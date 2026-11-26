import { NextResponse } from "next/server";
import {
  isAuthenticatedActor,
  resolveServerActor,
} from "@/lib/server/social-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await resolveServerActor();
  const authenticated = isAuthenticatedActor(actor);

  return NextResponse.json(
    {
      authenticated,
      role: authenticated ? actor.role : "user",
      userId: authenticated ? actor.id : null,
      username: authenticated ? actor.username : null,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
