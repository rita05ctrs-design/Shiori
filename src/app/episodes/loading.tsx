import React from "react";

export default function EpisodesLoading() {
  return (
    <div className="pt-[calc(4.75rem+env(safe-area-inset-top))] sm:pt-24 pb-24 md:pb-16 max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 space-y-6 animate-pulse">
      <div className="space-y-2">
        <div className="h-3.5 w-48 rounded bg-accent/25" />
        <div className="h-9 w-72 rounded-xl bg-white/[0.08]" />
      </div>
      <div className="rounded-2xl card-surface p-5 space-y-4">
        <div className="h-5 w-52 rounded bg-white/[0.08]" />
        <div className="h-2 w-full rounded-full bg-white/[0.07]" />
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-8 w-24 rounded-full bg-white/[0.06]" />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl card-surface p-3.5 flex items-center gap-3.5">
            <div className="w-14 h-20 rounded-xl bg-white/[0.06] shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-24 rounded bg-accent/20" />
              <div className="h-4 w-2/3 rounded bg-white/[0.08]" />
              <div className="h-3 w-1/2 rounded bg-white/[0.05]" />
            </div>
            <div className="h-11 w-20 rounded-xl bg-accent/25 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
