import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  getAllLocalCommunityProfiles,
  readSocialDb,
} from "@/lib/server/social-store";
import type { CommunityActivityItem, PublicUserProfile } from "@/types/media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ username: string }> }
) {
  const { username } = await context.params;
  const cleaned = decodeURIComponent(username).trim().replace(/^@/, "");
  const lower = cleaned.toLowerCase();

  let profile: PublicUserProfile | null = null;
  let activities: CommunityActivityItem[] = [];

  // 1) Try Supabase `public_profiles` view first
  try {
    const supabase = await getSupabaseServerClient();
    if (supabase) {
      const { data: row } = await supabase
        .from("public_profiles")
        .select("*")
        .ilike("username", cleaned)
        .maybeSingle();

      if (row) {
        const displayName = String(row.display_name || row.username);
        const s = row.stats_summary && typeof row.stats_summary === "object" ? row.stats_summary : {};
        profile = {
          id: String(row.id),
          username: String(row.username),
          displayName,
          avatarUrl: row.avatar_url ?? null,
          avatarInitials: displayName.slice(0, 2).toUpperCase(),
          bio: String(row.bio ?? ""),
          accentColor: String(row.accent_color || "#E5484D"),
          isActivityPublic: row.is_activity_public !== false,
          joinedAt: row.joined_at ?? new Date().toISOString(),
          favoriteStaff: Array.isArray(row.favorite_staff) ? row.favorite_staff : [],
          favoriteMedia: Array.isArray(row.favorite_media) ? row.favorite_media : [],
          libraryPreview: Array.isArray(s.libraryPreview) ? s.libraryPreview : [],
          stats: {
            totalEntries: Number(s.totalEntries ?? 0),
            animeCount: Number(s.animeCount ?? 0),
            mangaCount: Number(s.mangaCount ?? 0),
            episodesWatched: Number(s.episodesWatched ?? 0),
            chaptersRead: Number(s.chaptersRead ?? 0),
            completedCount: Number(s.completedCount ?? 0),
            meanScore: typeof s.meanScore === "number" ? s.meanScore : null,
          },
          unlockedBadges: Array.isArray(row.unlocked_badges) ? row.unlocked_badges : [],
          pinnedBadges: Array.isArray(row.pinned_badges) ? row.pinned_badges.slice(0, 3) : [],
          source: "supabase",
        };
      }
    }
  } catch {
    // fallback to local store
  }

  // 2) Fallback to local / community profile store
  if (!profile) {
    const localList = getAllLocalCommunityProfiles();
    profile =
      localList.find(
        (p) => p.username.toLowerCase() === lower || p.id.toLowerCase() === lower
      ) ?? null;
  }

  if (!profile) {
    return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });
  }

  // Gather this user's public activity if allowed
  if (profile.isActivityPublic) {
    const db = readSocialDb();
    const livePinned = (profile.pinnedBadges ?? []).slice(0, 3);
    activities = db.activities
      .filter(
        (a) =>
          a.isPublic &&
          (a.userId === profile!.id ||
            a.actorUsername.toLowerCase() === profile!.username.toLowerCase())
      )
      .slice(0, 20)
      .map((a) => (livePinned.length > 0 ? { ...a, actorPinnedBadges: livePinned } : a));
  }

  return NextResponse.json({ profile, activities });
}
