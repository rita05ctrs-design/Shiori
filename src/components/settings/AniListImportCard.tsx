"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Tv,
  BookOpen,
  Heart,
  BarChart3,
  ExternalLink,
  Cloud,
  User,
  Sparkles,
  RefreshCw,
  Link2,
  Unlink,
  ShieldCheck,
  ArrowLeftRight,
} from "lucide-react";
import { useShiori } from "@/context/ShioriContext";
import { useTranslation } from "@/hooks/useTranslation";
import { getSettingsCopy } from "@/lib/settings-translations";
import { cn } from "@/lib/utils";
import type { AniListImportResponse } from "@/types/media";

export function AniListImportCard() {
  const {
    importFromAniList,
    anilistStats,
    anilistConnection,
    anilistAutoSync,
    setAniListAutoSync,
    lastAniListSync,
    refreshAniListStatus,
    disconnectAniList,
    profile,
    contentLanguage,
    toast,
  } = useShiori();
  const { t, locale } = useTranslation();
  const copy = getSettingsCopy(contentLanguage).anilist;

  const [username, setUsername] = useState(
    anilistConnection.user?.name ?? anilistStats?.anilistUsername ?? ""
  );
  const [includeAnime, setIncludeAnime] = useState(true);
  const [includeManga, setIncludeManga] = useState(true);
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const [loading, setLoading] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [oauthNotice, setOauthNotice] = useState<{
    kind: "success" | "error" | "warning";
    message: string;
  } | null>(null);
  const [result, setResult] = useState<AniListImportResponse | null>(null);

  // Sync username field when connected AniList profile loads
  useEffect(() => {
    if (anilistConnection.user?.name && !username) {
      setUsername(anilistConnection.user.name);
    }
  }, [anilistConnection.user?.name, username]);

  // Handle OAuth callback query parameters on /settings
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const connectedFlag = params.get("anilist_connected");
    const connectedUser = params.get("anilist_user");
    const storage = params.get("anilist_storage");
    const sbWarn = params.get("anilist_sb_warn");
    const oauthErr = params.get("anilist_error");

    if (connectedFlag === "1") {
      void refreshAniListStatus();
      if (connectedUser) setUsername(connectedUser);
      const storageMsg =
        storage === "supabase"
          ? "Jeton OAuth chiffré sauvegardé dans Supabase (table profiles)."
          : sbWarn
            ? `Connecté en session serveur chiffrée (Supabase : ${sbWarn}).`
            : "Connecté en session serveur chiffrée. Connectez votre compte Supabase pour le sauvegarder aussi dans la table profiles.";

      setOauthNotice({
        kind: sbWarn ? "warning" : "success",
        message: `Compte AniList @${connectedUser || "connecté"} lié ! ${storageMsg}`,
      });
      toast({
        title: `AniList connecté (@${connectedUser || "membre"})`,
        description: "La synchronisation bidirectionnelle vers AniList est maintenant active.",
        variant: "success",
        celebrate: true,
      });

      // Clean callback params from URL without reloading
      const cleanUrl = `${window.location.pathname}${window.location.hash || "#anilist-sync"}`;
      window.history.replaceState({}, "", cleanUrl);
    } else if (oauthErr) {
      const friendly =
        oauthErr === "access_denied"
          ? "Autorisation AniList annulée."
          : oauthErr === "not_configured"
            ? "ANILIST_CLIENT_ID / ANILIST_CLIENT_SECRET non configurés dans .env.local."
            : oauthErr === "invalid_state"
              ? "Vérification de sécurité OAuth expirée. Réessayez de vous connecter."
              : oauthErr;
      setOauthNotice({ kind: "error", message: friendly });
      const cleanUrl = `${window.location.pathname}${window.location.hash || "#anilist-sync"}`;
      window.history.replaceState({}, "", cleanUrl);
    }
  }, [refreshAniListStatus, toast]);

  const runImport = async (targetUser: string) => {
    const cleaned = targetUser.trim().replace(/^@/, "");
    if (!cleaned) {
      setError("Veuillez indiquer un nom d'utilisateur AniList.");
      return;
    }
    if (!includeAnime && !includeManga) {
      setError("Sélectionnez au moins les animés ou les mangas à importer.");
      return;
    }

    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const res = await importFromAniList(cleaned, {
        includeAnime,
        includeManga,
        mode,
      });
      if (!res.ok) {
        setError(res.error || "Impossible d'importer ce profil AniList.");
      } else if (res.data) {
        setResult(res.data);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    await runImport(username);
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await disconnectAniList();
      setOauthNotice(null);
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div
      id="anilist-sync"
      className="rounded-2xl card-surface border-sky-500/30 p-6 space-y-6 relative overflow-hidden scroll-mt-24"
    >
      {/* Subtle sky glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-16 w-52 h-52 rounded-full opacity-15 blur-3xl"
        style={{ background: "radial-gradient(circle, #38BDF8, transparent 70%)" }}
      />

      {/* ================================================================== */}
      {/* PART 1: OAUTH 2.0 BIDIRECTIONAL SYNC (SaveMediaListEntry)          */}
      {/* ================================================================== */}
      <div className="relative z-10 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-white flex items-center gap-2">
              <ArrowLeftRight className="w-4 h-4 text-sky-400" />
              <span>{copy.syncTitle}</span>
            </h2>
            <p className="text-xs text-[#8A8FA4] mt-1 leading-relaxed max-w-2xl">
              {copy.syncSub}
            </p>
          </div>

          <span
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border shrink-0 self-start",
              anilistConnection.connected
                ? "bg-emerald-500/15 border-emerald-500/35 text-emerald-300"
                : anilistConnection.configured
                  ? "bg-sky-500/15 border-sky-400/35 text-sky-300"
                  : "bg-amber-500/15 border-amber-500/35 text-amber-300"
            )}
          >
            <span
              className={cn(
                "w-1.5 h-1.5 rounded-full",
                anilistConnection.connected
                  ? "bg-emerald-400 animate-pulse"
                  : anilistConnection.configured
                    ? "bg-sky-400"
                    : "bg-amber-400"
              )}
            />
            {anilistConnection.connected
              ? copy.connected
              : anilistConnection.configured
                ? copy.ready
                : copy.notConfigured}
          </span>
        </div>

        {/* Callback Feedback Banner */}
        <AnimatePresence>
          {oauthNotice && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className={cn(
                "p-3.5 rounded-xl border text-xs flex items-start gap-2.5",
                oauthNotice.kind === "success"
                  ? "bg-emerald-500/12 border-emerald-500/35 text-emerald-200"
                  : oauthNotice.kind === "warning"
                    ? "bg-amber-500/12 border-amber-500/35 text-amber-200"
                    : "bg-rose-500/12 border-rose-500/35 text-rose-200"
              )}
            >
              {oauthNotice.kind === "success" ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
              )}
              <span>{oauthNotice.message}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Connected vs Disconnected Panel */}
        {anilistConnection.connected && anilistConnection.user ? (
          <div className="rounded-xl bg-obsidian/75 border border-emerald-500/30 p-4 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {anilistConnection.user.avatarUrl ? (
                  <img
                    src={anilistConnection.user.avatarUrl}
                    alt={anilistConnection.user.name}
                    className="w-11 h-11 rounded-full object-cover border border-sky-400/40 shrink-0"
                  />
                ) : (
                  <div className="w-11 h-11 rounded-full bg-sky-500/20 border border-sky-400/35 flex items-center justify-center text-sky-300 font-bold shrink-0">
                    {anilistConnection.user.name.slice(0, 2).toUpperCase()}
                  </div>
                )}

                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-white truncate">
                      @{anilistConnection.user.name}
                    </p>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/35 text-[10px] font-mono text-emerald-300">
                      {anilistConnection.storage === "supabase"
                        ? "Stocké dans Supabase profiles"
                        : anilistConnection.storage === "account"
                          ? "Stocké sur compte Shiori"
                          : "Session serveur chiffrée"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-[11px] text-[#8E93A6]">
                    <span>AniList #{anilistConnection.user.id}</span>
                    {anilistConnection.user.siteUrl && (
                      <a
                        href={anilistConnection.user.siteUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sky-400 hover:text-sky-300 inline-flex items-center gap-1"
                      >
                        <span>{copy.viewOnAniList}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void runImport(anilistConnection.user!.name)}
                  className="h-9 px-3.5 rounded-xl bg-sky-500/18 hover:bg-sky-500/28 border border-sky-400/40 text-sky-200 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
                  <span>{copy.importListBtn}</span>
                </button>
                <button
                  type="button"
                  disabled={disconnecting}
                  onClick={() => void handleDisconnect()}
                  className="h-9 px-3.5 rounded-xl bg-rose-500/12 hover:bg-rose-500/22 border border-rose-500/30 text-rose-300 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Unlink className="w-3.5 h-3.5" />
                  <span>{copy.disconnectBtn}</span>
                </button>
              </div>
            </div>

            {/* Auto-Sync Toggle Row */}
            <div className="pt-3 border-t border-white/[0.07] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-white">
                  {copy.autoSyncTitle}
                </p>
                <p className="text-[11px] text-[#858A9E]">
                  {copy.autoSyncDesc}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={anilistAutoSync}
                onClick={() => setAniListAutoSync(!anilistAutoSync)}
                className={cn(
                  "w-11 h-6 rounded-full p-0.5 transition-colors shrink-0 cursor-pointer self-start sm:self-auto",
                  anilistAutoSync ? "bg-emerald-500" : "bg-white/[0.14]"
                )}
              >
                <span
                  className={cn(
                    "block w-5 h-5 rounded-full bg-white shadow transition-transform",
                    anilistAutoSync ? "translate-x-5" : "translate-x-0"
                  )}
                />
              </button>
            </div>

            {/* Live Last Sync Telemetry */}
            {lastAniListSync && (
              <div
                className={cn(
                  "px-3 py-2 rounded-lg border text-[11.5px] flex items-center justify-between gap-2",
                  lastAniListSync.ok
                    ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-200"
                    : "bg-rose-500/10 border-rose-500/25 text-rose-200"
                )}
              >
                <span className="truncate">
                  {lastAniListSync.ok ? "✓ AniList: " : "⚠ AniList: "}
                  <strong className="text-white">{lastAniListSync.title}</strong> —{" "}
                  {lastAniListSync.detail}
                </span>
                <span className="font-mono text-[10px] opacity-75 shrink-0">
                  {new Date(lastAniListSync.at).toLocaleTimeString(locale, {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl bg-obsidian/70 border border-white/[0.08] p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                {copy.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 rounded-md bg-sky-500/12 border border-sky-400/25 text-sky-200 font-medium"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <p className="text-[11px] text-[#858A9E] flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>{copy.secureHint}</span>
              </p>
            </div>

            <a
              href="/api/auth/anilist/start"
              className="h-11 px-5 rounded-xl bg-gradient-to-r from-[#02A9FF] to-indigo-500 hover:from-[#29B8FF] hover:to-indigo-400 text-white text-xs font-semibold shadow-[0_10px_26px_rgba(2,169,255,0.32)] inline-flex items-center justify-center gap-2 transition-all shrink-0"
            >
              <Link2 className="w-4 h-4" />
              <span>{copy.connectBtn}</span>
            </a>
          </div>
        )}
      </div>

      {/* PART 2: PUBLIC USERNAME IMPORT */}
      <div id="anilist-import" className="relative z-10 pt-5 border-t border-white/[0.08] space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-sky-400" />
            <span>{copy.usernameImportTitle}</span>
          </h3>
          <p className="text-xs text-[#8A8FA4] mt-1 leading-relaxed">
            {copy.usernameImportSub}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleImport} className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <User className="w-4 h-4 text-sky-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={copy.usernamePlaceholder}
                className="w-full h-11 pl-10 pr-4 rounded-xl bg-obsidian/80 border border-white/[0.1] text-sm text-white placeholder:text-[#63687D] focus:outline-none focus:border-sky-400/70"
              />
            </div>

            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
              className="h-11 px-5 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] border border-white/[0.14] disabled:opacity-60 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shrink-0"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{copy.importingBtn}</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 text-sky-400" />
                  <span>{copy.importUsernameBtn}</span>
                </>
              )}
            </motion.button>
          </div>

          {/* Options Row */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIncludeAnime((v) => !v)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-all cursor-pointer",
                  includeAnime
                    ? "bg-sky-500/18 border-sky-400/45 text-sky-200"
                    : "bg-white/[0.03] border-white/[0.08] text-[#7D8296]"
                )}
              >
                <Tv className="w-3.5 h-3.5" />
                <span>{t("common.anime")}</span>
              </button>
              <button
                type="button"
                onClick={() => setIncludeManga((v) => !v)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-all cursor-pointer",
                  includeManga
                    ? "bg-violet-500/18 border-violet-400/45 text-violet-200"
                    : "bg-white/[0.03] border-white/[0.08] text-[#7D8296]"
                )}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>{t("common.manga")}</span>
              </button>
            </div>

            {/* Merge vs Replace */}
            <div className="inline-flex items-center p-0.5 rounded-lg bg-white/[0.04] border border-white/[0.07] text-[11px]">
              <button
                type="button"
                onClick={() => setMode("merge")}
                className={cn(
                  "px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer",
                  mode === "merge"
                    ? "bg-white/[0.12] text-white"
                    : "text-[#8C91A6] hover:text-white"
                )}
              >
                {copy.merge}
              </button>
              <button
                type="button"
                onClick={() => setMode("replace")}
                className={cn(
                  "px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer",
                  mode === "replace"
                    ? "bg-accent text-accent-fg font-semibold"
                    : "text-[#8C91A6] hover:text-white"
                )}
              >
                {copy.replaceList}
              </button>
            </div>
          </div>
        </form>

        {/* Error feedback */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="p-3.5 rounded-xl bg-rose-500/12 border border-rose-500/35 text-xs text-rose-200 flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Live Import Result Summary */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-xl bg-obsidian/80 border border-emerald-500/30 p-4 space-y-3.5"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {result.user.avatarUrl ? (
                    <img
                      src={result.user.avatarUrl}
                      alt={result.user.name}
                      className="w-10 h-10 rounded-full object-cover border border-white/15 shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-sky-500/20 flex items-center justify-center text-sky-300 font-bold">
                      {result.user.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white flex items-center gap-1.5 truncate">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Import réussi : {result.user.name}</span>
                    </p>
                    <p className="text-[11px] text-[#8E93A6] mt-0.5">
                      {result.counts.total} entrées fusionnées (toutes listes incluses) + statistiques
                    </p>
                  </div>
                </div>
                {result.user.siteUrl && (
                  <a
                    href={result.user.siteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-sky-400 hover:text-sky-300 inline-flex items-center gap-1 shrink-0"
                  >
                    <span>Profil</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

              {/* Imported Counters */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                  <p className="text-[10px] font-mono uppercase text-[#7D8296] flex items-center gap-1">
                    <Tv className="w-3 h-3 text-sky-400" /> {t("common.anime")}
                  </p>
                  <p className="text-base font-bold font-mono text-white mt-0.5">
                    {result.counts.anime}
                  </p>
                </div>
                <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                  <p className="text-[10px] font-mono uppercase text-[#7D8296] flex items-center gap-1">
                    <BookOpen className="w-3 h-3 text-violet-400" /> {t("common.manga")}
                  </p>
                  <p className="text-base font-bold font-mono text-white mt-0.5">
                    {result.counts.manga}
                  </p>
                </div>
                <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                  <p className="text-[10px] font-mono uppercase text-[#7D8296] flex items-center gap-1">
                    <Heart className="w-3 h-3 text-accent-hover" /> {t("nav.favorites")}
                  </p>
                  <p className="text-base font-bold font-mono text-white mt-0.5">
                    {result.counts.favorites}
                  </p>
                </div>
                <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                  <p className="text-[10px] font-mono uppercase text-[#7D8296] flex items-center gap-1">
                    <BarChart3 className="w-3 h-3 text-kinpaku" /> {t("common.epShort")} / {t("common.chShort")}
                  </p>
                  <p className="text-xs font-bold font-mono text-white mt-1 truncate">
                    {result.statistics.anime.episodesWatched.toLocaleString(locale)} /{" "}
                    {result.statistics.manga.chaptersRead.toLocaleString(locale)}
                  </p>
                </div>
              </div>

              {/* Supabase Cloud Persistence Status */}
              <div
                className={cn(
                  "p-2.5 rounded-lg border text-xs flex items-start gap-2",
                  result.supabaseSync.authenticated && result.supabaseSync.statsSaved
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                    : result.supabaseSync.error
                      ? "bg-amber-500/10 border-amber-500/30 text-amber-200"
                      : "bg-white/[0.03] border-white/[0.08] text-[#A8ADBE]"
                )}
              >
                <Cloud className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  {result.supabaseSync.authenticated && result.supabaseSync.statsSaved
                    ? `Supabase: ${result.supabaseSync.entriesSaved} ${t("common.titles")}`
                    : result.supabaseSync.error
                      ? `Supabase: ${result.supabaseSync.error}`
                      : profile.mode === "supabase"
                        ? "Supabase synced."
                        : t("nav.localMode")}
                </span>
              </div>

              <div className="flex items-center gap-3 pt-0.5 text-xs">
                <Link
                  href="/library"
                  className="font-semibold text-white hover:text-accent-soft transition-colors"
                >
                  {copy.openLibrary}
                </Link>
                <Link
                  href="/stats"
                  className="font-semibold text-sky-400 hover:text-sky-300 transition-colors"
                >
                  {copy.viewStats}
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Existing saved AniList snapshot notice */}
        {!result && anilistStats && (
          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.07] flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              {anilistStats.anilistAvatarUrl && (
                <img
                  src={anilistStats.anilistAvatarUrl}
                  alt={anilistStats.anilistUsername}
                  className="w-7 h-7 rounded-full object-cover border border-white/15 shrink-0"
                />
              )}
              <span className="text-[#C6CAD8] truncate">
                {copy.lastImport}{" "}
                <strong className="text-white">@{anilistStats.anilistUsername}</strong> (
                {anilistStats.anime.count} {t("common.anime").toLowerCase()} ·{" "}
                {anilistStats.manga.count} {t("common.manga").toLowerCase()})
              </span>
            </div>
            <Link href="/stats" className="text-sky-400 hover:text-sky-300 shrink-0 font-medium">
              {t("nav.stats")} →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
