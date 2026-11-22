import { NextRequest, NextResponse } from "next/server";
import { getAniListConnection } from "@/lib/server/anilist-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ANILIST_ENDPOINT = "https://graphql.anilist.co";

export interface AniListFeedReply {
  id: number;
  text: string;
  likeCount: number;
  isLiked: boolean;
  createdAt: number;
  user: {
    id: number;
    name: string;
    avatarUrl: string | null;
    siteUrl: string;
  };
}

export interface AniListFeedItem {
  id: number;
  kind: "ANIME_LIST" | "MANGA_LIST" | "TEXT";
  statusRaw: string | null;
  progress: string | null;
  actionLabel: string;
  text: string | null;
  likeCount: number;
  replyCount: number;
  isLiked: boolean;
  createdAt: number; // unix sec
  siteUrl: string | null;
  user: {
    id: number;
    name: string;
    avatarUrl: string | null;
    siteUrl: string;
  };
  media: {
    id: number;
    type: "ANIME" | "MANGA";
    title: string;
    coverImage: string;
    format: string | null;
    averageScore: number | null;
  } | null;
}

function translateAniListStatus(status: string | null, progress: string | null): string {
  const s = (status ?? "").toLowerCase().trim();
  const prog = progress ? ` ${progress}` : "";

  if (s.includes("watched episode")) {
    return progress?.includes("-")
      ? `A regardé les épisodes${prog}`
      : `A regardé l'épisode${prog}`;
  }
  if (s.includes("rewatched episode")) {
    return progress?.includes("-")
      ? `A revu les épisodes${prog}`
      : `A revu l'épisode${prog}`;
  }
  if (s.includes("read chapter")) {
    return progress?.includes("-")
      ? `A lu les chapitres${prog}`
      : `A lu le chapitre${prog}`;
  }
  if (s.includes("reread chapter")) {
    return progress?.includes("-")
      ? `A relu les chapitres${prog}`
      : `A relu le chapitre${prog}`;
  }
  if (s === "completed") return "A terminé";
  if (s === "rewatched") return "A revu en entier";
  if (s === "reread") return "A relu en entier";
  if (s === "plans to watch") return "A ajouté en Plan to Watch";
  if (s === "plans to read") return "A ajouté à lire";
  if (s === "paused watching" || s === "paused reading") return "A mis en pause";
  if (s === "dropped") return "A abandonné";

  return status ? `${status.charAt(0).toUpperCase() + status.slice(1)}${prog}` : "Activité AniList";
}

function cleanAniListMarkdown(raw: string): string {
  return raw
    .replace(/~!([\s\S]*?)!~/g, "[Spoiler masqué]")
    .replace(/img\d*\(([^)]+)\)/gi, "")
    .replace(/~~~+/g, "")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function queryAniList(
  query: string,
  variables: Record<string, unknown>,
  accessToken?: string | null
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const res = await fetch(ANILIST_ENDPOINT, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.errors?.length) {
    const err = new Error(json.errors?.[0]?.message || `AniList HTTP ${res.status}`) as Error & {
      status?: number;
    };
    err.status = json.errors?.[0]?.status ?? res.status;
    throw err;
  }
  return json.data;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const repliesFor = searchParams.get("repliesFor");
  const conn = await getAniListConnection();

  // Optional sub-query: load replies for a specific AniList activity ID
  if (repliesFor) {
    const activityId = Number(repliesFor);
    if (!Number.isInteger(activityId) || activityId <= 0) {
      return NextResponse.json({ replies: [] });
    }
    try {
      const q = `
        query ($activityId: Int!) {
          Page(page: 1, perPage: 25) {
            activityReplies(activityId: $activityId) {
              id
              text(asHtml: false)
              likeCount
              isLiked
              createdAt
              user {
                id
                name
                avatar { large medium }
                siteUrl
              }
            }
          }
        }
      `;
      const data = await queryAniList(q, { activityId }, conn?.accessToken);
      const raw = Array.isArray(data?.Page?.activityReplies)
        ? data.Page.activityReplies
        : [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const replies: AniListFeedReply[] = raw.map((r: any) => ({
        id: Number(r.id),
        text: cleanAniListMarkdown(String(r.text ?? "")),
        likeCount: Number(r.likeCount ?? 0),
        isLiked: Boolean(r.isLiked),
        createdAt: Number(r.createdAt ?? 0),
        user: {
          id: Number(r.user?.id ?? 0),
          name: String(r.user?.name ?? "Utilisateur AniList"),
          avatarUrl: r.user?.avatar?.large ?? r.user?.avatar?.medium ?? null,
          siteUrl:
            r.user?.siteUrl ??
            `https://anilist.co/user/${encodeURIComponent(String(r.user?.name ?? ""))}`,
        },
      }));
      return NextResponse.json({ replies, authenticated: Boolean(conn) });
    } catch {
      return NextResponse.json({ replies: [], authenticated: Boolean(conn) });
    }
  }

  const scope = (searchParams.get("scope") ?? "global") as "global" | "following" | "me";
  const filter = (searchParams.get("filter") ?? "ALL") as "ALL" | "ANIME" | "MANGA" | "TEXT";
  const page = Math.max(1, Number(searchParams.get("page") ?? 1) || 1);
  const perPage = Math.min(30, Math.max(5, Number(searchParams.get("perPage") ?? 20) || 20));
  const paramUserId = Number(searchParams.get("userId") ?? 0);
  const paramUsername = (searchParams.get("username") ?? "").trim().replace(/^@/, "");

  // Following feed requires AniList OAuth token
  if (scope === "following" && !conn?.accessToken) {
    return NextResponse.json({
      activities: [],
      hasNextPage: false,
      page,
      authenticated: false,
      requiresAuth: true,
      anilistUser: null,
    });
  }

  let resolvedUserId: number | undefined;
  if (scope === "me") {
    if (conn?.userId) {
      resolvedUserId = conn.userId;
    } else if (Number.isInteger(paramUserId) && paramUserId > 0) {
      resolvedUserId = paramUserId;
    } else if (paramUsername) {
      try {
        const uData = await queryAniList(
          `query ($name: String) { User(name: $name) { id name } }`,
          { name: paramUsername },
          conn?.accessToken
        );
        if (uData?.User?.id) resolvedUserId = Number(uData.User.id);
      } catch {
        return NextResponse.json({
          activities: [],
          hasNextPage: false,
          page,
          authenticated: Boolean(conn),
          error: `Utilisateur AniList « ${paramUsername} » introuvable.`,
        });
      }
    } else {
      return NextResponse.json({
        activities: [],
        hasNextPage: false,
        page,
        authenticated: Boolean(conn),
        needsUsername: true,
      });
    }
  }

  const typeIn =
    filter === "ANIME"
      ? ["ANIME_LIST"]
      : filter === "MANGA"
        ? ["MANGA_LIST"]
        : filter === "TEXT"
          ? ["TEXT"]
          : ["ANIME_LIST", "MANGA_LIST", "TEXT"];

  const query = `
    query ($page: Int, $perPage: Int, $typeIn: [ActivityType], $isFollowing: Boolean, $userId: Int) {
      Page(page: $page, perPage: $perPage) {
        pageInfo {
          currentPage
          hasNextPage
        }
        activities(
          sort: ID_DESC
          type_in: $typeIn
          isFollowing: $isFollowing
          userId: $userId
        ) {
          __typename
          ... on ListActivity {
            id
            type
            status
            progress
            likeCount
            replyCount
            isLiked
            createdAt
            siteUrl
            user {
              id
              name
              avatar { large medium }
              siteUrl
            }
            media {
              id
              type
              isAdult
              title { english romaji }
              coverImage { large medium }
              format
              averageScore
            }
          }
          ... on TextActivity {
            id
            type
            text(asHtml: false)
            likeCount
            replyCount
            isLiked
            createdAt
            siteUrl
            user {
              id
              name
              avatar { large medium }
              siteUrl
            }
          }
        }
      }
    }
  `;

  try {
    const variables: Record<string, unknown> = {
      page,
      perPage,
      typeIn,
    };
    if (scope === "following") variables.isFollowing = true;
    if (scope === "me" && resolvedUserId) variables.userId = resolvedUserId;

    const data = await queryAniList(query, variables, conn?.accessToken);
    const rawList = Array.isArray(data?.Page?.activities) ? data.Page.activities : [];

    const activities: AniListFeedItem[] = [];
    for (const a of rawList) {
      if (!a || !a.user) continue;

      if (a.__typename === "ListActivity") {
        if (!a.media || a.media.isAdult) continue;
        const kind: "ANIME_LIST" | "MANGA_LIST" =
          a.media.type === "MANGA" ? "MANGA_LIST" : "ANIME_LIST";
        activities.push({
          id: Number(a.id),
          kind,
          statusRaw: a.status ?? null,
          progress: a.progress ?? null,
          actionLabel: translateAniListStatus(a.status ?? null, a.progress ?? null),
          text: null,
          likeCount: Number(a.likeCount ?? 0),
          replyCount: Number(a.replyCount ?? 0),
          isLiked: Boolean(a.isLiked),
          createdAt: Number(a.createdAt ?? 0),
          siteUrl: a.siteUrl ?? null,
          user: {
            id: Number(a.user.id),
            name: String(a.user.name),
            avatarUrl: a.user.avatar?.large ?? a.user.avatar?.medium ?? null,
            siteUrl:
              a.user.siteUrl ??
              `https://anilist.co/user/${encodeURIComponent(String(a.user.name))}`,
          },
          media: {
            id: Number(a.media.id),
            type: a.media.type === "MANGA" ? "MANGA" : "ANIME",
            title: String(a.media.title?.english || a.media.title?.romaji || "Sans titre"),
            coverImage: a.media.coverImage?.large ?? a.media.coverImage?.medium ?? "",
            format: a.media.format ?? null,
            averageScore: a.media.averageScore ?? null,
          },
        });
      } else if (a.__typename === "TextActivity") {
        const cleaned = cleanAniListMarkdown(String(a.text ?? ""));
        if (!cleaned) continue;
        activities.push({
          id: Number(a.id),
          kind: "TEXT",
          statusRaw: null,
          progress: null,
          actionLabel: "A publié un statut sur AniList",
          text: cleaned.slice(0, 650),
          likeCount: Number(a.likeCount ?? 0),
          replyCount: Number(a.replyCount ?? 0),
          isLiked: Boolean(a.isLiked),
          createdAt: Number(a.createdAt ?? 0),
          siteUrl: a.siteUrl ?? null,
          user: {
            id: Number(a.user.id),
            name: String(a.user.name),
            avatarUrl: a.user.avatar?.large ?? a.user.avatar?.medium ?? null,
            siteUrl:
              a.user.siteUrl ??
              `https://anilist.co/user/${encodeURIComponent(String(a.user.name))}`,
          },
          media: null,
        });
      }
    }

    return NextResponse.json({
      activities,
      hasNextPage: Boolean(data?.Page?.pageInfo?.hasNextPage),
      page: Number(data?.Page?.pageInfo?.currentPage ?? page),
      authenticated: Boolean(conn),
      anilistUser: conn ? { id: conn.userId, name: conn.username } : null,
    });
  } catch (err) {
    return NextResponse.json(
      {
        activities: [],
        hasNextPage: false,
        page,
        authenticated: Boolean(conn),
        error:
          err instanceof Error
            ? err.message
            : "Impossible de charger le fil d'actualités AniList.",
      },
      { status: 502 }
    );
  }
}

export async function POST(request: NextRequest) {
  const conn = await getAniListConnection();
  if (!conn?.accessToken) {
    return NextResponse.json(
      {
        ok: false,
        code: "NOT_CONNECTED",
        error: "Connectez votre compte AniList (OAuth) pour liker, répondre ou publier sur AniList.",
      },
      { status: 401 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const action = body?.action as "like" | "reply" | "post_text";

    if (action === "like") {
      const id = Number(body?.activityId);
      if (!Number.isInteger(id) || id <= 0) {
        return NextResponse.json({ ok: false, error: "activityId invalide" }, { status: 400 });
      }
      const mutation = `
        mutation ($id: Int!) {
          ToggleLikeV2(id: $id, type: ACTIVITY) {
            ... on ListActivity { id likeCount isLiked }
            ... on TextActivity { id likeCount isLiked }
          }
        }
      `;
      const data = await queryAniList(mutation, { id }, conn.accessToken);
      const updated = data?.ToggleLikeV2;
      return NextResponse.json({
        ok: true,
        likeCount: Number(updated?.likeCount ?? 0),
        isLiked: Boolean(updated?.isLiked),
      });
    }

    if (action === "reply") {
      const activityId = Number(body?.activityId);
      const text = String(body?.text ?? "").trim();
      if (!Number.isInteger(activityId) || activityId <= 0 || !text) {
        return NextResponse.json({ ok: false, error: "Réponse invalide." }, { status: 400 });
      }
      const mutation = `
        mutation ($activityId: Int!, $text: String!) {
          SaveActivityReply(activityId: $activityId, text: $text) {
            id
            text(asHtml: false)
            likeCount
            isLiked
            createdAt
            user {
              id
              name
              avatar { large medium }
              siteUrl
            }
          }
        }
      `;
      const data = await queryAniList(mutation, { activityId, text }, conn.accessToken);
      const r = data?.SaveActivityReply;
      const reply: AniListFeedReply = {
        id: Number(r.id),
        text: cleanAniListMarkdown(String(r.text ?? text)),
        likeCount: Number(r.likeCount ?? 0),
        isLiked: Boolean(r.isLiked),
        createdAt: Number(r.createdAt ?? Math.floor(Date.now() / 1000)),
        user: {
          id: Number(r.user?.id ?? conn.userId),
          name: String(r.user?.name ?? conn.username),
          avatarUrl: r.user?.avatar?.large ?? r.user?.avatar?.medium ?? conn.avatarUrl,
          siteUrl: r.user?.siteUrl ?? conn.siteUrl ?? `https://anilist.co/user/${conn.username}`,
        },
      };
      return NextResponse.json({ ok: true, reply });
    }

    if (action === "post_text") {
      const text = String(body?.text ?? "").trim();
      if (!text || text.length > 1000) {
        return NextResponse.json(
          { ok: false, error: "Le statut doit contenir entre 1 et 1000 caractères." },
          { status: 400 }
        );
      }
      const mutation = `
        mutation ($text: String!) {
          SaveTextActivity(text: $text) {
            id
            type
            text(asHtml: false)
            likeCount
            replyCount
            isLiked
            createdAt
            siteUrl
            user {
              id
              name
              avatar { large medium }
              siteUrl
            }
          }
        }
      `;
      const data = await queryAniList(mutation, { text }, conn.accessToken);
      const a = data?.SaveTextActivity;
      const item: AniListFeedItem = {
        id: Number(a.id),
        kind: "TEXT",
        statusRaw: null,
        progress: null,
        actionLabel: "A publié un statut sur AniList",
        text: cleanAniListMarkdown(String(a.text ?? text)),
        likeCount: Number(a.likeCount ?? 0),
        replyCount: Number(a.replyCount ?? 0),
        isLiked: Boolean(a.isLiked),
        createdAt: Number(a.createdAt ?? Math.floor(Date.now() / 1000)),
        siteUrl: a.siteUrl ?? null,
        user: {
          id: Number(a.user?.id ?? conn.userId),
          name: String(a.user?.name ?? conn.username),
          avatarUrl: a.user?.avatar?.large ?? a.user?.avatar?.medium ?? conn.avatarUrl,
          siteUrl: a.user?.siteUrl ?? conn.siteUrl ?? `https://anilist.co/user/${conn.username}`,
        },
        media: null,
      };
      return NextResponse.json({ ok: true, activity: item });
    }

    return NextResponse.json({ ok: false, error: "Action inconnue" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Erreur API AniList.",
      },
      { status: 502 }
    );
  }
}
