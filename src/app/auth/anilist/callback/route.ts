import crypto from "crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import {
  ANILIST_STATE_COOKIE,
  exchangeAniListCode,
  fetchAniListViewer,
  saveAniListConnection,
} from "@/lib/server/anilist-oauth";
import { isSecureRequest } from "@/lib/server/auth-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function timingSafeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * AniList OAuth 2.0 Callback Route: /auth/anilist/callback
 *
 * Exchanges the authorization code strictly server-side using ANILIST_CLIENT_SECRET,
 * queries AniList Viewer identity, stores the encrypted access token in Supabase
 * (`public.profiles`) + encrypted HttpOnly cookie, and redirects back to /settings.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const returnedState = searchParams.get("state");
  const oauthError = searchParams.get("error");
  const oauthErrorDesc = searchParams.get("error_description");

  if (oauthError) {
    const msg = encodeURIComponent(oauthErrorDesc || oauthError);
    return NextResponse.redirect(
      `${origin}/settings?anilist_error=${msg}#anilist-sync`
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${origin}/settings?anilist_error=missing_code#anilist-sync`
    );
  }

  // Strictly enforce CSRF state verification (prevents OAuth login/link CSRF)
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(ANILIST_STATE_COOKIE)?.value;
  if (!expectedState || !returnedState || !timingSafeEquals(expectedState, returnedState)) {
    return NextResponse.redirect(
      `${origin}/settings?anilist_error=invalid_state#anilist-sync`
    );
  }

  try {
    const { accessToken, expiresIn } = await exchangeAniListCode(code, origin);
    const viewer = await fetchAniListViewer(accessToken);

    const redirectParams = new URLSearchParams({
      anilist_connected: "1",
      anilist_user: viewer.name,
    });

    // Create redirect response first so saveAniListConnection can attach HttpOnly cookie
    const tempUrl = `${origin}/settings?${redirectParams.toString()}#anilist-sync`;
    const response = NextResponse.redirect(tempUrl);

    // Clear one-time CSRF state cookie
    response.cookies.set(ANILIST_STATE_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: isSecureRequest(request),
      path: "/",
      maxAge: 0,
    });

    const persistResult = await saveAniListConnection(
      {
        accessToken,
        userId: viewer.id,
        username: viewer.name,
        avatarUrl: viewer.avatarUrl,
        siteUrl: viewer.siteUrl,
        expiresIn,
      },
      response
    );

    // Append storage metadata to the redirect Location header while keeping cookies intact
    if (persistResult.savedToSupabase) {
      redirectParams.set("anilist_storage", "supabase");
    } else if (persistResult.savedToAccount) {
      redirectParams.set("anilist_storage", "account");
    } else {
      redirectParams.set("anilist_storage", "cookie");
    }
    if (persistResult.supabaseError) {
      redirectParams.set("anilist_sb_warn", persistResult.supabaseError.slice(0, 140));
    }

    response.headers.set(
      "Location",
      `${origin}/settings?${redirectParams.toString()}#anilist-sync`
    );

    return response;
  } catch (err) {
    const msg = encodeURIComponent(
      err instanceof Error ? err.message : "Erreur lors de la connexion AniList"
    );
    return NextResponse.redirect(
      `${origin}/settings?anilist_error=${msg}#anilist-sync`
    );
  }
}
