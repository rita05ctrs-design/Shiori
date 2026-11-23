import { NextRequest, NextResponse } from "next/server";
import {
  readAccountDb,
  SESSION_COOKIE_NAME,
  slugifyUsername,
  toPublicProfile,
  verifySessionToken,
  writeAccountDb,
} from "@/lib/server/auth-store";
import {
  checkRateLimit,
  rateLimitResponse,
  sanitizeSafeImageUrl,
} from "@/lib/server/rate-limit";

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

export async function PUT(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const userId = verifySessionToken(token);
  if (!userId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const limit = checkRateLimit(`user:sync:${userId}`, 60, 60_000);
  if (!limit.ok) {
    return rateLimitResponse(limit.retryAfterSec);
  }

  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Requête JSON invalide" }, { status: 400 });
    }

    const db = readAccountDb();
    const idx = db.users.findIndex((u) => u.id === userId);
    if (idx === -1) {
      return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });
    }

    const current = db.users[idx];

    if (Array.isArray(body.library)) {
      current.library = body.library.slice(0, 10_000);
    }
    if (Array.isArray(body.notifications)) {
      current.notifications = body.notifications.slice(0, 200);
    }
    if (Array.isArray(body.activity)) {
      current.activity = body.activity.slice(0, 200);
    }
    if (body.profile && typeof body.profile === "object") {
      if (typeof body.profile.displayName === "string" && body.profile.displayName.trim()) {
        current.displayName = body.profile.displayName.trim().slice(0, 60);
        current.avatarInitials = current.displayName.slice(0, 2).toUpperCase();
      }
      if (typeof body.profile.username === "string" && body.profile.username.trim()) {
        const nextSlug = slugifyUsername(body.profile.username);
        const taken = db.users.some((u, i) => i !== idx && u.username === nextSlug);
        if (!taken) current.username = nextSlug;
      }
      if (typeof body.profile.bio === "string") {
        current.bio = body.profile.bio.slice(0, 400);
      }
      if (typeof body.profile.accentColor === "string" && HEX_COLOR_RE.test(body.profile.accentColor)) {
        current.accentColor = body.profile.accentColor;
      }
      if (body.profile.avatarUrl === null || typeof body.profile.avatarUrl === "string") {
        current.avatarUrl = sanitizeSafeImageUrl(body.profile.avatarUrl, { allowDataImage: true });
      }
      if (body.profile.bannerUrl === null || typeof body.profile.bannerUrl === "string") {
        current.bannerUrl = sanitizeSafeImageUrl(body.profile.bannerUrl);
      }
      if (typeof body.profile.isActivityPublic === "boolean") {
        current.isActivityPublic = body.profile.isActivityPublic;
      }
      if (
        body.profile.preferredLanguage === "fr" ||
        body.profile.preferredLanguage === "en" ||
        body.profile.preferredLanguage === "es" ||
        body.profile.preferredLanguage === "it"
      ) {
        current.preferredLanguage = body.profile.preferredLanguage;
      }
      if (Array.isArray(body.favoriteStaff)) {
        current.favoriteStaff = body.favoriteStaff.slice(0, 100);
      }
      if (Array.isArray(body.favoriteOrder)) {
        current.favoriteOrder = body.favoriteOrder
          .slice(0, 200)
          .map((n: unknown) => Number(n))
          .filter((n: number) => Number.isFinite(n));
      }
      if (Array.isArray(body.unlockedBadges)) {
        current.unlockedBadges = body.unlockedBadges.slice(0, 100);
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

    if (Array.isArray(body.collections)) {
      current.collections = body.collections.slice(0, 60);
    }
    if (body.uiPreferences && typeof body.uiPreferences === "object") {
      current.uiPreferences = body.uiPreferences;
    }

    db.users[idx] = current;
    writeAccountDb(db);

    return NextResponse.json({
      ok: true,
      user: toPublicProfile(current),
    });
  } catch {
    return NextResponse.json({ error: "Erreur de synchronisation" }, { status: 500 });
  }
}
