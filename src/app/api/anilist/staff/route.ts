import { NextRequest, NextResponse } from "next/server";
import type { FavoriteVoiceActor } from "@/types/media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ANILIST_ENDPOINT = "https://graphql.anilist.co";

const FALLBACK_SEIYUU: FavoriteVoiceActor[] = [
  {
    id: 112215,
    name: "Atsumi Tanezaki",
    nativeName: "種﨑敦美",
    image: "https://s4.anilist.co/file/anilistcdn/staff/large/n112215-kfABGD8W2YSJ.jpg",
    language: "Japanese",
    siteUrl: "https://anilist.co/staff/112215",
    notableRoles: [
      { name: "Frieren", mediaTitle: "Frieren: Beyond Journey's End" },
      { name: "Anya Forger", mediaTitle: "SPY x FAMILY" },
    ],
  },
  {
    id: 95591,
    name: "Kenjirou Tsuda",
    nativeName: "津田健次郎",
    image: "https://s4.anilist.co/file/anilistcdn/staff/large/n95591-WQGdD3ubbeoq.jpg",
    language: "Japanese",
    siteUrl: "https://anilist.co/staff/95591",
    notableRoles: [
      { name: "Kento Nanami", mediaTitle: "Jujutsu Kaisen" },
      { name: "Seto Kaiba", mediaTitle: "Yu-Gi-Oh!" },
    ],
  },
  {
    id: 95185,
    name: "Kana Hanazawa",
    nativeName: "花澤香菜",
    image: "https://s4.anilist.co/file/anilistcdn/staff/large/n95185-x8ZYvtN7SegC.png",
    language: "Japanese",
    siteUrl: "https://anilist.co/staff/95185",
    notableRoles: [
      { name: "Mitsuri Kanroji", mediaTitle: "Demon Slayer" },
      { name: "Mayuri Shiina", mediaTitle: "Steins;Gate" },
    ],
  },
  {
    id: 95118,
    name: "Hiroshi Kamiya",
    nativeName: "神谷浩史",
    image: "https://s4.anilist.co/file/anilistcdn/staff/large/n95118-oOElrn1aSaiC.png",
    language: "Japanese",
    siteUrl: "https://anilist.co/staff/95118",
    notableRoles: [
      { name: "Levi Ackerman", mediaTitle: "Attack on Titan" },
      { name: "Trafalgar Law", mediaTitle: "ONE PIECE" },
    ],
  },
  {
    id: 95065,
    name: "Mamoru Miyano",
    nativeName: "宮野真守",
    image: "https://s4.anilist.co/file/anilistcdn/staff/large/n95065-eyynywrhombR.png",
    language: "Japanese",
    siteUrl: "https://anilist.co/staff/95065",
    notableRoles: [
      { name: "Rintarou Okabe", mediaTitle: "Steins;Gate" },
      { name: "Light Yagami", mediaTitle: "Death Note" },
    ],
  },
];

/**
 * Searches AniList Staff / Voice Actors (Seiyuu) via AniList public GraphQL API.
 * GET /api/anilist/staff?q=Tsuda
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();

  try {
    const query = q
      ? `
        query ($search: String) {
          Page(page: 1, perPage: 16) {
            staff(search: $search, sort: [SEARCH_MATCH, FAVOURITES_DESC]) {
              id
              name { full native }
              image { large medium }
              languageV2
              primaryOccupations
              siteUrl
              characters(perPage: 2, sort: [FAVOURITES_DESC]) {
                nodes {
                  name { full }
                  media(perPage: 1, sort: [POPULARITY_DESC]) {
                    nodes { title { english romaji } }
                  }
                }
              }
            }
          }
        }
      `
      : `
        query {
          Page(page: 1, perPage: 16) {
            staff(sort: [FAVOURITES_DESC]) {
              id
              name { full native }
              image { large medium }
              languageV2
              primaryOccupations
              siteUrl
              characters(perPage: 2, sort: [FAVOURITES_DESC]) {
                nodes {
                  name { full }
                  media(perPage: 1, sort: [POPULARITY_DESC]) {
                    nodes { title { english romaji } }
                  }
                }
              }
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
        variables: q ? { search: q } : {},
      }),
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json({ items: FALLBACK_SEIYUU });
    }

    const json = await res.json().catch(() => ({}));
    const rawList = Array.isArray(json?.data?.Page?.staff) ? json.data.Page.staff : [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items: FavoriteVoiceActor[] = rawList.map((s: any) => ({
      id: Number(s.id),
      name: String(s.name?.full ?? "Staff"),
      nativeName: s.name?.native ?? null,
      image: s.image?.large ?? s.image?.medium ?? "",
      language: s.languageV2 ?? null,
      siteUrl: s.siteUrl ?? `https://anilist.co/staff/${s.id}`,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      notableRoles: (s.characters?.nodes ?? []).map((c: any) => ({
        name: String(c?.name?.full ?? ""),
        mediaTitle:
          c?.media?.nodes?.[0]?.title?.english ??
          c?.media?.nodes?.[0]?.title?.romaji ??
          null,
      })),
    }));

    return NextResponse.json({ items: items.length > 0 ? items : FALLBACK_SEIYUU });
  } catch {
    return NextResponse.json({ items: FALLBACK_SEIYUU });
  }
}
