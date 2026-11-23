"use client";

import React from "react";
import { LayoutGrid, Sparkles, Rows3, Accessibility } from "lucide-react";
import { useShiori } from "@/context/ShioriContext";
import { cn } from "@/lib/utils";
import type { LibraryDensity, MotionPreference, PosterSize } from "@/types/media";

const POSTER_SIZES: { id: PosterSize; label: string; desc: string }[] = [
  { id: "compact", label: "Compactes", desc: "Plus d'œuvres à l'écran" },
  { id: "normal", label: "Standard", desc: "Équilibre idéal" },
  { id: "large", label: "Grandes", desc: "Affiches grand format" },
];

const DENSITIES: { id: LibraryDensity; label: string; desc: string }[] = [
  { id: "compact", label: "Compacte", desc: "Espacements serrés" },
  { id: "comfortable", label: "Confortable", desc: "Mise en page aérée" },
];

const MOTION_MODES: { id: MotionPreference; label: string; desc: string }[] = [
  { id: "system", label: "Automatique", desc: "Suit le réglage de l'appareil" },
  { id: "full", label: "Complètes", desc: "Transitions et effets visuels" },
  { id: "reduced", label: "Réduites", desc: "Sobre et sans particules" },
];

export function DisplayPreferencesCard() {
  const { displayPrefs, updateDisplayPrefs, toast } = useShiori();

  return (
    <section
      id="affichage"
      className="rounded-2xl card-surface border border-white/[0.08] p-5 sm:p-6 space-y-5 scroll-mt-24"
    >
      <div>
        <h2 className="text-base font-semibold text-white">
          Affichage & Confort visuel
        </h2>
        <p className="text-xs text-[#858A9E] mt-0.5">
          Ajustez la taille des affiches, l&apos;espacement et les animations.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Poster Size */}
        <div className="p-4 rounded-xl bg-obsidian/70 border border-white/[0.07] space-y-2.5">
          <p className="text-xs font-semibold text-white flex items-center gap-1.5">
            <LayoutGrid className="w-3.5 h-3.5 text-sky-400" />
            <span>Taille des affiches</span>
          </p>
          <div className="space-y-1.5">
            {POSTER_SIZES.map((opt) => {
              const active = displayPrefs.posterSize === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    updateDisplayPrefs({ posterSize: opt.id });
                    toast({ title: `Taille d'affiches : ${opt.label}`, variant: "info" });
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
            <span>Densité de la bibliothèque</span>
          </p>
          <div className="space-y-1.5">
            {DENSITIES.map((opt) => {
              const active = displayPrefs.libraryDensity === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    updateDisplayPrefs({ libraryDensity: opt.id });
                    toast({ title: `Densité : ${opt.label}`, variant: "info" });
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
            <span>Animations</span>
          </p>
          <div className="space-y-1.5">
            {MOTION_MODES.map((opt) => {
              const active = displayPrefs.motion === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    updateDisplayPrefs({ motion: opt.id });
                    toast({ title: `Animations : ${opt.label}`, variant: "info" });
                  }}
                  className={cn(
                    "w-full px-3 py-2 rounded-lg border text-left transition-all cursor-pointer",
                    active
                      ? "bg-accent/18 border-accent/50 text-white"
                      : "bg-white/[0.03] border-white/[0.07] text-[#B5B9C9] hover:text-white"
                  )}
                >
                  <p className="text-xs font-semibold flex items-center gap-1.5">
                    {opt.id === "full" && <Sparkles className="w-3 h-3 text-accent" />}
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
