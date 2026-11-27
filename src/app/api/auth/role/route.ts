import { NextResponse } from "next/server";
import {
  applyAdminGrantRole,
  readAdminGrantsLedger,
} from "@/lib/server/admin-grants-store";
import {
  isAuthenticatedActor,
  resolveServerActor,
} from "@/lib/server/social-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await resolveServerActor();
  const authenticated = isAuthenticatedActor(actor);

  let effectiveRole = authenticated ? actor.role : "user";
  let grantedBadges: { badgeId: string; unlockedAt: string }[] = [];
  let revokedBadgeIds: string[] = [];

  if (authenticated) {
    try {
      const ledger = await readAdminGrantsLedger();
      const entry = ledger.users[actor.id];
      if (entry) {
        effectiveRole = applyAdminGrantRole(effectiveRole, entry);
        grantedBadges = entry.grantedBadges;
        revokedBadgeIds = entry.revokedBadgeIds;
      }
    } catch {
      // non-fatal
    }
  }

  return NextResponse.json(
    {
      authenticated,
      role: effectiveRole,
      userId: authenticated ? actor.id : null,
      username: authenticated ? actor.username : null,
      grantedBadges,
      revokedBadgeIds,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
