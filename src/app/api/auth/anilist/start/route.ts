import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  ANILIST_STATE_COOKIE,
  buildAniListAuthorizeUrl,
} from "@/lib/server/anilist-oauth";
import { isSecureRequest } from "@/lib/server/auth-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Initiates the AniList OAuth 2.0 Authorization Code flow strictly server-side.
 * Generates a cryptographic CSRF `state` stored in an HttpOnly cookie.
 */
export async function GET(request: NextRequest) {
  const { origin } = new URL(request.url);
  const state = crypto.randomBytes(24).toString("base64url");
  const authorizeUrl = buildAniListAuthorizeUrl(state, origin);

  if (!authorizeUrl) {
    return NextResponse.redirect(
      `${origin}/settings?anilist_error=not_configured#anilist-sync`
    );
  }

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(ANILIST_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureRequest(request),
    path: "/",
    maxAge: 60 * 10, // 10 minutes
  });

  return response;
}
