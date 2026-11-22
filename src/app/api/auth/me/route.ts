import { NextRequest, NextResponse } from "next/server";
import {
  readAccountDb,
  SESSION_COOKIE_NAME,
  toPublicProfile,
  verifySessionToken,
} from "@/lib/server/auth-store";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const userId = verifySessionToken(token);
  if (!userId) {
    return NextResponse.json({ authenticated: false });
  }

  const db = readAccountDb();
  const account = db.users.find((u) => u.id === userId);
  if (!account) {
    return NextResponse.json({ authenticated: false });
  }

  return NextResponse.json({
    authenticated: true,
    user: toPublicProfile(account),
    library: account.library,
    notifications: account.notifications,
    activity: account.activity,
    favoriteStaff: account.favoriteStaff ?? [],
    unlockedBadges: account.unlockedBadges ?? [],
    pinnedBadges: account.pinnedBadges ?? [],
    socialInteractionsCount: account.socialInteractionsCount ?? 0,
  });
}
