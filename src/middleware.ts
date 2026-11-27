import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (
    !url ||
    !key ||
    !url.startsWith("https://") ||
    url.includes("votre-projet") ||
    key.includes("votre-cle")
  ) {
    return NextResponse.next();
  }

  // Fast-path: skip remote Supabase Auth network calls for guests (no sb- cookie),
  // Next.js prefetches, and client-side App Router soft navigations to regular pages.
  // Full document loads, /admin, /auth, and /api routes still validate/refresh tokens normally.
  const hasSupabaseCookie = request.cookies
    .getAll()
    .some((cookie) => cookie.name.startsWith("sb-"));
  if (!hasSupabaseCookie) {
    return NextResponse.next();
  }

  const isPrefetch =
    request.headers.get("next-router-prefetch") === "1" ||
    request.headers.get("purpose") === "prefetch";
  if (isPrefetch) {
    return NextResponse.next();
  }

  const pathname = request.nextUrl.pathname;
  const isRscSoftNav = request.headers.get("rsc") === "1";
  if (
    isRscSoftNav &&
    !pathname.startsWith("/admin") &&
    !pathname.startsWith("/auth")
  ) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  try {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options?: Record<string, unknown>;
          }[]
        ) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    });

    // Refreshes expired Supabase auth tokens cleanly in SSR cookies without blocking anonymous traffic
    await supabase.auth.getUser();
  } catch {
    // Non-fatal if Supabase is temporarily unreachable
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|icon.*|apple-touch-icon.*|manifest\\.json|sw\\.js|offline\\.html|robots\\.txt|sitemap\\.xml).*)",
  ],
};
