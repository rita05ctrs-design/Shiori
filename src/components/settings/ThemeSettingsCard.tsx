"use client";

import React, { useEffect, useState } from "react";
import {
  Palette,
  Check,
  RotateCcw,
  Sparkles,
  SunMedium,
  Square,
  Layers,
  Wand2,
  Bookmark,
  Star,
} from "lucide-react";
import { useShiori } from "@/context/ShioriContext";
import {
  CORNER_OPTIONS,
  CUSTOM_ACCENT_SWATCHES,
  GLOW_OPTIONS,
  normalizeHex,
  SECONDARY_SWATCHES,
  SURFACE_OPTIONS,
  THEME_PRESETS,
} from "@/lib/theme";
import { AMBIANCE_OPTIONS } from "@/components/settings/AmbianceSettingsCard";
import { cn } from "@/lib/utils";

export function ThemeSettingsCard() {
  const { theme, updateTheme, applyThemePreset, resetTheme, toast } = useShiori();
  const [hexDraft, setHexDraft] = useState(theme.accentColor);

  useEffect(() => {
    setHexDraft(theme.accentColor);
  }, [theme.accentColor]);

  const handleSelectPreset = (presetId: string) => {
    const preset = THEME_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    applyThemePreset(presetId);
    const particleLabel = AMBIANCE_OPTIONS.find(
      (o) => o.id === preset.suggestedEffect
    )?.label;
    toast({
      title: `Thème « ${preset.name} » activé`,
      description: theme.syncParticles && particleLabel
        ? `Palette appliquée + ambiance « ${particleLabel} » accordée.`
        : "Toute l'interface Shiori a été harmonisée en direct.",
    });
  };

  const handleHexInputChange = (val: string) => {
    setHexDraft(val);
    const trimmed = val.trim();
    if (/^#?[0-9a-fA-F]{6}$/.test(trimmed)) {
      updateTheme({ accentColor: normalizeHex(trimmed), presetId: "custom" });
    }
  };

  const handleReset = () => {
    resetTheme();
    toast({
      title: "Apparence réinitialisée",
      description: "Retour au thème signature Akane Crimson sur Obsidienne.",
    });
  };

  const activePreset = THEME_PRESETS.find((p) => p.id === theme.presetId);

  return (
    <section
      id="personnalisation"
      className="rounded-2xl card-surface border-accent/25 p-6 space-y-6 scroll-mt-24"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <span className="inline-flex items-center gap-1.5 text-[10.5px] font-mono uppercase tracking-[0.16em] text-accent-soft">
            <Palette className="w-3.5 h-3.5 text-accent" />
            Studio de Personnalisation · Temps Réel
          </span>
          <h2 className="text-lg sm:text-xl font-semibold text-white mt-0.5">
            Couleurs, Ambiance & Style de l&apos;Application
          </h2>
          <p className="text-xs text-[#8A8FA4] mt-0.5">
            Adaptez l&apos;identité visuelle de Shiori selon vos goûts : thèmes signature, couleur libre,
            atmosphère de fond et finitions d&apos;interface.
          </p>
        </div>

        <button
          type="button"
          onClick={handleReset}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/[0.05] hover:bg-white/[0.11] border border-white/[0.09] text-xs font-medium text-[#C8CCE0] hover:text-white transition-colors cursor-pointer self-start sm:self-auto shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Par défaut</span>
        </button>
      </div>

      {/* Live Mini Preview Strip */}
      <div className="rounded-2xl bg-obsidian/90 border border-white/[0.09] p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 65% 110% at 12% 50%, rgb(var(--shiori-accent-rgb) / 0.16), transparent 65%), radial-gradient(ellipse 50% 90% at 92% 20%, rgb(var(--shiori-secondary-rgb) / 0.12), transparent 60%)",
          }}
        />
        <div className="relative z-10 flex items-center gap-3.5 min-w-0">
          {/* Live Shiori Ribbon Emblem */}
          <div className="w-10 h-11 rounded-xl bg-surface-elevated border border-white/[0.1] flex items-center justify-center shrink-0">
            <svg
              viewBox="0 0 32 36"
              fill="none"
              className="w-6 h-7"
              style={{
                filter: "drop-shadow(0 0 10px rgb(var(--shiori-accent-rgb) / 0.55))",
              }}
            >
              <path
                d="M5 4C5 2.34315 6.34315 1 8 1H24C25.6569 1 27 2.34315 27 4V33.5L16 26.2L5 33.5V4Z"
                fill="url(#themePreviewRibbon)"
              />
              <text
                x="16"
                y="18.5"
                textAnchor="middle"
                fill="var(--shiori-accent-fg)"
                fontSize="12"
                fontFamily="serif"
                fontWeight="700"
              >
                栞
              </text>
              <defs>
                <linearGradient
                  id="themePreviewRibbon"
                  x1="5"
                  y1="1"
                  x2="27"
                  y2="34"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop stopColor="var(--shiori-accent-hover)" />
                  <stop offset="1" stopColor="var(--shiori-accent-deep)" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-white">
                Aperçu actif :{" "}
                <span className="text-accent-soft">
                  {activePreset ? activePreset.name : `Personnalisé (${theme.accentColor})`}
                </span>
              </span>
              <span className="px-2 py-0.5 rounded-md bg-accent/18 border border-accent/35 font-mono text-[10px] font-semibold text-accent-soft">
                Ép. 12
              </span>
              <span className="inline-flex items-center gap-1 font-mono text-[11px] text-kinpaku">
                <Star className="w-3 h-3 fill-current" />
                9.2
              </span>
            </div>
            <div className="mt-2 w-52 max-w-full h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
              <div
                className="h-full w-3/4 rounded-full"
                style={{
                  background:
                    "linear-gradient(90deg, var(--shiori-accent), var(--shiori-secondary))",
                }}
              />
            </div>
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-2 shrink-0">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent/16 border border-accent/35 text-accent-soft text-[11px] font-semibold">
            <Bookmark className="w-3.5 h-3.5" />
            Watching
          </span>
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-accent text-accent-fg text-[11px] font-semibold shadow-accent">
            Bouton principal
          </span>
        </div>
      </div>

      {/* 1. 8 Signature Theme Presets */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <p className="text-[11px] font-mono uppercase tracking-wider text-[#9A9EAE]">
            1. Thèmes Signature (1 clic)
          </p>
          {/* Auto-sync particles toggle */}
          <label className="inline-flex items-center gap-2 text-xs text-[#B6BACB] cursor-pointer select-none">
            <Wand2 className="w-3.5 h-3.5 text-kinpaku" />
            <span>Accorder les particules au thème</span>
            <button
              type="button"
              role="switch"
              aria-checked={theme.syncParticles}
              onClick={() => updateTheme({ syncParticles: !theme.syncParticles })}
              className={cn(
                "w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer",
                theme.syncParticles ? "bg-accent" : "bg-white/[0.14]"
              )}
            >
              <span
                className={cn(
                  "block w-4 h-4 rounded-full bg-white shadow transition-transform",
                  theme.syncParticles ? "translate-x-4" : "translate-x-0"
                )}
              />
            </button>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {THEME_PRESETS.map((preset) => {
            const active = theme.presetId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleSelectPreset(preset.id)}
                style={{
                  borderColor: active ? `${preset.accentColor}AA` : undefined,
                  boxShadow: active
                    ? `0 10px 26px -10px ${preset.accentColor}77`
                    : undefined,
                }}
                className={cn(
                  "group relative p-3.5 rounded-xl border text-left transition-all cursor-pointer overflow-hidden",
                  active
                    ? "bg-surface-elevated"
                    : "bg-obsidian/70 border-white/[0.08] hover:border-white/[0.18] hover:bg-surface"
                )}
              >
                {/* Top 3-color swatch preview strip */}
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-5 h-5 rounded-full border border-white/25 shadow-sm"
                      style={{ backgroundColor: preset.accentColor }}
                    />
                    <span
                      className="w-4 h-4 rounded-full border border-white/20 -ml-2"
                      style={{ backgroundColor: preset.secondaryColor }}
                    />
                    <span
                      className="w-4 h-4 rounded-full border border-white/20 -ml-1.5"
                      style={{ backgroundColor: preset.previewBg }}
                    />
                  </div>
                  {active && (
                    <span
                      style={{ backgroundColor: preset.accentColor }}
                      className="w-4.5 h-4.5 rounded-full flex items-center justify-center text-[#090A0F] shrink-0"
                    >
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </span>
                  )}
                </div>

                <p className="text-xs font-semibold text-white truncate">{preset.name}</p>
                <p className="text-[11px] text-[#858A9E] mt-0.5 line-clamp-1">
                  {preset.subtitle}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Custom Primary & Secondary Colors */}
      <div className="pt-5 border-t border-white/[0.07] grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Primary Accent Color */}
        <div className="p-4 rounded-xl bg-obsidian/65 border border-white/[0.07] space-y-3.5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-white">Couleur d&apos;accent principale</p>
              <p className="text-[11px] text-[#808599]">
                Boutons, badges, logo 栞, liens actifs et sélection.
              </p>
            </div>
            {/* Color wheel + hex input */}
            <div className="flex items-center gap-1.5 shrink-0">
              <label
                title="Choisir une couleur libre"
                className="relative w-8 h-8 rounded-lg border border-white/20 overflow-hidden cursor-pointer shadow-inner shrink-0"
                style={{ backgroundColor: theme.accentColor }}
              >
                <input
                  type="color"
                  aria-label="Sélecteur de couleur d'accent principale"
                  value={theme.accentColor}
                  onChange={(e) =>
                    updateTheme({ accentColor: e.target.value, presetId: "custom" })
                  }
                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                />
              </label>
              <input
                type="text"
                aria-label="Code hexadécimal couleur principale"
                value={hexDraft}
                onChange={(e) => handleHexInputChange(e.target.value)}
                maxLength={7}
                className="w-21 h-8 px-2 rounded-lg bg-surface border border-white/[0.1] font-mono text-[11px] text-white uppercase focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {CUSTOM_ACCENT_SWATCHES.map((s) => {
              const selected =
                theme.accentColor.toUpperCase() === s.color.toUpperCase();
              return (
                <button
                  key={s.color}
                  type="button"
                  title={s.name}
                  onClick={() =>
                    updateTheme({ accentColor: s.color, presetId: "custom" })
                  }
                  style={{ backgroundColor: s.color }}
                  className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center transition-transform cursor-pointer",
                    selected
                      ? "ring-2 ring-white ring-offset-2 ring-offset-obsidian scale-110"
                      : "opacity-80 hover:opacity-100 hover:scale-105"
                  )}
                >
                  {selected && <Check className="w-3.5 h-3.5 text-[#090A0F] stroke-[3]" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Secondary Highlight Color */}
        <div className="p-4 rounded-xl bg-obsidian/65 border border-white/[0.07] space-y-3.5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-white">
                Teinte secondaire (Reflets & Étoiles)
              </p>
              <p className="text-[11px] text-[#808599]">
                Notes, halo d&apos;arrière-plan et dégradé de barre de défilement.
              </p>
            </div>
            <label
              title="Choisir une couleur secondaire libre"
              className="relative w-8 h-8 rounded-lg border border-white/20 overflow-hidden cursor-pointer shadow-inner shrink-0"
              style={{ backgroundColor: theme.secondaryColor }}
            >
              <input
                type="color"
                aria-label="Sélecteur de couleur secondaire"
                value={theme.secondaryColor}
                onChange={(e) =>
                  updateTheme({ secondaryColor: e.target.value, presetId: "custom" })
                }
                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {SECONDARY_SWATCHES.map((s) => {
              const selected =
                theme.secondaryColor.toUpperCase() === s.color.toUpperCase();
              return (
                <button
                  key={s.color}
                  type="button"
                  title={s.name}
                  onClick={() =>
                    updateTheme({ secondaryColor: s.color, presetId: "custom" })
                  }
                  style={{ backgroundColor: s.color }}
                  className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center transition-transform cursor-pointer",
                    selected
                      ? "ring-2 ring-white ring-offset-2 ring-offset-obsidian scale-110"
                      : "opacity-80 hover:opacity-100 hover:scale-105"
                  )}
                >
                  {selected && <Check className="w-3.5 h-3.5 text-[#090A0F] stroke-[3]" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. Surface Atmosphere (Background & Cards) */}
      <div className="pt-5 border-t border-white/[0.07] space-y-3">
        <p className="text-[11px] font-mono uppercase tracking-wider text-[#9A9EAE] flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-accent" />
          <span>2. Ambiance de fond & Surfaces</span>
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {SURFACE_OPTIONS.map((surf) => {
            const active = theme.surface === surf.id;
            const previewBg =
              surf.id === "tinted"
                ? `color-mix(in srgb, #06070B 88%, ${theme.accentColor} 12%)`
                : surf.bg;
            const previewCard =
              surf.id === "tinted"
                ? `color-mix(in srgb, #141722 82%, ${theme.accentColor} 18%)`
                : surf.elevated;

            return (
              <button
                key={surf.id}
                type="button"
                onClick={() => updateTheme({ surface: surf.id })}
                className={cn(
                  "p-2.5 rounded-xl border text-left transition-all cursor-pointer space-y-2",
                  active
                    ? "bg-surface-elevated border-accent/70 ring-1 ring-accent/35"
                    : "bg-obsidian/65 border-white/[0.08] hover:border-white/[0.18]"
                )}
              >
                {/* Mini dark UI preview tile */}
                <div
                  className="h-10 rounded-lg border border-white/[0.09] p-1.5 flex items-end gap-1.5 overflow-hidden"
                  style={{ backgroundColor: previewBg }}
                >
                  <div
                    className="h-5 flex-1 rounded border border-white/[0.08]"
                    style={{ backgroundColor: previewCard }}
                  />
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: theme.accentColor }}
                  />
                </div>
                <div>
                  <p className="text-[11.5px] font-semibold text-white truncate">
                    {surf.label}
                  </p>
                  <p className="text-[10px] text-[#808599] truncate">{surf.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Corners & Ambient Glow */}
      <div className="pt-5 border-t border-white/[0.07] grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Corner Radius Style */}
        <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-obsidian/65 border border-white/[0.07]">
          <span className="text-xs font-medium text-[#C6CAD8] flex items-center gap-2">
            <Square className="w-3.5 h-3.5 text-accent" />
            <span>Arrondis</span>
          </span>
          <div className="inline-flex items-center p-0.5 rounded-lg bg-white/[0.04] border border-white/[0.07]">
            {CORNER_OPTIONS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => updateTheme({ corners: c.id })}
                className={cn(
                  "px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer",
                  theme.corners === c.id
                    ? "bg-accent text-accent-fg font-semibold"
                    : "text-[#8E93A6] hover:text-white"
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Ambient Header Glow */}
        <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-obsidian/65 border border-white/[0.07]">
          <span className="text-xs font-medium text-[#C6CAD8] flex items-center gap-2">
            <SunMedium className="w-3.5 h-3.5 text-kinpaku" />
            <span>Halo lumineux</span>
          </span>
          <div className="inline-flex items-center p-0.5 rounded-lg bg-white/[0.04] border border-white/[0.07]">
            {GLOW_OPTIONS.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => updateTheme({ glow: g.id })}
                className={cn(
                  "px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer",
                  theme.glow === g.id
                    ? "bg-accent text-accent-fg font-semibold"
                    : "text-[#8E93A6] hover:text-white"
                )}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Subtle footer tip */}
      <p className="text-[11px] text-[#7D8296] flex items-center gap-1.5">
        <Sparkles className="w-3.5 h-3.5 text-accent shrink-0" />
        <span>
          Astuce : vous pouvez aussi changer de thème à tout moment depuis l&apos;icône{" "}
          <strong className="text-[#C8CCE0]">Palette</strong> dans la barre de navigation.
        </span>
      </p>
    </section>
  );
}
