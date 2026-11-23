import { NextRequest, NextResponse } from "next/server";
import {
  createSessionToken,
  isSecureRequest,
  readAccountDb,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SEC,
  toPublicProfile,
  verifyPassword,
} from "@/lib/server/auth-store";
import {
  checkRateLimit,
  getClientIp,
  rateLimitResponse,
} from "@/lib/server/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const ipLimit = checkRateLimit(`auth:login:ip:${ip}`, 20, 5 * 60_000);
    if (!ipLimit.ok) {
      return rateLimitResponse(ipLimit.retryAfterSec);
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Requête JSON invalide." },
        { status: 400 }
      );
    }

    const identifier = String(body.email ?? "").trim().toLowerCase().slice(0, 160);
    const password = String(body.password ?? "");

    if (!identifier || !password || password.length > 256) {
      return NextResponse.json(
        { error: "Veuillez renseigner votre e-mail et votre mot de passe." },
        { status: 400 }
      );
    }

    const idLimit = checkRateLimit(`auth:login:id:${ip}:${identifier}`, 10, 5 * 60_000);
    if (!idLimit.ok) {
      return rateLimitResponse(idLimit.retryAfterSec);
    }

    const db = readAccountDb();
    const account = db.users.find(
      (u) => u.email === identifier || u.username === identifier.replace(/^@/, "")
    );

    if (!account || !verifyPassword(password, account.passwordHash)) {
      return NextResponse.json(
        { error: "Adresse e-mail ou mot de passe incorrect." },
        { status: 401 }
      );
    }

    const token = createSessionToken(account.id);
    const res = NextResponse.json({
      user: toPublicProfile(account),
      library: account.library,
      notifications: account.notifications,
      activity: account.activity,
      favoriteStaff: account.favoriteStaff ?? [],
      favoriteOrder: account.favoriteOrder ?? [],
      collections: account.collections ?? [],
      uiPreferences: account.uiPreferences ?? null,
      unlockedBadges: account.unlockedBadges ?? [],
      pinnedBadges: account.pinnedBadges ?? [],
      socialInteractionsCount: account.socialInteractionsCount ?? 0,
    });

    res.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: isSecureRequest(request),
      path: "/",
      maxAge: SESSION_MAX_AGE_SEC,
    });

    return res;
  } catch {
    return NextResponse.json(
      { error: "Impossible de se connecter pour le moment." },
      { status: 500 }
    );
  }
}
