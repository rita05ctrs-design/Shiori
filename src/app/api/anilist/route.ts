import { NextRequest, NextResponse } from "next/server";
import {
  fetchDiscover,
  fetchHomeData,
  fetchMediaDetail,
  fetchWeeklySchedule,
} from "@/lib/anilist";
import type { MediaType } from "@/types/media";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action") ?? "discover";

  try {
    if (action === "home") {
      const data = await fetchHomeData();
      return NextResponse.json(data);
    }

    if (action === "schedule") {
      const items = await fetchWeeklySchedule();
      return NextResponse.json({ items });
    }

    if (action === "detail") {
      const id = Number(searchParams.get("id"));
      if (!id || Number.isNaN(id)) {
        return NextResponse.json({ error: "Invalid media ID" }, { status: 400 });
      }
      const detail = await fetchMediaDetail(id);
      if (!detail) {
        return NextResponse.json({ error: "Media not found" }, { status: 404 });
      }
      return NextResponse.json(detail);
    }

    // Default: discover / search
    const typeParam = searchParams.get("type");
    const type: MediaType = typeParam === "MANGA" ? "MANGA" : "ANIME";
    const yearParam = searchParams.get("year");
    const pageParam = searchParams.get("page");
    const perPageParam = searchParams.get("perPage");

    const result = await fetchDiscover({
      search: searchParams.get("search") ?? undefined,
      type,
      genre: searchParams.get("genre") ?? undefined,
      season: searchParams.get("season") ?? undefined,
      year: yearParam && yearParam !== "ALL" ? Number(yearParam) : undefined,
      format: searchParams.get("format") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      sort: searchParams.get("sort") ?? "TRENDING_DESC",
      page: pageParam ? Math.max(1, Number(pageParam)) : 1,
      perPage: perPageParam ? Math.min(36, Math.max(1, Number(perPageParam))) : 24,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("[/api/anilist] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch AniList data" },
      { status: 500 }
    );
  }
}
