import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { normalizeIdentityHandle } from "@/lib/server/role-resolver";
import {
  getSupabaseAdminClient,
  getSupabasePublicServerClient,
  getSupabaseServerClient,
} from "@/lib/supabase/server";
import {
  EMPTY_SUGGESTION_META,
  mergeAndOverlaySuggestions,
  mergeSuggestionMeta,
  sanitizeStoredSuggestion,
  sanitizeSuggestionMeta,
  type SuggestionModerationMeta,
} from "@/lib/suggestions-utils";
import type {
  SuggestionCategory,
  SuggestionStatus,
  UserSuggestionRecord,
} from "@/types/media";

const SUGGESTIONS_SITE_KEY = "user_suggestions_v1";
const SUGGESTIONS_META_SITE_KEY = "user_suggestions_meta_v1";
export const USER_SUGGESTIONS_STATS_KEY = "_shioriSuggestions";
export const CREATOR_SUGGESTION_META_STATS_KEY = "_shioriSuggestionMeta";

const CREATOR_HANDLE_SET = new Set<string>(["6t79", "enzolepg63"]);
const MAX_STORED_SUGGESTIONS = 300;
const MAX_PER_USER_SUGGESTIONS = 25;

const PROJECT_DATA_DIR = process.env.SHIORI_DATA_DIR
  ? path.resolve(process.env.SHIORI_DATA_DIR)
  : path.join(process.cwd(), ".shiori-data");
const TMP_DATA_DIR = path.join(os.tmpdir(), "shiori-data");

let resolvedDir: string | null = null;
const globalSugMem = globalThis as unknown as {
  __shioriSuggestionsCache?: {
    items: UserSuggestionRecord[];
    meta: SuggestionModerationMeta;
  };
};

interface LocalSuggestionsPayload {
  items: UserSuggestionRecord[];
  meta: SuggestionModerationMeta;
}

function getWritablePath(): string | null {
  if (resolvedDir) return path.join(resolvedDir, "suggestions.json");
  for (const dir of [PROJECT_DATA_DIR, TMP_DATA_DIR]) {
    try {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.accessSync(dir, fs.constants.W_OK);
      resolvedDir = dir;
      return path.join(dir, "suggestions.json");
    } catch {
      // try next candidate
    }
  }
  return null;
}

function readLocalStore(): LocalSuggestionsPayload {
  const filePath = getWritablePath();
  if (filePath && fs.existsSync(filePath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as {
        items?: unknown[];
        meta?: unknown;
      };
      const items = Array.isArray(parsed.items)
        ? parsed.items
            .map(sanitizeStoredSuggestion)
            .filter((x): x is UserSuggestionRecord => x !== null)
        : [];
      const meta = sanitizeSuggestionMeta(parsed.meta);
      globalSugMem.__shioriSuggestionsCache = { items, meta };
      return { items, meta };
    } catch {
      // ignore corrupt file
    }
  }
  return (
    globalSugMem.__shioriSuggestionsCache ?? {
      items: [],
      meta: { ...EMPTY_SUGGESTION_META },
    }
  );
}

function writeLocalStore(payload: LocalSuggestionsPayload): void {
  const trimmed: LocalSuggestionsPayload = {
    items: payload.items.slice(0, MAX_STORED_SUGGESTIONS),
    meta: payload.meta,
  };
  globalSugMem.__shioriSuggestionsCache = trimmed;
  const filePath = getWritablePath();
  if (!filePath) return;
  try {
    const tmp = `${filePath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(trimmed, null, 2), "utf8");
    fs.renameSync(tmp, filePath);
  } catch {
    // non-fatal on read-only FS
  }
}

function isUuid(val: string | null | undefined): val is string {
  return (
    typeof val === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)
  );
}

/**
 * Reads all user suggestions merged across:
 * 1) Local disk/memory cache
 * 2) Supabase `public.site_settings` (`user_suggestions_v1` + `user_suggestions_meta_v1`)
 * 3) Every user's `public.public_profiles.stats_summary._shioriSuggestions`
 *    & Creator's `_shioriSuggestionMeta` (works reliably even without service_role key!)
 */
export async function listAllSuggestions(): Promise<{
  suggestions: UserSuggestionRecord[];
  newCount: number;
  meta: SuggestionModerationMeta;
}> {
  const local = readLocalStore();
  const itemSources: UserSuggestionRecord[][] = [local.items];
  const metaSources: SuggestionModerationMeta[] = [local.meta];

  try {
    const client =
      getSupabaseAdminClient() ??
      (await getSupabaseServerClient()) ??
      getSupabasePublicServerClient();

    if (client) {
      // Source A: `public.site_settings`
      try {
        const { data: settingsRows } = await client
          .from("site_settings")
          .select("key, value")
          .in("key", [SUGGESTIONS_SITE_KEY, SUGGESTIONS_META_SITE_KEY]);

        if (Array.isArray(settingsRows)) {
          for (const row of settingsRows) {
            if (row.key === SUGGESTIONS_SITE_KEY && Array.isArray(row.value)) {
              const items = row.value
                .map(sanitizeStoredSuggestion)
                .filter((x): x is UserSuggestionRecord => x !== null);
              itemSources.push(items);
            } else if (row.key === SUGGESTIONS_META_SITE_KEY && row.value) {
              metaSources.push(sanitizeSuggestionMeta(row.value));
            }
          }
        }
      } catch {
        // non-fatal
      }

      // Source B: `public.public_profiles.stats_summary`
      try {
        const { data: pubRows } = await client
          .from("public_profiles")
          .select("username, display_name, role, stats_summary")
          .limit(500);

        if (Array.isArray(pubRows)) {
          for (const row of pubRows) {
            const summary = row.stats_summary;
            if (!summary || typeof summary !== "object") continue;
            const summaryObj = summary as Record<string, unknown>;

            if (Array.isArray(summaryObj[USER_SUGGESTIONS_STATS_KEY])) {
              const userItems = (summaryObj[USER_SUGGESTIONS_STATS_KEY] as unknown[])
                .map(sanitizeStoredSuggestion)
                .filter((x): x is UserSuggestionRecord => x !== null);
              if (userItems.length > 0) itemSources.push(userItems);
            }

            const unameNorm = normalizeIdentityHandle(String(row.username || ""));
            const dnameNorm = normalizeIdentityHandle(String(row.display_name || ""));
            const isCreatorRow =
              row.role === "creator" ||
              CREATOR_HANDLE_SET.has(unameNorm) ||
              CREATOR_HANDLE_SET.has(dnameNorm);
            if (isCreatorRow && summaryObj[CREATOR_SUGGESTION_META_STATS_KEY]) {
              metaSources.push(
                sanitizeSuggestionMeta(summaryObj[CREATOR_SUGGESTION_META_STATS_KEY])
              );
            }
          }
        }
      } catch {
        // non-fatal
      }
    }
  } catch {
    // non-fatal
  }

  const mergedMeta = mergeSuggestionMeta(...metaSources);
  const suggestions = mergeAndOverlaySuggestions(itemSources, mergedMeta);
  const newCount = suggestions.filter((s) => s.status === "new").length;
  return { suggestions, newCount, meta: mergedMeta };
}

/**
 * Persists a newly submitted suggestion across local disk, Supabase `site_settings`
 * (when service_role / creator access is available), and the submitting user's own
 * `profiles.stats_summary._shioriSuggestions` (always RLS-allowed for authenticated members).
 */
export async function createUserSuggestion(input: {
  userId: string | null;
  username: string | null;
  displayName: string;
  avatarUrl: string | null;
  accentColor?: string | null;
  category: SuggestionCategory;
  title: string;
  message: string;
  device: "mobile" | "desktop";
  pagePath: string | null;
}): Promise<{ suggestion: UserSuggestionRecord; persistedToCloud: boolean }> {
  const nowIso = new Date().toISOString();
  const suggestion: UserSuggestionRecord = {
    id: `sug-${crypto.randomUUID()}`,
    userId: input.userId,
    username: input.username,
    displayName: input.displayName || "Invité",
    avatarUrl: input.avatarUrl,
    accentColor: input.accentColor ?? null,
    category: input.category,
    title: input.title,
    message: input.message,
    device: input.device,
    pagePath: input.pagePath,
    status: "new",
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  // 1) Local store
  const local = readLocalStore();
  writeLocalStore({
    items: [suggestion, ...local.items].slice(0, MAX_STORED_SUGGESTIONS),
    meta: local.meta,
  });

  let persistedToCloud = false;

  try {
    const adminClient = getSupabaseAdminClient();
    const userClient = await getSupabaseServerClient();

    // 2) If service_role is available, append to `public.site_settings` (`user_suggestions_v1`)
    if (adminClient) {
      try {
        const { data: existingRow } = await adminClient
          .from("site_settings")
          .select("value")
          .eq("key", SUGGESTIONS_SITE_KEY)
          .maybeSingle();

        const existingItems = Array.isArray(existingRow?.value)
          ? existingRow.value
              .map(sanitizeStoredSuggestion)
              .filter((x): x is UserSuggestionRecord => x !== null)
          : [];

        const nextItems = [suggestion, ...existingItems].slice(0, MAX_STORED_SUGGESTIONS);
        const { error } = await adminClient.from("site_settings").upsert(
          {
            key: SUGGESTIONS_SITE_KEY,
            value: nextItems,
            updated_by: isUuid(input.userId) ? input.userId : null,
            updated_at: nowIso,
          },
          { onConflict: "key" }
        );
        if (!error) persistedToCloud = true;
      } catch {
        // non-fatal
      }
    }

    // 3) Always mirror into the submitting authenticated user's own `profiles.stats_summary._shioriSuggestions`
    const profileClient = adminClient ?? userClient;
    if (profileClient && isUuid(input.userId)) {
      try {
        const { data: profileRow } = await profileClient
          .from("profiles")
          .select("stats_summary")
          .eq("id", input.userId)
          .maybeSingle();

        const currentSummary =
          profileRow?.stats_summary && typeof profileRow.stats_summary === "object"
            ? (profileRow.stats_summary as Record<string, unknown>)
            : {};

        const prevMine = Array.isArray(currentSummary[USER_SUGGESTIONS_STATS_KEY])
          ? (currentSummary[USER_SUGGESTIONS_STATS_KEY] as unknown[])
              .map(sanitizeStoredSuggestion)
              .filter((x): x is UserSuggestionRecord => x !== null)
          : [];

        const nextMine = [suggestion, ...prevMine].slice(0, MAX_PER_USER_SUGGESTIONS);

        const { data: updated, error } = await profileClient
          .from("profiles")
          .update({
            stats_summary: {
              ...currentSummary,
              [USER_SUGGESTIONS_STATS_KEY]: nextMine,
            },
          })
          .eq("id", input.userId)
          .select("id");

        if (!error && Array.isArray(updated) && updated.length > 0) {
          persistedToCloud = true;
        }
      } catch {
        // non-fatal
      }
    }
  } catch {
    // local store already persisted
  }

  return { suggestion, persistedToCloud };
}

/**
 * Creator-only mutation: updates a suggestion's status (`new | planned | done | archived`)
 * or deletes it, persisting durably across local disk, `site_settings`, and Creator's own profile.
 */
export async function mutateSuggestionAsCreator(input: {
  creatorUserId: string;
  suggestionId: string;
  action: "set_status" | "delete";
  status?: SuggestionStatus;
}): Promise<{
  suggestions: UserSuggestionRecord[];
  newCount: number;
  persistedToCloud: boolean;
}> {
  const { suggestions: currentItems, meta: currentMeta } = await listAllSuggestions();
  const nowIso = new Date().toISOString();

  const nextMeta: SuggestionModerationMeta = {
    statusById: { ...currentMeta.statusById },
    deletedIds: [...currentMeta.deletedIds],
    updatedAt: nowIso,
  };

  if (input.action === "delete") {
    if (!nextMeta.deletedIds.includes(input.suggestionId)) {
      nextMeta.deletedIds.push(input.suggestionId);
    }
    delete nextMeta.statusById[input.suggestionId];
  } else if (input.status) {
    nextMeta.statusById[input.suggestionId] = {
      status: input.status,
      updatedAt: nowIso,
    };
  }

  const nextItems = mergeAndOverlaySuggestions([currentItems], nextMeta);
  writeLocalStore({ items: nextItems, meta: nextMeta });

  let persistedToCloud = false;
  try {
    const client = getSupabaseAdminClient() ?? (await getSupabaseServerClient());
    if (client) {
      // 1) Try `public.site_settings` (meta + compacted list)
      try {
        const { error: metaErr } = await client.from("site_settings").upsert(
          {
            key: SUGGESTIONS_META_SITE_KEY,
            value: nextMeta,
            updated_by: isUuid(input.creatorUserId) ? input.creatorUserId : null,
            updated_at: nowIso,
          },
          { onConflict: "key" }
        );
        const { error: listErr } = await client.from("site_settings").upsert(
          {
            key: SUGGESTIONS_SITE_KEY,
            value: nextItems.slice(0, MAX_STORED_SUGGESTIONS),
            updated_by: isUuid(input.creatorUserId) ? input.creatorUserId : null,
            updated_at: nowIso,
          },
          { onConflict: "key" }
        );
        if (!metaErr || !listErr) persistedToCloud = true;
      } catch {
        // handled by mirror below
      }

      // 2) Always mirror Creator moderation metadata into Creator's own profile
      if (isUuid(input.creatorUserId)) {
        try {
          const { data: creatorRow } = await client
            .from("profiles")
            .select("stats_summary")
            .eq("id", input.creatorUserId)
            .maybeSingle();

          const currentSummary =
            creatorRow?.stats_summary && typeof creatorRow.stats_summary === "object"
              ? (creatorRow.stats_summary as Record<string, unknown>)
              : {};

          const { data: updated, error } = await client
            .from("profiles")
            .update({
              stats_summary: {
                ...currentSummary,
                [CREATOR_SUGGESTION_META_STATS_KEY]: nextMeta,
              },
            })
            .eq("id", input.creatorUserId)
            .select("id");

          if (!error && Array.isArray(updated) && updated.length > 0) {
            persistedToCloud = true;
          }
        } catch {
          // non-fatal
        }
      }
    }
  } catch {
    // local store already persisted
  }

  return {
    suggestions: nextItems,
    newCount: nextItems.filter((s) => s.status === "new").length,
    persistedToCloud,
  };
}
