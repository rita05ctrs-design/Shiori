import { NextResponse } from "next/server";
import { clearAniListConnection } from "@/lib/server/anilist-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Disconnects the user's AniList OAuth integration from Supabase profiles,
 * local Shiori server account, and encrypted HttpOnly cookies.
 */
export async function POST() {
  const response = NextResponse.json({ ok: true });
  await clearAniListConnection(response);
  return response;
}
