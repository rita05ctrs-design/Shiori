import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  ensureServerSupabaseProfile,
  getAllLocalCommunityProfiles,
  isAuthenticatedActor,
  makeId,
  pushLocalActivity,
  readSocialDb,
  resolveServerActor,
} from "@/lib/server/social-store";
import {
  checkRateLimit,
  rateLimitResponse,
  sanitizeSafeImageUrl,
} from "@/lib/server/rate-limit";
import { resolvePublicProfileRole } from "@/lib/server/role-resolver";
import type {
  ActivityCommentItem,
  BadgeRarity,
  CommunityActivityItem,
  CommunityActivityKind,
  MediaType,
  UserRole,
} from "@/types/media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const kind = searchParams.get("kind");
  const username = searchParams.get("username")?.trim().toLowerCase();

  const requester = await resolveServerActor();
  const requesterId = isAuthenticatedActor(requester) ? requester.id : null;

  const merged = new Map<string, CommunityActivityItem>();
  const privateUserIds = new Set<string>();
  const privateUsernames = new Set<string>();
  const roleByUserId = new Map<string, UserRole>();
  const roleByUsername = new Map<string, UserRole>();

  if (requesterId && requester.role !== "user") {
    roleByUserId.set(requesterId, requester.role);
    roleByUsername.set(requester.username.toLowerCase(), requester.role);
  }

  // 1) Fetch public realtime activity from Supabase if tables exist
  try {
    const supabase = await getSupabaseServerClient();
    if (supabase) {
      const [{ data: rows, error }, { data: privateProfs }, { data: roleProfs }] = await Promise.all([
        supabase
          .from("activity_events")
          .select("*")
          .eq("is_public", true)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("public_profiles")
          .select("id, username")
          .eq("is_activity_public", false)
          .limit(200),
        supabase
          .from("public_profiles")
          .select("id, username, role")
          .in("role", ["creator", "moderator"])
          .limit(50),
      ]);

      for (const pp of privateProfs ?? []) {
        if (pp.id) privateUserIds.add(String(pp.id));
        if (pp.username) privateUsernames.add(String(pp.username).toLowerCase());
      }
      for (const rp of roleProfs ?? []) {
        const r = resolvePublicProfileRole({
          dbRole: rp.role,
          username: rp.username ? String(rp.username) : null,
        });
        if (r !== "user") {
          if (rp.id) roleByUserId.set(String(rp.id), r);
          if (rp.username) roleByUsername.set(String(rp.username).toLowerCase(), r);
        }
      }

      if (!error && Array.isArray(rows) && rows.length > 0) {
        const ids = rows.map((r) => r.id);
        const [{ data: likeRows }, { data: commentRows }] = await Promise.all([
          supabase.from("activity_likes").select("activity_id, user_id").in("activity_id", ids),
          supabase
            .from("activity_comments")
            .select("*")
            .in("activity_id", ids)
            .order("created_at", { ascending: true }),
        ]);

        const likesByAct = new Map<string, string[]>();
        for (const l of likeRows ?? []) {
          const arr = likesByAct.get(l.activity_id) ?? [];
          arr.push(l.user_id);
          likesByAct.set(l.activity_id, arr);
        }

        const commentsByAct = new Map<string, ActivityCommentItem[]>();
        for (const c of commentRows ?? []) {
          const arr = commentsByAct.get(c.activity_id) ?? [];
          arr.push({
            id: c.id,
            activityId: c.activity_id,
            userId: c.user_id,
            authorUsername: c.author_username,
            authorDisplayName: c.author_display_name,
            authorAvatarUrl: sanitizeSafeImageUrl(c.author_avatar_url),
            authorRole: resolvePublicProfileRole({
              username: c.author_username,
              displayName: c.author_display_name,
            }),
            body: c.body,
            createdAt: c.created_at,
          });
          commentsByAct.set(c.activity_id, arr);
        }

        for (const r of rows) {
          const meta = r.metadata && typeof r.metadata === "object" ? r.metadata : {};
          const resolvedMediaType: MediaType | "STAFF" | "BADGE" = meta.isBadge
            ? "BADGE"
            : meta.isStaff
              ? "STAFF"
              : (r.media_type || "ANIME");
          const actorUsername = String(r.actor_username || "membre");
          const actorDisplayName = String(r.actor_display_name || r.actor_username || "Membre");
          const item: CommunityActivityItem = {
            id: String(r.id),
            userId: String(r.user_id),
            actorUsername,
            actorDisplayName,
            actorAvatarUrl: sanitizeSafeImageUrl(r.actor_avatar_url),
            actorAccentColor: typeof meta.accentColor === "string" ? meta.accentColor : "#E5484D",
            actorRole: resolvePublicProfileRole({
              dbRole:
                roleByUserId.get(String(r.user_id)) ??
                roleByUsername.get(actorUsername.toLowerCase()) ??
                meta.actorRole,
              username: actorUsername,
              displayName: actorDisplayName,
            }),
            actorPinnedBadges: Array.isArray(meta.pinnedBadges)
              ? meta.pinnedBadges.slice(0, 3)
              : undefined,
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
            likes: likesByAct.get(r.id) ?? [],
            comments: commentsByAct.get(r.id) ?? [],
          };
          merged.set(item.id, item);
        }
      }
    }
  } catch {
    // graceful fallback to local store
  }

  // 2) Merge local community activity feed & track private local profiles
  const localProfiles = getAllLocalCommunityProfiles();
  for (const p of localProfiles) {
    if (!p.isActivityPublic) {
      privateUserIds.add(p.id);
      privateUsernames.add(p.username.toLowerCase());
    }
  }

  const db = readSocialDb();
  for (const a of db.activities) {
    if (!a.isPublic) continue;
    if (!merged.has(a.id)) {
      merged.set(a.id, a);
    }
  }

  // Filter out activities from users who switched their profile to private
  let items = Array.from(merged.values())
    .filter((a) => {
      if (requesterId && a.userId === requesterId) return true;
      if (privateUserIds.has(a.userId)) return false;
      if (privateUsernames.has(a.actorUsername.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Hydrate latest pinnedBadges and authoritative roles onto each activity & comment author
  const pinnedByUsername = new Map<string, string[]>();
  for (const p of localProfiles) {
    if (Array.isArray(p.pinnedBadges) && p.pinnedBadges.length > 0) {
      pinnedByUsername.set(p.username.toLowerCase(), p.pinnedBadges.slice(0, 3));
    }
    if (p.role && p.role !== "user") {
      roleByUserId.set(p.id, p.role);
      roleByUsername.set(p.username.toLowerCase(), p.role);
    }
  }
  items = items.map((a) => {
    const livePinned = pinnedByUsername.get(a.actorUsername.toLowerCase());
    const resolvedActorRole = resolvePublicProfileRole({
      dbRole:
        roleByUserId.get(a.userId) ??
        roleByUsername.get(a.actorUsername.toLowerCase()) ??
        a.actorRole,
      username: a.actorUsername,
      displayName: a.actorDisplayName,
    });
    const enrichedComments = a.comments.map((c) => {
      const cRole = resolvePublicProfileRole({
        dbRole:
          roleByUserId.get(c.userId) ??
          roleByUsername.get(c.authorUsername.toLowerCase()) ??
          c.authorRole,
        username: c.authorUsername,
        displayName: c.authorDisplayName,
      });
      return cRole && cRole !== "user" ? { ...c, authorRole: cRole } : c;
    });
    return {
      ...a,
      ...(livePinned ? { actorPinnedBadges: livePinned } : {}),
      ...(resolvedActorRole && resolvedActorRole !== "user"
        ? { actorRole: resolvedActorRole }
        : {}),
      comments: enrichedComments,
    };
  });

  if (kind && kind !== "ALL") {
    items = items.filter((a) => a.kind === kind);
  }
  if (username) {
    items = items.filter((a) => a.actorUsername.toLowerCase() === username);
  }

  return NextResponse.json({ activities: items.slice(0, 60) });
}

export async function POST(request: NextRequest) {
  try {
    const actor = await resolveServerActor();
    if (!isAuthenticatedActor(actor)) {
      return NextResponse.json(
        { error: "Authentification requise pour publier une activité." },
        { status: 401 }
      );
    }

    const limit = checkRateLimit(`activity:post:${actor.id}`, 30, 60_000);
    if (!limit.ok) {
      return rateLimitResponse(limit.retryAfterSec);
    }

    const body = await request.json();
    if (body?.isPublic === false) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const kind = (body?.kind || "UPDATE") as CommunityActivityKind;
    const mediaTitle = String(body?.mediaTitle || "").trim().slice(0, 200);
    const action = String(body?.action || "").trim().slice(0, 300);
    if (!mediaTitle || !action) {
      return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 });
    }

    const isBadge = body?.mediaType === "BADGE" || kind === "BADGE_UNLOCKED";
    const isStaff = body?.mediaType === "STAFF" || kind === "FAVORITE_STAFF";
    const dbMediaType: MediaType = body?.mediaType === "MANGA" ? "MANGA" : "ANIME";
    const actorPinnedBadges: string[] = Array.isArray(body?.actorPinnedBadges)
      ? body.actorPinnedBadges.filter((x: unknown) => typeof x === "string").slice(0, 3)
      : [];
    const badgeId = typeof body?.badgeId === "string" ? body.badgeId.slice(0, 64) : undefined;
    const badgeRarity = typeof body?.badgeRarity === "string" ? (body.badgeRarity as BadgeRarity) : undefined;
    const safeCoverImage = sanitizeSafeImageUrl(body?.coverImage);

    let createdId = makeId("act");
    const createdAt = new Date().toISOString();
    let savedToSupabase = false;
    let supabaseError: string | undefined;

    if (actor.source === "supabase") {
      try {
        const supabase = await getSupabaseServerClient();
        if (supabase) {
          const ensured = await ensureServerSupabaseProfile(supabase, actor);
          const { data: inserted, error } = await supabase
            .from("activity_events")
            .insert({
              user_id: actor.id,
              media_id: Number(body?.mediaId ?? 0),
              media_title: mediaTitle,
              media_type: dbMediaType,
              cover_image: safeCoverImage,
              action,
              event_kind: kind,
              is_public: true,
              actor_username: ensured.username || actor.username,
              actor_display_name: actor.displayName,
              actor_avatar_url: sanitizeSafeImageUrl(actor.avatarUrl),
              metadata: {
                isStaff,
                isBadge,
                badgeId,
                badgeRarity,
                pinnedBadges: actorPinnedBadges,
                score: typeof body?.score === "number" ? body.score : null,
                accentColor: actor.accentColor,
                actorRole: actor.role,
              },
            })
            .select("id")
            .single();

          if (!error && inserted?.id) {
            createdId = String(inserted.id);
            savedToSupabase = true;
          } else if (error) {
            supabaseError = "Impossible de publier l'activité.";
          }
        }
      } catch {
        supabaseError = "Erreur de synchronisation activité.";
      }
    }

    const item: CommunityActivityItem = {
      id: createdId,
      userId: actor.id,
      actorUsername: actor.username,
      actorDisplayName: actor.displayName,
      actorAvatarUrl: sanitizeSafeImageUrl(actor.avatarUrl),
      actorAccentColor: actor.accentColor,
      actorRole: actor.role,
      actorPinnedBadges,
      kind,
      mediaId: Number(body?.mediaId ?? 0),
      mediaTitle,
      mediaType: isBadge ? "BADGE" : isStaff ? "STAFF" : dbMediaType,
      coverImage: safeCoverImage,
      action,
      score: typeof body?.score === "number" ? body.score : null,
      badgeId,
      badgeRarity,
      isPublic: true,
      createdAt,
      likes: [],
      comments: [],
    };

    if (actor.source === "account") {
      pushLocalActivity(item);
    }

    return NextResponse.json({
      ok: true,
      activity: item,
      savedToSupabase,
      supabaseError,
    });
  } catch {
    return NextResponse.json({ error: "Erreur publication activité" }, { status: 400 });
  }
}
