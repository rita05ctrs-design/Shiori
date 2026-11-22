import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  createSessionToken,
  hashPassword,
  readAccountDb,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SEC,
  slugifyUsername,
  toPublicProfile,
  writeAccountDb,
  type StoredAccount,
} from "@/lib/server/auth-store";
import type { LibraryEntry } from "@/types/media";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const displayName = String(body.displayName ?? "").trim();
    const requestedUsername = String(body.username ?? "").trim();
    const initialLibrary: LibraryEntry[] = Array.isArray(body.initialLibrary)
      ? body.initialLibrary
      : [];

    if (!displayName || displayName.length < 2) {
      return NextResponse.json(
        { error: "Veuillez saisir un nom d'affichage (au moins 2 caractères)." },
        { status: 400 }
      );
    }

    if (!EMAIL_RE.test(email)) {
      return NextResponse.json(
        { error: "Veuillez saisir une adresse e-mail valide." },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Le mot de passe doit contenir au moins 6 caractères." },
        { status: 400 }
      );
    }

    const db = readAccountDb();

    if (db.users.some((u) => u.email === email)) {
      return NextResponse.json(
        { error: "Un compte existe déjà avec cette adresse e-mail. Connectez-vous." },
        { status: 409 }
      );
    }

    // Ensure unique username
    let username = slugifyUsername(requestedUsername || displayName);
    if (db.users.some((u) => u.username === username)) {
      username = `${username}_${Math.floor(100 + Math.random() * 900)}`;
    }

    const nowIso = new Date().toISOString();
    const newAccount: StoredAccount = {
      id: crypto.randomUUID(),
      email,
      username,
      displayName,
      bio: "Membre Shiori — passionné d'animés et de mangas.",
      avatarInitials: displayName.slice(0, 2).toUpperCase(),
      accentColor: "#E5484D",
      passwordHash: hashPassword(password),
      notificationPrefs: {
        airingAlerts: true,
        weeklyDigest: true,
        milestones: true,
        recommendations: true,
      },
      joinedAt: nowIso,
      library: initialLibrary,
      notifications: [
        {
          id: `notif-welcome-${Date.now()}`,
          kind: "SYSTEM",
          title: `Bienvenue sur Shiori, ${displayName} !`,
          body:
            initialLibrary.length > 0
              ? `Votre compte @${username} est actif avec ${initialLibrary.length} œuvres synchronisées.`
              : `Votre compte @${username} est prêt. Explorez le catalogue pour ajouter vos premiers titres !`,
          isRead: false,
          createdAt: nowIso,
        },
      ],
      activity: [],
    };

    db.users.push(newAccount);
    writeAccountDb(db);

    const token = createSessionToken(newAccount.id);
    const res = NextResponse.json({
      user: toPublicProfile(newAccount),
      library: newAccount.library,
      notifications: newAccount.notifications,
      activity: newAccount.activity,
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
    console.error("[/api/auth/register] error:", err);
    return NextResponse.json(
      { error: "Impossible de créer le compte pour le moment." },
      { status: 500 }
    );
  }
}
