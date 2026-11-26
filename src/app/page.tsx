import React from "react";
import { fetchHomeData } from "@/lib/anilist";
import { getSiteConfig } from "@/lib/server/site-config";
import { HomeDashboardClient } from "@/components/home/HomeDashboardClient";

export const revalidate = 300;

export default async function HomePage() {
  const [data, siteConfig] = await Promise.all([
    fetchHomeData(),
    getSiteConfig(),
  ]);

  const featured = siteConfig.featuredHero;
  const heroItems =
    featured.enabled && featured.media
      ? [featured.media, ...data.hero.filter((item) => item.id !== featured.media!.id)]
      : data.hero;

  const enrichedData = {
    ...data,
    hero: heroItems,
  };

  const featuredHeroMeta =
    featured.enabled && featured.media
      ? {
          mediaId: featured.media.id,
          customTagline: featured.customTagline ?? "",
        }
      : null;

  const surprisePool = [
    ...data.topAnime,
    ...data.trending,
    ...data.movies,
    ...data.hiddenGems,
    ...data.shortBinge,
    ...data.manga,
  ];

  return (
    <HomeDashboardClient
      data={enrichedData}
      surprisePool={surprisePool}
      featuredHero={featuredHeroMeta}
    />
  );
}
