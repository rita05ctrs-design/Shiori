import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  getAllLocalCommunityProfiles,
  makeId,
  pushLocalActivity,
  readSocialDb,
  resolveServerActor,
} from "@/lib/server/social-store";
import type {
  ActivityCommentItem,
  BadgeRarity,
  CommunityActivityItem,
  CommunityActivityKind,
  MediaType,
} from "@/types/media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const kind = searchParams.get("kind");
  const username = searchParams.get("username")?.trim().toLowerCase();

  const merged = new Map<string, CommunityActivityItem>();

  // 1) Fetch public realtime activity from Supabase if tables exist
  try {
    const supabase = await getSupabaseServerClient();
    if (supabase) {
      const { data: rows, error } = await supabase
        .from("activity_events")
        .select("*")
        .eq("is_public", true)
        .order("created_at", { ascending: false })
        .limit(50);

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
            authorAvatarUrl: c.author_avatar_url ?? null,
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
          const item: CommunityActivityItem = {
            id: String(r.id),
            userId: String(r.user_id),
            actorUsername: String(r.actor_username || "membre"),
            actorDisplayName: String(r.actor_display_name || r.actor_username || "Membre"),
            actorAvatarUrl: r.actor_avatar_url ?? null,
            actorAccentColor: typeof meta.accentColor === "string" ? meta.accentColor : "#E5484D",
            actorPinnedBadges: Array.isArray(meta.pinnedBadges)
              ? meta.pinnedBadges.slice(0, 3)
              : undefined,
            kind: (r.event_kind || "UPDATE") as CommunityActivityKind,
            mediaId: Number(r.media_id ?? 0),
            mediaTitle: String(r.media_title),
            mediaType: resolvedMediaType,
            coverImage: r.cover_image ?? null,
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

  // 2) Merge local community activity feed
  const db = readSocialDb();
  for (const a of db.activities) {
    if (!a.isPublic) continue;
    if (!merged.has(a.id)) {
      merged.set(a.id, a);
    }
  }

  let items = Array.from(merged.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // Hydrate latest pinnedBadges onto each activity author from community profiles
  const pinnedByUsername = new Map<string, string[]>();
  for (const p of getAllLocalCommunityProfiles()) {
    if (Array.isArray(p.pinnedBadges) && p.pinnedBadges.length > 0) {
      pinnedByUsername.set(p.username.toLowerCase(), p.pinnedBadges.slice(0, 3));
    }
  }
  items = items.map((a) => {
    const livePinned = pinnedByUsername.get(a.actorUsername.toLowerCase());
    if (livePinned) {
      return { ...a, actorPinnedBadges: livePinned };
    }
    return a;
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
    const body = await request.json();
    if (body?.isPublic === false) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const actor = await resolveServerActor({
      userId: body?.userId,
      username: body?.actorUsername,
      displayName: body?.actorDisplayName,
      avatarUrl: body?.actorAvatarUrl,
      accentColor: body?.actorAccentColor,
    });

    const kind = (body?.kind || "UPDATE") as CommunityActivityKind;
    const mediaTitle = String(body?.mediaTitle || "").trim();
    const action = String(body?.action || "").trim();
    if (!mediaTitle || !action) {
      return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 });
    }

    const isBadge = body?.mediaType === "BADGE" || kind === "BADGE_UNLOCKED";
    const isStaff = body?.mediaType === "STAFF" || kind === "FAVORITE_STAFF";
    const dbMediaType: MediaType = body?.mediaType === "MANGA" ? "MANGA" : "ANIME";
    const actorPinnedBadges: string[] = Array.isArray(body?.actorPinnedBadges)
      ? body.actorPinnedBadges.filter((x: unknown) => typeof x === "string").slice(0, 3)
      : [];
    const badgeId = typeof body?.badgeId === "string" ? body.badgeId : undefined;
    const badgeRarity = typeof body?.badgeRarity === "string" ? (body.badgeRarity as BadgeRarity) : undefined;

    let createdId = makeId("act");
    const createdAt = new Date().toISOString();

    // Persist to Supabase `activity_events` (triggers Supabase Realtime!)
    if (actor.source === "supabase") {
      try {
        const supabase = await getSupabaseServerClient();
        if (supabase) {
          const { data: inserted, error } = await supabase
            .from("activity_events")
            .insert({
              user_id: actor.id,
              media_id: Number(body?.mediaId ?? 0),
              media_title: mediaTitle,
              media_type: dbMediaType,
              cover_image: body?.coverImage ?? null,
              action,
              event_kind: kind,
              is_public: true,
              actor_username: actor.username,
              actor_display_name: actor.displayName,
              actor_avatar_url: actor.avatarUrl,
              metadata: {
                isStaff,
                isBadge,
                badgeId,
                badgeRarity,
                pinnedBadges: actorPinnedBadges,
                score: typeof body?.score === "number" ? body.score : null,
                accentColor: actor.accentColor,
              },
            })
            .select("id")
            .single();

          if (!error && inserted?.id) {
            createdId = String(inserted.id);
          }
        }
      } catch {
        // fallback cleanly to local store
      }
    }

    const item: CommunityActivityItem = {
      id: createdId,
      userId: actor.id,
      actorUsername: actor.username,
      actorDisplayName: actor.displayName,
      actorAvatarUrl: actor.avatarUrl,
      actorAccentColor: actor.accentColor,
      actorPinnedBadges,
      kind,
      mediaId: Number(body?.mediaId ?? 0),
      mediaTitle,
      mediaType: isBadge ? "BADGE" : isStaff ? "STAFF" : dbMediaType,
      coverImage: body?.coverImage ?? null,
      action,
      score: typeof body?.score === "number" ? body.score : null,
      badgeId,
      badgeRarity,
      isPublic: true,
      createdAt,
      likes: [],
      comments: [],
    };

    pushLocalActivity(item);
    return NextResponse.json({ ok: true, activity: item });
  } catch {
    return NextResponse.json({ error: "Erreur publication activité" }, { status: 500 });
  }
}
