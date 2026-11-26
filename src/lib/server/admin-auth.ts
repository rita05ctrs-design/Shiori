import { NextResponse } from "next/server";
import {
  isAuthenticatedActor,
  resolveServerActor,
  type ActiveActor,
} from "@/lib/server/social-store";
export {
  isCreatorRole,
  isStaffRole,
  normalizeRole,
  resolveEffectiveRole,
} from "@/lib/server/role-resolver";

export type CreatorGuardResult =
  | { ok: true; actor: ActiveActor }
  | { ok: false; response: NextResponse };

/**
 * Strictly guards `/api/admin/*` endpoints.
 * Returns HTTP 401 for unauthenticated callers and HTTP 403 for authenticated non-creators.
 */
export async function requireCreatorActor(): Promise<CreatorGuardResult> {
  const actor = await resolveServerActor();
  if (!isAuthenticatedActor(actor)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Authentification requise pour accéder à l'administration." },
        { status: 401 }
      ),
    };
  }
  if (actor.role !== "creator") {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Accès réservé au Créateur de Shiori." },
        { status: 403 }
      ),
    };
  }
  return { ok: true, actor };
}
