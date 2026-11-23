import type { MetadataRoute } from "next";
import seedData from "@/data/anilist-seed.json";

const SITE_URL = "https://shiori-lac.vercel.app";

interface SeedSection {
  media?: { id?: number }[];
}

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/discover`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/calendar`,
      lastModified: now,
      changeFrequency: "hourly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/episodes`,
      lastModified: now,
      changeFrequency: "hourly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/community`,
      lastModified: now,
      changeFrequency: "hourly",
      priority: 0.8,
    },
  ];

  // Include flagship anime & manga detail URLs from verified seed catalog
  const raw = seedData as Record<string, SeedSection>;
  const mediaIds = new Set<number>();
  for (const key of ["trending", "popular", "topAnime", "manga"]) {
    for (const item of raw[key]?.media ?? []) {
      if (typeof item?.id === "number" && item.id > 0) {
        mediaIds.add(item.id);
      }
    }
  }

  const mediaRoutes: MetadataRoute.Sitemap = Array.from(mediaIds).map((id) => ({
    url: `${SITE_URL}/media/${id}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticRoutes, ...mediaRoutes];
}
