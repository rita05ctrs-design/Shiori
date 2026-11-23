import React from "react";
import { fetchHomeData } from "@/lib/anilist";
import { HomeDashboardClient } from "@/components/home/HomeDashboardClient";

export const revalidate = 300;

export default async function HomePage() {
  const data = await fetchHomeData();

  const surprisePool = [
    ...data.topAnime,
    ...data.trending,
    ...data.movies,
    ...data.hiddenGems,
    ...data.shortBinge,
    ...data.manga,
  ];

  return <HomeDashboardClient data={data} surprisePool={surprisePool} />;
}
