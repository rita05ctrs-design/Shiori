import React from "react";

export default function DiscoverLoading() {
  return (
    <div className="pt-[calc(5rem+env(safe-area-inset-top))] sm:pt-24 pb-24 md:pb-16 max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 space-y-5 animate-pulse">
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="h-9 w-64 rounded-xl bg-white/[0.08]" />
          <div className="h-4 w-80 max-w-full rounded bg-white/[0.05]" />
        </div>
        <div className="h-10 w-44 rounded-full bg-white/[0.06]" />
      </div>

      <div className="rounded-2xl card-surface p-4 space-y-3">
        <div className="h-10 w-full rounded-xl bg-white/[0.05]" />
        <div className="flex gap-2 overflow-hidden">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-7 w-20 rounded-full bg-white/[0.05] shrink-0" />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="aspect-[2/3] rounded-xl bg-white/[0.05] border border-white/[0.07]" />
            <div className="h-3.5 w-4/5 rounded bg-white/[0.07]" />
            <div className="h-3 w-1/2 rounded bg-white/[0.04]" />
          </div>
        ))}
      </div>
    </div>
  );
}
