import { getSupabaseBrowserClient } from "./client";
import type { LibraryEntry } from "@/types/media";

/**
 * Synchronise une entrée de bibliothèque avec Supabase lorsqu'un utilisateur
 * est authentifié dans le cloud. Retourne silencieusement en mode local.
 */
export async function syncEntryToCloud(userId: string, entry: LibraryEntry) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { synced: false };

  const { error } = await supabase.from("library_entries").upsert(
    {
      user_id: userId,
      media_id: entry.mediaId,
      media_type: entry.type,
      title: entry.title,
      cover_image: entry.coverImage,
      banner_image: entry.bannerImage,
      total_units: entry.totalUnits,
      duration: entry.duration,
      genres: entry.genres,
      studio: entry.studio,
      format: entry.format,
      average_score: entry.averageScore,
      status: entry.status,
      progress: entry.progress,
      score: entry.score,
      is_favorite: entry.isFavorite,
      notes: entry.notes,
      started_at: entry.startedAt ?? null,
      completed_at: entry.completedAt ?? null,
    },
    { onConflict: "user_id,media_id" }
  );

  return { synced: !error, error: error?.message };
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
