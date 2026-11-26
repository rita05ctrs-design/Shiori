import { NextRequest, NextResponse } from "next/server";
import {
  fetchDiscover,
  fetchHomeData,
  fetchMediaDetail,
  fetchWeeklySchedule,
} from "@/lib/anilist";
import { parseGenreMinRanks } from "@/lib/genre-intensity";
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
    const minYearParam = searchParams.get("minYear");
    const maxYearParam = searchParams.get("maxYear");
    const minScoreParam = searchParams.get("minScore");
    const maxScoreParam = searchParams.get("maxScore");
    const minEpisodesParam = searchParams.get("minEpisodes");
    const maxEpisodesParam = searchParams.get("maxEpisodes");
    const minChaptersParam = searchParams.get("minChapters");
    const maxChaptersParam = searchParams.get("maxChapters");
    const pageParam = searchParams.get("page");
    const perPageParam = searchParams.get("perPage");
    const genresParam = searchParams.get("genres");
    const genreRanksParam = searchParams.get("genreRanks");
    const minGenreRankParam = searchParams.get("minGenreRank");
    const tagsParam = searchParams.get("tags");

    const genres = genresParam
      ? genresParam
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined;
    const tags = tagsParam
      ? tagsParam
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined;

    const toPosInt = (v: string | null) => {
      if (!v || v === "ALL") return undefined;
      const n = Number(v);
      return Number.isFinite(n) && n > 0 ? Math.trunc(n) : undefined;
    };

    const genreMinRanks = genreRanksParam
      ? parseGenreMinRanks(genreRanksParam, genres)
      : undefined;

    const result = await fetchDiscover({
      search: searchParams.get("search") ?? undefined,
      type,
      genre: searchParams.get("genre") ?? undefined,
      genres,
      minGenreRank: toPosInt(minGenreRankParam),
      genreMinRanks,
      tags,
      minScore: toPosInt(minScoreParam),
      maxScore: toPosInt(maxScoreParam),
      minEpisodes: toPosInt(minEpisodesParam),
      maxEpisodes: toPosInt(maxEpisodesParam),
      minChapters: toPosInt(minChaptersParam),
      maxChapters: toPosInt(maxChaptersParam),
      season: searchParams.get("season") ?? undefined,
      year: yearParam && yearParam !== "ALL" ? yearParam : undefined,
      minYear: toPosInt(minYearParam),
      maxYear: toPosInt(maxYearParam),
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
