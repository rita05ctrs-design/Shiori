import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  getAllLocalCommunityProfiles,
  resolveServerActor,
  upsertLocalCommunityProfile,
} from "@/lib/server/social-store";
import type { PublicUserProfile } from "@/types/media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapSupabasePublicProfile(row: any): PublicUserProfile {
  const displayName = String(row.display_name || row.username || "Membre Shiori");
  const statsRaw = row.stats_summary && typeof row.stats_summary === "object" ? row.stats_summary : {};
  return {
    id: String(row.id),
    username: String(row.username),
    displayName,
    avatarUrl: row.avatar_url ?? null,
    avatarInitials: displayName.slice(0, 2).toUpperCase(),
    bio: String(row.bio ?? ""),
    accentColor: String(row.accent_color || "#E5484D"),
    isActivityPublic: row.is_activity_public !== false,
    joinedAt: row.joined_at ?? row.created_at ?? new Date().toISOString(),
    favoriteStaff: Array.isArray(row.favorite_staff) ? row.favorite_staff : [],
    favoriteMedia: Array.isArray(row.favorite_media) ? row.favorite_media : [],
    stats: {
      totalEntries: Number(statsRaw.totalEntries ?? 0),
      animeCount: Number(statsRaw.animeCount ?? 0),
      mangaCount: Number(statsRaw.mangaCount ?? 0),
      episodesWatched: Number(statsRaw.episodesWatched ?? 0),
      chaptersRead: Number(statsRaw.chaptersRead ?? 0),
      completedCount: Number(statsRaw.completedCount ?? 0),
      meanScore: typeof statsRaw.meanScore === "number" ? statsRaw.meanScore : null,
    },
    unlockedBadges: Array.isArray(row.unlocked_badges) ? row.unlocked_badges : [],
    pinnedBadges: Array.isArray(row.pinned_badges) ? row.pinned_badges.slice(0, 3) : [],
    source: "supabase",
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim().toLowerCase();

  const byKey = new Map<string, PublicUserProfile>();

  // 1) Fetch public profiles from Supabase safe view `public_profiles`
  try {
    const supabase = await getSupabaseServerClient();
    if (supabase) {
      const { data, error } = await supabase
        .from("public_profiles")
        .select("*")
        .order("joined_at", { ascending: false })
        .limit(60);

      if (!error && Array.isArray(data)) {
        for (const row of data) {
          const mapped = mapSupabasePublicProfile(row);
          byKey.set(mapped.username.toLowerCase(), mapped);
        }
      }
    }
  } catch {
    // graceful fallback when view isn't migrated yet
  }

  // 2) Merge local / community profiles
  for (const p of getAllLocalCommunityProfiles()) {
    const k = p.username.toLowerCase();
    if (!byKey.has(k)) {
      byKey.set(k, p);
    }
  }

  let list = Array.from(byKey.values());
  if (q) {
    list = list.filter(
      (p) =>
        p.username.toLowerCase().includes(q) ||
        p.displayName.toLowerCase().includes(q) ||
        p.bio.toLowerCase().includes(q) ||
        p.favoriteStaff.some((s) => s.name.toLowerCase().includes(q))
    );
  }

  return NextResponse.json({ profiles: list });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const actor = await resolveServerActor({
      userId: body?.id,
      username: body?.username,
      displayName: body?.displayName,
      avatarUrl: body?.avatarUrl,
      accentColor: body?.accentColor,
    });

    const displayName = String(body?.displayName || actor.displayName).trim() || "Membre Shiori";
    const username =
      String(body?.username || actor.username)
        .trim()
        .replace(/\s+/g, "_")
        .replace(/^@/, "") || "shiori_user";

    const publicProfile: PublicUserProfile = {
      id: actor.id,
      username,
      displayName,
      avatarUrl: body?.avatarUrl !== undefined ? body.avatarUrl : actor.avatarUrl,
      avatarInitials: displayName.slice(0, 2).toUpperCase(),
      bio: typeof body?.bio === "string" ? body.bio : "",
      accentColor: typeof body?.accentColor === "string" ? body.accentColor : actor.accentColor,
      isActivityPublic: body?.isActivityPublic !== false,
      joinedAt: typeof body?.joinedAt === "string" ? body.joinedAt : new Date().toISOString(),
      favoriteStaff: Array.isArray(body?.favoriteStaff) ? body.favoriteStaff.slice(0, 30) : [],
      favoriteMedia: Array.isArray(body?.favoriteMedia) ? body.favoriteMedia.slice(0, 12) : [],
      stats: {
        totalEntries: Number(body?.stats?.totalEntries ?? 0),
        animeCount: Number(body?.stats?.animeCount ?? 0),
        mangaCount: Number(body?.stats?.mangaCount ?? 0),
        episodesWatched: Number(body?.stats?.episodesWatched ?? 0),
        chaptersRead: Number(body?.stats?.chaptersRead ?? 0),
        completedCount: Number(body?.stats?.completedCount ?? 0),
        meanScore: typeof body?.stats?.meanScore === "number" ? body.stats.meanScore : null,
      },
      unlockedBadges: Array.isArray(body?.unlockedBadges) ? body.unlockedBadges.slice(0, 60) : [],
      pinnedBadges: Array.isArray(body?.pinnedBadges)
        ? body.pinnedBadges.filter((id: unknown) => typeof id === "string").slice(0, 3)
        : [],
      socialInteractionsCount:
        typeof body?.socialInteractionsCount === "number"
          ? Math.max(0, Math.floor(body.socialInteractionsCount))
          : 0,
      source: actor.source === "supabase" ? "supabase" : "local",
    };

    // Always persist in local community store for immediate discovery
    upsertLocalCommunityProfile(publicProfile);

    // Sync to Supabase `profiles` if authenticated via Supabase
    let savedToSupabase = false;
    if (actor.source === "supabase") {
      try {
        const supabase = await getSupabaseServerClient();
        if (supabase) {
          const { error } = await supabase.from("profiles").upsert(
            {
              id: actor.id,
              username: publicProfile.username,
              display_name: publicProfile.displayName,
              avatar_url: publicProfile.avatarUrl,
              bio: publicProfile.bio,
              accent_color: publicProfile.accentColor,
              is_activity_public: publicProfile.isActivityPublic,
              favorite_staff: publicProfile.favoriteStaff,
              favorite_media: publicProfile.favoriteMedia,
              stats_summary: publicProfile.stats,
              unlocked_badges: publicProfile.unlockedBadges ?? [],
              pinned_badges: publicProfile.pinnedBadges ?? [],
            },
            { onConflict: "id" }
          );
          if (!error) savedToSupabase = true;
        }
      } catch {
        // non-fatal if new columns haven't been migrated yet
      }
    }

    return NextResponse.json({ ok: true, profile: publicProfile, savedToSupabase });
  } catch {
    return NextResponse.json({ ok: false, error: "Payload profil invalide" }, { status: 400 });
  }
}
