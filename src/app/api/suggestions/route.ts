import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/server/rate-limit";
import { broadcastRealtimeEvent } from "@/lib/server/realtime-broadcast";
import {
  isAuthenticatedActor,
  resolveServerActor,
} from "@/lib/server/social-store";
import { createUserSuggestion } from "@/lib/server/suggestions-store";
import { sanitizeSuggestionInput } from "@/lib/suggestions-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUGGESTIONS_REALTIME_TOPIC = "shiori:creator-suggestions";
const SUGGESTIONS_REALTIME_EVENT = "suggestion_created";

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(`suggestions:${ip}`, 6, 10 * 60 * 1000);
  if (!rl.ok) {
    return rateLimitResponse(
      rl.retryAfterSec,
      "Trop de suggestions envoyées récemment. Réessayez dans quelques minutes."
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Payload JSON invalide." }, { status: 400 });
  }

  const validated = sanitizeSuggestionInput({
    category: (body as Record<string, unknown>).category,
    title: (body as Record<string, unknown>).title,
    message: (body as Record<string, unknown>).message,
    device: (body as Record<string, unknown>).device,
    pagePath: (body as Record<string, unknown>).pagePath,
  });

  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const actor = await resolveServerActor();
  const authenticated = isAuthenticatedActor(actor);

  const rawGuestName =
    typeof (body as Record<string, unknown>).guestName === "string"
      ? String((body as Record<string, unknown>).guestName).trim().slice(0, 40)
      : "";

  const result = await createUserSuggestion({
    userId: authenticated ? actor.id : null,
    username: authenticated ? actor.username : null,
    displayName: authenticated ? actor.displayName : rawGuestName || "Invité",
    avatarUrl: authenticated ? actor.avatarUrl : null,
    accentColor: authenticated ? actor.accentColor : null,
    category: validated.category,
    title: validated.title,
    message: validated.message,
    device: validated.device,
    pagePath: validated.pagePath,
  });

  // Push instantly from server -> Supabase Realtime -> every connected Creator tab/device worldwide
  const broadcasted = await broadcastRealtimeEvent(
    SUGGESTIONS_REALTIME_TOPIC,
    SUGGESTIONS_REALTIME_EVENT,
    { suggestion: result.suggestion }
  );

  return NextResponse.json(
    {
      ok: true,
      suggestion: result.suggestion,
      persistedToCloud: result.persistedToCloud,
      broadcasted,
    },
    { status: 201 }
  );
}
