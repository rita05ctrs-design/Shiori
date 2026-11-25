import React from "react";

export default function MediaDetailLoading() {
  return (
    <div className="pb-16 animate-pulse">
      {/* Banner Skeleton */}
      <div className="h-[320px] sm:h-[400px] lg:h-[440px] w-full bg-surface relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-obsidian via-obsidian/55 to-obsidian/35" />
      </div>

      {/* Main Content Skeleton */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 -mt-28 sm:-mt-44 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
          {/* Left Poster + Card */}
          <div className="lg:col-span-3 space-y-5">
            <div className="w-36 sm:w-56 lg:w-full aspect-[2/3] rounded-2xl bg-white/[0.06] border border-white/[0.1]" />
            <div className="h-44 rounded-2xl card-surface" />
          </div>

          {/* Right Title + Genres + Synopsis */}
          <div className="lg:col-span-9 space-y-6 pt-2 lg:pt-20">
            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="h-6 w-24 rounded-full bg-white/[0.06]" />
                <div className="h-6 w-20 rounded-full bg-kinpaku/15" />
              </div>
              <div className="h-10 sm:h-12 w-3/4 rounded-xl bg-white/[0.08]" />
              <div className="flex flex-wrap gap-2 pt-1">
                <div className="h-7 w-24 rounded-xl bg-white/[0.05]" />
                <div className="h-7 w-28 rounded-xl bg-white/[0.05]" />
                <div className="h-7 w-20 rounded-xl bg-white/[0.05]" />
              </div>
            </div>

            <div className="rounded-2xl card-surface p-6 space-y-3">
              <div className="h-4 w-32 rounded bg-white/[0.07]" />
              <div className="h-3.5 w-full rounded bg-white/[0.05]" />
              <div className="h-3.5 w-11/12 rounded bg-white/[0.05]" />
              <div className="h-3.5 w-4/5 rounded bg-white/[0.05]" />
            </div>

            <div className="rounded-2xl card-surface p-5 space-y-3">
              <div className="h-4 w-44 rounded bg-white/[0.07]" />
              <div className="flex gap-3 overflow-hidden">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-52 h-20 rounded-xl bg-white/[0.04] border border-white/[0.07] shrink-0"
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
