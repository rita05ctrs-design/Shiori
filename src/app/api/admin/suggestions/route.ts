import { NextRequest, NextResponse } from "next/server";
import { requireCreatorActor } from "@/lib/server/admin-auth";
import {
  listAllSuggestions,
  mutateSuggestionAsCreator,
} from "@/lib/server/suggestions-store";
import { VALID_SUGGESTION_STATUSES } from "@/lib/suggestions-utils";
import type { SuggestionStatus } from "@/types/media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireCreatorActor();
  if (!guard.ok) return guard.response;

  const { suggestions, newCount } = await listAllSuggestions();
  return NextResponse.json(
    { suggestions, newCount },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function PATCH(request: NextRequest) {
  const guard = await requireCreatorActor();
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id.trim() : "";
  const status = body?.status as SuggestionStatus;

  if (!id || !VALID_SUGGESTION_STATUSES.includes(status)) {
    return NextResponse.json(
      { error: "Identifiant ou statut invalide." },
      { status: 400 }
    );
  }

  const res = await mutateSuggestionAsCreator({
    creatorUserId: guard.actor.id,
    suggestionId: id,
    action: "set_status",
    status,
  });

  return NextResponse.json({
    ok: true,
    suggestions: res.suggestions,
    newCount: res.newCount,
    persistedToCloud: res.persistedToCloud,
  });
}

export async function DELETE(request: NextRequest) {
  const guard = await requireCreatorActor();
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id.trim() : "";
  if (!id) {
    return NextResponse.json({ error: "Identifiant requis." }, { status: 400 });
  }

  const res = await mutateSuggestionAsCreator({
    creatorUserId: guard.actor.id,
    suggestionId: id,
    action: "delete",
  });

  return NextResponse.json({
    ok: true,
    suggestions: res.suggestions,
    newCount: res.newCount,
    persistedToCloud: res.persistedToCloud,
  });
}
