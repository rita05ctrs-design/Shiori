import fs from "fs";
import os from "os";
import path from "path";
import type { SiteConfig } from "@/types/media";
import { normalizeIdentityHandle } from "@/lib/server/role-resolver";
import {
  getSupabaseAdminClient,
  getSupabasePublicServerClient,
  getSupabaseServerClient,
} from "@/lib/supabase/server";
import {
  DEFAULT_SITE_CONFIG,
  sanitizeCtaHref,
  sanitizeSiteConfigInput,
} from "@/lib/site-config-utils";

export { DEFAULT_SITE_CONFIG, sanitizeCtaHref, sanitizeSiteConfigInput };

const SITE_SETTINGS_KEY = "global_config";
export const SITE_CONFIG_STATS_KEY = "_shioriSiteConfig";
const SITE_CONFIG_TTL_MS = 15_000;
const CREATOR_HANDLE_SET = new Set<string>(["6t79", "enzolepg63"]);

const PROJECT_DATA_DIR = process.env.SHIORI_DATA_DIR
  ? path.resolve(process.env.SHIORI_DATA_DIR)
  : path.join(process.cwd(), ".shiori-data");
const TMP_DATA_DIR = path.join(os.tmpdir(), "shiori-data");

let resolvedConfigDir: string | null = null;
const globalConfigMem = globalThis as unknown as {
  __shioriSiteConfigCache?: SiteConfig;
  __shioriSiteConfigFetchedAt?: number;
};

function getWritableConfigPath(): string | null {
  if (resolvedConfigDir) {
    return path.join(resolvedConfigDir, "site-config.json");
  }
  for (const dir of [PROJECT_DATA_DIR, TMP_DATA_DIR]) {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.accessSync(dir, fs.constants.W_OK);
      resolvedConfigDir = dir;
      return path.join(dir, "site-config.json");
    } catch {
      // try next directory
    }
  }
  return null;
}

function hydrateRawConfig(
  raw: unknown,
  fallbackUpdatedAt?: string | null,
  fallbackUpdatedBy?: string | null
): SiteConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const val = raw as Partial<SiteConfig>;
  const hydrated = sanitizeSiteConfigInput(
    {
      announcement: val.announcement,
      featuredHero: val.featuredHero,
    },
    DEFAULT_SITE_CONFIG,
    val.featuredHero?.media ?? null
  );
  hydrated.updatedAt = String(
    val.updatedAt || fallbackUpdatedAt || DEFAULT_SITE_CONFIG.updatedAt
  );
  hydrated.updatedBy =
    (val.updatedBy as string | null) ?? fallbackUpdatedBy ?? null;
  return hydrated;
}

function pickNewestConfig(candidates: SiteConfig[]): SiteConfig {
  if (candidates.length === 0) return DEFAULT_SITE_CONFIG;
  let winner = candidates[0];
  let winnerMs = Date.parse(winner.updatedAt) || 0;
  for (let i = 1; i < candidates.length; i++) {
    const cur = candidates[i];
    const curMs = Date.parse(cur.updatedAt) || 0;
    if (curMs > winnerMs) {
      winner = cur;
      winnerMs = curMs;
    }
  }
  return winner;
}

function readLocalSiteConfig(): SiteConfig | null {
  const filePath = getWritableConfigPath();
  if (filePath && fs.existsSync(filePath)) {
    try {
      const raw = fs.readFileSync(filePath, "utf8");
      const parsed = JSON.parse(raw);
      const hydrated = hydrateRawConfig(parsed);
      if (hydrated) {
        globalConfigMem.__shioriSiteConfigCache = hydrated;
        return hydrated;
      }
    } catch {
      // ignore corrupt file
    }
  }
  return globalConfigMem.__shioriSiteConfigCache ?? null;
}

function writeLocalSiteConfig(config: SiteConfig) {
  globalConfigMem.__shioriSiteConfigCache = config;
  globalConfigMem.__shioriSiteConfigFetchedAt = Date.now();
  const filePath = getWritableConfigPath();
  if (!filePath) return;
  try {
    const tmp = `${filePath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(config, null, 2), "utf8");
    fs.renameSync(tmp, filePath);
  } catch {
    // non-fatal on read-only FS
  }
}

export async function getSiteConfig(options?: {
  bypassCache?: boolean;
}): Promise<SiteConfig> {
  if (
    !options?.bypassCache &&
    globalConfigMem.__shioriSiteConfigCache &&
    globalConfigMem.__shioriSiteConfigFetchedAt &&
    Date.now() - globalConfigMem.__shioriSiteConfigFetchedAt < SITE_CONFIG_TTL_MS
  ) {
    return globalConfigMem.__shioriSiteConfigCache;
  }

  const candidates: SiteConfig[] = [];
  const localCfg = readLocalSiteConfig();
  if (localCfg) candidates.push(localCfg);

  // Use cookie-less client so ISR routes (e.g. Home) remain static/cached
  try {
    const client = getSupabaseAdminClient() ?? getSupabasePublicServerClient();
    if (client) {
      // Source A: `public.site_settings`
      try {
        const { data, error } = await client
          .from("site_settings")
          .select("value, updated_at, updated_by")
          .eq("key", SITE_SETTINGS_KEY)
          .maybeSingle();

        if (!error && data?.value) {
          const hydrated = hydrateRawConfig(
            data.value,
            data.updated_at ? String(data.updated_at) : null,
            data.updated_by ? String(data.updated_by) : null
          );
          if (hydrated) candidates.push(hydrated);
        }
      } catch {
        // table may not exist or RLS blocked
      }

      // Source B: Creator profile's `public_profiles.stats_summary._shioriSiteConfig`
      // (RLS-safe cloud fallback that works even without service_role key or site_settings migration)
      try {
        const { data: pubRows } = await client
          .from("public_profiles")
          .select("username, display_name, role, stats_summary")
          .limit(300);

        if (Array.isArray(pubRows)) {
          for (const row of pubRows) {
            const unameNorm = normalizeIdentityHandle(String(row.username || ""));
            const dnameNorm = normalizeIdentityHandle(String(row.display_name || ""));
            const isCreatorRow =
              row.role === "creator" ||
              CREATOR_HANDLE_SET.has(unameNorm) ||
              CREATOR_HANDLE_SET.has(dnameNorm);
            if (!isCreatorRow) continue;
            const summary = row.stats_summary;
            if (summary && typeof summary === "object" && SITE_CONFIG_STATS_KEY in summary) {
              const hydrated = hydrateRawConfig(
                (summary as Record<string, unknown>)[SITE_CONFIG_STATS_KEY]
              );
              if (hydrated) candidates.push(hydrated);
            }
          }
        }
      } catch {
        // non-fatal
      }
    }
  } catch {
    // Gracefully fall back if Supabase isn't configured
  }

  const newest = pickNewestConfig(candidates);
  globalConfigMem.__shioriSiteConfigCache = newest;
  globalConfigMem.__shioriSiteConfigFetchedAt = Date.now();
  return newest;
}

export async function saveSiteConfig(
  nextConfig: SiteConfig,
  updatedByUserId?: string | null
): Promise<{ config: SiteConfig; persistedToSupabase: boolean }> {
  const stamped: SiteConfig = {
    ...nextConfig,
    updatedAt: new Date().toISOString(),
    updatedBy: updatedByUserId ?? nextConfig.updatedBy ?? null,
  };

  writeLocalSiteConfig(stamped);

  let persistedToSupabase = false;
  const isUuid =
    typeof updatedByUserId === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      updatedByUserId
    );

  try {
    const client = getSupabaseAdminClient() ?? (await getSupabaseServerClient());
    if (client) {
      // 1) Try `public.site_settings`
      try {
        const { error } = await client.from("site_settings").upsert(
          {
            key: SITE_SETTINGS_KEY,
            value: stamped,
            updated_by: isUuid ? updatedByUserId : null,
            updated_at: stamped.updatedAt,
          },
          { onConflict: "key" }
        );
        if (!error) {
          persistedToSupabase = true;
        }
      } catch {
        // RLS or missing table — handled cleanly by mirror below
      }

      // 2) Always mirror into Creator's own `profiles.stats_summary._shioriSiteConfig`
      //    (auth.uid() = id ALWAYS passes Supabase RLS even without service_role key!)
      if (isUuid && updatedByUserId) {
        try {
          const { data: creatorRow } = await client
            .from("profiles")
            .select("stats_summary")
            .eq("id", updatedByUserId)
            .maybeSingle();

          const currentSummary =
            creatorRow?.stats_summary && typeof creatorRow.stats_summary === "object"
              ? (creatorRow.stats_summary as Record<string, unknown>)
              : {};

          const { data: updatedRows, error: mirrorErr } = await client
            .from("profiles")
            .update({
              stats_summary: {
                ...currentSummary,
                [SITE_CONFIG_STATS_KEY]: stamped,
              },
            })
            .eq("id", updatedByUserId)
            .select("id");

          if (!mirrorErr && Array.isArray(updatedRows) && updatedRows.length > 0) {
            persistedToSupabase = true;
          }
        } catch {
          // non-fatal
        }
      }
    }
  } catch {
    // local JSON cache still succeeded
  }

  return { config: stamped, persistedToSupabase };
}
