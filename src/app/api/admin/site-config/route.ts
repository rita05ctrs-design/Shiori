import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { fetchMediaDetail } from "@/lib/anilist";
import { requireCreatorActor } from "@/lib/server/admin-auth";
import { broadcastRealtimeEvent } from "@/lib/server/realtime-broadcast";
import {
  getSiteConfig,
  sanitizeSiteConfigInput,
  saveSiteConfig,
} from "@/lib/server/site-config";
import type { MediaItem } from "@/types/media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SITE_CONFIG_REALTIME_TOPIC = "shiori:site-config-live";
const SITE_CONFIG_REALTIME_EVENT = "site_config_updated";

export async function GET() {
  const guard = await requireCreatorActor();
  if (!guard.ok) return guard.response;

  const config = await getSiteConfig({ bypassCache: true });
  return NextResponse.json({ config });
}

export async function PUT(request: NextRequest) {
  const guard = await requireCreatorActor();
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Payload JSON invalide." }, { status: 400 });
  }

  const current = await getSiteConfig({ bypassCache: true });
  let resolvedMedia: MediaItem | null | undefined = undefined;

  if (body.featuredHero && typeof body.featuredHero === "object") {
    const incomingId = body.featuredHero.mediaId;
    if (incomingId === null || incomingId === 0 || incomingId === "") {
      resolvedMedia = null;
    } else if (typeof incomingId === "number" && Number.isInteger(incomingId) && incomingId > 0) {
      if (current.featuredHero.media?.id === incomingId) {
        resolvedMedia = current.featuredHero.media;
      } else {
        const fetched = await fetchMediaDetail(incomingId);
        if (!fetched) {
          return NextResponse.json(
            { error: `Impossible de trouver l'animé AniList #${incomingId}.` },
            { status: 404 }
          );
        }
        resolvedMedia = {
          id: fetched.id,
          type: fetched.type,
          format: fetched.format,
          status: fetched.status,
          title: fetched.title,
          synonyms: fetched.synonyms,
          description: fetched.description,
          coverImage: fetched.coverImage,
          bannerImage: fetched.bannerImage,
          averageScore: fetched.averageScore,
          meanScore: fetched.meanScore,
          popularity: fetched.popularity,
          favourites: fetched.favourites,
          episodes: fetched.episodes,
          chapters: fetched.chapters,
          volumes: fetched.volumes,
          duration: fetched.duration,
          season: fetched.season,
          seasonYear: fetched.seasonYear,
          startYear: fetched.startYear,
          startDate: fetched.startDate,
          genres: fetched.genres,
          tags: fetched.tags,
          studio: fetched.studio,
          nextAiringEpisode: fetched.nextAiringEpisode,
          trailer: fetched.trailer,
          streamingLinks: fetched.streamingLinks,
        };
      }
    }
  }

  const sanitized = sanitizeSiteConfigInput(
    {
      announcement: body.announcement,
      featuredHero: body.featuredHero,
    },
    current,
    resolvedMedia
  );

  const saved = await saveSiteConfig(sanitized, guard.actor.id);

  // Push instantly from server -> Supabase Realtime -> every connected visitor worldwide
  const broadcasted = await broadcastRealtimeEvent(
    SITE_CONFIG_REALTIME_TOPIC,
    SITE_CONFIG_REALTIME_EVENT,
    { config: saved.config }
  );

  try {
    revalidatePath("/");
  } catch {
    // non-fatal
  }

  return NextResponse.json({
    ok: true,
    config: saved.config,
    persistedToSupabase: saved.persistedToSupabase,
    broadcasted,
  });
}
