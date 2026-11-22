import React from "react";

export default function Loading() {
  return (
    <div className="pt-28 pb-20 max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 space-y-8 animate-pulse">
      <div className="h-[340px] rounded-3xl bg-white/[0.04] border border-white/[0.06]" />
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-2.5">
            <div className="aspect-[2/3] rounded-xl bg-white/[0.05]" />
            <div className="h-3.5 w-3/4 rounded bg-white/[0.05]" />
            <div className="h-3 w-1/2 rounded bg-white/[0.04]" />
          </div>
        ))}
      </div>
    </div>
  );
}
