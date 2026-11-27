import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  ADMIN_GRANTS_STATS_KEY,
  applyAdminGrantRole,
  applyAdminGrantsToBadges,
  readAdminGrantsLedger,
} from "@/lib/server/admin-grants-store";
import {
  getAllLocalCommunityProfiles,
  isAuthenticatedActor,
  isSeedBotAccount,
  resolveServerActor,
  upsertLocalCommunityProfile,
} from "@/lib/server/social-store";
import {
  checkRateLimit,
  rateLimitResponse,
  sanitizeSafeImageUrl,
} from "@/lib/server/rate-limit";
import { resolvePublicProfileRole } from "@/lib/server/role-resolver";
import type { PublicUserProfile } from "@/types/media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

function redactPrivateProfile(
  profile: PublicUserProfile,
  requesterId: string | null
): PublicUserProfile {
  if (profile.isActivityPublic || (requesterId && requesterId === profile.id)) {
    return profile;
  }
  return {
    ...profile,
    favoriteMedia: [],
    libraryPreview: [],
    sharedCollections: [],
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapSupabasePublicProfile(row: any): PublicUserProfile {
  const displayName = String(row.display_name || row.username || "Membre Shiori");
  const statsRaw = row.stats_summary && typeof row.stats_summary === "object" ? row.stats_summary : {};
  const isPublic = row.is_activity_public !== false;
  return {
    id: String(row.id),
    username: String(row.username),
    displayName,
    avatarUrl: sanitizeSafeImageUrl(row.avatar_url),
    bannerUrl: sanitizeSafeImageUrl(row.banner_url),
    avatarInitials: displayName.slice(0, 2).toUpperCase(),
    bio: String(row.bio ?? ""),
    accentColor: typeof row.accent_color === "string" && HEX_COLOR_RE.test(row.accent_color)
      ? row.accent_color
      : "#E5484D",
    role: resolvePublicProfileRole({
      dbRole: row.role,
      username: String(row.username || ""),
      displayName,
    }),
    isActivityPublic: isPublic,
    joinedAt: row.joined_at ?? row.created_at ?? new Date().toISOString(),
    favoriteStaff: Array.isArray(row.favorite_staff) ? row.favorite_staff : [],
    favoriteMedia: isPublic && Array.isArray(row.favorite_media) ? row.favorite_media : [],
    libraryPreview: isPublic && Array.isArray(statsRaw.libraryPreview) ? statsRaw.libraryPreview : [],
    sharedCollections: isPublic && Array.isArray(statsRaw.sharedCollections) ? statsRaw.sharedCollections : [],
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
  const q = (searchParams.get("q") ?? "").trim().replace(/^@+/, "").toLowerCase();
  const requester = await resolveServerActor();
  const requesterId = isAuthenticatedActor(requester) ? requester.id : null;

  const byKey = new Map<string, PublicUserProfile>();

  // 1) Fetch public profiles from Supabase safe view `public_profiles`
  try {
    const supabase = await getSupabaseServerClient();
    if (supabase) {
      const { data, error } = await supabase
        .from("public_profiles")
        .select("*")
        .order("joined_at", { ascending: false })
        .limit(300);

      if (!error && Array.isArray(data)) {
        for (const row of data) {
          const mapped = redactPrivateProfile(mapSupabasePublicProfile(row), requesterId);
          if (isSeedBotAccount(mapped)) continue;
          if (requesterId && mapped.id === requesterId && requester.role === "creator") {
            mapped.role = "creator";
          }
          byKey.set(mapped.username.toLowerCase(), mapped);
        }
      }
    }
  } catch {
    // graceful fallback when view isn't migrated yet
  }

  // 2) Merge real local profiles (strictly excluding seed/demo bots)
  for (const p of getAllLocalCommunityProfiles()) {
    if (isSeedBotAccount(p)) continue;
    const k = p.username.toLowerCase();
    if (!byKey.has(k)) {
      byKey.set(k, redactPrivateProfile(p, requesterId));
    }
  }

  const grantsLedger = await readAdminGrantsLedger();
  let list = Array.from(byKey.values()).map((p) => {
    const grantEntry = grantsLedger.users[p.id];
    if (!grantEntry) return p;
    return {
      ...p,
      role: applyAdminGrantRole(p.role ?? "user", grantEntry),
      unlockedBadges: applyAdminGrantsToBadges(p.unlockedBadges, grantEntry),
    };
  });
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
    const actor = await resolveServerActor();
    if (!isAuthenticatedActor(actor)) {
      return NextResponse.json(
        { ok: false, error: "Authentification requise pour mettre à jour le profil." },
        { status: 401 }
      );
    }

    const limit = checkRateLimit(`profiles:post:${actor.id}`, 30, 60_000);
    if (!limit.ok) {
      return rateLimitResponse(limit.retryAfterSec);
    }

    const body = await request.json();
    const displayName =
      String(body?.displayName || actor.displayName)
        .trim()
        .slice(0, 60) || "Membre Shiori";
    const rawUsername = String(body?.username || actor.username)
      .trim()
      .replace(/^@+/, "")
      .replace(/[^a-zA-Z0-9_.-]/g, "_")
      .slice(0, 30);
    const username = rawUsername.length >= 2 ? rawUsername : actor.username;

    const safeAvatarUrl =
      body?.avatarUrl !== undefined
        ? sanitizeSafeImageUrl(body.avatarUrl, { allowDataImage: true })
        : sanitizeSafeImageUrl(actor.avatarUrl, { allowDataImage: true });
    const safeBannerUrl =
      body?.bannerUrl !== undefined ? sanitizeSafeImageUrl(body.bannerUrl) : null;
    const accentColor =
      typeof body?.accentColor === "string" && HEX_COLOR_RE.test(body.accentColor)
        ? body.accentColor
        : HEX_COLOR_RE.test(actor.accentColor)
          ? actor.accentColor
          : "#E5484D";

    const isActivityPublic = body?.isActivityPublic !== false;

    const publicProfile: PublicUserProfile = {
      id: actor.id,
      username,
      displayName,
      avatarUrl: safeAvatarUrl,
      bannerUrl: safeBannerUrl,
      avatarInitials: displayName.slice(0, 2).toUpperCase(),
      bio: typeof body?.bio === "string" ? body.bio.trim().slice(0, 400) : "",
      accentColor,
      role: resolvePublicProfileRole({
        dbRole: actor.role,
        username,
        displayName,
      }),
      isActivityPublic,
      joinedAt: typeof body?.joinedAt === "string" ? body.joinedAt : new Date().toISOString(),
      favoriteStaff: Array.isArray(body?.favoriteStaff) ? body.favoriteStaff.slice(0, 30) : [],
      favoriteMedia: Array.isArray(body?.favoriteMedia) ? body.favoriteMedia.slice(0, 40) : [],
      libraryPreview: Array.isArray(body?.libraryPreview) ? body.libraryPreview.slice(0, 80) : [],
      sharedCollections: Array.isArray(body?.sharedCollections)
        ? body.sharedCollections.slice(0, 12)
        : [],
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

    // 1) Sync to Supabase `profiles` when authenticated via Supabase
    let savedToSupabase = false;
    let supabaseError: string | undefined;
    if (actor.source === "supabase") {
      try {
        const supabase = await getSupabaseServerClient();
        if (supabase) {
          const preservedInternalKeys: Record<string, unknown> = {};
          try {
            const { data: existingRow } = await supabase
              .from("profiles")
              .select("stats_summary")
              .eq("id", actor.id)
              .maybeSingle();
            if (existingRow?.stats_summary && typeof existingRow.stats_summary === "object") {
              const existingSummary = existingRow.stats_summary as Record<string, unknown>;
              for (const [k, v] of Object.entries(existingSummary)) {
                if (k === ADMIN_GRANTS_STATS_KEY || k.startsWith("_shiori")) {
                  preservedInternalKeys[k] = v;
                }
              }
            }
          } catch {
            // non-fatal
          }

          const coreRow = {
            id: actor.id,
            username: publicProfile.username,
            display_name: publicProfile.displayName,
            avatar_url: publicProfile.avatarUrl,
            bio: publicProfile.bio,
            accent_color: publicProfile.accentColor,
            is_activity_public: publicProfile.isActivityPublic,
          };
          const fullRow = {
            ...coreRow,
            banner_url: publicProfile.bannerUrl ?? null,
            favorite_staff: publicProfile.favoriteStaff,
            favorite_media: isActivityPublic ? publicProfile.favoriteMedia : [],
            stats_summary: {
              ...publicProfile.stats,
              libraryPreview: isActivityPublic ? (publicProfile.libraryPreview ?? []) : [],
              sharedCollections: isActivityPublic ? (publicProfile.sharedCollections ?? []) : [],
              ...preservedInternalKeys,
            },
            unlocked_badges: publicProfile.unlockedBadges ?? [],
            pinned_badges: publicProfile.pinnedBadges ?? [],
          };

          const isMissingCol = (err: { code?: string; message?: string } | null) =>
            Boolean(
              err &&
                (err.code === "PGRST204" ||
                  err.code === "42703" ||
                  /could not find the .* column|column .* does not exist/i.test(err.message ?? ""))
            );

          let upsertErr = (
            await supabase.from("profiles").upsert(fullRow, { onConflict: "id" })
          ).error;

          if (isMissingCol(upsertErr)) {
            upsertErr = (
              await supabase.from("profiles").upsert(coreRow, { onConflict: "id" })
            ).error;
          }

          if (!upsertErr) {
            savedToSupabase = true;
          } else if (upsertErr.code === "23505") {
            const uniqueUsername = `${publicProfile.username.slice(0, 22)}_${actor.id.slice(0, 5)}`;
            let retryErr = (
              await supabase
                .from("profiles")
                .upsert({ ...fullRow, username: uniqueUsername }, { onConflict: "id" })
            ).error;
            if (isMissingCol(retryErr)) {
              retryErr = (
                await supabase
                  .from("profiles")
                  .upsert({ ...coreRow, username: uniqueUsername }, { onConflict: "id" })
              ).error;
            }
            if (!retryErr) {
              savedToSupabase = true;
              publicProfile.username = uniqueUsername;
            } else {
              supabaseError = "Impossible de mettre à jour le profil Supabase.";
            }
          } else {
            supabaseError = "Impossible de mettre à jour le profil Supabase.";
          }
        }
      } catch {
        supabaseError = "Erreur de synchronisation Supabase.";
      }

      return NextResponse.json({
        ok: savedToSupabase,
        profile: publicProfile,
        savedToSupabase,
        supabaseError,
      });
    }

    // 2) Local account store — enforce unique username across distinct user IDs
    const existingCollision = getAllLocalCommunityProfiles().find(
      (p) => p.id !== actor.id && p.username.toLowerCase() === publicProfile.username.toLowerCase()
    );
    if (existingCollision) {
      return NextResponse.json(
        { ok: false, error: "Ce nom d'utilisateur est déjà pris." },
        { status: 409 }
      );
    }

    upsertLocalCommunityProfile(publicProfile);

    return NextResponse.json({
      ok: true,
      profile: publicProfile,
      savedToSupabase: false,
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Payload profil invalide" }, { status: 400 });
  }
}
