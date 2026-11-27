import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  readAccountDb,
  SESSION_COOKIE_NAME,
  verifySessionToken,
  writeAccountDb,
} from "@/lib/server/auth-store";
import { normalizeRole, resolveEffectiveRole } from "@/lib/server/role-resolver";
import type {
  ActivityCommentItem,
  CommunityActivityItem,
  ContentReportRecord,
  DirectMessageItem,
  FriendshipRecord,
  PublicUserProfile,
  UnlockedBadgeRecord,
  UserBlockRecord,
  UserRole,
} from "@/types/media";

const PROJECT_DATA_DIR = process.env.SHIORI_DATA_DIR
  ? path.resolve(process.env.SHIORI_DATA_DIR)
  : path.join(process.cwd(), ".shiori-data");
const TMP_DATA_DIR = path.join(os.tmpdir(), "shiori-data");

let resolvedDataDir: string | null = null;
const globalMemory = globalThis as unknown as {
  __shioriSocialDbCache?: SocialDatabase;
};

function getWritableSocialPath(): string | null {
  if (resolvedDataDir) {
    return path.join(resolvedDataDir, "social.json");
  }
  for (const dir of [PROJECT_DATA_DIR, TMP_DATA_DIR]) {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.accessSync(dir, fs.constants.W_OK);
      resolvedDataDir = dir;
      return path.join(dir, "social.json");
    } catch {
      // try next candidate (e.g. /tmp on Vercel serverless)
    }
  }
  return null;
}

export interface SocialDatabase {
  profiles: PublicUserProfile[];
  activities: CommunityActivityItem[];
  messages: DirectMessageItem[];
  friendships: FriendshipRecord[];
  blocks?: UserBlockRecord[];
  reports?: ContentReportRecord[];
}

const SEED_BOT_IDS = new Set<string>([
  "community-sora",
  "community-ren",
  "community-hana",
  "local-curator",
]);

const SEED_BOT_USERNAMES = new Set<string>([
  "sora_kyoto",
  "ren_seinen",
  "hana_sakura",
  "kuro_shiori",
]);

export function isSeedBotAccount(input: {
  id?: string | null;
  username?: string | null;
  source?: string | null;
}): boolean {
  const id = (input.id ?? "").trim().toLowerCase();
  const username = (input.username ?? "").trim().toLowerCase();
  if (input.source === "community") return true;
  if (id && (SEED_BOT_IDS.has(id) || id.startsWith("community-"))) return true;
  if (username && SEED_BOT_USERNAMES.has(username)) return true;
  return false;
}

export function isSeedBotRecordId(id?: string | null): boolean {
  if (!id) return false;
  return (
    id.startsWith("act-seed-") ||
    id.startsWith("cmt-seed-") ||
    id.startsWith("dm-seed-")
  );
}

function createEmptySocialDb(): SocialDatabase {
  return {
    profiles: [],
    activities: [],
    messages: [],
    friendships: [],
    blocks: [],
    reports: [],
  };
}

function purgeSeedBotsFromDb(db: SocialDatabase): { db: SocialDatabase; changed: boolean } {
  let changed = false;

  const profiles = db.profiles.filter((p) => {
    const bot = isSeedBotAccount(p);
    if (bot) changed = true;
    return !bot;
  });

  const activities = db.activities
    .filter((a) => {
      const bot =
        isSeedBotRecordId(a.id) ||
        isSeedBotAccount({ id: a.userId, username: a.actorUsername });
      if (bot) changed = true;
      return !bot;
    })
    .map((a) => {
      const nextLikes = a.likes.filter((uid) => !isSeedBotAccount({ id: uid }));
      const nextComments = a.comments.filter(
        (c) =>
          !isSeedBotRecordId(c.id) &&
          !isSeedBotAccount({ id: c.userId, username: c.authorUsername })
      );
      if (nextLikes.length !== a.likes.length || nextComments.length !== a.comments.length) {
        changed = true;
        return { ...a, likes: nextLikes, comments: nextComments };
      }
      return a;
    });

  const messages = db.messages.filter((m) => {
    const bot =
      isSeedBotRecordId(m.id) ||
      isSeedBotAccount({ id: m.senderId, username: m.senderUsername }) ||
      isSeedBotAccount({ id: m.recipientId, username: m.recipientUsername });
    if (bot) changed = true;
    return !bot;
  });

  const friendships = db.friendships.filter((f) => {
    const bot =
      isSeedBotAccount({ id: f.requesterId, username: f.requesterUsername }) ||
      isSeedBotAccount({ id: f.addresseeId, username: f.addresseeUsername });
    if (bot) changed = true;
    return !bot;
  });

  return {
    changed,
    db: {
      ...db,
      profiles,
      activities,
      messages,
      friendships,
    },
  };
}

export function isLocalPairBlocked(userAId: string, userBId: string): boolean {
  const db = readSocialDb();
  const blocks = db.blocks ?? [];
  return blocks.some(
    (b) =>
      (b.blockerId === userAId && b.blockedId === userBId) ||
      (b.blockerId === userBId && b.blockedId === userAId)
  );
}

export function readSocialDb(): SocialDatabase {
  const filePath = getWritableSocialPath();
  if (filePath && fs.existsSync(filePath)) {
    try {
      const raw = fs.readFileSync(filePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<SocialDatabase>;
      const rawLoaded: SocialDatabase = {
        profiles: Array.isArray(parsed.profiles) ? parsed.profiles : [],
        activities: Array.isArray(parsed.activities) ? parsed.activities : [],
        messages: Array.isArray(parsed.messages) ? parsed.messages : [],
        friendships: Array.isArray(parsed.friendships) ? parsed.friendships : [],
        blocks: Array.isArray(parsed.blocks) ? parsed.blocks : [],
        reports: Array.isArray(parsed.reports) ? parsed.reports : [],
      };
      const { db: cleaned, changed } = purgeSeedBotsFromDb(rawLoaded);
      if (changed) {
        writeSocialDb(cleaned);
      } else {
        globalMemory.__shioriSocialDbCache = cleaned;
      }
      return cleaned;
    } catch {
      // fall through cleanly
    }
  }

  if (globalMemory.__shioriSocialDbCache) {
    const { db: cleaned, changed } = purgeSeedBotsFromDb(globalMemory.__shioriSocialDbCache);
    if (changed) {
      globalMemory.__shioriSocialDbCache = cleaned;
    }
    return cleaned;
  }

  const empty = createEmptySocialDb();
  writeSocialDb(empty);
  return empty;
}

export function writeSocialDb(db: SocialDatabase) {
  globalMemory.__shioriSocialDbCache = db;
  const filePath = getWritableSocialPath();
  if (!filePath) return;
  try {
    const tmp = `${filePath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2), "utf8");
    fs.renameSync(tmp, filePath);
  } catch {
    // Never crash serverless handlers if filesystem is read-only; in-memory cache stays updated
  }
}

/**
 * Guarantees that an authenticated Supabase user has a row in `public.profiles`
 * (retrying with a unique suffix on username collision) so `public_profiles`,
 * `friendships`, `activity_events` and `direct_messages` never fail foreign-key checks.
 */
export async function ensureServerSupabaseProfile(
  supabase: SupabaseClient,
  actor: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string | null;
    accentColor?: string;
  }
): Promise<{ ok: boolean; username: string; error?: string }> {
  try {
    const { data: existing } = await supabase
      .from("profiles")
      .select("id, username")
      .eq("id", actor.id)
      .maybeSingle();

    if (existing?.id) {
      return { ok: true, username: String(existing.username || actor.username) };
    }

    const cleanBase =
      actor.username
        .toLowerCase()
        .replace(/[^a-z0-9_]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 24) || `user_${actor.id.slice(0, 6)}`;

    const baseRow = {
      id: actor.id,
      username: cleanBase,
      display_name: actor.displayName || cleanBase,
      avatar_url: actor.avatarUrl ?? null,
      accent_color: actor.accentColor || "#E5484D",
      is_activity_public: true,
    };

    const { error } = await supabase
      .from("profiles")
      .upsert(baseRow, { onConflict: "id" });

    if (!error) {
      return { ok: true, username: cleanBase };
    }

    // Retry with unique suffix if username collided with another member
    const fallbackUsername = `${cleanBase.slice(0, 20)}_${actor.id.slice(0, 5)}`;
    const retry = await supabase
      .from("profiles")
      .upsert({ ...baseRow, username: fallbackUsername }, { onConflict: "id" });

    if (!retry.error) {
      return { ok: true, username: fallbackUsername };
    }

    return { ok: false, username: cleanBase, error: retry.error.message };
  } catch (err) {
    return {
      ok: false,
      username: actor.username,
      error: err instanceof Error ? err.message : "Erreur initialisation profil",
    };
  }
}

export function makeId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export interface ActiveActor {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  accentColor: string;
  role: UserRole;
  email?: string | null;
  anilistUserId?: number | null;
  source: "supabase" | "account" | "local";
}

export function isAuthenticatedActor(actor: ActiveActor): boolean {
  return actor.source === "supabase" || actor.source === "account";
}

/**
 * Resolves the active user STRICTLY from cryptographically verified server credentials:
 * 1) Supabase Auth JWT session cookie (`supabase.auth.getUser()`), or
 * 2) Signed HttpOnly `shiori_session` HMAC cookie (`accounts.json`).
 *
 * SECURITY: Never trusts client-supplied `userId` or `username` to impersonate another user!
 * Unauthenticated callers always resolve to the non-privileged guest actor (`source: "local"`).
 */
export async function resolveServerActor(): Promise<ActiveActor> {
  // 1) Supabase Auth user (server-verified JWT)
  try {
    const supabase = await getSupabaseServerClient();
    if (supabase) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        let username =
          (user.user_metadata?.username as string) ||
          user.email?.split("@")[0] ||
          `user_${user.id.slice(0, 6)}`;
        let displayName =
          (user.user_metadata?.display_name as string) ||
          (user.user_metadata?.full_name as string) ||
          username;
        let avatarUrl: string | null =
          (user.user_metadata?.avatar_url as string) ?? null;
        let accentColor = "#E5484D";
        let dbRole: unknown = "user";
        let anilistUserId: number | null = null;

        const extended = await supabase
          .from("profiles")
          .select("username, display_name, avatar_url, accent_color, role, anilist_user_id")
          .eq("id", user.id)
          .maybeSingle();

        let pRow: Record<string, unknown> | null = extended.data as Record<string, unknown> | null;
        if (extended.error) {
          const fallback = await supabase
            .from("profiles")
            .select("username, display_name, avatar_url, accent_color")
            .eq("id", user.id)
            .maybeSingle();
          pRow = fallback.data as Record<string, unknown> | null;
        }

        if (pRow) {
          if (typeof pRow.username === "string" && pRow.username) username = pRow.username;
          if (typeof pRow.display_name === "string" && pRow.display_name)
            displayName = pRow.display_name;
          if (pRow.avatar_url !== undefined) avatarUrl = (pRow.avatar_url as string | null) ?? null;
          if (typeof pRow.accent_color === "string" && pRow.accent_color)
            accentColor = pRow.accent_color;
          if (pRow.role !== undefined) dbRole = pRow.role;
          if (typeof pRow.anilist_user_id === "number") anilistUserId = pRow.anilist_user_id;
        }

        if (anilistUserId === null) {
          try {
            const { data: statsRow } = await supabase
              .from("user_anilist_stats")
              .select("anilist_user_id")
              .eq("user_id", user.id)
              .maybeSingle();
            if (typeof statsRow?.anilist_user_id === "number") {
              anilistUserId = statsRow.anilist_user_id;
            }
          } catch {
            // table may not exist
          }
        }

        const role = resolveEffectiveRole({
          dbRole,
          email: user.email ?? null,
          anilistUserId,
          username,
          displayName,
        });

        return {
          id: user.id,
          username,
          displayName,
          avatarUrl,
          accentColor,
          role,
          email: user.email ?? null,
          anilistUserId,
          source: "supabase",
        };
      }
    }
  } catch {
    // fall through cleanly
  }

  // 2) Built-in Shiori server account (HMAC-signed HttpOnly cookie)
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const uid = verifySessionToken(token);
    if (uid) {
      const db = readAccountDb();
      const acct = db.users.find((u) => u.id === uid);
      if (acct) {
        const anilistUserId = acct.anilistOAuth?.userId ?? null;
        const role = resolveEffectiveRole({
          dbRole: acct.role,
          email: acct.email,
          anilistUserId,
          username: acct.username,
          displayName: acct.displayName,
        });
        return {
          id: acct.id,
          username: acct.username,
          displayName: acct.displayName,
          avatarUrl: acct.avatarUrl ?? null,
          accentColor: acct.accentColor || "#E5484D",
          role,
          email: acct.email,
          anilistUserId,
          source: "account",
        };
      }
    }
  } catch {
    // fall through
  }

  // 3) Unauthenticated guest — NEVER trusts client-supplied userId/username
  return {
    id: "local-curator",
    username: "kuro_shiori",
    displayName: "Kuro",
    avatarUrl: null,
    accentColor: "#E5484D",
    role: "user",
    email: null,
    anilistUserId: null,
    source: "local",
  };
}

/**
 * Permanently scrubs all local social records associated with a deleted account.
 */
export function purgeLocalUserData(userId: string) {
  const db = readSocialDb();
  db.profiles = db.profiles.filter((p) => p.id !== userId);
  db.activities = db.activities
    .filter((a) => a.userId !== userId)
    .map((a) => ({
      ...a,
      likes: a.likes.filter((id) => id !== userId),
      comments: a.comments.filter((c) => c.userId !== userId),
    }));
  db.messages = db.messages.filter(
    (m) => m.senderId !== userId && m.recipientId !== userId
  );
  db.friendships = db.friendships.filter(
    (f) => f.requesterId !== userId && f.addresseeId !== userId
  );
  db.blocks = (db.blocks ?? []).filter(
    (b) => b.blockerId !== userId && b.blockedId !== userId
  );
  db.reports = (db.reports ?? []).filter((r) => r.reporterId !== userId);
  writeSocialDb(db);
}

/**
 * Merges registered local Shiori accounts + persisted social profiles into one deduplicated list.
 */
export function getAllLocalCommunityProfiles(): PublicUserProfile[] {
  const socialDb = readSocialDb();
  const byUsername = new Map<string, PublicUserProfile>();

  for (const p of socialDb.profiles) {
    if (isSeedBotAccount(p)) continue;
    byUsername.set(p.username.toLowerCase(), {
      ...p,
      role: resolveEffectiveRole({
        dbRole: p.role,
        username: p.username,
        displayName: p.displayName,
      }),
    });
  }

  // Also include any registered local server accounts from .shiori-data/accounts.json
  try {
    const acctDb = readAccountDb();
    for (const u of acctDb.users) {
      const key = u.username.toLowerCase();
      const effectiveRole = resolveEffectiveRole({
        dbRole: u.role,
        email: u.email,
        anilistUserId: u.anilistOAuth?.userId ?? null,
        username: u.username,
        displayName: u.displayName,
      });
      if (byUsername.has(key)) {
        const existing = byUsername.get(key)!;
        byUsername.set(key, {
          ...existing,
          role: effectiveRole,
          unlockedBadges:
            existing.unlockedBadges?.length
              ? existing.unlockedBadges
              : u.unlockedBadges ?? [],
        });
        continue;
      }
      const lib = u.library ?? [];
      const scored = lib.filter((e) => e.score !== null);
      const meanScore = scored.length
        ? Math.round((scored.reduce((a, b) => a + (b.score ?? 0), 0) / scored.length) * 10) / 10
        : null;
      byUsername.set(key, {
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl ?? null,
        avatarInitials: u.avatarInitials,
        bio: u.bio,
        accentColor: u.accentColor || "#E5484D",
        role: effectiveRole,
        isActivityPublic: u.isActivityPublic ?? true,
        joinedAt: u.joinedAt,
        favoriteStaff: u.favoriteStaff ?? [],
        favoriteMedia: lib
          .filter((e) => e.isFavorite)
          .slice(0, 8)
          .map((e) => ({
            mediaId: e.mediaId,
            type: e.type,
            title: e.title,
            coverImage: e.coverImage,
            score: e.score,
          })),
        libraryPreview: [...lib]
          .sort(
            (a, b) =>
              Number(b.isFavorite) - Number(a.isFavorite) ||
              (b.score ?? -1) - (a.score ?? -1)
          )
          .slice(0, 80)
          .map((e) => ({
            mediaId: e.mediaId,
            type: e.type,
            title: e.title,
            coverImage: e.coverImage,
            score: e.score,
            status: e.status,
            isFavorite: e.isFavorite,
            genres: Array.isArray(e.genres) ? e.genres.slice(0, 5) : undefined,
          })),
        stats: {
          totalEntries: lib.length,
          animeCount: lib.filter((e) => e.type === "ANIME").length,
          mangaCount: lib.filter((e) => e.type === "MANGA").length,
          episodesWatched: lib
            .filter((e) => e.type === "ANIME")
            .reduce((a, b) => a + b.progress, 0),
          chaptersRead: lib
            .filter((e) => e.type === "MANGA")
            .reduce((a, b) => a + b.progress, 0),
          completedCount: lib.filter((e) => e.status === "COMPLETED").length,
          meanScore,
        },
        unlockedBadges: u.unlockedBadges ?? [],
        pinnedBadges: (u.pinnedBadges ?? []).slice(0, 3),
        socialInteractionsCount: u.socialInteractionsCount ?? 0,
        source: "local",
      });
    }
  } catch {
    // ignore
  }

  return Array.from(byUsername.values());
}

export function upsertLocalCommunityProfile(profile: PublicUserProfile) {
  const db = readSocialDb();
  const idx = db.profiles.findIndex(
    (p) =>
      p.id === profile.id ||
      p.username.toLowerCase() === profile.username.toLowerCase()
  );
      if (idx === -1) {
    db.profiles.unshift(profile);
  } else {
    // SECURITY: Never overwrite another user's profile on username collision; match strictly by id
    const byId = db.profiles.findIndex((p) => p.id === profile.id);
    if (byId !== -1) {
      db.profiles[byId] = { ...db.profiles[byId], ...profile };
    } else {
      db.profiles.unshift(profile);
    }
  }
  writeSocialDb(db);
}

export function pushLocalActivity(item: CommunityActivityItem) {
  const db = readSocialDb();
  db.activities.unshift(item);
  db.activities = db.activities.slice(0, 120);
  writeSocialDb(db);
}

export function toggleLocalActivityLike(activityId: string, userId: string): {
  liked: boolean;
  likes: string[];
} | null {
  const db = readSocialDb();
  const target = db.activities.find((a) => a.id === activityId);
  if (!target) return null;
  const exists = target.likes.includes(userId);
  target.likes = exists
    ? target.likes.filter((id) => id !== userId)
    : [...target.likes, userId];
  writeSocialDb(db);
  return { liked: !exists, likes: target.likes };
}

export function addLocalActivityComment(
  activityId: string,
  comment: ActivityCommentItem
): ActivityCommentItem | null {
  const db = readSocialDb();
  const target = db.activities.find((a) => a.id === activityId);
  if (!target) return null;
  target.comments.push(comment);
  writeSocialDb(db);
  return comment;
}

export function deleteLocalActivity(activityId: string): boolean {
  const db = readSocialDb();
  const before = db.activities.length;
  db.activities = db.activities.filter((a) => a.id !== activityId);
  if (db.activities.length === before) return false;
  writeSocialDb(db);
  return true;
}

export function deleteLocalActivityComment(
  commentId: string,
  activityId?: string
): boolean {
  const db = readSocialDb();
  let removed = false;
  db.activities = db.activities.map((a) => {
    if (activityId && a.id !== activityId) return a;
    const nextComments = a.comments.filter((c) => c.id !== commentId);
    if (nextComments.length !== a.comments.length) {
      removed = true;
      return { ...a, comments: nextComments };
    }
    return a;
  });
  if (removed) {
    writeSocialDb(db);
  }
  return removed;
}

export function updateLocalUserAdminGrants(
  userId: string,
  patch: {
    grantBadgeId?: string;
    revokeBadgeId?: string;
    role?: UserRole;
  }
): {
  found: boolean;
  unlockedBadges?: UnlockedBadgeRecord[];
  role?: UserRole;
} {
  let found = false;
  let finalBadges: UnlockedBadgeRecord[] | undefined;
  let finalRole: UserRole | undefined;

  const applyBadgePatch = (current: UnlockedBadgeRecord[] = []): UnlockedBadgeRecord[] => {
    const map = new Map<string, UnlockedBadgeRecord>();
    for (const item of current) {
      if (item?.badgeId) map.set(item.badgeId, item);
    }
    if (patch.grantBadgeId) {
      if (!map.has(patch.grantBadgeId)) {
        map.set(patch.grantBadgeId, {
          badgeId: patch.grantBadgeId,
          unlockedAt: new Date().toISOString(),
        });
      }
    }
    if (patch.revokeBadgeId) {
      map.delete(patch.revokeBadgeId);
    }
    return Array.from(map.values());
  };

  // 1) Update built-in accounts.json if user exists there
  const acctDb = readAccountDb();
  const acctIdx = acctDb.users.findIndex((u) => u.id === userId);
  if (acctIdx !== -1) {
    found = true;
    const acct = acctDb.users[acctIdx];
    const nextBadges = applyBadgePatch(acct.unlockedBadges ?? []);
    const nextRole = patch.role ? normalizeRole(patch.role) : acct.role;
    acctDb.users[acctIdx] = {
      ...acct,
      unlockedBadges: nextBadges,
      pinnedBadges: patch.revokeBadgeId
        ? (acct.pinnedBadges ?? []).filter((id) => id !== patch.revokeBadgeId)
        : acct.pinnedBadges,
      role: nextRole,
    };
    writeAccountDb(acctDb);
    finalBadges = nextBadges;
    finalRole = resolveEffectiveRole({
      dbRole: nextRole,
      email: acct.email,
      anilistUserId: acct.anilistOAuth?.userId ?? null,
      username: acct.username,
      displayName: acct.displayName,
    });
  }

  // 2) Update local social.json profile if present
  const socialDb = readSocialDb();
  const socialIdx = socialDb.profiles.findIndex((p) => p.id === userId);
  if (socialIdx !== -1) {
    found = true;
    const prof = socialDb.profiles[socialIdx];
    const nextBadges = applyBadgePatch(prof.unlockedBadges ?? []);
    const nextRole = patch.role ? normalizeRole(patch.role) : prof.role;
    socialDb.profiles[socialIdx] = {
      ...prof,
      unlockedBadges: nextBadges,
      pinnedBadges: patch.revokeBadgeId
        ? (prof.pinnedBadges ?? []).filter((id) => id !== patch.revokeBadgeId)
        : prof.pinnedBadges,
      role: finalRole ?? nextRole,
    };
    writeSocialDb(socialDb);
    finalBadges = finalBadges ?? nextBadges;
    finalRole = finalRole ?? normalizeRole(nextRole);
  }

  return { found, unlockedBadges: finalBadges, role: finalRole };
}
