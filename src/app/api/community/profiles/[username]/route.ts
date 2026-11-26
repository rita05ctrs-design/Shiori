import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  getAllLocalCommunityProfiles,
  isAuthenticatedActor,
  readSocialDb,
  resolveServerActor,
} from "@/lib/server/social-store";
import { sanitizeSafeImageUrl } from "@/lib/server/rate-limit";
import { normalizeRole } from "@/lib/server/role-resolver";
import type {
  BadgeRarity,
  CommunityActivityItem,
  CommunityActivityKind,
  MediaType,
  PublicUserProfile,
} from "@/types/media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ username: string }> }
) {
  const { username } = await context.params;
  const cleaned = decodeURIComponent(username).trim().replace(/^@/, "");
  const lower = cleaned.toLowerCase();

  const requester = await resolveServerActor();
  const requesterId = isAuthenticatedActor(requester) ? requester.id : null;

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
          avatarUrl: sanitizeSafeImageUrl(row.avatar_url),
          bannerUrl: sanitizeSafeImageUrl(row.banner_url),
          avatarInitials: displayName.slice(0, 2).toUpperCase(),
          bio: String(row.bio ?? ""),
          accentColor: String(row.accent_color || "#E5484D"),
          role:
            requesterId && String(row.id) === requesterId && requester.role === "creator"
              ? "creator"
              : normalizeRole(row.role),
          isActivityPublic: row.is_activity_public !== false,
          joinedAt: row.joined_at ?? new Date().toISOString(),
          favoriteStaff: Array.isArray(row.favorite_staff) ? row.favorite_staff : [],
          favoriteMedia: Array.isArray(row.favorite_media) ? row.favorite_media : [],
          libraryPreview: Array.isArray(s.libraryPreview) ? s.libraryPreview : [],
          sharedCollections: Array.isArray(s.sharedCollections) ? s.sharedCollections : [],
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

  const isOwnProfile = Boolean(requesterId && requesterId === profile.id);

  // Enforce privacy strictly: if the user disabled public activity, never leak
  // their library preview, shared collections, favorites, or activity events to others.
  if (!profile.isActivityPublic && !isOwnProfile) {
    profile = {
      ...profile,
      favoriteMedia: [],
      libraryPreview: [],
      sharedCollections: [],
    };
    return NextResponse.json({ profile, activities: [] });
  }

  // Gather this user's public activity if allowed
  if (profile.isActivityPublic || isOwnProfile) {
    const livePinned = (profile.pinnedBadges ?? []).slice(0, 3);

    if (profile.source === "supabase") {
      try {
        const supabase = await getSupabaseServerClient();
        if (supabase) {
          let query = supabase
            .from("activity_events")
            .select("*")
            .eq("user_id", profile.id)
            .order("created_at", { ascending: false })
            .limit(20);
          if (!isOwnProfile) {
            query = query.eq("is_public", true);
          }
          const { data: rows } = await query;
          if (Array.isArray(rows)) {
            activities = rows.map((r) => {
              const meta = r.metadata && typeof r.metadata === "object" ? r.metadata : {};
              const resolvedMediaType: MediaType | "STAFF" | "BADGE" = meta.isBadge
                ? "BADGE"
                : meta.isStaff
                  ? "STAFF"
                  : (r.media_type || "ANIME");
              return {
                id: String(r.id),
                userId: String(r.user_id),
                actorUsername: String(r.actor_username || profile!.username),
                actorDisplayName: String(r.actor_display_name || profile!.displayName),
                actorAvatarUrl: sanitizeSafeImageUrl(r.actor_avatar_url),
                actorAccentColor: typeof meta.accentColor === "string" ? meta.accentColor : profile!.accentColor,
                actorRole: profile!.role ?? normalizeRole(meta.actorRole),
                actorPinnedBadges: livePinned.length > 0 ? livePinned : undefined,
                kind: (r.event_kind || "UPDATE") as CommunityActivityKind,
                mediaId: Number(r.media_id ?? 0),
                mediaTitle: String(r.media_title),
                mediaType: resolvedMediaType,
                coverImage: sanitizeSafeImageUrl(r.cover_image),
                action: String(r.action),
                score: typeof meta.score === "number" ? meta.score : null,
                badgeId: typeof meta.badgeId === "string" ? meta.badgeId : undefined,
                badgeRarity: typeof meta.badgeRarity === "string" ? (meta.badgeRarity as BadgeRarity) : undefined,
                isPublic: r.is_public !== false,
                createdAt: r.created_at,
                likes: [],
                comments: [],
              };
            });
          }
        }
      } catch {
        // non-fatal
      }
    }

    if (activities.length === 0) {
      const db = readSocialDb();
      activities = db.activities
        .filter(
          (a) =>
            (a.isPublic || isOwnProfile) &&
            (a.userId === profile!.id ||
              a.actorUsername.toLowerCase() === profile!.username.toLowerCase())
        )
        .slice(0, 20)
        .map((a) => ({
          ...a,
          actorRole: profile!.role ?? a.actorRole,
          ...(livePinned.length > 0 ? { actorPinnedBadges: livePinned } : {}),
        }));
    }
  }

  return NextResponse.json({ profile, activities });
}
