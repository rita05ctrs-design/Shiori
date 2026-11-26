import fs from "fs";
import os from "os";
import path from "path";
import type { SiteConfig } from "@/types/media";
import { getSupabaseAdminClient, getSupabaseServerClient } from "@/lib/supabase/server";
import {
  DEFAULT_SITE_CONFIG,
  sanitizeCtaHref,
  sanitizeSiteConfigInput,
} from "@/lib/site-config-utils";

export { DEFAULT_SITE_CONFIG, sanitizeCtaHref, sanitizeSiteConfigInput };

const SITE_SETTINGS_KEY = "global_config";

const PROJECT_DATA_DIR = process.env.SHIORI_DATA_DIR
  ? path.resolve(process.env.SHIORI_DATA_DIR)
  : path.join(process.cwd(), ".shiori-data");
const TMP_DATA_DIR = path.join(os.tmpdir(), "shiori-data");

let resolvedConfigDir: string | null = null;
const globalConfigMem = globalThis as unknown as {
  __shioriSiteConfigCache?: SiteConfig;
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

function readLocalSiteConfig(): SiteConfig | null {
  const filePath = getWritableConfigPath();
  if (filePath && fs.existsSync(filePath)) {
    try {
      const raw = fs.readFileSync(filePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<SiteConfig>;
      const merged = sanitizeSiteConfigInput(
        {
          announcement: parsed.announcement,
          featuredHero: parsed.featuredHero,
        },
        DEFAULT_SITE_CONFIG,
        parsed.featuredHero?.media ?? null
      );
      merged.updatedAt = parsed.updatedAt || merged.updatedAt;
      merged.updatedBy = parsed.updatedBy ?? null;
      globalConfigMem.__shioriSiteConfigCache = merged;
      return merged;
    } catch {
      // ignore corrupt file
    }
  }
  return globalConfigMem.__shioriSiteConfigCache ?? null;
}

function writeLocalSiteConfig(config: SiteConfig) {
  globalConfigMem.__shioriSiteConfigCache = config;
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

export async function getSiteConfig(): Promise<SiteConfig> {
  // 1) Try Supabase `public.site_settings`
  try {
    const client = getSupabaseAdminClient() ?? (await getSupabaseServerClient());
    if (client) {
      const { data, error } = await client
        .from("site_settings")
        .select("value, updated_at, updated_by")
        .eq("key", SITE_SETTINGS_KEY)
        .maybeSingle();

      if (!error && data?.value && typeof data.value === "object") {
        const val = data.value as Partial<SiteConfig>;
        const hydrated = sanitizeSiteConfigInput(
          {
            announcement: val.announcement,
            featuredHero: val.featuredHero,
          },
          DEFAULT_SITE_CONFIG,
          val.featuredHero?.media ?? null
        );
        hydrated.updatedAt = String(data.updated_at || val.updatedAt || hydrated.updatedAt);
        hydrated.updatedBy =
          (val.updatedBy as string | null) ?? (data.updated_by as string | null) ?? null;
        globalConfigMem.__shioriSiteConfigCache = hydrated;
        return hydrated;
      }
    }
  } catch {
    // Gracefully fall back if Supabase isn't configured or table isn't migrated yet
  }

  // 2) Fall back to local JSON / memory cache / defaults
  return readLocalSiteConfig() ?? DEFAULT_SITE_CONFIG;
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
  try {
    const client = getSupabaseAdminClient() ?? (await getSupabaseServerClient());
    if (client) {
      const isUuid =
        typeof updatedByUserId === "string" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          updatedByUserId
        );

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
    }
  } catch {
    // local JSON cache still succeeded
  }

  return { config: stamped, persistedToSupabase };
}
