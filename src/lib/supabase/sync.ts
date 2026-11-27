import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "./client";
import type {
  AniListUserStatsSnapshot,
  BadgeRarity,
  CommunityActivityKind,
  ContentLanguage,
  FavoriteVoiceActor,
  LibraryEntry,
  MediaType,
  PublicProfileLibraryItem,
  PublicProfileMediaSummary,
  PublicProfileStatsSummary,
  SharedPublicCollection,
  UnlockedBadgeRecord,
  UserRole,
} from "@/types/media";
import { normalizeContentLanguage } from "@/lib/i18n";
import { resolvePublicProfileRole } from "@/lib/server/role-resolver";

let volumesColumnsSupported = true;

function isAnyMissingColumnError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === "PGRST204" ||
    error.code === "42703" ||
    Boolean(error.message && /could not find the .* column|column .* does not exist/i.test(error.message))
  );
}

function isMissingColumnError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === "PGRST204" ||
    error.code === "42703" ||
    Boolean(error.message && /progress_volumes|total_volumes/i.test(error.message))
  );
}

function entryToRow(userId: string, entry: LibraryEntry, includeVolumes = volumesColumnsSupported) {
  const safeScore =
    entry.score !== null && entry.score !== undefined && !Number.isNaN(entry.score)
      ? Math.max(0, Math.min(10, Math.round(entry.score * 10) / 10))
      : null;

  const base = {
    user_id: userId,
    media_id: entry.mediaId,
    media_type: entry.type,
    title: entry.title,
    cover_image: entry.coverImage,
    banner_image: entry.bannerImage ?? null,
    total_units: entry.totalUnits ?? null,
    duration: entry.duration ?? null,
    genres: entry.genres ?? [],
    studio: entry.studio ?? null,
    format: entry.format ?? null,
    average_score: entry.averageScore ?? null,
    status: entry.status,
    progress: Math.max(0, Math.floor(entry.progress || 0)),
    score: safeScore,
    is_favorite: Boolean(entry.isFavorite),
    notes: entry.notes ?? "",
    started_at: entry.startedAt ?? null,
    completed_at: entry.completedAt ?? null,
  };

  if (!includeVolumes) return base;
  return {
    ...base,
    total_volumes: entry.totalVolumes ?? null,
    progress_volumes: Math.max(0, Math.floor(entry.progressVolumes || 0)),
  };
}

export interface CloudProfileSnapshot {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  bio: string;
  accentColor: string;
  role?: UserRole;
  isActivityPublic: boolean;
  preferredLanguage: ContentLanguage;
  favoriteStaff: FavoriteVoiceActor[];
  unlockedBadges: UnlockedBadgeRecord[];
  pinnedBadges: string[];
  joinedAt: string;
}

/**
 * Ensures the signed-in user has a row in `public.profiles` (and therefore in `public.public_profiles`)
 * immediately on sign-in, and returns their canonical cloud profile row.
 */
export async function ensureSupabaseProfile(
  supabase: SupabaseClient,
  user: { id: string; email?: string; user_metadata?: Record<string, unknown> }
): Promise<{ ok: boolean; profile?: CloudProfileSnapshot; error?: string }> {
  const rawName =
    (user.user_metadata?.display_name as string) ||
    (user.user_metadata?.full_name as string) ||
    (user.user_metadata?.name as string) ||
    user.email?.split("@")[0] ||
    "Membre Shiori";
  const baseUsername =
    ((user.user_metadata?.username as string) || rawName)
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 24) || `user_${user.id.slice(0, 6)}`;

  const selectColsWithRole =
    "id, username, display_name, avatar_url, banner_url, bio, accent_color, role, is_activity_public, preferred_language, favorite_staff, unlocked_badges, pinned_badges, created_at";
  const selectCols =
    "id, username, display_name, avatar_url, banner_url, bio, accent_color, is_activity_public, preferred_language, favorite_staff, unlocked_badges, pinned_badges, created_at";
  const selectCoreCols =
    "id, username, display_name, avatar_url, bio, accent_color, is_activity_public, created_at";

  let existingRes = await supabase
    .from("profiles")
    .select(selectColsWithRole)
    .eq("id", user.id)
    .maybeSingle();

  if (existingRes.error) {
    existingRes = await supabase
      .from("profiles")
      .select(selectCols)
      .eq("id", user.id)
      .maybeSingle();
  }
  if (existingRes.error) {
    existingRes = await supabase
      .from("profiles")
      .select(selectCoreCols)
      .eq("id", user.id)
      .maybeSingle();
  }
  const existing = existingRes.data;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRow = (row: any): CloudProfileSnapshot => {
    const resolvedUsername = String(row.username || baseUsername);
    const resolvedDisplayName = String(row.display_name || rawName);
    return {
      id: String(row.id),
      username: resolvedUsername,
      displayName: resolvedDisplayName,
      avatarUrl: row.avatar_url ?? null,
      bannerUrl: row.banner_url ?? null,
      bio: String(row.bio ?? ""),
      accentColor: String(row.accent_color || "#E5484D"),
      role: resolvePublicProfileRole({
        dbRole: row.role,
        username: resolvedUsername,
        displayName: resolvedDisplayName,
      }),
      isActivityPublic: row.is_activity_public !== false,
      preferredLanguage: normalizeContentLanguage(row.preferred_language),
      favoriteStaff: Array.isArray(row.favorite_staff) ? row.favorite_staff : [],
      unlockedBadges: Array.isArray(row.unlocked_badges) ? row.unlocked_badges : [],
      pinnedBadges: Array.isArray(row.pinned_badges) ? row.pinned_badges.slice(0, 3) : [],
      joinedAt: String(row.created_at || new Date().toISOString()),
    };
  };

  if (existing) {
    return { ok: true, profile: mapRow(existing) };
  }

  const insertPayload = {
    id: user.id,
    username: baseUsername,
    display_name: rawName,
    avatar_url: (user.user_metadata?.avatar_url as string) ?? null,
    accent_color: "#E5484D",
    is_activity_public: true,
  };

  let createRes = await supabase
    .from("profiles")
    .upsert(insertPayload, { onConflict: "id" })
    .select(selectCoreCols)
    .maybeSingle();

  if (!createRes.error) {
    return { ok: true, profile: createRes.data ? mapRow(createRes.data) : undefined };
  }

  // Retry with unique suffix if username collided with another member
  const retryUsername = `${baseUsername.slice(0, 20)}_${user.id.slice(0, 5)}`;
  createRes = await supabase
    .from("profiles")
    .upsert({ ...insertPayload, username: retryUsername }, { onConflict: "id" })
    .select(selectCoreCols)
    .maybeSingle();

  return {
    ok: !createRes.error,
    profile: createRes.data ? mapRow(createRes.data) : undefined,
    error: createRes.error?.message,
  };
}

/**
 * Immediately saves the user's core identity (displayName, username, bio, avatar, banner,
 * accentColor, visibility) to Supabase `public.profiles` AND `auth.users` metadata.
 * Gracefully strips optional columns (`banner_url`, `is_activity_public`) if the connected
 * Supabase schema hasn't run newer migrations yet, and surfaces username conflicts explicitly.
 */
export async function saveProfileIdentityToCloud(
  userId: string,
  payload: {
    displayName: string;
    username: string;
    bio?: string;
    accentColor?: string;
    avatarUrl?: string | null;
    bannerUrl?: string | null;
    isActivityPublic?: boolean;
  }
): Promise<{
  ok: boolean;
  username: string;
  code?: "USERNAME_TAKEN" | "ERROR";
  error?: string;
}> {
  const supabase = getSupabaseBrowserClient();
  const cleanUsername =
    payload.username
      .trim()
      .replace(/^@+/, "")
      .replace(/\s+/g, "_")
      .slice(0, 30) || `user_${userId.slice(0, 6)}`;
  const cleanDisplayName = payload.displayName.trim().slice(0, 60) || cleanUsername;

  if (!supabase) {
    return { ok: false, username: cleanUsername, code: "ERROR", error: "Supabase non configuré." };
  }

  const fullIdentityRow: Record<string, unknown> = {
    id: userId,
    username: cleanUsername,
    display_name: cleanDisplayName,
  };
  if (payload.bio !== undefined) fullIdentityRow.bio = payload.bio;
  if (payload.accentColor !== undefined) fullIdentityRow.accent_color = payload.accentColor || "#E5484D";
  if (payload.avatarUrl !== undefined) fullIdentityRow.avatar_url = payload.avatarUrl;
  if (payload.bannerUrl !== undefined) fullIdentityRow.banner_url = payload.bannerUrl;
  if (payload.isActivityPublic !== undefined) {
    fullIdentityRow.is_activity_public = payload.isActivityPublic;
  }

  const coreIdentityRow: Record<string, unknown> = {
    id: userId,
    username: cleanUsername,
    display_name: cleanDisplayName,
    ...(payload.bio !== undefined ? { bio: payload.bio } : {}),
    ...(payload.accentColor !== undefined
      ? { accent_color: payload.accentColor || "#E5484D" }
      : {}),
    ...(payload.avatarUrl !== undefined ? { avatar_url: payload.avatarUrl } : {}),
  };

  const minimalIdentityRow = {
    id: userId,
    username: cleanUsername,
    display_name: cleanDisplayName,
  };

  try {
    let res = await supabase.from("profiles").upsert(fullIdentityRow, { onConflict: "id" });

    if (isAnyMissingColumnError(res.error)) {
      res = await supabase.from("profiles").upsert(coreIdentityRow, { onConflict: "id" });
    }
    if (isAnyMissingColumnError(res.error)) {
      res = await supabase.from("profiles").upsert(minimalIdentityRow, { onConflict: "id" });
    }

    if (res.error) {
      if (res.error.code === "23505") {
        return {
          ok: false,
          username: cleanUsername,
          code: "USERNAME_TAKEN",
          error: "Ce nom d'utilisateur est déjà pris.",
        };
      }
      return {
        ok: false,
        username: cleanUsername,
        code: "ERROR",
        error: res.error.message,
      };
    }

    // Best-effort sync to Supabase Auth user metadata so reloads/fallbacks always match
    try {
      await supabase.auth.updateUser({
        data: {
          display_name: cleanDisplayName,
          full_name: cleanDisplayName,
          username: cleanUsername,
        },
      });
    } catch {
      // non-fatal: public.profiles already succeeded
    }

    return { ok: true, username: cleanUsername };
  } catch (err) {
    return {
      ok: false,
      username: cleanUsername,
      code: "ERROR",
      error: err instanceof Error ? err.message : "Erreur de sauvegarde du profil.",
    };
  }
}

/**
 * Directly syncs the signed-in user's full public profile snapshot into `public.profiles`
 * using the browser's authenticated Supabase session JWT.
 */
export async function syncPublicProfileToCloud(
  userId: string,
  payload: {
    username: string;
    displayName: string;
    avatarUrl: string | null;
    bannerUrl?: string | null;
    bio: string;
    accentColor: string;
    isActivityPublic: boolean;
    preferredLanguage?: ContentLanguage;
    favoriteStaff: FavoriteVoiceActor[];
    favoriteMedia: PublicProfileMediaSummary[];
    libraryPreview?: PublicProfileLibraryItem[];
    sharedCollections?: SharedPublicCollection[];
    stats: PublicProfileStatsSummary;
    unlockedBadges: UnlockedBadgeRecord[];
    pinnedBadges: string[];
  }
): Promise<{ synced: boolean; error?: string }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { synced: false };

  const cleanUsername =
    payload.username
      .trim()
      .replace(/^@+/, "")
      .replace(/\s+/g, "_")
      .slice(0, 30) || `user_${userId.slice(0, 6)}`;

  const coreRow = {
    id: userId,
    username: cleanUsername,
    display_name: payload.displayName.trim() || cleanUsername,
    avatar_url: payload.avatarUrl,
    bio: payload.bio ?? "",
    accent_color: payload.accentColor || "#E5484D",
    is_activity_public: payload.isActivityPublic,
  };

  // Preserve any Creator-owned `_shioriAdminGrants` stored on `stats_summary` so debounced
  // profile syncs never overwrite special badge grants.
  let preservedAdminGrants: unknown;
  try {
    const { data: existingStatsRow } = await supabase
      .from("profiles")
      .select("stats_summary")
      .eq("id", userId)
      .maybeSingle();
    if (
      existingStatsRow?.stats_summary &&
      typeof existingStatsRow.stats_summary === "object" &&
      "_shioriAdminGrants" in (existingStatsRow.stats_summary as Record<string, unknown>)
    ) {
      preservedAdminGrants = (existingStatsRow.stats_summary as Record<string, unknown>)
        ._shioriAdminGrants;
    }
  } catch {
    // non-fatal
  }

  const fullRow = {
    ...coreRow,
    banner_url: payload.bannerUrl ?? null,
    preferred_language: payload.preferredLanguage ?? "fr",
    favorite_staff: payload.favoriteStaff.slice(0, 30),
    favorite_media: payload.favoriteMedia.slice(0, 40),
    stats_summary: {
      ...payload.stats,
      libraryPreview: (payload.libraryPreview ?? []).slice(0, 80),
      sharedCollections: (payload.sharedCollections ?? []).slice(0, 12),
      ...(preservedAdminGrants !== undefined
        ? { _shioriAdminGrants: preservedAdminGrants }
        : {}),
    },
    unlocked_badges: payload.unlockedBadges.slice(0, 60),
    pinned_badges: payload.pinnedBadges.slice(0, 3),
  };

  try {
    let res = await supabase.from("profiles").upsert(fullRow, { onConflict: "id" });

    if (isAnyMissingColumnError(res.error)) {
      res = await supabase.from("profiles").upsert(coreRow, { onConflict: "id" });
    }
    if (!res.error) return { synced: true };

    // Handle username unique conflict gracefully by keeping existing username or suffixing
    if (res.error.code === "23505") {
      const suffixed = `${cleanUsername.slice(0, 22)}_${userId.slice(0, 5)}`;
      let retry = await supabase
        .from("profiles")
        .upsert({ ...fullRow, username: suffixed }, { onConflict: "id" });
      if (isAnyMissingColumnError(retry.error)) {
        retry = await supabase
          .from("profiles")
          .upsert({ ...coreRow, username: suffixed }, { onConflict: "id" });
      }
      return { synced: !retry.error, error: retry.error?.message };
    }
    return { synced: false, error: res.error.message };
  } catch (err) {
    return { synced: false, error: err instanceof Error ? err.message : "Erreur sync profil" };
  }
}

export interface ActivityBackfillItem {
  kind: CommunityActivityKind;
  mediaId: number;
  mediaTitle: string;
  mediaType: MediaType | "STAFF" | "BADGE";
  coverImage: string | null;
  action: string;
  score?: number | null;
  badgeId?: string;
  badgeRarity?: BadgeRarity;
}

/**
 * Ensures existing library highlights (favorites, scores, completed series, favorite Seiyuu)
 * are represented in Supabase `public.activity_events` when the user's activity is public.
 * Idempotent: skips any (event_kind, media_id) already stored for this user.
 */
export async function backfillCloudActivities(
  userId: string,
  actor: {
    username: string;
    displayName: string;
    avatarUrl: string | null;
    accentColor: string;
    pinnedBadges: string[];
  },
  events: ActivityBackfillItem[]
): Promise<{ inserted: number }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase || events.length === 0) return { inserted: 0 };

  try {
    const { data: existingRows, error: selErr } = await supabase
      .from("activity_events")
      .select("event_kind, media_id")
      .eq("user_id", userId)
      .limit(100);

    if (selErr) return { inserted: 0 };

    const existingKeys = new Set<string>(
      (existingRows ?? []).map((r) => `${r.event_kind}:${r.media_id}`)
    );

    const toInsert = events
      .filter((e) => !existingKeys.has(`${e.kind}:${e.mediaId}`))
      .slice(0, 8)
      .map((e) => ({
        user_id: userId,
        media_id: e.mediaId,
        media_title: e.mediaTitle,
        media_type: e.mediaType === "MANGA" ? "MANGA" : "ANIME",
        cover_image: e.coverImage ?? null,
        action: e.action,
        event_kind: e.kind,
        is_public: true,
        actor_username: actor.username,
        actor_display_name: actor.displayName,
        actor_avatar_url: actor.avatarUrl,
        metadata: {
          isStaff: e.mediaType === "STAFF" || e.kind === "FAVORITE_STAFF",
          isBadge: e.mediaType === "BADGE" || e.kind === "BADGE_UNLOCKED",
          badgeId: e.badgeId,
          badgeRarity: e.badgeRarity,
          pinnedBadges: actor.pinnedBadges.slice(0, 3),
          score: typeof e.score === "number" ? e.score : null,
          accentColor: actor.accentColor,
        },
      }));

    if (toInsert.length === 0) return { inserted: 0 };

    const { error: insErr } = await supabase.from("activity_events").insert(toInsert);
    return { inserted: insErr ? 0 : toInsert.length };
  } catch {
    return { inserted: 0 };
  }
}

/**
 * Synchronise une entrée de bibliothèque avec Supabase lorsqu'un utilisateur
 * est authentifié dans le cloud. Retourne silencieusement en mode local.
 */
export async function syncEntryToCloud(userId: string, entry: LibraryEntry) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { synced: false };

  const { error } = await supabase
    .from("library_entries")
    .upsert(entryToRow(userId, entry), { onConflict: "user_id,media_id" });

  if (isMissingColumnError(error)) {
    volumesColumnsSupported = false;
    const retry = await supabase
      .from("library_entries")
      .upsert(entryToRow(userId, entry, false), { onConflict: "user_id,media_id" });
    return { synced: !retry.error, error: retry.error?.message };
  }

  return { synced: !error, error: error?.message };
}

/**
 * Synchronise en lot (par paquets de 100) un ensemble d'entrées anime/manga
 * ainsi que les statistiques AniList (User.statistics) dans Supabase.
 */
export async function syncAniListImportWithClient(
  supabase: SupabaseClient,
  user: { id: string; email?: string; user_metadata?: Record<string, unknown> },
  entries: LibraryEntry[],
  stats: AniListUserStatsSnapshot,
  mode: "merge" | "replace" = "merge"
): Promise<{
  entriesSaved: number;
  statsSaved: boolean;
  error?: string;
}> {
  const profileCheck = await ensureSupabaseProfile(supabase, user);
  if (!profileCheck.ok) {
    return {
      entriesSaved: 0,
      statsSaved: false,
      error: profileCheck.error || "Table public.profiles introuvable dans Supabase.",
    };
  }

  // Deduplicate by mediaId before batch upsert to avoid ON CONFLICT duplicate-row errors
  const dedupedMap = new Map<number, LibraryEntry>();
  for (const e of entries) {
    dedupedMap.set(e.mediaId, e);
  }
  const uniqueEntries = Array.from(dedupedMap.values());

  if (mode === "replace") {
    const { error: delErr } = await supabase
      .from("library_entries")
      .delete()
      .eq("user_id", user.id);
    if (delErr) {
      return { entriesSaved: 0, statsSaved: false, error: delErr.message };
    }
  }

  let entriesSaved = 0;
  const BATCH_SIZE = 100;
  for (let i = 0; i < uniqueEntries.length; i += BATCH_SIZE) {
    const batch = uniqueEntries.slice(i, i + BATCH_SIZE).map((e) => entryToRow(user.id, e));
    const { error } = await supabase
      .from("library_entries")
      .upsert(batch, { onConflict: "user_id,media_id" });
    if (error) {
      return {
        entriesSaved,
        statsSaved: false,
        error: `Erreur sauvegarde library_entries : ${error.message}`,
      };
    }
    entriesSaved += batch.length;
  }

  // Save User.statistics (anime & manga) into public.user_anilist_stats
  const { error: statsErr } = await supabase.from("user_anilist_stats").upsert(
    {
      user_id: user.id,
      anilist_username: stats.anilistUsername,
      anilist_user_id: stats.anilistUserId,
      anilist_avatar_url: stats.anilistAvatarUrl,
      anilist_banner_url: stats.anilistBannerUrl,
      anilist_site_url: stats.anilistSiteUrl,
      anime_count: stats.anime.count,
      anime_episodes_watched: stats.anime.episodesWatched,
      anime_minutes_watched: stats.anime.minutesWatched,
      anime_mean_score: stats.anime.meanScore,
      manga_count: stats.manga.count,
      manga_chapters_read: stats.manga.chaptersRead,
      manga_volumes_read: stats.manga.volumesRead,
      manga_mean_score: stats.manga.meanScore,
      anime_stats: stats.anime,
      manga_stats: stats.manga,
      synced_at: stats.syncedAt,
    },
    { onConflict: "user_id" }
  );

  // Best-effort notification log (ignore if table policy/schema differs)
  await supabase.from("notifications").insert({
    user_id: user.id,
    kind: "SYSTEM",
    title: `Import AniList terminé (@${stats.anilistUsername})`,
    body: `${entriesSaved} titres (animes & mangas) et vos statistiques ont été synchronisés dans Supabase.`,
  });

  if (statsErr) {
    return {
      entriesSaved,
      statsSaved: false,
      error: `Entrées enregistrées (${entriesSaved}), mais erreur user_anilist_stats : ${statsErr.message}`,
    };
  }

  return { entriesSaved, statsSaved: true };
}

export async function syncAniListImportBrowser(
  entries: LibraryEntry[],
  stats: AniListUserStatsSnapshot,
  mode: "merge" | "replace" = "merge"
) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return { authenticated: false, entriesSaved: 0, statsSaved: false };
  }
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    return { authenticated: false, entriesSaved: 0, statsSaved: false };
  }
  const res = await syncAniListImportWithClient(supabase, data.user, entries, stats, mode);
  return { authenticated: true, ...res };
}

export async function syncEntriesBatchToCloud(
  userId: string,
  entries: LibraryEntry[],
  chunkSize = 100
): Promise<{ synced: boolean; count: number; error?: string }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase || entries.length === 0) return { synced: false, count: 0 };

  let saved = 0;
  for (let i = 0; i < entries.length; i += chunkSize) {
    const slice = entries.slice(i, i + chunkSize);
    const chunk = slice.map((e) => entryToRow(userId, e));
    const { error } = await supabase
      .from("library_entries")
      .upsert(chunk, { onConflict: "user_id,media_id" });
    if (isMissingColumnError(error)) {
      volumesColumnsSupported = false;
      const retry = await supabase
        .from("library_entries")
        .upsert(
          slice.map((e) => entryToRow(userId, e, false)),
          { onConflict: "user_id,media_id" }
        );
      if (retry.error) {
        return { synced: saved > 0, count: saved, error: retry.error.message };
      }
      saved += slice.length;
      continue;
    }
    if (error) {
      return { synced: saved > 0, count: saved, error: error.message };
    }
    saved += chunk.length;
  }
  return { synced: true, count: saved };
}

export async function removeEntryFromCloud(userId: string, mediaId: number) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { synced: false };

  const { error } = await supabase
    .from("library_entries")
    .delete()
    .eq("user_id", userId)
    .eq("media_id", mediaId);

  return { synced: !error, error: error?.message };
}

export async function fetchCloudLibrary(userId: string): Promise<LibraryEntry[] | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("library_entries")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error || !data) return null;

  return data.map((row) => ({
    mediaId: row.media_id,
    type: row.media_type,
    title: row.title,
    coverImage: row.cover_image,
    bannerImage: row.banner_image,
    totalUnits: row.total_units,
    totalVolumes: typeof row.total_volumes === "number" ? row.total_volumes : null,
    duration: row.duration,
    genres: row.genres ?? [],
    studio: row.studio,
    format: row.format,
    season: row.season ?? null,
    seasonYear: row.season_year ?? null,
    averageScore: row.average_score,
    status: row.status,
    progress: row.progress,
    progressVolumes: typeof row.progress_volumes === "number" ? row.progress_volumes : 0,
    score: row.score !== null ? Number(row.score) : null,
    isFavorite: Boolean(row.is_favorite),
    notes: row.notes ?? "",
    updatedAt: row.updated_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  }));
}

export async function fetchCloudAniListStats(
  userId: string
): Promise<AniListUserStatsSnapshot | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("user_anilist_stats")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    anilistUsername: data.anilist_username,
    anilistUserId: data.anilist_user_id,
    anilistAvatarUrl: data.anilist_avatar_url,
    anilistBannerUrl: data.anilist_banner_url,
    anilistSiteUrl: data.anilist_site_url,
    anime: data.anime_stats,
    manga: data.manga_stats,
    syncedAt: data.synced_at,
  };
}

/**
 * Resizes an image file to a crisp square 256x256 JPEG data URL (<= ~25KB)
 * for instant preview & local/fallback persistence when Supabase Storage isn't configured.
 */
async function compressAvatarToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Lecture du fichier impossible"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Format d'image invalide"));
      img.onload = () => {
        const size = 256;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(String(reader.result));
          return;
        }
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
        resolve(canvas.toDataURL("image/jpeg", 0.86));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Uploads a custom profile avatar to Supabase Storage (`avatars` bucket) if signed in
 * via Supabase, or falls back smoothly to a crisp compressed square Data URL.
 */
export async function uploadProfileAvatar(
  userId: string,
  file: File
): Promise<{ url: string; storage: "supabase" | "local"; warning?: string }> {
  const supabase = getSupabaseBrowserClient();
  if (supabase) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
        const filePath = `${user.id}/avatar-${Date.now()}.${ext || "jpg"}`;
        const { error: uploadErr } = await supabase.storage
          .from("avatars")
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: true,
            contentType: file.type || "image/jpeg",
          });

        if (!uploadErr) {
          const { data: pub } = supabase.storage.from("avatars").getPublicUrl(filePath);
          if (pub?.publicUrl) {
            await supabase
              .from("profiles")
              .update({ avatar_url: pub.publicUrl })
              .eq("id", user.id);
            return { url: pub.publicUrl, storage: "supabase" };
          }
        }
      }
    } catch {
      // fall through cleanly to compressed local data URL
    }
  }

  const dataUrl = await compressAvatarToDataUrl(file);
  return {
    url: dataUrl,
    storage: "local",
    warning:
      userId && supabase
        ? "Avatar enregistré localement (créez le bucket Supabase Storage 'avatars' via schema.sql pour l'hébergement cloud)."
        : undefined,
  };
}

/**
 * Fetches unlocked badges & pinned badge IDs from Supabase (`public.user_badges` + `public.profiles`).
 */
export async function fetchCloudUserBadges(userId: string): Promise<{
  unlockedBadges: UnlockedBadgeRecord[];
  pinnedBadges: string[];
} | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  try {
    const [{ data: badgeRows, error: bErr }, { data: pRow }] = await Promise.all([
      supabase
        .from("user_badges")
        .select("badge_id, unlocked_at, is_pinned")
        .eq("user_id", userId)
        .order("unlocked_at", { ascending: true }),
      supabase
        .from("profiles")
        .select("unlocked_badges, pinned_badges")
        .eq("id", userId)
        .maybeSingle(),
    ]);

    const unlockedMap = new Map<string, string>();
    const pinnedFromTable: string[] = [];

    if (!bErr && Array.isArray(badgeRows)) {
      for (const row of badgeRows) {
        if (row.badge_id) {
          unlockedMap.set(String(row.badge_id), String(row.unlocked_at || new Date().toISOString()));
          if (row.is_pinned) pinnedFromTable.push(String(row.badge_id));
        }
      }
    }

    if (pRow && Array.isArray(pRow.unlocked_badges)) {
      for (const item of pRow.unlocked_badges as UnlockedBadgeRecord[]) {
        if (item?.badgeId && !unlockedMap.has(item.badgeId)) {
          unlockedMap.set(item.badgeId, item.unlockedAt || new Date().toISOString());
        }
      }
    }

    const pinnedBadges =
      pRow && Array.isArray(pRow.pinned_badges) && pRow.pinned_badges.length > 0
        ? (pRow.pinned_badges as string[]).slice(0, 3)
        : pinnedFromTable.slice(0, 3);

    const unlockedBadges: UnlockedBadgeRecord[] = Array.from(unlockedMap.entries()).map(
      ([badgeId, unlockedAt]) => ({ badgeId, unlockedAt })
    );

    if (unlockedBadges.length === 0 && pinnedBadges.length === 0) return null;
    return { unlockedBadges, pinnedBadges };
  } catch {
    return null;
  }
}

/**
 * Persists unlocked badges + pinned selection to Supabase (`public.user_badges` & `public.profiles`).
 */
export async function syncUserBadgesToCloud(
  userId: string,
  unlockedBadges: UnlockedBadgeRecord[],
  pinnedBadges: string[]
): Promise<{ synced: boolean }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { synced: false };

  try {
    const pinnedSet = new Set(pinnedBadges.slice(0, 3));
    if (unlockedBadges.length > 0) {
      const rows = unlockedBadges.map((b) => ({
        user_id: userId,
        badge_id: b.badgeId,
        unlocked_at: b.unlockedAt,
        is_pinned: pinnedSet.has(b.badgeId),
      }));
      await supabase.from("user_badges").upsert(rows, { onConflict: "user_id,badge_id" });
    }

    await supabase
      .from("profiles")
      .update({
        unlocked_badges: unlockedBadges,
        pinned_badges: pinnedBadges.slice(0, 3),
      })
      .eq("id", userId);

    return { synced: true };
  } catch {
    return { synced: false };
  }
}

export interface CloudUiPreferences {
  theme?: Record<string, unknown>;
  ambiance?: Record<string, unknown>;
  displayPrefs?: Record<string, unknown>;
  homeSections?: { id: string; visible: boolean }[];
}

export async function fetchCloudUiPreferences(
  userId: string
): Promise<CloudUiPreferences | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("ui_preferences")
      .eq("id", userId)
      .maybeSingle();
    if (error || !data?.ui_preferences || typeof data.ui_preferences !== "object") {
      return null;
    }
    return data.ui_preferences as CloudUiPreferences;
  } catch {
    return null;
  }
}

export async function syncUiPreferencesToCloud(
  userId: string,
  prefs: CloudUiPreferences
): Promise<{ synced: boolean }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { synced: false };
  try {
    const { error } = await supabase
      .from("profiles")
      .update({ ui_preferences: prefs })
      .eq("id", userId);
    return { synced: !error };
  } catch {
    return { synced: false };
  }
}
