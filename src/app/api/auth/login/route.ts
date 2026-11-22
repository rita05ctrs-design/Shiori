import { NextRequest, NextResponse } from "next/server";
import {
  createSessionToken,
  readAccountDb,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SEC,
  toPublicProfile,
  verifyPassword,
} from "@/lib/server/auth-store";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const identifier = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    if (!identifier || !password) {
      return NextResponse.json(
        { error: "Veuillez renseigner votre e-mail et votre mot de passe." },
        { status: 400 }
      );
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
    });

    res.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_MAX_AGE_SEC,
    });

    return res;
  } catch (err) {
    console.error("[/api/auth/login] error:", err);
    return NextResponse.json(
      { error: "Impossible de se connecter pour le moment." },
      { status: 500 }
    );
  }
}
