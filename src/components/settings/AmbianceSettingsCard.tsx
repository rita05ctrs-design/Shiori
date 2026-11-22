"use client";

import React from "react";
import {
  Flower2,
  Leaf,
  Snowflake,
  Sparkles,
  CloudRain,
  Stars,
  EyeOff,
  Check,
  Gauge,
  Sliders,
} from "lucide-react";
import { useShiori } from "@/context/ShioriContext";
import { cn } from "@/lib/utils";
import type {
  AmbianceDensity,
  AmbianceEffect,
  AmbianceSpeed,
} from "@/types/media";

export const AMBIANCE_OPTIONS: {
  id: AmbianceEffect;
  label: string;
  subtitle: string;
  accent: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    id: "sakura",
    label: "Pétales de Sakura",
    subtitle: "Cerisiers en fleurs · Printemps japonais",
    accent: "#F472B6",
    icon: Flower2,
  },
  {
    id: "momiji",
    label: "Feuilles d'Automne",
    subtitle: "Érables Momiji · Kyoto vermillon",
    accent: "#E5484D",
    icon: Leaf,
  },
  {
    id: "snow",
    label: "Neige d'Hiver",
    subtitle: "Flocons silencieux · Nuit d'hiver",
    accent: "#7DD3FC",
    icon: Snowflake,
  },
  {
    id: "fireflies",
    label: "Lucioles Nocturnes",
    subtitle: "Hotaru dorées · Forêt mystique",
    accent: "#F0B95B",
    icon: Sparkles,
  },
  {
    id: "rain",
    label: "Pluie Néon",
    subtitle: "Averse nocturne · Tokyo Cyberpunk",
    accent: "#38BDF8",
    icon: CloudRain,
  },
  {
    id: "stars",
    label: "Poussière d'Étoiles",
    subtitle: "Ciel nocturne & étoiles filantes",
    accent: "#C084FC",
    icon: Stars,
  },
  {
    id: "none",
    label: "Désactivé",
    subtitle: "Interface épurée sans particules",
    accent: "#94A3B8",
    icon: EyeOff,
  },
];

const DENSITY_OPTIONS: { id: AmbianceDensity; label: string }[] = [
  { id: "subtle", label: "Subtil" },
  { id: "balanced", label: "Équilibré" },
  { id: "immersive", label: "Immersif" },
];

const SPEED_OPTIONS: { id: AmbianceSpeed; label: string }[] = [
  { id: "slow", label: "Douce" },
  { id: "normal", label: "Normale" },
  { id: "brisk", label: "Vive" },
];

export function AmbianceSettingsCard() {
  const { ambiance, updateAmbiance, toast } = useShiori();

  const handleSelectEffect = (id: AmbianceEffect) => {
    updateAmbiance({ effect: id });
    const meta = AMBIANCE_OPTIONS.find((o) => o.id === id);
    toast({
      title: id === "none" ? "Effets d'ambiance désactivés" : `Ambiance : ${meta?.label}`,
      description:
        id === "none"
          ? "Vous pouvez réactiver les particules à tout moment."
          : "Aperçu actif en direct sur tout le site.",
    });
  };

  return (
    <section
      id="ambiance"
      className="rounded-2xl card-surface border-accent/20 p-6 space-y-5 scroll-mt-24"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <span className="inline-flex items-center gap-1.5 text-[10.5px] font-mono uppercase tracking-[0.16em] text-accent-soft">
            <Flower2 className="w-3.5 h-3.5 text-accent" />
            Particules en continu · 60/120 FPS
          </span>
          <h2 className="text-base sm:text-lg font-semibold text-white mt-0.5">
            Ambiance & Effets en continu
          </h2>
          <p className="text-xs text-[#8A8FA4] mt-0.5">
            Choisissez une atmosphère animée selon vos goûts ou désactivez-la en un clic.
          </p>
        </div>

        {ambiance.effect !== "none" && (
          <button
            type="button"
            onClick={() => handleSelectEffect("none")}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/[0.05] hover:bg-white/[0.11] border border-white/[0.09] text-xs font-medium text-[#C8CCE0] hover:text-white transition-colors cursor-pointer self-start sm:self-auto"
          >
            <EyeOff className="w-3.5 h-3.5" />
            <span>Désactiver</span>
          </button>
        )}
      </div>

      {/* 7 Effect Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        {AMBIANCE_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const active = ambiance.effect === opt.id;

          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => handleSelectEffect(opt.id)}
              style={{
                borderColor: active ? `${opt.accent}99` : undefined,
                boxShadow: active ? `0 10px 26px -10px ${opt.accent}66` : undefined,
              }}
              className={cn(
                "relative p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 overflow-hidden",
                active
                  ? "bg-[#161926]"
                  : "bg-[#090B12] border-white/[0.08] hover:border-white/[0.18] hover:bg-[#111420]"
              )}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border"
                style={{
                  backgroundColor: `${opt.accent}20`,
                  borderColor: `${opt.accent}50`,
                  color: opt.accent,
                }}
              >
                <Icon className="w-4 h-4" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1.5">
                  <p className="text-xs font-semibold text-white truncate">
                    {opt.label}
                  </p>
                  {active && (
                    <span
                      style={{ backgroundColor: opt.accent }}
                      className="w-4 h-4 rounded-full flex items-center justify-center text-[#07080C] shrink-0"
                    >
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[#83889C] mt-0.5 line-clamp-2 leading-snug">
                  {opt.subtitle}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Density & Speed Controls (visible whenever an effect is active) */}
      {ambiance.effect !== "none" && (
        <div className="pt-4 border-t border-white/[0.07] grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Density */}
          <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-obsidian/70 border border-white/[0.07]">
            <span className="text-xs font-medium text-[#C6CAD8] flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5 text-accent" />
              <span>Intensité</span>
            </span>
            <div className="inline-flex items-center p-0.5 rounded-lg bg-white/[0.04] border border-white/[0.07]">
              {DENSITY_OPTIONS.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => updateAmbiance({ density: d.id })}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer",
                    ambiance.density === d.id
                      ? "bg-accent text-accent-fg font-semibold"
                      : "text-[#8E93A6] hover:text-white"
                  )}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Speed */}
          <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-obsidian/70 border border-white/[0.07]">
            <span className="text-xs font-medium text-[#C6CAD8] flex items-center gap-2">
              <Gauge className="w-3.5 h-3.5 text-kinpaku" />
              <span>Vitesse</span>
            </span>
            <div className="inline-flex items-center p-0.5 rounded-lg bg-white/[0.04] border border-white/[0.07]">
              {SPEED_OPTIONS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => updateAmbiance({ speed: s.id })}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer",
                    ambiance.speed === s.id
                      ? "bg-accent text-accent-fg font-semibold"
                      : "text-[#8E93A6] hover:text-white"
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
