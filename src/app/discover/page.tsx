import React, { Suspense } from "react";
import { fetchDiscover } from "@/lib/anilist";
import { DiscoverClient } from "@/components/discover/DiscoverClient";

export const revalidate = 180;

export default async function DiscoverPage() {
  const initial = await fetchDiscover({
    type: "ANIME",
    sort: "TRENDING_DESC",
    page: 1,
    perPage: 24,
  });

  return (
    <Suspense
      fallback={
        <div className="pt-28 max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-10 w-64 rounded-xl bg-white/[0.06] animate-pulse" />
        </div>
      }
    >
      <DiscoverClient initialItems={initial.items} initialTotal={initial.total} />
    </Suspense>
  );
}
