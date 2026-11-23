import { NextRequest, NextResponse } from "next/server";
import { isSecureRequest, SESSION_COOKIE_NAME } from "@/lib/server/auth-store";

export async function POST(request: NextRequest) {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureRequest(request),
    path: "/",
    maxAge: 0,
  });
  return res;
}
