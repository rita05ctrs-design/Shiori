import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  isAuthenticatedActor,
  resolveServerActor,
  toggleLocalActivityLike,
} from "@/lib/server/social-store";
import { checkRateLimit, rateLimitResponse } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: activityId } = await context.params;
  const actor = await resolveServerActor();
  if (!isAuthenticatedActor(actor)) {
    return NextResponse.json(
      { error: "Connectez-vous pour aimer une activité." },
      { status: 401 }
    );
  }

  const limit = checkRateLimit(`activity:like:${actor.id}`, 60, 60_000);
  if (!limit.ok) {
    return rateLimitResponse(limit.retryAfterSec);
  }

  // 1) Supabase `activity_likes` when authenticated via Supabase and activityId is UUID
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
          const { error } = await supabase.from("activity_likes").insert({
            activity_id: activityId,
            user_id: actor.id,
          });
          if (error) {
            return NextResponse.json(
              { error: "Impossible de modifier le like sur cette activité." },
              { status: 400 }
            );
          }
          liked = true;
        }

        const { data: allLikes } = await supabase
          .from("activity_likes")
          .select("user_id")
          .eq("activity_id", activityId);

        return NextResponse.json({
          ok: true,
          liked,
          likes: (allLikes ?? []).map((r) => r.user_id),
        });
      }
    } catch {
      return NextResponse.json({ error: "Erreur lors de la mise à jour du like." }, { status: 500 });
    }
  }

  // 2) Local social store toggle
  const localRes = toggleLocalActivityLike(activityId, actor.id);
  if (!localRes) {
    return NextResponse.json({ error: "Activité introuvable" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, ...localRes });
}
