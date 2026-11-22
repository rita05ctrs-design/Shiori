import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Server-side OAuth PKCE callback for Supabase (Google OAuth, Magic Links, etc.).
 * Exchanges the temporary authorization code on the server and stores the session
 * exclusively in HttpOnly cookies — tokens are never exposed in frontend URLs.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "/";
  // Prevent open redirects: allow only safe internal paths
  const nextPath = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  if (code) {
    const supabase = await getSupabaseServerClient();
    if (supabase) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return NextResponse.redirect(`${origin}${nextPath}`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/settings?auth_error=oauth_callback`);
}
