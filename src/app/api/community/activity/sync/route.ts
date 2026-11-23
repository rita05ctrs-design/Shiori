import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  ensureServerSupabaseProfile,
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
import type {
  BadgeRarity,
  CommunityActivityItem,
  CommunityActivityKind,
  MediaType,
} from "@/types/media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface IncomingSyncEvent {
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
 * Idempotent backfill endpoint: generates public `activity_events` rows for a user's
 * existing library highlights (favorites, scores, completed series, favorite Seiyuu)
 * without ever duplicating already-published (event_kind, media_id) events.
 */
export async function POST(request: NextRequest) {
  try {
    const actor = await resolveServerActor();
    if (!isAuthenticatedActor(actor)) {
      return NextResponse.json(
        { ok: false, error: "Authentification requise." },
        { status: 401 }
      );
    }

    const limit = checkRateLimit(`activity:sync:${actor.id}`, 10, 60_000);
    if (!limit.ok) {
      return rateLimitResponse(limit.retryAfterSec);
    }

    const body = await request.json();
    if (body?.isPublic === false) {
      return NextResponse.json({ ok: true, insertedCount: 0, skipped: true });
    }

    const rawEvents = Array.isArray(body?.events) ? (body.events as IncomingSyncEvent[]) : [];
    const validEvents = rawEvents
      .filter((e) => e && typeof e.mediaTitle === "string" && e.mediaTitle.trim() && e.action)
      .slice(0, 10);

    if (validEvents.length === 0) {
      return NextResponse.json({ ok: true, insertedCount: 0 });
    }

    const actorPinnedBadges: string[] = Array.isArray(body?.actorPinnedBadges)
      ? body.actorPinnedBadges.filter((x: unknown) => typeof x === "string").slice(0, 3)
      : [];

    let insertedCloud = 0;

    // 1) Backfill into Supabase `public.activity_events` when authenticated via Supabase
    if (actor.source === "supabase") {
      try {
        const supabase = await getSupabaseServerClient();
        if (supabase) {
          const ensured = await ensureServerSupabaseProfile(supabase, actor);
          const { data: existingRows } = await supabase
            .from("activity_events")
            .select("event_kind, media_id")
            .eq("user_id", actor.id)
            .limit(120);

          const existingKeys = new Set<string>(
            (existingRows ?? []).map((r) => `${r.event_kind}:${r.media_id}`)
          );

          const toInsert = validEvents
            .filter((e) => !existingKeys.has(`${e.kind}:${Number(e.mediaId ?? 0)}`))
            .slice(0, 8)
            .map((e) => ({
              user_id: actor.id,
              media_id: Number(e.mediaId ?? 0),
              media_title: e.mediaTitle.trim().slice(0, 200),
              media_type: e.mediaType === "MANGA" ? "MANGA" : "ANIME",
              cover_image: sanitizeSafeImageUrl(e.coverImage),
              action: String(e.action).trim().slice(0, 300),
              event_kind: e.kind,
              is_public: true,
              actor_username: ensured.username || actor.username,
              actor_display_name: actor.displayName,
              actor_avatar_url: sanitizeSafeImageUrl(actor.avatarUrl),
              metadata: {
                isStaff: e.mediaType === "STAFF" || e.kind === "FAVORITE_STAFF",
                isBadge: e.mediaType === "BADGE" || e.kind === "BADGE_UNLOCKED",
                badgeId: e.badgeId,
                badgeRarity: e.badgeRarity,
                pinnedBadges: actorPinnedBadges,
                score: typeof e.score === "number" ? e.score : null,
                accentColor: actor.accentColor,
              },
            }));

          if (toInsert.length > 0) {
            const { error } = await supabase.from("activity_events").insert(toInsert);
            if (!error) insertedCloud = toInsert.length;
          }
        }
      } catch {
        // non-fatal
      }

      return NextResponse.json({
        ok: true,
        insertedCount: insertedCloud,
        insertedCloud,
        insertedLocal: 0,
      });
    }

    // 2) Backfill into local community feed for server account mode
    let insertedLocal = 0;
    try {
      const db = readSocialDb();
      const actorUserLower = actor.username.toLowerCase();
      const existingLocalKeys = new Set<string>(
        db.activities
          .filter(
            (a) =>
              a.userId === actor.id || a.actorUsername.toLowerCase() === actorUserLower
          )
          .map((a) => `${a.kind}:${a.mediaId}`)
      );

      const missingLocal = validEvents
        .filter((e) => !existingLocalKeys.has(`${e.kind}:${Number(e.mediaId ?? 0)}`))
        .slice(0, 6);

      const nowMs = Date.now();
      for (let i = missingLocal.length - 1; i >= 0; i--) {
        const e = missingLocal[i];
        const isBadge = e.mediaType === "BADGE" || e.kind === "BADGE_UNLOCKED";
        const isStaff = e.mediaType === "STAFF" || e.kind === "FAVORITE_STAFF";
        const item: CommunityActivityItem = {
          id: makeId("act"),
          userId: actor.id,
          actorUsername: actor.username,
          actorDisplayName: actor.displayName,
          actorAvatarUrl: sanitizeSafeImageUrl(actor.avatarUrl),
          actorAccentColor: actor.accentColor,
          actorPinnedBadges,
          kind: e.kind,
          mediaId: Number(e.mediaId ?? 0),
          mediaTitle: e.mediaTitle.trim().slice(0, 200),
          mediaType: isBadge ? "BADGE" : isStaff ? "STAFF" : e.mediaType === "MANGA" ? "MANGA" : "ANIME",
          coverImage: sanitizeSafeImageUrl(e.coverImage),
          action: String(e.action).trim().slice(0, 300),
          score: typeof e.score === "number" ? e.score : null,
          badgeId: e.badgeId,
          badgeRarity: e.badgeRarity,
          isPublic: true,
          createdAt: new Date(nowMs - i * 60 * 1000).toISOString(),
          likes: [],
          comments: [],
        };
        pushLocalActivity(item);
        insertedLocal += 1;
      }
    } catch {
      // non-fatal
    }

    return NextResponse.json({
      ok: true,
      insertedCount: insertedLocal,
      insertedCloud: 0,
      insertedLocal,
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Erreur lors de la synchronisation de l'activité." },
      { status: 400 }
    );
  }
}
