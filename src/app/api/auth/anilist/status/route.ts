import { NextRequest, NextResponse } from "next/server";
import {
  getAniListConnection,
  getAniListOAuthConfig,
  isAniListOAuthConfigured,
} from "@/lib/server/anilist-oauth";
import type { AniListConnectionStatus } from "@/types/media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Returns safe, non-secret AniList OAuth connection status for the active user.
 * Never returns the OAuth access token to the browser.
 */
export async function GET(request: NextRequest) {
  const { origin } = new URL(request.url);
  const configured = isAniListOAuthConfigured();
  const cfg = getAniListOAuthConfig(origin);
  const conn = await getAniListConnection();

  const payload: AniListConnectionStatus = {
    configured,
    connected: Boolean(conn),
    storage: conn?.storage ?? null,
    redirectUri:
      cfg?.redirectUri ??
      process.env.NEXT_PUBLIC_ANILIST_REDIRECT_URI ??
      `${origin}/auth/anilist/callback`,
    user: conn
      ? {
          id: conn.userId,
          name: conn.username,
          avatarUrl: conn.avatarUrl,
          siteUrl: conn.siteUrl,
        }
      : null,
    connectedAt: conn?.connectedAt ?? null,
    expiresAt: conn?.expiresAt ?? null,
  };

  return NextResponse.json(payload);
}
