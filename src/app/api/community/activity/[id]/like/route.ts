import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  resolveServerActor,
  toggleLocalActivityLike,
} from "@/lib/server/social-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: activityId } = await context.params;
  const body = await request.json().catch(() => ({}));
  const actor = await resolveServerActor({
    userId: body?.userId,
    username: body?.username,
    displayName: body?.displayName,
    avatarUrl: body?.avatarUrl,
  });

  // 1) Try Supabase `activity_likes` when both IDs are Supabase UUIDs
  if (actor.source === "supabase" && UUID_RE.test(activityId)) {
    try {
      const supabase = await getSupabaseServerClient();
      if (supabase) {
        const { data: existing } = await supabase
          .from("activity_likes")
          .select("id")
          .eq("activity_id", activityId)
          .eq("user_id", actor.id)
          .maybeSingle();

        let liked = false;
        if (existing?.id) {
          await supabase.from("activity_likes").delete().eq("id", existing.id);
          liked = false;
        } else {
          await supabase.from("activity_likes").insert({
            activity_id: activityId,
            user_id: actor.id,
          });
          liked = true;
        }

        const { data: allLikes } = await supabase
          .from("activity_likes")
          .select("user_id")
          .eq("activity_id", activityId);

        // Keep local cache in sync if present
        toggleLocalActivityLike(activityId, actor.id);

        return NextResponse.json({
          ok: true,
          liked,
          likes: (allLikes ?? []).map((r) => r.user_id),
        });
      }
    } catch {
      // fall through to local store
    }
  }

  // 2) Local social store toggle
  const localRes = toggleLocalActivityLike(activityId, actor.id);
  if (!localRes) {
    return NextResponse.json({ error: "Activité introuvable" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, ...localRes });
}
