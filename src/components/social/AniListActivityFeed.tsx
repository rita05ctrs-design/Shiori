"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Globe,
  Users,
  User,
  RefreshCw,
  Heart,
  MessageCircle,
  ExternalLink,
  Send,
  Star,
  Tv,
  BookOpen,
  FileText,
  Link2,
  Loader2,
  Search,
} from "lucide-react";
import { useShiori } from "@/context/ShioriContext";
import { useTranslation } from "@/hooks/useTranslation";
import { cn, formatScore } from "@/lib/utils";
import type {
  AniListFeedItem,
  AniListFeedReply,
} from "@/app/api/anilist/activity/route";

type AniListScope = "global" | "following" | "me";
type AniListTypeFilter = "ALL" | "ANIME" | "MANGA" | "TEXT";

export function AniListActivityFeed() {
  const { anilistConnection, anilistStats, toast } = useShiori();
  const { tr, tRelativeTime } = useTranslation();

  // Default to "following" if connected via AniList OAuth, otherwise "global"
  const [scope, setScope] = useState<AniListScope>("global");
  const [scopeAutoInit, setScopeAutoInit] = useState(false);
  const [typeFilter, setTypeFilter] = useState<AniListTypeFilter>("ALL");
  const [customUsername, setCustomUsername] = useState(
    anilistConnection.user?.name ?? anilistStats?.anilistUsername ?? ""
  );
  const [activeLookupUser, setActiveLookupUser] = useState(
    anilistConnection.user?.name ?? anilistStats?.anilistUsername ?? ""
  );

  const [activities, setActivities] = useState<AniListFeedItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [requiresAuth, setRequiresAuth] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Post new AniList text status (when OAuth connected)
  const [statusDraft, setStatusDraft] = useState("");
  const [postingStatus, setPostingStatus] = useState(false);

  // Per-activity replies map
  const [openReplies, setOpenReplies] = useState<Record<number, boolean>>({});
  const [repliesMap, setRepliesMap] = useState<Record<number, AniListFeedReply[]>>({});
  const [loadingReplies, setLoadingReplies] = useState<Record<number, boolean>>({});
  const [replyDrafts, setReplyDrafts] = useState<Record<number, string>>({});
  const [sendingReply, setSendingReply] = useState<Record<number, boolean>>({});

  // Auto-select Following once OAuth status resolves if connected
  useEffect(() => {
    if (scopeAutoInit) return;
    if (anilistConnection.connected) {
      setScope("following");
      if (anilistConnection.user?.name) {
        setCustomUsername(anilistConnection.user.name);
        setActiveLookupUser(anilistConnection.user.name);
      }
      setScopeAutoInit(true);
    } else if (anilistStats?.anilistUsername && !activeLookupUser) {
      setCustomUsername(anilistStats.anilistUsername);
      setActiveLookupUser(anilistStats.anilistUsername);
    }
  }, [anilistConnection, anilistStats, scopeAutoInit, activeLookupUser]);

  const loadFeed = useCallback(
    async (targetPage: number, append: boolean) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      setErrorMsg(null);
      setRequiresAuth(false);

      try {
        const qs = new URLSearchParams({
          scope,
          filter: typeFilter,
          page: String(targetPage),
          perPage: "20",
        });
        if (scope === "me") {
          if (anilistConnection.user?.id) {
            qs.set("userId", String(anilistConnection.user.id));
          } else if (activeLookupUser.trim()) {
            qs.set("username", activeLookupUser.trim());
          } else if (anilistStats?.anilistUserId) {
            qs.set("userId", String(anilistStats.anilistUserId));
          }
        }

        const res = await fetch(`/api/anilist/activity?${qs.toString()}`, {
          cache: "no-store",
        });
        const data = await res.json();

        if (data?.requiresAuth) {
          setRequiresAuth(true);
          setActivities([]);
          setHasNextPage(false);
          return;
        }
        if (data?.error) {
          setErrorMsg(data.error);
        }
        const incoming: AniListFeedItem[] = Array.isArray(data?.activities)
          ? data.activities
          : [];
        setActivities((prev) => {
          if (!append) return incoming;
          const seen = new Set(prev.map((a) => a.id));
          return [...prev, ...incoming.filter((a) => !seen.has(a.id))];
        });
        setHasNextPage(Boolean(data?.hasNextPage));
        setPage(targetPage);
      } catch {
        setErrorMsg(tr("Impossible de joindre AniList pour le moment."));
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [scope, typeFilter, activeLookupUser, anilistConnection.user?.id, anilistStats?.anilistUserId, tr]
  );

  useEffect(() => {
    void loadFeed(1, false);
  }, [loadFeed]);

  const handleLike = async (item: AniListFeedItem) => {
    if (!anilistConnection.connected) {
      toast({
        title: tr("Connexion AniList requise"),
        description: tr("Connectez votre compte AniList (OAuth) pour liker sur AniList."),
        variant: "info",
      });
      return;
    }

    const optimisticLiked = !item.isLiked;
    const optimisticCount = Math.max(0, item.likeCount + (optimisticLiked ? 1 : -1));
    setActivities((prev) =>
      prev.map((a) =>
        a.id === item.id
          ? { ...a, isLiked: optimisticLiked, likeCount: optimisticCount }
          : a
      )
    );

    try {
      const res = await fetch("/api/anilist/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "like", activityId: item.id }),
      });
      const data = await res.json();
      if (res.ok && data?.ok) {
        setActivities((prev) =>
          prev.map((a) =>
            a.id === item.id
              ? { ...a, isLiked: Boolean(data.isLiked), likeCount: Number(data.likeCount) }
              : a
          )
        );
      } else {
        setActivities((prev) => prev.map((a) => (a.id === item.id ? item : a)));
      }
    } catch {
      setActivities((prev) => prev.map((a) => (a.id === item.id ? item : a)));
    }
  };

  const handleToggleReplies = async (item: AniListFeedItem) => {
    const nextOpen = !openReplies[item.id];
    setOpenReplies((prev) => ({ ...prev, [item.id]: nextOpen }));
    if (nextOpen && !repliesMap[item.id] && item.replyCount > 0) {
      setLoadingReplies((prev) => ({ ...prev, [item.id]: true }));
      try {
        const res = await fetch(`/api/anilist/activity?repliesFor=${item.id}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (Array.isArray(data?.replies)) {
          setRepliesMap((prev) => ({ ...prev, [item.id]: data.replies }));
        }
      } finally {
        setLoadingReplies((prev) => ({ ...prev, [item.id]: false }));
      }
    }
  };

  const handleSendReply = async (e: React.FormEvent, item: AniListFeedItem) => {
    e.preventDefault();
    const text = (replyDrafts[item.id] ?? "").trim();
    if (!text) return;
    if (!anilistConnection.connected) {
      toast({
        title: tr("Connexion AniList requise"),
        description: tr("Connectez votre compte AniList (OAuth) pour répondre sur AniList."),
        variant: "info",
      });
      return;
    }

    setSendingReply((prev) => ({ ...prev, [item.id]: true }));
    try {
      const res = await fetch("/api/anilist/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reply", activityId: item.id, text }),
      });
      const data = await res.json();
      if (!res.ok || !data?.reply) {
        toast({
          title: tr("Erreur AniList"),
          description: data?.error || tr("Impossible d'envoyer la réponse."),
          variant: "warning",
        });
        return;
      }
      setRepliesMap((prev) => ({
        ...prev,
        [item.id]: [...(prev[item.id] ?? []), data.reply as AniListFeedReply],
      }));
      setActivities((prev) =>
        prev.map((a) =>
          a.id === item.id ? { ...a, replyCount: a.replyCount + 1 } : a
        )
      );
      setReplyDrafts((prev) => ({ ...prev, [item.id]: "" }));
    } finally {
      setSendingReply((prev) => ({ ...prev, [item.id]: false }));
    }
  };

  const handlePostStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = statusDraft.trim();
    if (!text || postingStatus) return;

    setPostingStatus(true);
    try {
      const res = await fetch("/api/anilist/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "post_text", text }),
      });
      const data = await res.json();
      if (!res.ok || !data?.activity) {
        toast({
          title: tr("Publication impossible"),
          description: data?.error || tr("Impossible de publier sur AniList."),
          variant: "warning",
        });
        return;
      }
      setActivities((prev) => [data.activity as AniListFeedItem, ...prev]);
      setStatusDraft("");
      toast({
        title: tr("Statut publié sur AniList !"),
        variant: "success",
      });
    } finally {
      setPostingStatus(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Scope Bar: Global / Abonnements / Mon activité + Refresh */}
      <div className="rounded-2xl card-surface border border-sky-500/20 p-4 space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="w-full sm:w-auto max-w-full overflow-x-auto no-scrollbar">
            <div className="inline-flex flex-nowrap items-center gap-1 p-1 rounded-xl bg-obsidian/80 border border-white/[0.08]">
              {[
                { id: "global" as const, label: tr("Global AniList"), icon: Globe },
                { id: "following" as const, label: tr("Abonnements"), icon: Users },
                { id: "me" as const, label: tr("Mon activité"), icon: User },
              ].map((s) => {
                const Icon = s.icon;
                const active = scope === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setScope(s.id)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap shrink-0",
                      active
                        ? "bg-[#02A9FF] text-[#06121C] shadow-[0_6px_18px_rgba(2,169,255,0.35)]"
                        : "text-[#A2A6B8] hover:text-white"
                    )}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span>{s.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!anilistConnection.connected && (
              <a
                href="/api/auth/anilist/start"
                className="h-8 px-3 rounded-full bg-sky-500/18 hover:bg-sky-500/28 border border-sky-400/40 text-sky-200 text-[11px] font-semibold inline-flex items-center gap-1.5 transition-colors"
              >
                <Link2 className="w-3 h-3" />
                <span>{tr("Connecter AniList")}</span>
              </a>
            )}
            <button
              type="button"
              onClick={() => void loadFeed(1, false)}
              className="h-8 px-3 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.09] text-xs font-medium text-white inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
              <span>{tr("Actualiser")}</span>
            </button>
          </div>
        </div>

        {/* Type Filters + Optional AniList Username Lookup in "Mon activité" */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex flex-nowrap sm:flex-wrap items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5 max-w-full">
            {[
              { id: "ALL" as const, label: tr("Tout"), icon: null },
              { id: "ANIME" as const, label: tr("Animés"), icon: Tv },
              { id: "MANGA" as const, label: tr("Mangas"), icon: BookOpen },
              { id: "TEXT" as const, label: tr("Statuts"), icon: FileText },
            ].map((f) => {
              const Icon = f.icon;
              const active = typeFilter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setTypeFilter(f.id)}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs font-semibold border transition-colors cursor-pointer inline-flex items-center gap-1 whitespace-nowrap shrink-0",
                    active
                      ? "bg-white text-[#090A0F] border-white"
                      : "bg-obsidian/70 border-white/[0.08] text-[#9A9EAE] hover:text-white"
                  )}
                >
                  {Icon && <Icon className="w-3 h-3 shrink-0" />}
                  <span>{f.label}</span>
                </button>
              );
            })}
          </div>

          {scope === "me" && !anilistConnection.connected && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setActiveLookupUser(customUsername.trim());
              }}
              className="flex items-center gap-1.5"
            >
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#7D8296] absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={customUsername}
                  onChange={(e) => setCustomUsername(e.target.value)}
                  placeholder={tr("Pseudo AniList")}
                  className="h-8 w-44 pl-8 pr-2.5 rounded-lg bg-obsidian border border-white/[0.1] text-base sm:text-xs text-white placeholder:text-[#656A7E] focus:outline-none focus:border-sky-400"
                />
              </div>
              <button
                type="submit"
                className="h-8 px-3 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 text-sky-200 text-xs font-semibold cursor-pointer"
              >
                {tr("Voir")}
              </button>
            </form>
          )}
        </div>

        {/* Post new status directly onto AniList (when OAuth connected) */}
        {anilistConnection.connected && (
          <form onSubmit={handlePostStatus} className="pt-2 border-t border-white/[0.07] flex items-center gap-2">
            <input
              type="text"
              value={statusDraft}
              onChange={(e) => setStatusDraft(e.target.value)}
              placeholder={tr("Publier un statut sur AniList en tant que @{user}...", {
                user: anilistConnection.user?.name ?? "",
              })}
              maxLength={1000}
              className="flex-1 h-9 px-3.5 rounded-xl bg-obsidian/80 border border-white/[0.09] text-base sm:text-xs text-white placeholder:text-[#656A7E] focus:outline-none focus:border-sky-400"
            />
            <button
              type="submit"
              disabled={postingStatus || !statusDraft.trim()}
              className="h-9 px-4 rounded-xl bg-[#02A9FF] hover:bg-[#2BB8FF] disabled:opacity-45 text-[#06121C] text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{tr("Publier")}</span>
            </button>
          </form>
        )}
      </div>

      {/* Following Requires OAuth Callout */}
      {requiresAuth && (
        <div className="rounded-2xl card-surface border border-sky-500/30 p-8 text-center space-y-3">
          <Users className="w-8 h-8 text-sky-400 mx-auto" />
          <h3 className="text-base font-bold text-white">
            {tr("Connectez votre compte AniList pour voir vos abonnements")}
          </h3>
          <p className="text-xs text-[#8A8FA4] max-w-md mx-auto">
            {tr("Le fil « Abonnements » affiche en direct l'activité des amis que vous suivez sur AniList et vous permet aussi de liker, répondre et publier depuis Shiori.")}
          </p>
          <a
            href="/api/auth/anilist/start"
            className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#02A9FF] hover:bg-[#29B8FF] text-[#06121C] text-xs font-bold shadow-[0_10px_26px_rgba(2,169,255,0.35)]"
          >
            <Link2 className="w-4 h-4" />
            <span>{tr("Connecter mon compte AniList")}</span>
          </a>
        </div>
      )}

      {errorMsg && (
        <div className="rounded-xl bg-rose-500/12 border border-rose-500/35 p-3.5 text-xs text-rose-200">
          {errorMsg}
        </div>
      )}

      {/* Feed Cards */}
      {loading && activities.length === 0 ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-36 rounded-2xl card-surface animate-pulse" />
          ))}
        </div>
      ) : !requiresAuth && activities.length === 0 ? (
        <div className="rounded-2xl card-surface p-10 text-center space-y-2">
          <p className="text-sm font-semibold text-white">
            {tr("Aucune activité AniList trouvée pour ce filtre.")}
          </p>
          <p className="text-xs text-[#858A9E]">
            {scope === "me" && !activeLookupUser
              ? tr("Indiquez votre pseudo AniList ci-dessus ou connectez votre compte AniList.")
              : tr("Essayez un autre filtre ou passez sur Global AniList.")}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3.5 items-start">
          {activities.map((item) => {
            const repliesOpen = Boolean(openReplies[item.id]);
            const replies = repliesMap[item.id] ?? [];
            const isLoadingRep = Boolean(loadingReplies[item.id]);

            return (
              <article
                key={item.id}
                className="rounded-2xl card-surface border border-white/[0.08] hover:border-white/[0.15] p-4 space-y-3 transition-colors"
              >
                {/* Header: AniList User + Time + AniList Badge */}
                <div className="flex items-center justify-between gap-3">
                  <a
                    href={item.user.siteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2.5 group min-w-0"
                  >
                    {item.user.avatarUrl ? (
                      <img
                        src={item.user.avatarUrl}
                        alt={item.user.name}
                        loading="lazy"
                        decoding="async"
                        className="w-9 h-9 rounded-full object-cover border border-white/15 shrink-0 bg-[#121522]"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-sky-500/20 border border-sky-400/35 flex items-center justify-center text-xs font-bold text-sky-300 shrink-0">
                        {item.user.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-semibold text-white group-hover:text-sky-300 transition-colors truncate">
                        {item.user.name}
                      </p>
                      <p className="text-[11px] text-[#7D8296]">
                        {tRelativeTime(new Date(item.createdAt * 1000).toISOString())}
                      </p>
                    </div>
                  </a>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="px-2 py-0.5 rounded-full bg-sky-500/14 border border-sky-400/30 text-[10px] font-mono font-semibold text-sky-300">
                      AniList
                    </span>
                    {item.siteUrl && (
                      <a
                        href={item.siteUrl}
                        target="_blank"
                        rel="noreferrer"
                        title={tr("Ouvrir sur AniList")}
                        className="text-[#7D8296] hover:text-white transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>

                {/* Body: Either ListActivity (with clickable Shiori /media/[id] card) OR TextActivity */}
                {item.media ? (
                  <div className="rounded-xl bg-obsidian/70 border border-white/[0.07] p-3 flex items-center gap-3.5">
                    <Link href={`/media/${item.media.id}`} className="shrink-0">
                      <img
                        src={item.media.coverImage}
                        alt={item.media.title}
                        loading="lazy"
                        decoding="async"
                        className="w-12 h-16 rounded-lg object-cover border border-white/12 hover:scale-105 transition-transform"
                      />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-[#B6BAC9] font-medium">
                          {item.actionLabel}
                        </span>
                        <span className="px-1.5 py-0.2 rounded bg-white/[0.06] text-[9.5px] font-mono uppercase text-[#9A9EAE]">
                          {item.media.type === "MANGA" ? "Manga" : item.media.format || "Anime"}
                        </span>
                      </div>
                      <Link
                        href={`/media/${item.media.id}`}
                        className="block text-sm sm:text-[15px] font-bold text-white hover:text-accent-hover transition-colors line-clamp-1 mt-0.5"
                      >
                        {item.media.title}
                      </Link>
                      {item.media.averageScore && (
                        <span className="inline-flex items-center gap-1 mt-1 font-mono text-[11px] text-kinpaku">
                          <Star className="w-3 h-3 fill-current" />
                          {formatScore(item.media.averageScore)}
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl bg-obsidian/70 border border-white/[0.07] p-3.5">
                    <p className="text-xs sm:text-[13px] text-[#E6E8F0] whitespace-pre-wrap break-words leading-relaxed">
                      {item.text}
                    </p>
                  </div>
                )}

                {/* Footer Actions: Like + Replies */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleLike(item)}
                    className={cn(
                      "h-8 px-3 rounded-full border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer",
                      item.isLiked
                        ? "bg-rose-500/18 border-rose-400/45 text-rose-300"
                        : "bg-white/[0.04] hover:bg-white/[0.09] border-white/[0.08] text-[#B5B9C9] hover:text-white"
                    )}
                  >
                    <Heart className={cn("w-3.5 h-3.5", item.isLiked && "fill-current")} />
                    <span className="font-mono">{item.likeCount}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleToggleReplies(item)}
                    className={cn(
                      "h-8 px-3 rounded-full border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer",
                      repliesOpen
                        ? "bg-sky-500/18 border-sky-400/40 text-sky-200"
                        : "bg-white/[0.04] hover:bg-white/[0.09] border-white/[0.08] text-[#B5B9C9] hover:text-white"
                    )}
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span className="font-mono">{item.replyCount}</span>
                    <span>{tr("Réponses")}</span>
                  </button>
                </div>

                {/* Expandable AniList Replies */}
                {repliesOpen && (
                  <div className="pt-3 border-t border-white/[0.07] space-y-2.5">
                    {isLoadingRep ? (
                      <div className="flex items-center gap-2 text-xs text-[#8E93A6] py-1">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" />
                        <span>{tr("Chargement des réponses AniList...")}</span>
                      </div>
                    ) : replies.length > 0 ? (
                      <div className="space-y-2">
                        {replies.map((r) => (
                          <div
                            key={r.id}
                            className="flex items-start gap-2.5 rounded-xl bg-obsidian/70 border border-white/[0.06] p-2.5"
                          >
                            {r.user.avatarUrl && (
                              <img
                                src={r.user.avatarUrl}
                                alt={r.user.name}
                                className="w-6 h-6 rounded-full object-cover shrink-0"
                              />
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <a
                                  href={r.user.siteUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs font-semibold text-white hover:text-sky-300"
                                >
                                  {r.user.name}
                                </a>
                                <span className="text-[10px] text-[#7D8296]">
                                  {tRelativeTime(new Date(r.createdAt * 1000).toISOString())}
                                </span>
                              </div>
                              <p className="text-xs text-[#D6D9E5] mt-0.5 break-words">
                                {r.text}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-[#7D8296]">
                        {tr("Aucune réponse pour le moment.")}
                      </p>
                    )}

                    <form
                      onSubmit={(e) => void handleSendReply(e, item)}
                      className="flex items-center gap-2"
                    >
                      <input
                        type="text"
                        value={replyDrafts[item.id] ?? ""}
                        onChange={(e) =>
                          setReplyDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))
                        }
                        placeholder={
                          anilistConnection.connected
                            ? tr("Répondre sur AniList...")
                            : tr("Connectez AniList (OAuth) pour répondre...")
                        }
                        className="flex-1 h-8 px-3 rounded-lg bg-obsidian border border-white/[0.09] text-base sm:text-xs text-white placeholder:text-[#656A7E] focus:outline-none focus:border-sky-400"
                      />
                      <button
                        type="submit"
                        disabled={sendingReply[item.id] || !(replyDrafts[item.id] ?? "").trim()}
                        className="h-8 px-3 rounded-lg bg-[#02A9FF] hover:bg-[#29B8FF] disabled:opacity-40 text-[#06121C] text-xs font-bold inline-flex items-center justify-center cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </form>
                  </div>
                )}
              </article>
            );
          })}

          {hasNextPage && (
            <div className="pt-2 flex justify-center">
              <button
                type="button"
                disabled={loadingMore}
                onClick={() => void loadFeed(page + 1, true)}
                className="px-5 py-2.5 rounded-full bg-white/[0.07] hover:bg-white/[0.13] border border-white/[0.12] text-xs font-semibold text-white inline-flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
              >
                {loadingMore && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{tr("Charger plus d'activités AniList")}</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
