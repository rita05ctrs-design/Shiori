import fs from "fs";
import os from "os";
import path from "path";
import { ADMIN_GRANTABLE_BADGE_IDS } from "@/lib/badges";
import { normalizeIdentityHandle } from "@/lib/server/role-resolver";
import { getSupabaseAdminClient, getSupabaseServerClient } from "@/lib/supabase/server";
import type { UnlockedBadgeRecord } from "@/types/media";
import {
  applyAdminGrantRole,
  applyAdminGrantsToBadges,
  type AdminGrantsLedger,
  type AdminUserGrantEntry,
} from "@/lib/admin-grants-utils";

export {
  applyAdminGrantRole,
  applyAdminGrantsToBadges,
  type AdminGrantsLedger,
  type AdminUserGrantEntry,
};

const ADMIN_GRANTS_SITE_KEY = "admin_grants_v1";
export const ADMIN_GRANTS_STATS_KEY = "_shioriAdminGrants";

const GRANTABLE_SET = new Set<string>(ADMIN_GRANTABLE_BADGE_IDS);
const CREATOR_HANDLE_SET = new Set<string>(["6t79", "enzolepg63"]);

const PROJECT_DATA_DIR = process.env.SHIORI_DATA_DIR
  ? path.resolve(process.env.SHIORI_DATA_DIR)
  : path.join(process.cwd(), ".shiori-data");
const TMP_DATA_DIR = path.join(os.tmpdir(), "shiori-data");

let resolvedGrantsDir: string | null = null;
const globalGrantsMem = globalThis as unknown as {
  __shioriAdminGrantsCache?: AdminGrantsLedger;
};

function getWritableGrantsPath(): string | null {
  if (resolvedGrantsDir) {
    return path.join(resolvedGrantsDir, "admin-grants.json");
  }
  for (const dir of [PROJECT_DATA_DIR, TMP_DATA_DIR]) {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.accessSync(dir, fs.constants.W_OK);
      resolvedGrantsDir = dir;
      return path.join(dir, "admin-grants.json");
    } catch {
      // try next candidate
    }
  }
  return null;
}

function sanitizeGrantEntry(raw: unknown): AdminUserGrantEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const grantedBadges: UnlockedBadgeRecord[] = [];
  const seenGranted = new Set<string>();
  if (Array.isArray(obj.grantedBadges)) {
    for (const item of obj.grantedBadges) {
      if (
        item &&
        typeof item === "object" &&
        typeof (item as { badgeId?: unknown }).badgeId === "string"
      ) {
        const badgeId = String((item as { badgeId: string }).badgeId).trim();
        if (GRANTABLE_SET.has(badgeId) && !seenGranted.has(badgeId)) {
          seenGranted.add(badgeId);
          grantedBadges.push({
            badgeId,
            unlockedAt:
              typeof (item as { unlockedAt?: unknown }).unlockedAt === "string"
                ? String((item as { unlockedAt: string }).unlockedAt)
                : new Date().toISOString(),
          });
        }
      }
    }
  }
  const revokedBadgeIds: string[] = Array.isArray(obj.revokedBadgeIds)
    ? Array.from(
        new Set(
          obj.revokedBadgeIds
            .filter((x): x is string => typeof x === "string")
            .map((x) => x.trim())
            .filter((x) => GRANTABLE_SET.has(x) && !seenGranted.has(x))
        )
      )
    : [];
  const role =
    obj.role === "moderator" || obj.role === "user" ? obj.role : undefined;
  const updatedAt =
    typeof obj.updatedAt === "string" && obj.updatedAt
      ? obj.updatedAt
      : new Date(0).toISOString();

  return {
    grantedBadges,
    revokedBadgeIds,
    ...(role ? { role } : {}),
    updatedAt,
  };
}

function sanitizeLedger(raw: unknown): AdminGrantsLedger {
  const empty: AdminGrantsLedger = { users: {}, updatedAt: new Date(0).toISOString() };
  if (!raw || typeof raw !== "object") return empty;
  const obj = raw as Record<string, unknown>;
  const usersRaw = obj.users && typeof obj.users === "object" ? (obj.users as Record<string, unknown>) : {};
  const users: Record<string, AdminUserGrantEntry> = {};
  for (const [uid, entryRaw] of Object.entries(usersRaw)) {
    const cleanUid = uid.trim();
    if (!cleanUid) continue;
    const entry = sanitizeGrantEntry(entryRaw);
    if (entry) users[cleanUid] = entry;
  }
  return {
    users,
    updatedAt: typeof obj.updatedAt === "string" && obj.updatedAt ? obj.updatedAt : empty.updatedAt,
  };
}

function mergeLedgers(...ledgers: AdminGrantsLedger[]): AdminGrantsLedger {
  const users: Record<string, AdminUserGrantEntry> = {};
  let latestUpdated = new Date(0).toISOString();

  for (const ledger of ledgers) {
    if (ledger.updatedAt > latestUpdated) latestUpdated = ledger.updatedAt;
    for (const [uid, entry] of Object.entries(ledger.users)) {
      const existing = users[uid];
      if (!existing || entry.updatedAt >= existing.updatedAt) {
        users[uid] = entry;
      }
    }
  }

  return { users, updatedAt: latestUpdated };
}

function readLocalGrantsLedger(): AdminGrantsLedger {
  const filePath = getWritableGrantsPath();
  if (filePath && fs.existsSync(filePath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
      const clean = sanitizeLedger(parsed);
      globalGrantsMem.__shioriAdminGrantsCache = clean;
      return clean;
    } catch {
      // ignore corrupt file
    }
  }
  return globalGrantsMem.__shioriAdminGrantsCache ?? { users: {}, updatedAt: new Date(0).toISOString() };
}

function writeLocalGrantsLedger(ledger: AdminGrantsLedger) {
  globalGrantsMem.__shioriAdminGrantsCache = ledger;
  const filePath = getWritableGrantsPath();
  if (!filePath) return;
  try {
    const tmp = `${filePath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(ledger, null, 2), "utf8");
    fs.renameSync(tmp, filePath);
  } catch {
    // non-fatal on read-only serverless FS
  }
}

/**
 * Reads the authoritative admin-grants ledger merged across:
 * 1) Local disk / memory cache
 * 2) Supabase `public.site_settings` (`key = 'admin_grants_v1'`)
 * 3) Creator's `public.public_profiles.stats_summary._shioriAdminGrants` (RLS-safe cloud fallback
 *    that works even without `SUPABASE_SERVICE_ROLE_KEY` or custom SQL migrations!)
 */
export async function readAdminGrantsLedger(): Promise<AdminGrantsLedger> {
  const localLedger = readLocalGrantsLedger();
  const candidates: AdminGrantsLedger[] = [localLedger];

  try {
    const supabase = getSupabaseAdminClient() ?? (await getSupabaseServerClient());
    if (supabase) {
      // Source A: `site_settings` row
      try {
        const { data } = await supabase
          .from("site_settings")
          .select("value")
          .eq("key", ADMIN_GRANTS_SITE_KEY)
          .maybeSingle();
        if (data?.value) {
          candidates.push(sanitizeLedger(data.value));
        }
      } catch {
        // table may not exist yet
      }

      // Source B: Creator profile's `stats_summary._shioriAdminGrants` via `public_profiles`
      try {
        const { data: pubRows } = await supabase
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
            if (summary && typeof summary === "object" && ADMIN_GRANTS_STATS_KEY in summary) {
              candidates.push(
                sanitizeLedger((summary as Record<string, unknown>)[ADMIN_GRANTS_STATS_KEY])
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

  const merged = mergeLedgers(...candidates);
  globalGrantsMem.__shioriAdminGrantsCache = merged;
  return merged;
}

/**
 * Applies a special badge grant/revocation or role change to the durable admin-grants ledger
 * and persists it to disk + Supabase (`site_settings` AND creator's own `profiles.stats_summary`).
 */
export async function saveAdminGrantPatch(input: {
  targetUserId: string;
  creatorUserId: string;
  grantBadgeId?: string;
  revokeBadgeId?: string;
  role?: "user" | "moderator";
}): Promise<{
  ledger: AdminGrantsLedger;
  entry: AdminUserGrantEntry;
  persistedToCloud: boolean;
}> {
  const currentLedger = await readAdminGrantsLedger();
  const prev = currentLedger.users[input.targetUserId] ?? {
    grantedBadges: [],
    revokedBadgeIds: [],
    updatedAt: new Date(0).toISOString(),
  };

  const nowIso = new Date().toISOString();
  const grantedMap = new Map<string, UnlockedBadgeRecord>();
  for (const b of prev.grantedBadges) {
    if (GRANTABLE_SET.has(b.badgeId)) grantedMap.set(b.badgeId, b);
  }
  const revokedSet = new Set<string>(
    prev.revokedBadgeIds.filter((id) => GRANTABLE_SET.has(id))
  );

  if (input.grantBadgeId && GRANTABLE_SET.has(input.grantBadgeId)) {
    revokedSet.delete(input.grantBadgeId);
    if (!grantedMap.has(input.grantBadgeId)) {
      grantedMap.set(input.grantBadgeId, {
        badgeId: input.grantBadgeId,
        unlockedAt: nowIso,
      });
    }
  }

  if (input.revokeBadgeId && GRANTABLE_SET.has(input.revokeBadgeId)) {
    grantedMap.delete(input.revokeBadgeId);
    revokedSet.add(input.revokeBadgeId);
  }

  const nextEntry: AdminUserGrantEntry = {
    grantedBadges: Array.from(grantedMap.values()),
    revokedBadgeIds: Array.from(revokedSet),
    ...(input.role !== undefined
      ? { role: input.role }
      : prev.role !== undefined
        ? { role: prev.role }
        : {}),
    updatedAt: nowIso,
  };

  const nextLedger: AdminGrantsLedger = {
    users: {
      ...currentLedger.users,
      [input.targetUserId]: nextEntry,
    },
    updatedAt: nowIso,
  };

  writeLocalGrantsLedger(nextLedger);

  let persistedToCloud = false;
  const isCreatorUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      input.creatorUserId
    );

  try {
    const supabase = getSupabaseAdminClient() ?? (await getSupabaseServerClient());
    if (supabase) {
      // 1) Try `public.site_settings`
      try {
        const { error } = await supabase.from("site_settings").upsert(
          {
            key: ADMIN_GRANTS_SITE_KEY,
            value: nextLedger,
            updated_by: isCreatorUuid ? input.creatorUserId : null,
            updated_at: nowIso,
          },
          { onConflict: "key" }
        );
        if (!error) persistedToCloud = true;
      } catch {
        // RLS or missing table — handled cleanly by step 2 below
      }

      // 2) Always mirror into Creator's own `profiles.stats_summary._shioriAdminGrants`
      //    (auth.uid() = id ALWAYS passes Supabase RLS even without service_role key!)
      if (isCreatorUuid) {
        try {
          const { data: creatorRow } = await supabase
            .from("profiles")
            .select("stats_summary")
            .eq("id", input.creatorUserId)
            .maybeSingle();

          const currentSummary =
            creatorRow?.stats_summary && typeof creatorRow.stats_summary === "object"
              ? (creatorRow.stats_summary as Record<string, unknown>)
              : {};

          const { data: updatedCreator, error: mirrorErr } = await supabase
            .from("profiles")
            .update({
              stats_summary: {
                ...currentSummary,
                [ADMIN_GRANTS_STATS_KEY]: nextLedger,
              },
            })
            .eq("id", input.creatorUserId)
            .select("id");

          if (!mirrorErr && Array.isArray(updatedCreator) && updatedCreator.length > 0) {
            persistedToCloud = true;
          }
        } catch {
          // non-fatal
        }
      }
    }
  } catch {
    // local ledger already persisted
  }

  return { ledger: nextLedger, entry: nextEntry, persistedToCloud };
}
