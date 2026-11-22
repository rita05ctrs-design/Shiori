import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  addLocalActivityComment,
  makeId,
  resolveServerActor,
} from "@/lib/server/social-store";
import type { ActivityCommentItem } from "@/types/media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: activityId } = await context.params;
  const body = await request.json().catch(() => ({}));
  const text = String(body?.body ?? "").trim();

  if (!text || text.length > 600) {
    return NextResponse.json(
      { error: "Le commentaire doit contenir entre 1 et 600 caractères." },
      { status: 400 }
    );
  }

  const actor = await resolveServerActor({
    userId: body?.userId,
    username: body?.username,
    displayName: body?.displayName,
    avatarUrl: body?.avatarUrl,
    accentColor: body?.accentColor,
  });

  let commentId = makeId("cmt");
  const createdAt = new Date().toISOString();

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
            author_avatar_url: actor.avatarUrl,
            body: text,
          })
          .select("id, created_at")
          .single();

        if (!error && inserted?.id) {
          commentId = String(inserted.id);
        }
      }
    } catch {
      // fall through to local cache
    }
  }

  const comment: ActivityCommentItem = {
    id: commentId,
    activityId,
    userId: actor.id,
    authorUsername: actor.username,
    authorDisplayName: actor.displayName,
    authorAvatarUrl: actor.avatarUrl,
    authorAccentColor: actor.accentColor,
    body: text,
    createdAt,
  };

  addLocalActivityComment(activityId, comment);
  return NextResponse.json({ ok: true, comment });
}
