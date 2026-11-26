"use client";

import React from "react";
import { LayoutGrid, Sparkles, Rows3, Accessibility } from "lucide-react";
import { useShiori } from "@/context/ShioriContext";
import { getSettingsCopy } from "@/lib/settings-translations";
import { cn } from "@/lib/utils";
import type { LibraryDensity, MotionPreference, PosterSize } from "@/types/media";

const POSTER_SIZE_IDS: PosterSize[] = ["compact", "normal", "large"];
const DENSITY_IDS: LibraryDensity[] = ["compact", "comfortable"];
const MOTION_IDS: MotionPreference[] = ["system", "full", "reduced"];

export function DisplayPreferencesCard() {
  const { displayPrefs, updateDisplayPrefs, contentLanguage, toast } = useShiori();
  const copy = getSettingsCopy(contentLanguage).display;

  return (
    <section
      id="affichage"
      className="rounded-2xl card-surface border border-white/[0.08] p-5 sm:p-6 space-y-5 scroll-mt-24"
    >
      <div>
        <h2 className="text-base font-semibold text-white">
          {copy.title}
        </h2>
        <p className="text-xs text-[#858A9E] mt-0.5">
          {copy.subtitle}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Poster Size */}
        <div className="p-4 rounded-xl bg-obsidian/70 border border-white/[0.07] space-y-2.5">
          <p className="text-xs font-semibold text-white flex items-center gap-1.5">
            <LayoutGrid className="w-3.5 h-3.5 text-sky-400" />
            <span>{copy.posterTitle}</span>
          </p>
          <div className="space-y-1.5">
            {POSTER_SIZE_IDS.map((id) => {
              const opt = copy.posterSizes[id];
              const active = displayPrefs.posterSize === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    updateDisplayPrefs({ posterSize: id });
                    toast({ title: `${copy.posterTitle}: ${opt.label}`, variant: "info" });
                  }}
                  className={cn(
                    "w-full px-3 py-2 rounded-lg border text-left transition-all cursor-pointer",
                    active
                      ? "bg-accent/18 border-accent/50 text-white"
                      : "bg-white/[0.03] border-white/[0.07] text-[#B5B9C9] hover:text-white"
                  )}
                >
                  <p className="text-xs font-semibold">{opt.label}</p>
                  <p className="text-[10.5px] text-[#858A9E]">{opt.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Library Density */}
        <div className="p-4 rounded-xl bg-obsidian/70 border border-white/[0.07] space-y-2.5">
          <p className="text-xs font-semibold text-white flex items-center gap-1.5">
            <Rows3 className="w-3.5 h-3.5 text-emerald-400" />
            <span>{copy.densityTitle}</span>
          </p>
          <div className="space-y-1.5">
            {DENSITY_IDS.map((id) => {
              const opt = copy.densities[id];
              const active = displayPrefs.libraryDensity === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    updateDisplayPrefs({ libraryDensity: id });
                    toast({ title: `${copy.densityTitle}: ${opt.label}`, variant: "info" });
                  }}
                  className={cn(
                    "w-full px-3 py-2 rounded-lg border text-left transition-all cursor-pointer",
                    active
                      ? "bg-accent/18 border-accent/50 text-white"
                      : "bg-white/[0.03] border-white/[0.07] text-[#B5B9C9] hover:text-white"
                  )}
                >
                  <p className="text-xs font-semibold">{opt.label}</p>
                  <p className="text-[10.5px] text-[#858A9E]">{opt.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Reduced Motion & Accessibility */}
        <div className="p-4 rounded-xl bg-obsidian/70 border border-white/[0.07] space-y-2.5">
          <p className="text-xs font-semibold text-white flex items-center gap-1.5">
            <Accessibility className="w-3.5 h-3.5 text-kinpaku" />
            <span>{copy.motionTitle}</span>
          </p>
          <div className="space-y-1.5">
            {MOTION_IDS.map((id) => {
              const opt = copy.motions[id];
              const active = displayPrefs.motion === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    updateDisplayPrefs({ motion: id });
                    toast({ title: `${copy.motionTitle}: ${opt.label}`, variant: "info" });
                  }}
                  className={cn(
                    "w-full px-3 py-2 rounded-lg border text-left transition-all cursor-pointer",
                    active
                      ? "bg-accent/18 border-accent/50 text-white"
                      : "bg-white/[0.03] border-white/[0.07] text-[#B5B9C9] hover:text-white"
                  )}
                >
                  <p className="text-xs font-semibold flex items-center gap-1.5">
                    {id === "full" && <Sparkles className="w-3 h-3 text-accent" />}
                    <span>{opt.label}</span>
                  </p>
                  <p className="text-[10.5px] text-[#858A9E]">{opt.desc}</p>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
