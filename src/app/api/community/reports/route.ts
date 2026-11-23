import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/server/rate-limit";
import {
  isAuthenticatedActor,
  makeId,
  readSocialDb,
  resolveServerActor,
  writeSocialDb,
} from "@/lib/server/social-store";
import type { ContentReportRecord, ReportReason, ReportTargetType } from "@/types/media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_TYPES = new Set<ReportTargetType>([
  "profile",
  "activity",
  "comment",
  "message",
]);
const ALLOWED_REASONS = new Set<ReportReason>([
  "spam",
  "harassment",
  "inappropriate",
  "spoiler",
  "other",
]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v: string) => UUID_RE.test(v);

export async function POST(request: NextRequest) {
  try {
    const actor = await resolveServerActor();
    if (!isAuthenticatedActor(actor)) {
      return NextResponse.json(
        { error: "Connexion requise pour signaler un contenu." },
        { status: 401 }
      );
    }

    const rl = checkRateLimit(`report:${actor.id}:${getClientIp(request)}`, 10, 60_000);
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterSec);

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Requête JSON invalide." }, { status: 400 });
    }
    const targetType = String(body?.targetType ?? "") as ReportTargetType;
    const targetId = String(body?.targetId ?? "").trim().slice(0, 120);
    const targetUserId = body?.targetUserId ? String(body.targetUserId).trim() : null;
    const reason = String(body?.reason ?? "") as ReportReason;
    const details = String(body?.details ?? "").trim().slice(0, 600);

    if (!ALLOWED_TYPES.has(targetType)) {
      return NextResponse.json({ error: "Type de signalement invalide." }, { status: 400 });
    }
    if (!targetId) {
      return NextResponse.json({ error: "Cible du signalement manquante." }, { status: 400 });
    }
    if (!ALLOWED_REASONS.has(reason)) {
      return NextResponse.json({ error: "Motif de signalement invalide." }, { status: 400 });
    }

    let reportId = makeId("rep");
    let savedToSupabase = false;

    if (actor.source === "supabase" && isUuid(actor.id)) {
      try {
        const supabase = await getSupabaseServerClient();
        if (supabase) {
          const { data, error } = await supabase
            .from("content_reports")
            .insert({
              reporter_id: actor.id,
              target_type: targetType,
              target_id: targetId,
              target_user_id: targetUserId && isUuid(targetUserId) ? targetUserId : null,
              reason,
              details,
            })
            .select("id")
            .maybeSingle();

          if (!error) {
            if (data?.id) reportId = String(data.id);
            savedToSupabase = true;
          }
        }
      } catch {
        // graceful fallback if migration not yet applied
      }
    }

    const record: ContentReportRecord = {
      id: reportId,
      reporterId: actor.id,
      targetType,
      targetId,
      targetUserId,
      reason,
      details,
      createdAt: new Date().toISOString(),
    };

    if (actor.source === "account") {
      try {
        const db = readSocialDb();
        db.reports = [record, ...(db.reports ?? [])].slice(0, 200);
        writeSocialDb(db);
      } catch {
        // non-fatal
      }
    }

    return NextResponse.json({
      ok: true,
      reportId,
      savedToSupabase,
      message: "Votre signalement a bien été enregistré. Merci de contribuer à la sécurité de Shiori.",
    });
  } catch {
    return NextResponse.json(
      { error: "Impossible d'enregistrer le signalement." },
      { status: 400 }
    );
  }
}
