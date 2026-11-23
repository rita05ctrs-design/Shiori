import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { ensureServerSupabaseProfile } from "@/lib/server/social-store";

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
  const nextPath =
    rawNext.startsWith("/") && !rawNext.startsWith("//") && !rawNext.startsWith("/\\")
      ? rawNext
      : "/";

  if (code) {
    const supabase = await getSupabaseServerClient();
    if (supabase) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        const user = data?.user;
        if (user) {
          const displayName =
            (user.user_metadata?.display_name as string) ||
            (user.user_metadata?.full_name as string) ||
            (user.user_metadata?.name as string) ||
            user.email?.split("@")[0] ||
            "Membre Shiori";
          const username =
            (user.user_metadata?.username as string) || displayName;
          await ensureServerSupabaseProfile(supabase, {
            id: user.id,
            username,
            displayName,
            avatarUrl: (user.user_metadata?.avatar_url as string) ?? null,
          });
        }
        return NextResponse.redirect(`${origin}${nextPath}`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/settings?auth_error=oauth_callback`);
}
