import React from "react";
import type { Metadata } from "next";
import { PublicProfileClient } from "@/components/social/PublicProfileClient";

interface PageProps {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username } = await params;
  const decoded = decodeURIComponent(username);
  return {
    title: `@${decoded} — Profil`,
    description: `Découvrez le profil public Shiori de @${decoded} : animés et mangas favoris, Voice Actors (Seiyuu) favoris et statistiques.`,
  };
}

export default async function PublicProfilePage({ params }: PageProps) {
  const { username } = await params;
  return <PublicProfileClient username={decodeURIComponent(username)} />;
}
