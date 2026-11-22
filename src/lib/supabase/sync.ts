import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "./client";
import type { AniListUserStatsSnapshot, LibraryEntry } from "@/types/media";

function entryToRow(userId: string, entry: LibraryEntry) {
  const safeScore =
    entry.score !== null && entry.score !== undefined && !Number.isNaN(entry.score)
      ? Math.max(0, Math.min(10, Math.round(entry.score * 10) / 10))
      : null;

  return {
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
}

/**
 * Ensures the signed-in user has a row in `public.profiles` so foreign keys on
 * `library_entries` and `user_anilist_stats` never fail.
 */
export async function ensureSupabaseProfile(
  supabase: SupabaseClient,
  user: { id: string; email?: string; user_metadata?: Record<string, unknown> }
) {
  const rawName =
    (user.user_metadata?.display_name as string) ||
    (user.user_metadata?.full_name as string) ||
    user.email?.split("@")[0] ||
    "Membre Shiori";
  const baseUsername =
    (user.user_metadata?.username as string) ||
    rawName.toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "") ||
    `user_${user.id.slice(0, 6)}`;

  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (existing) return { ok: true };

  const { error } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      username: baseUsername,
      display_name: rawName,
      avatar_url: (user.user_metadata?.avatar_url as string) ?? null,
    },
    { onConflict: "id" }
  );

  if (error) {
    // Retry with unique suffix if username collided
    const retry = await supabase.from("profiles").upsert(
      {
        id: user.id,
        username: `${baseUsername}_${user.id.slice(0, 5)}`,
        display_name: rawName,
        avatar_url: (user.user_metadata?.avatar_url as string) ?? null,
      },
      { onConflict: "id" }
    );
    return { ok: !retry.error, error: retry.error?.message };
  }
  return { ok: true };
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
    duration: row.duration,
    genres: row.genres ?? [],
    studio: row.studio,
    format: row.format,
    seasonYear: null,
    averageScore: row.average_score,
    status: row.status,
    progress: row.progress,
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
