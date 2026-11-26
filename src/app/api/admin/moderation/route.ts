import { NextRequest, NextResponse } from "next/server";
import { requireCreatorActor } from "@/lib/server/admin-auth";
import { sanitizeSafeImageUrl } from "@/lib/server/rate-limit";
import {
  deleteLocalActivity,
  deleteLocalActivityComment,
  readSocialDb,
} from "@/lib/server/social-store";
import {
  getSupabaseAdminClient,
  getSupabaseServerClient,
} from "@/lib/supabase/server";
import type {
  ActivityCommentItem,
  CommunityActivityItem,
  CommunityActivityKind,
  MediaType,
} from "@/types/media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET() {
  const guard = await requireCreatorActor();
  if (!guard.ok) return guard.response;

  const mergedActivities = new Map<string, CommunityActivityItem>();

  // 1) Fetch recent Supabase activities + comments
  try {
    const supabase = getSupabaseAdminClient() ?? (await getSupabaseServerClient());
    if (supabase) {
      const { data: rows, error } = await supabase
        .from("activity_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(80);

      if (!error && Array.isArray(rows) && rows.length > 0) {
        const ids = rows.map((r) => r.id);
        const { data: commentRows } = await supabase
          .from("activity_comments")
          .select("*")
          .in("activity_id", ids)
          .order("created_at", { ascending: false });

        const commentsByAct = new Map<string, ActivityCommentItem[]>();
        for (const c of commentRows ?? []) {
          const arr = commentsByAct.get(c.activity_id) ?? [];
          arr.push({
            id: String(c.id),
            activityId: String(c.activity_id),
            userId: String(c.user_id),
            authorUsername: String(c.author_username || "membre"),
            authorDisplayName: String(c.author_display_name || c.author_username || "Membre"),
            authorAvatarUrl: sanitizeSafeImageUrl(c.author_avatar_url),
            body: String(c.body ?? ""),
            createdAt: String(c.created_at),
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
          mergedActivities.set(String(r.id), {
            id: String(r.id),
            userId: String(r.user_id),
            actorUsername: String(r.actor_username || "membre"),
            actorDisplayName: String(r.actor_display_name || r.actor_username || "Membre"),
            actorAvatarUrl: sanitizeSafeImageUrl(r.actor_avatar_url),
            actorAccentColor: typeof meta.accentColor === "string" ? meta.accentColor : "#E5484D",
            kind: (r.event_kind || "UPDATE") as CommunityActivityKind,
            mediaId: Number(r.media_id ?? 0),
            mediaTitle: String(r.media_title || ""),
            mediaType: resolvedMediaType,
            coverImage: sanitizeSafeImageUrl(r.cover_image),
            action: String(r.action || ""),
            score: typeof meta.score === "number" ? meta.score : null,
            isPublic: r.is_public !== false,
            createdAt: String(r.created_at),
            likes: [],
            comments: commentsByAct.get(String(r.id)) ?? [],
          });
        }
      }
    }
  } catch {
    // non-fatal
  }

  // 2) Merge local social DB activities
  const localDb = readSocialDb();
  for (const act of localDb.activities) {
    if (!mergedActivities.has(act.id)) {
      mergedActivities.set(act.id, act);
    }
  }

  const activities = Array.from(mergedActivities.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const comments: Array<ActivityCommentItem & { activityTitle: string }> = [];
  for (const act of activities) {
    for (const c of act.comments) {
      comments.push({
        ...c,
        activityTitle: act.mediaTitle || act.action,
      });
    }
  }
  comments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return NextResponse.json({
    activities: activities.slice(0, 80),
    comments: comments.slice(0, 120),
    reports: (localDb.reports ?? []).slice(0, 40),
  });
}

export async function DELETE(request: NextRequest) {
  const guard = await requireCreatorActor();
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => null);
  const targetType = body?.targetType;
  const id = typeof body?.id === "string" ? body.id.trim() : "";
  const activityId = typeof body?.activityId === "string" ? body.activityId.trim() : undefined;

  if ((targetType !== "activity" && targetType !== "comment") || !id) {
    return NextResponse.json(
      { error: "Paramètres de modération invalides (targetType & id requis)." },
      { status: 400 }
    );
  }

  let deletedFromSupabase = false;
  if (UUID_RE.test(id)) {
    try {
      const supabase = getSupabaseAdminClient() ?? (await getSupabaseServerClient());
      if (supabase) {
        const table = targetType === "activity" ? "activity_events" : "activity_comments";
        const { error } = await supabase.from(table).delete().eq("id", id);
        if (!error) {
          deletedFromSupabase = true;
        }
      }
    } catch {
      // fall through
    }
  }

  const deletedFromLocal =
    targetType === "activity"
      ? deleteLocalActivity(id)
      : deleteLocalActivityComment(id, activityId);

  if (!deletedFromSupabase && !deletedFromLocal) {
    return NextResponse.json(
      { error: "Élément introuvable ou déjà supprimé." },
      { status: 404 }
    );
  }

  return NextResponse.json({
    ok: true,
    targetType,
    deletedId: id,
    deletedFromSupabase,
    deletedFromLocal,
  });
}
