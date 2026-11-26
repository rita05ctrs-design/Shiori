"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Download,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  Star,
  Trophy,
  Clock,
  BookOpen,
  Tv,
  Award,
  Calendar,
} from "lucide-react";
import { useShiori } from "@/context/ShioriContext";
import { useTranslation } from "@/hooks/useTranslation";
import { computeShioriWrapped } from "@/lib/stats";
import { cn } from "@/lib/utils";

const TOTAL_SLIDES = 4;

export function ShioriWrappedCard() {
  const { library, activity, profile, theme, toast } = useShiori();
  const { t, tr, tGenre, locale } = useTranslation();
  const initialWrapped = useMemo(
    () => computeShioriWrapped(library, activity),
    [library, activity]
  );
  const [selectedYear, setSelectedYear] = useState<number>(initialWrapped.year);
  const [slide, setSlide] = useState(0);
  const [copied, setCopied] = useState(false);

  const wrapped = useMemo(
    () => computeShioriWrapped(library, activity, selectedYear),
    [library, activity, selectedYear]
  );

  const busiestMonthLabel = useMemo(() => {
    if (!wrapped.busiestMonth) return null;
    const [yStr, mStr] = wrapped.busiestMonth.key.split("-");
    const dt = new Date(Number(yStr), Number(mStr) - 1, 1);
    if (Number.isNaN(dt.getTime())) return wrapped.busiestMonth.label;
    const f = new Intl.DateTimeFormat(locale, { month: "short" })
      .format(dt)
      .replace(/\.$/, "");
    return f.charAt(0).toUpperCase() + f.slice(1);
  }, [wrapped.busiestMonth, locale]);

  const archetypeTitle = tr(wrapped.archetype.title);
  const archetypeSubtitle = tr(wrapped.archetype.subtitle);

  const buildShareText = () => {
    const lines = [
      `栞 Shiori Wrapped ${wrapped.year} — ${profile.displayName} (@${profile.username})`,
      `✨ ${archetypeTitle}`,
      `📺 ${tr("{animes} animés · {eps} épisodes ({days}j estimés)", {
        animes: wrapped.animeCount,
        eps: wrapped.episodesWatched.toLocaleString(locale),
        days: wrapped.estimatedDays,
      })}`,
      `📖 ${tr("{mangas} mangas · {chaps} chapitres", {
        mangas: wrapped.mangaCount,
        chaps: wrapped.chaptersRead.toLocaleString(locale),
      })}`,
      wrapped.meanScore !== null
        ? `★ ${tr("Note moyenne")} : ${wrapped.meanScore.toFixed(2)}/10`
        : "",
      wrapped.topGenres.length > 0
        ? `🎭 ${tr("Genres préférés")} : ${wrapped.topGenres
            .slice(0, 3)
            .map((g) => tGenre(g.genre))
            .join(", ")}`
        : "",
      wrapped.topStudio ? `🎬 ${tr("Studio signature")} : ${wrapped.topStudio.name}` : "",
      wrapped.topTitles.length > 0
        ? `🏆 ${tr("Top œuvres")} : ${wrapped.topTitles.map((item) => item.title).join(" · ")}`
        : "",
    ].filter(Boolean);
    return lines.join("\n");
  };

  const handleCopySummary = async () => {
    try {
      await navigator.clipboard.writeText(buildShareText());
      setCopied(true);
      toast({
        title: tr("Résumé Shiori Wrapped copié !"),
        description: tr("Prêt à être partagé sur Discord, X ou entre amis."),
        variant: "success",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: tr("Copie bloquée par le navigateur"),
        variant: "warning",
      });
    }
  };

  const handleDownloadPosterPng = () => {
    const canvas = document.createElement("canvas");
    const w = 1080;
    const h = 1350;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Background obsidian + ambient theme glows
    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, "#08090F");
    bg.addColorStop(0.55, "#111322");
    bg.addColorStop(1, "#0A0B12");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    const glow1 = ctx.createRadialGradient(220, 220, 20, 220, 220, 520);
    glow1.addColorStop(0, `${theme.accentColor}55`);
    glow1.addColorStop(1, "transparent");
    ctx.fillStyle = glow1;
    ctx.fillRect(0, 0, w, h);

    const glow2 = ctx.createRadialGradient(880, 1080, 20, 880, 1080, 480);
    glow2.addColorStop(0, `${theme.secondaryColor}40`);
    glow2.addColorStop(1, "transparent");
    ctx.fillStyle = glow2;
    ctx.fillRect(0, 0, w, h);

    // Subtle editorial frame
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 2;
    ctx.strokeRect(48, 48, w - 96, h - 96);

    // Header eyebrow & Brand
    ctx.fillStyle = theme.accentColor;
    ctx.font = "600 24px monospace";
    ctx.fillText(`栞  SHIORI WRAPPED ${wrapped.year}`, 96, 130);

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "700 62px sans-serif";
    ctx.fillText(profile.displayName, 96, 212);

    ctx.fillStyle = "#9A9EAE";
    ctx.font = "500 26px monospace";
    ctx.fillText(`@${profile.username}  ·  ${archetypeTitle}`, 96, 258);

    // 4 KPI tiles
    const kpis = [
      { label: tr("Épisodes vus").toUpperCase(), val: wrapped.episodesWatched.toLocaleString(locale) },
      { label: tr("Chapitres lus").toUpperCase(), val: wrapped.chaptersRead.toLocaleString(locale) },
      { label: tr("Temps estimé").toUpperCase(), val: tr("{n} jours", { n: wrapped.estimatedDays }) },
      {
        label: tr("Note moyenne").toUpperCase(),
        val: wrapped.meanScore !== null ? `${wrapped.meanScore.toFixed(1)} / 10` : "—",
      },
    ];
    kpis.forEach((k, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 96 + col * 456;
      const y = 320 + row * 176;
      ctx.fillStyle = "rgba(255,255,255,0.045)";
      ctx.fillRect(x, y, 432, 152);
      ctx.strokeStyle = "rgba(255,255,255,0.1)";
      ctx.strokeRect(x, y, 432, 152);

      ctx.fillStyle = "#9A9EAE";
      ctx.font = "600 20px monospace";
      ctx.fillText(k.label, x + 28, y + 52);

      ctx.fillStyle = i === 3 ? "#F0B95B" : "#FFFFFF";
      ctx.font = "700 46px monospace";
      ctx.fillText(k.val, x + 28, y + 114);
    });

    // Top Genres
    ctx.fillStyle = theme.accentColor;
    ctx.font = "600 22px monospace";
    ctx.fillText(tr("ADN GENRES"), 96, 738);

    ctx.fillStyle = "#F4F3EE";
    ctx.font = "600 32px sans-serif";
    const genreLine =
      wrapped.topGenres.length > 0
        ? wrapped.topGenres.slice(0, 3).map((g) => `${tGenre(g.genre)} (${g.count})`).join("  ·  ")
        : tr("Collection en construction");
    ctx.fillText(genreLine.slice(0, 52), 96, 788);

    // Top Studio
    if (wrapped.topStudio) {
      ctx.fillStyle = "#F0B95B";
      ctx.font = "600 22px monospace";
      ctx.fillText(tr("Studio signature").toUpperCase(), 96, 868);
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "700 34px sans-serif";
      ctx.fillText(
        `${wrapped.topStudio.name} (${tr("{n} œuvres", { n: wrapped.topStudio.count })})`,
        96,
        916
      );
    }

    // Top 3 Titles
    ctx.fillStyle = theme.accentColor;
    ctx.font = "600 22px monospace";
    ctx.fillText(tr("Chefs-d'œuvre marquants").toUpperCase(), 96, 1002);
    wrapped.topTitles.forEach((item, idx) => {
      const y = 1054 + idx * 54;
      ctx.fillStyle = "#F0B95B";
      ctx.font = "700 28px monospace";
      ctx.fillText(`#${idx + 1}`, 96, y);
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "600 28px sans-serif";
      const label = item.title.length > 44 ? `${item.title.slice(0, 44)}…` : item.title;
      ctx.fillText(label, 152, y);
      if (item.score !== null) {
        ctx.fillStyle = "#F0B95B";
        ctx.font = "600 24px monospace";
        ctx.fillText(`★ ${item.score.toFixed(1)}`, 880, y);
      }
    });

    // Footer watermark
    ctx.fillStyle = "#7D8296";
    ctx.font = "500 20px monospace";
    ctx.fillText("SHIORI (栞) — ANIME & MANGA", 96, h - 86);

    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `shiori-wrapped-${wrapped.year}-${profile.username}.png`;
    a.click();
    toast({
      title: tr("Carte Shiori Wrapped {year} téléchargée", { year: wrapped.year }),
      variant: "success",
      celebrate: true,
    });
  };

  if (library.length === 0) {
    return null;
  }

  return (
    <section
      id="wrapped"
      className="rounded-3xl card-surface border border-accent/35 p-5 sm:p-7 space-y-5 relative overflow-hidden scroll-mt-24"
    >
      {/* Ambient Japanese editorial glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -right-20 w-80 h-80 rounded-full opacity-25 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, var(--shiori-accent) 0%, var(--shiori-secondary) 55%, transparent 75%)",
        }}
      />

      {/* Top Header + Year Switcher + Share Controls */}
      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-accent flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{tr("Bilan annuel personnalisé · 100% données réelles")}</span>
          </p>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gradient-editorial mt-0.5">
            Shiori Wrapped {wrapped.year}
          </h2>
          <p className="text-xs text-[#9EA3B5] mt-1">
            {tr("Votre rétrospective éditoriale générée en direct depuis votre bibliothèque et vos notes.")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
          {wrapped.availableYears.length > 1 && (
            <div className="inline-flex items-center gap-1 p-1 rounded-full bg-obsidian/80 border border-white/[0.1]">
              {wrapped.availableYears.slice(0, 4).map((yr) => (
                <button
                  key={yr}
                  type="button"
                  onClick={() => setSelectedYear(yr)}
                  className={cn(
                    "px-2.5 py-1 rounded-full font-mono text-xs font-semibold cursor-pointer transition-colors",
                    selectedYear === yr
                      ? "bg-accent text-accent-fg"
                      : "text-[#9A9EAE] hover:text-white"
                  )}
                >
                  {yr}
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={handleCopySummary}
            className="h-9 px-3.5 rounded-full bg-white/[0.07] hover:bg-white/[0.14] border border-white/[0.12] text-xs font-semibold text-white inline-flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            <span>{copied ? t("common.copied") : tr("Copier le résumé")}</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadPosterPng}
            className="h-9 px-4 rounded-full bg-accent hover:bg-accent-hover text-accent-fg text-xs font-semibold shadow-accent inline-flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{tr("Télécharger la carte PNG")}</span>
          </button>
        </div>
      </div>

      {/* Story Progress Bars */}
      <div className="relative z-10 grid grid-cols-4 gap-2">
        {[
          tr("Vue d'ensemble"),
          tr("ADN Genres & Studio"),
          tr("Tes Chefs-d'Œuvre"),
          tr("Carte Partageable"),
        ].map((lbl, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => setSlide(idx)}
            className="text-left space-y-1.5 cursor-pointer group"
          >
            <div className="h-1.5 rounded-full bg-white/[0.1] overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-300",
                  idx === slide
                    ? "w-full bg-gradient-to-r from-accent to-kinpaku"
                    : idx < slide
                      ? "w-full bg-white/55"
                      : "w-0"
                )}
              />
            </div>
            <span
              className={cn(
                "block text-[10.5px] font-mono truncate transition-colors",
                idx === slide
                  ? "text-white font-semibold"
                  : "text-[#7D8296] group-hover:text-[#C8CCE0]"
              )}
            >
              0{idx + 1}. {lbl}
            </span>
          </button>
        ))}
      </div>

      {/* Interactive Story Stage */}
      <div className="relative z-10 rounded-2xl bg-obsidian/80 border border-white/[0.09] p-5 sm:p-6 min-h-[260px] flex flex-col justify-between gap-5">
        <AnimatePresence mode="wait">
          {slide === 0 && (
            <motion.div
              key="slide-0"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-5"
            >
              <div className="space-y-1">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-accent/18 border border-accent/40 text-[11px] font-semibold text-accent-soft">
                  <Trophy className="w-3 h-3" />
                  {tr("Archétype {year}", { year: wrapped.year })}
                </span>
                <h3 className="text-2xl sm:text-3xl font-bold text-white">
                  {archetypeTitle}
                </h3>
                <p className="text-xs sm:text-sm text-[#A6AAB8] max-w-2xl">
                  {archetypeSubtitle}
                </p>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-white/[0.035] border border-white/[0.07]">
                  <p className="text-[10.5px] font-mono text-[#858A9E] flex items-center gap-1.5">
                    <Tv className="w-3.5 h-3.5 text-sky-400" />
                    {tr("Épisodes vus")}
                  </p>
                  <p className="text-2xl font-bold font-mono text-white mt-1">
                    {wrapped.episodesWatched.toLocaleString(locale)}
                  </p>
                  <p className="text-[10.5px] text-[#7D8296] mt-0.5">
                    {tr("{animes} animés · {completed} terminés", {
                      animes: wrapped.animeCount,
                      completed: wrapped.completedCount,
                    })}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-white/[0.035] border border-white/[0.07]">
                  <p className="text-[10.5px] font-mono text-[#858A9E] flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-violet-400" />
                    {tr("Chapitres lus")}
                  </p>
                  <p className="text-2xl font-bold font-mono text-white mt-1">
                    {wrapped.chaptersRead.toLocaleString(locale)}
                  </p>
                  <p className="text-[10.5px] text-[#7D8296] mt-0.5">
                    {tr("{n} mangas suivis", { n: wrapped.mangaCount })}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-white/[0.035] border border-white/[0.07]">
                  <p className="text-[10.5px] font-mono text-[#858A9E] flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-emerald-400" />
                    {tr("Temps estimé")}
                  </p>
                  <p className="text-2xl font-bold font-mono text-white mt-1">
                    {wrapped.estimatedDays} {tr("j")}
                  </p>
                  <p className="text-[10.5px] text-[#7D8296] mt-0.5">
                    {tr("{n} heures", { n: wrapped.estimatedHours.toLocaleString(locale) })}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-white/[0.035] border border-white/[0.07]">
                  <p className="text-[10.5px] font-mono text-[#858A9E] flex items-center gap-1.5">
                    <Star className="w-3.5 h-3.5 text-kinpaku fill-current" />
                    {tr("Note moyenne")}
                  </p>
                  <p className="text-2xl font-bold font-mono text-kinpaku mt-1">
                    {wrapped.meanScore !== null ? `${wrapped.meanScore.toFixed(2)}/10` : "—"}
                  </p>
                  <p className="text-[10.5px] text-[#7D8296] mt-0.5">
                    {wrapped.busiestMonth && busiestMonthLabel
                      ? tr("Pic en {month} ({n})", {
                          month: busiestMonthLabel,
                          n: wrapped.busiestMonth.count,
                        })
                      : tr("{n} œuvres analysées", { n: wrapped.titlesTracked })}
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {slide === 1 && (
            <motion.div
              key="slide-1"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center"
            >
              <div className="space-y-3">
                <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-accent">
                  {tr("Tes genres dominants")}
                </p>
                <div className="space-y-2.5">
                  {wrapped.topGenres.length === 0 ? (
                    <p className="text-xs text-[#8A8FA4]">
                      {tr("Ajoutez des œuvres pour découvrir votre ADN.")}
                    </p>
                  ) : (
                    wrapped.topGenres.map((g, idx) => (
                      <div
                        key={g.genre}
                        className="p-3 rounded-xl bg-white/[0.035] border border-white/[0.07] flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="w-6 h-6 rounded-lg bg-accent/20 text-accent-soft font-mono text-xs font-bold flex items-center justify-center">
                            #{idx + 1}
                          </span>
                          <span className="text-sm font-semibold text-white">
                            {tGenre(g.genre)}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 font-mono text-xs">
                          {g.avgScore !== null && (
                            <span className="text-kinpaku">★ {g.avgScore.toFixed(1)}</span>
                          )}
                          <span className="text-[#9A9EAE]">
                            {tr("{n} titres", { n: g.count })}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-gradient-to-br from-accent/14 via-surface to-kinpaku/10 border border-white/[0.1] space-y-3">
                <Award className="w-8 h-8 text-kinpaku" />
                <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-kinpaku">
                  {tr("Studio signature")}
                </p>
                <h4 className="text-2xl font-bold text-white">
                  {wrapped.topStudio ? wrapped.topStudio.name : tr("En cours de découverte")}
                </h4>
                <p className="text-xs text-[#B5B9C9] leading-relaxed">
                  {wrapped.topStudio
                    ? wrapped.topStudio.avgScore !== null
                      ? tr("{n} œuvres suivies avec une note moyenne de ★ {score}/10.", {
                          n: wrapped.topStudio.count,
                          score: wrapped.topStudio.avgScore.toFixed(1),
                        })
                      : tr("{n} œuvres suivies.", { n: wrapped.topStudio.count })
                    : tr("Notez et suivez vos studios préférés pour révéler votre signature.")}
                </p>
                {wrapped.busiestMonth && busiestMonthLabel && (
                  <p className="text-[11px] font-mono text-[#9EA3B5] flex items-center gap-1.5 pt-1">
                    <Calendar className="w-3.5 h-3.5 text-accent-soft" />
                    {tr("Mois le plus actif : {month} ({n} actions)", {
                      month: busiestMonthLabel,
                      n: wrapped.busiestMonth.count,
                    })}
                  </p>
                )}
              </div>
            </motion.div>
          )}

          {slide === 2 && (
            <motion.div
              key="slide-2"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              <div>
                <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-kinpaku">
                  {tr("Podium {year}", { year: wrapped.year })}
                </p>
                <h3 className="text-xl font-bold text-white mt-0.5">
                  {tr("Les œuvres qui ont marqué votre sélection")}
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                {wrapped.topTitles.map((item, idx) => (
                  <Link
                    key={item.mediaId}
                    href={`/media/${item.mediaId}`}
                    className="group p-3 rounded-2xl bg-white/[0.035] hover:bg-white/[0.07] border border-white/[0.09] hover:border-accent/50 flex items-center gap-3.5 transition-all"
                  >
                    <img
                      src={item.coverImage}
                      alt={item.title}
                      className="w-14 h-20 rounded-xl object-cover border border-white/15 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <span className="px-2 py-0.5 rounded-full bg-kinpaku/20 border border-kinpaku/40 font-mono text-[10px] font-bold text-kinpaku">
                        #{idx + 1}
                      </span>
                      <p className="text-sm font-bold text-white group-hover:text-accent-hover line-clamp-2 mt-1">
                        {item.title}
                      </p>
                      <p className="text-[11px] font-mono text-[#9A9EAE] mt-1">
                        {item.score !== null
                          ? `★ ${item.score.toFixed(1)}/10`
                          : `${item.progress} ${item.type === "MANGA" ? t("common.chShort") : t("common.epShort")}`}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </motion.div>
          )}

          {slide === 3 && (
            <motion.div
              key="slide-3"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5"
            >
              <div className="space-y-2 max-w-xl">
                <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-accent">
                  {tr("Prêt à partager")}
                </p>
                <h3 className="text-xl sm:text-2xl font-bold text-white">
                  {tr("Votre affiche Shiori Wrapped {year}", { year: wrapped.year })}
                </h3>
                <p className="text-xs sm:text-sm text-[#9EA3B5] leading-relaxed">
                  {tr("Téléchargez votre carte haute définition (1080×1350 PNG aux couleurs de votre thème actif) ou copiez votre résumé texte en un clic.")}
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleDownloadPosterPng}
                    className="h-10 px-5 rounded-full bg-accent hover:bg-accent-hover text-accent-fg text-xs font-semibold shadow-accent inline-flex items-center gap-2 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>{tr("Télécharger en PNG")}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCopySummary}
                    className="h-10 px-4 rounded-full bg-white/[0.08] hover:bg-white/[0.15] border border-white/[0.12] text-xs font-semibold text-white inline-flex items-center gap-2 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{tr("Copier le résumé")}</span>
                  </button>
                </div>
              </div>

              <div className="w-full md:w-72 rounded-2xl border border-accent/40 bg-gradient-to-br from-[#141625] via-[#0B0D16] to-[#1A1018] p-4 space-y-2.5 shrink-0 shadow-2xl">
                <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-accent-soft">
                  栞 SHIORI WRAPPED · {wrapped.year}
                </p>
                <p className="text-base font-bold text-white truncate">{profile.displayName}</p>
                <p className="text-[11px] text-kinpaku font-medium">{archetypeTitle}</p>
                <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
                  <div className="p-2 rounded-lg bg-white/[0.04]">
                    <span className="text-[#858A9E] block text-[9.5px]">{tr("Épisodes")}</span>
                    <strong className="text-white">{wrapped.episodesWatched}</strong>
                  </div>
                  <div className="p-2 rounded-lg bg-white/[0.04]">
                    <span className="text-[#858A9E] block text-[9.5px]">{tr("Note moy.")}</span>
                    <strong className="text-kinpaku">
                      {wrapped.meanScore !== null ? `★ ${wrapped.meanScore.toFixed(1)}` : "—"}
                    </strong>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Slide Prev/Next Controls */}
        <div className="flex items-center justify-between pt-3 border-t border-white/[0.07]">
          <button
            type="button"
            onClick={() => setSlide((s) => (s - 1 + TOTAL_SLIDES) % TOTAL_SLIDES)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.05] hover:bg-white/[0.12] text-xs font-medium text-white cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>{tr("Précédent")}</span>
          </button>
          <span className="text-[11px] font-mono text-[#7D8296]">
            {slide + 1} / {TOTAL_SLIDES}
          </span>
          <button
            type="button"
            onClick={() => setSlide((s) => (s + 1) % TOTAL_SLIDES)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.05] hover:bg-white/[0.12] text-xs font-medium text-white cursor-pointer"
          >
            <span>{tr("Suivant")}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </section>
  );
}
