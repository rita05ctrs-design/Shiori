import { NextRequest, NextResponse } from "next/server";
import {
  deleteMediaListEntryOnAniList,
  getAniListConnection,
  saveMediaListEntryOnAniList,
  syncFavoriteOnAniList,
} from "@/lib/server/anilist-oauth";
import type { LibraryStatus, MediaType } from "@/types/media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_STATUSES: Set<LibraryStatus> = new Set([
  "WATCHING",
  "COMPLETED",
  "ON_HOLD",
  "DROPPED",
  "PLAN_TO_WATCH",
]);

/**
 * Bidirectional Sync Endpoint: pushes Shiori library mutations directly to the user's
 * connected AniList account using their server-side OAuth token.
 *
 * Supported actions:
 * - "save" (default): SaveMediaListEntry (add/update anime or manga, status, progress, score, notes, dates)
 * - "delete": DeleteMediaListEntry
 * - "favorite": ToggleFavourite (idempotent sync with desired isFavorite state)
 */
export async function POST(request: NextRequest) {
  try {
    const conn = await getAniListConnection();
    if (!conn) {
      return NextResponse.json(
        {
          ok: false,
          synced: false,
          code: "NOT_CONNECTED",
          error: "Aucun compte AniList connecté.",
        },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const action = (body?.action as "save" | "delete" | "favorite") ?? "save";
    const mediaId = Number(body?.mediaId);

    if (!Number.isInteger(mediaId) || mediaId <= 0) {
      return NextResponse.json(
        { ok: false, synced: false, error: "Identifiant mediaId invalide." },
        { status: 400 }
      );
    }

    if (action === "delete") {
      const res = await deleteMediaListEntryOnAniList(
        conn.accessToken,
        conn.userId,
        mediaId
      );
      return NextResponse.json({
        ok: true,
        synced: true,
        action: "delete",
        deleted: res.deleted,
        anilistUser: conn.username,
      });
    }

    if (action === "favorite") {
      const mediaType: MediaType = body?.mediaType === "MANGA" ? "MANGA" : "ANIME";
      const isFavorite = Boolean(body?.isFavorite);
      const res = await syncFavoriteOnAniList(
        conn.accessToken,
        mediaId,
        mediaType,
        isFavorite
      );
      return NextResponse.json({
        ok: true,
        synced: true,
        action: "favorite",
        isFavourite: res.isFavourite,
        toggled: res.toggled,
        anilistUser: conn.username,
      });
    }

    // Default: SaveMediaListEntry
    const status = body?.status as LibraryStatus;
    if (!VALID_STATUSES.has(status)) {
      return NextResponse.json(
        { ok: false, synced: false, error: "Statut de bibliothèque invalide." },
        { status: 400 }
      );
    }

    const progress =
      typeof body?.progress === "number" && Number.isFinite(body.progress)
        ? Math.max(0, Math.trunc(body.progress))
        : 0;

    const score =
      body?.score === null || body?.score === undefined
        ? null
        : Number.isFinite(Number(body.score))
          ? Math.max(0, Math.min(10, Number(body.score)))
          : null;

    const saved = await saveMediaListEntryOnAniList(conn.accessToken, {
      mediaId,
      status,
      progress,
      score,
      notes: typeof body?.notes === "string" ? body.notes : undefined,
      startedAt: typeof body?.startedAt === "string" ? body.startedAt : undefined,
      completedAt: typeof body?.completedAt === "string" ? body.completedAt : undefined,
    });

    return NextResponse.json({
      ok: true,
      synced: true,
      action: "save",
      entry: saved,
      anilistUser: conn.username,
    });
  } catch (err) {
    const status = (err as { status?: number })?.status;
    const message =
      err instanceof Error ? err.message : "Erreur lors de la synchronisation AniList.";
    return NextResponse.json(
      {
        ok: false,
        synced: false,
        code: status === 401 ? "TOKEN_EXPIRED" : "ANILIST_ERROR",
        error: message,
      },
      { status: status === 401 ? 401 : 502 }
    );
  }
}
