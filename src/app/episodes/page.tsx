import React from "react";
import type { Metadata } from "next";
import { fetchWeeklyEpisodeTrackerSchedule } from "@/lib/anilist";
import { WeeklyEpisodeTracker } from "@/components/episodes/WeeklyEpisodeTracker";

export const revalidate = 180;

export const metadata: Metadata = {
  title: "Épisodes de la Semaine",
  description:
    "Cochez en 1 clic Oui ou Non pour chaque épisode d'anime sorti cette semaine, avec suivi des épisodes en retard et synchronisation AniList automatique.",
};

export default async function EpisodesPage() {
  const schedule = await fetchWeeklyEpisodeTrackerSchedule();
  return <WeeklyEpisodeTracker initialSchedule={schedule} />;
}
