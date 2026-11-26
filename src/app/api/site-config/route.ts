import { NextResponse } from "next/server";
import { getSiteConfig } from "@/lib/server/site-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const config = await getSiteConfig();
  return NextResponse.json(
    { config },
    { headers: { "Cache-Control": "no-store" } }
  );
}
