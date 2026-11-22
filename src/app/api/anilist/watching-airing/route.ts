import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ANILIST_ENDPOINT = "https://graphql.anilist.co";

export interface WatchingAiringItem {
  mediaId: number;
  title: {
    romaji: string;
    english: string | null;
    native: string | null;
  };
  coverImage: {
    extraLarge: string;
    large: string;
    color: string | null;
  };
  bannerImage: string | null;
  episodes: number | null;
  averageScore: number | null;
  format: string | null;
  studio: string | null;
  genres: string[];
  latestAiredEpisode: number;
  latestAiredAt: number | null;
  nextAiringEpisode: {
    episode: number;
    airingAt: number;
    timeUntilAiring: number;
  } | null;
}

/**
 * Given a user's active Watching / Plan to Watch anime mediaIds (up to 50),
 * fetches live RELEASING airing status + latest aired episode timestamp in one
 * batched AniList GraphQL request so the 1-click Weekly Episode Tracker always
 * knows every show the user is following — even imported AniList shows!
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const rawIds = Array.isArray(body?.ids) ? body.ids : [];
    const ids: number[] = Array.from(
      new Set<number>(
        rawIds
          .map((n: unknown) => Number(n))
          .filter((n: number) => Number.isInteger(n) && n > 0)
      )
    ).slice(0, 50);

    if (ids.length === 0) {
      return NextResponse.json({ items: [] });
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const pastStart = nowSec - 14 * 86400;

    const query = `
      query ($ids: [Int], $pastStart: Int, $now: Int) {
        releasing: Page(page: 1, perPage: 50) {
          media(id_in: $ids, type: ANIME, status: RELEASING) {
            id
            title { romaji english native }
            coverImage { extraLarge large color }
            bannerImage
            episodes
            averageScore
            format
            genres
            studios(isMain: true) { nodes { name } }
            nextAiringEpisode {
              episode
              airingAt
              timeUntilAiring
            }
          }
        }
        recentSchedules: Page(page: 1, perPage: 50) {
          airingSchedules(mediaId_in: $ids, airingAt_greater: $pastStart, airingAt_lesser: $now, sort: TIME_DESC) {
            mediaId
            episode
            airingAt
          }
        }
      }
    `;

    const res = await fetch(ANILIST_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        query,
        variables: { ids, pastStart, now: nowSec },
      }),
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json({ items: [] });
    }

    const json = await res.json().catch(() => ({}));
    const releasingMedia = json?.data?.releasing?.media ?? [];
    const recentSchedules = json?.data?.recentSchedules?.airingSchedules ?? [];

    // Map mediaId -> most recent aired schedule slot
    const latestSlotByMedia = new Map<number, { episode: number; airingAt: number }>();
    for (const s of recentSchedules) {
      if (!s?.mediaId) continue;
      const existing = latestSlotByMedia.get(s.mediaId);
      if (!existing || s.airingAt > existing.airingAt) {
        latestSlotByMedia.set(s.mediaId, {
          episode: Number(s.episode),
          airingAt: Number(s.airingAt),
        });
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items: WatchingAiringItem[] = releasingMedia.map((m: any) => {
      const slot = latestSlotByMedia.get(m.id);
      const nextEp = m.nextAiringEpisode
        ? {
            episode: Number(m.nextAiringEpisode.episode),
            airingAt: Number(m.nextAiringEpisode.airingAt),
            timeUntilAiring: Number(m.nextAiringEpisode.timeUntilAiring),
          }
        : null;

      // Determine latest aired episode reliably
      const latestFromNext = nextEp ? Math.max(0, nextEp.episode - 1) : 0;
      const latestAiredEpisode = Math.max(slot?.episode ?? 0, latestFromNext);

      return {
        mediaId: Number(m.id),
        title: {
          romaji: m.title?.romaji ?? "Sans titre",
          english: m.title?.english ?? null,
          native: m.title?.native ?? null,
        },
        coverImage: {
          extraLarge: m.coverImage?.extraLarge ?? m.coverImage?.large ?? "",
          large: m.coverImage?.large ?? m.coverImage?.extraLarge ?? "",
          color: m.coverImage?.color ?? null,
        },
        bannerImage: m.bannerImage ?? null,
        episodes: m.episodes ?? null,
        averageScore: m.averageScore ?? null,
        format: m.format ?? null,
        studio: m.studios?.nodes?.[0]?.name ?? null,
        genres: m.genres ?? [],
        latestAiredEpisode,
        latestAiredAt:
          slot?.airingAt ??
          (nextEp && nextEp.airingAt - 7 * 86400 <= nowSec
            ? nextEp.airingAt - 7 * 86400
            : null),
        nextAiringEpisode: nextEp,
      };
    });

    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [] });
  }
}
