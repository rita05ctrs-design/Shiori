import { NextRequest, NextResponse } from "next/server";
import {
  readAccountDb,
  SESSION_COOKIE_NAME,
  slugifyUsername,
  toPublicProfile,
  verifySessionToken,
  writeAccountDb,
} from "@/lib/server/auth-store";

export async function PUT(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const userId = verifySessionToken(token);
  if (!userId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const db = readAccountDb();
    const idx = db.users.findIndex((u) => u.id === userId);
    if (idx === -1) {
      return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });
    }

    const current = db.users[idx];

    if (Array.isArray(body.library)) {
      current.library = body.library;
    }
    if (Array.isArray(body.notifications)) {
      current.notifications = body.notifications;
    }
    if (Array.isArray(body.activity)) {
      current.activity = body.activity;
    }
    if (body.profile && typeof body.profile === "object") {
      if (typeof body.profile.displayName === "string" && body.profile.displayName.trim()) {
        current.displayName = body.profile.displayName.trim();
        current.avatarInitials = current.displayName.slice(0, 2).toUpperCase();
      }
      if (typeof body.profile.username === "string" && body.profile.username.trim()) {
        const nextSlug = slugifyUsername(body.profile.username);
        const taken = db.users.some((u, i) => i !== idx && u.username === nextSlug);
        if (!taken) current.username = nextSlug;
      }
      if (typeof body.profile.bio === "string") {
        current.bio = body.profile.bio;
      }
      if (typeof body.profile.accentColor === "string") {
        current.accentColor = body.profile.accentColor;
      }
      if (body.profile.avatarUrl === null || typeof body.profile.avatarUrl === "string") {
        current.avatarUrl = body.profile.avatarUrl;
      }
      if (typeof body.profile.isActivityPublic === "boolean") {
        current.isActivityPublic = body.profile.isActivityPublic;
      }
      if (Array.isArray(body.favoriteStaff)) {
        current.favoriteStaff = body.favoriteStaff;
      }
      if (Array.isArray(body.unlockedBadges)) {
        current.unlockedBadges = body.unlockedBadges;
      }
      if (Array.isArray(body.pinnedBadges)) {
        current.pinnedBadges = body.pinnedBadges.slice(0, 3);
      }
      if (typeof body.socialInteractionsCount === "number") {
        current.socialInteractionsCount = Math.max(0, Math.floor(body.socialInteractionsCount));
      }
      if (body.profile.notificationPrefs && typeof body.profile.notificationPrefs === "object") {
        current.notificationPrefs = {
          ...current.notificationPrefs,
          ...body.profile.notificationPrefs,
        };
      }
    }

    db.users[idx] = current;
    writeAccountDb(db);

    return NextResponse.json({
      ok: true,
      user: toPublicProfile(current),
    });
  } catch (err) {
    console.error("[/api/user/sync] error:", err);
    return NextResponse.json({ error: "Erreur de synchronisation" }, { status: 500 });
  }
}
