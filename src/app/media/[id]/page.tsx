import React from "react";
import Link from "next/link";
import { fetchMediaDetail } from "@/lib/anilist";
import { MediaDetailClient } from "@/components/media/MediaDetailClient";

export const revalidate = 300;

export default async function MediaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numericId = Number(id);
  const media = !Number.isNaN(numericId) ? await fetchMediaDetail(numericId) : null;

  if (!media) {
    return (
      <div className="pt-36 pb-24 max-w-xl mx-auto px-4 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#E5484D]">
          404 · Œuvre introuvable
        </p>
        <h1 className="text-3xl font-bold text-white mt-2">
          Impossible de trouver cette fiche
        </h1>
        <p className="text-sm text-[#8A8FA4] mt-2">
          L&apos;identifiant demandé ne correspond à aucun anime ou manga disponible.
        </p>
        <Link
          href="/discover"
          className="mt-6 inline-flex items-center px-5 py-2.5 rounded-full bg-[#E5484D] hover:bg-[#F2545B] text-white text-sm font-semibold transition-colors"
        >
          Retourner au catalogue
        </Link>
      </div>
    );
  }

  return <MediaDetailClient media={media} />;
}
