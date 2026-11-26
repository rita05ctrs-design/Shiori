import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  addLocalActivityComment,
  isAuthenticatedActor,
  makeId,
  readSocialDb,
  resolveServerActor,
} from "@/lib/server/social-store";
import {
  checkRateLimit,
  rateLimitResponse,
  sanitizeSafeImageUrl,
} from "@/lib/server/rate-limit";
import type { ActivityCommentItem } from "@/types/media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: activityId } = await context.params;
  const actor = await resolveServerActor();
  if (!isAuthenticatedActor(actor)) {
    return NextResponse.json(
      { error: "Connectez-vous pour commenter une activité." },
      { status: 401 }
    );
  }

  const limit = checkRateLimit(`activity:comment:${actor.id}`, 25, 60_000);
  if (!limit.ok) {
    return rateLimitResponse(limit.retryAfterSec);
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Requête JSON invalide." }, { status: 400 });
  }
  const text = String(body?.body ?? "").trim();

  if (!text || text.length > 600) {
    return NextResponse.json(
      { error: "Le commentaire doit contenir entre 1 et 600 caractères." },
      { status: 400 }
    );
  }

  let commentId = makeId("cmt");
  let createdAt = new Date().toISOString();
  const safeAvatar = sanitizeSafeImageUrl(actor.avatarUrl);

  if (actor.source === "supabase" && UUID_RE.test(activityId)) {
    try {
      const supabase = await getSupabaseServerClient();
      if (supabase) {
        const { data: inserted, error } = await supabase
          .from("activity_comments")
          .insert({
            activity_id: activityId,
            user_id: actor.id,
            author_username: actor.username,
            author_display_name: actor.displayName,
            author_avatar_url: safeAvatar,
            body: text,
          })
          .select("id, created_at")
          .single();

        if (error || !inserted?.id) {
          return NextResponse.json(
            { error: "Impossible de publier ce commentaire." },
            { status: 400 }
          );
        }
        commentId = String(inserted.id);
        createdAt = inserted.created_at ?? createdAt;

        const comment: ActivityCommentItem = {
          id: commentId,
          activityId,
          userId: actor.id,
          authorUsername: actor.username,
          authorDisplayName: actor.displayName,
          authorAvatarUrl: safeAvatar,
          authorAccentColor: actor.accentColor,
          authorRole: actor.role,
          body: text,
          createdAt,
        };
        return NextResponse.json({ ok: true, comment });
      }
    } catch {
      return NextResponse.json(
        { error: "Erreur serveur lors de la publication du commentaire." },
        { status: 500 }
      );
    }
  }

  // Local social store: verify target activity exists first
  const db = readSocialDb();
  const target = db.activities.find((a) => a.id === activityId);
  if (!target || (!target.isPublic && target.userId !== actor.id)) {
    return NextResponse.json({ error: "Activité introuvable." }, { status: 404 });
  }

  const comment: ActivityCommentItem = {
    id: commentId,
    activityId,
    userId: actor.id,
    authorUsername: actor.username,
    authorDisplayName: actor.displayName,
    authorAvatarUrl: safeAvatar,
    authorAccentColor: actor.accentColor,
    authorRole: actor.role,
    body: text,
    createdAt,
  };

  addLocalActivityComment(activityId, comment);
  return NextResponse.json({ ok: true, comment });
}
