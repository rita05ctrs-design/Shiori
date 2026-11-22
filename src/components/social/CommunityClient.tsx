"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  Activity,
  Search,
  RefreshCw,
  MessageSquare,
  Mic2,
  Star,
  Radio,
  UserCircle2,
  Loader2,
  Globe,
} from "lucide-react";
import { useShiori } from "@/context/ShioriContext";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { ActivityCard } from "@/components/social/ActivityCard";
import { AniListActivityFeed } from "@/components/social/AniListActivityFeed";
import { PinnedBadgesRow } from "@/components/badges/PinnedBadgesRow";
import { cn } from "@/lib/utils";
import type {
  CommunityActivityItem,
  CommunityActivityKind,
  PublicUserProfile,
} from "@/types/media";

type CommunityTab = "anilist" | "activity" | "members";

const ACTIVITY_FILTERS: { id: "ALL" | CommunityActivityKind; label: string }[] = [
  { id: "ALL", label: "Toute l'activité" },
  { id: "BADGE_UNLOCKED", label: "Badges rares" },
  { id: "FAVORITE_MEDIA", label: "Favoris Anime/Manga" },
  { id: "FAVORITE_STAFF", label: "Voice Actors" },
  { id: "COMPLETED", label: "Séries terminées" },
  { id: "SCORED", label: "Notes" },
];

export function CommunityClient() {
  const { profile, supabaseReady } = useShiori();
  const [tab, setTab] = useState<CommunityTab>("anilist");
  const [kindFilter, setKindFilter] = useState<"ALL" | CommunityActivityKind>("ALL");
  const [memberQuery, setMemberQuery] = useState("");
  const [activities, setActivities] = useState<CommunityActivityItem[]>([]);
  const [profiles, setProfiles] = useState<PublicUserProfile[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [realtimeLive, setRealtimeLive] = useState(false);

  const loadActivities = useCallback(async () => {
    setLoadingFeed(true);
    try {
      const qs = kindFilter !== "ALL" ? `?kind=${encodeURIComponent(kindFilter)}` : "";
      const res = await fetch(`/api/community/activity${qs}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.activities)) {
          setActivities(data.activities);
        }
      }
    } finally {
      setLoadingFeed(false);
    }
  }, [kindFilter]);

  const loadProfiles = useCallback(async (q: string) => {
    setLoadingMembers(true);
    try {
      const qs = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
      const res = await fetch(`/api/community/profiles${qs}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.profiles)) {
          setProfiles(data.profiles);
        }
      }
    } finally {
      setLoadingMembers(false);
    }
  }, []);

  useEffect(() => {
    void loadActivities();
  }, [loadActivities]);

  useEffect(() => {
    const t = setTimeout(() => {
      void loadProfiles(memberQuery);
    }, memberQuery ? 220 : 0);
    return () => clearTimeout(t);
  }, [memberQuery, loadProfiles]);

  // Subscribe to Supabase Realtime for live activity_events, activity_likes, activity_comments!
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    const channel = supabase
      .channel("shiori-community-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "activity_events" },
        () => {
          void loadActivities();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "activity_likes" },
        () => {
          void loadActivities();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "activity_comments" },
        () => {
          void loadActivities();
        }
      )
      .subscribe((status) => {
        setRealtimeLive(status === "SUBSCRIBED");
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadActivities]);

  return (
    <div className="pt-24 pb-16 max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-accent mb-1.5 flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5" />
            <span>
              Communauté Shiori · {realtimeLive ? "Supabase Realtime connecté" : "Fil en direct"}
            </span>
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gradient-editorial">
            Activité & Profils Publics
          </h1>
          <p className="text-sm text-[#8A8FA4] mt-1.5 max-w-2xl">
            Découvrez les coups de cœur, Voice Actors favoris, séries terminées et notes des
            membres en temps réel, échangez par commentaires et discutez en message privé.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Link
            href={`/profile/${encodeURIComponent(profile.username)}`}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-xs font-semibold text-white transition-colors"
          >
            <UserCircle2 className="w-3.5 h-3.5 text-accent" />
            <span>Mon profil public</span>
          </Link>
          <Link
            href="/messages"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-accent hover:bg-accent-hover text-accent-fg text-xs font-semibold shadow-accent transition-colors"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Messagerie</span>
          </Link>
        </div>
      </div>

      {/* Main Navigation Tabs: Fil AniList (default) vs Activité Shiori vs Membres */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="inline-flex flex-wrap items-center p-1 rounded-full bg-surface border border-white/[0.09] self-start gap-0.5">
          <button
            type="button"
            onClick={() => setTab("anilist")}
            className={cn(
              "px-4 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer inline-flex items-center gap-1.5",
              tab === "anilist"
                ? "bg-[#02A9FF] text-[#06121C] shadow-[0_6px_18px_rgba(2,169,255,0.35)]"
                : "text-[#9A9EAE] hover:text-white"
            )}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Fil AniList</span>
          </button>
          <button
            type="button"
            onClick={() => setTab("activity")}
            className={cn(
              "px-4 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer inline-flex items-center gap-1.5",
              tab === "activity"
                ? "bg-accent text-accent-fg shadow-accent"
                : "text-[#9A9EAE] hover:text-white"
            )}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Activité Shiori</span>
          </button>
          <button
            type="button"
            onClick={() => setTab("members")}
            className={cn(
              "px-4 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer inline-flex items-center gap-1.5",
              tab === "members"
                ? "bg-accent text-accent-fg shadow-accent"
                : "text-[#9A9EAE] hover:text-white"
            )}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Membres ({profiles.length})</span>
          </button>
        </div>

        {tab === "activity" ? (
          <div className="flex items-center gap-2">
            {supabaseReady && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/12 border border-emerald-500/30 text-[10.5px] font-mono text-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Temps réel
              </span>
            )}
            <button
              type="button"
              onClick={() => void loadActivities()}
              className="h-9 px-3.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.09] text-xs font-medium text-white inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", loadingFeed && "animate-spin")} />
              <span>Actualiser</span>
            </button>
          </div>
        ) : tab === "members" ? (
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-[#7D8296] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={memberQuery}
              onChange={(e) => setMemberQuery(e.target.value)}
              placeholder="Rechercher un membre, @pseudo, Seiyuu..."
              className="w-full h-10 pl-10 pr-4 rounded-xl bg-surface border border-white/[0.09] text-xs text-white placeholder:text-[#656A7E] focus:outline-none focus:border-accent"
            />
          </div>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/12 border border-sky-400/30 text-[11px] font-mono text-sky-300 self-start sm:self-auto">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
            Flux officiel AniList en direct
          </span>
        )}
      </div>

      {/* TAB 0: ANILIST LIVE ACTIVITY FEED + SIDEBAR DIRECTORY */}
      {tab === "anilist" ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-8">
            <AniListActivityFeed />
          </div>

          <aside className="lg:col-span-4 space-y-4">
            <div className="rounded-2xl card-surface p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-accent" />
                  <span>Membres Shiori</span>
                </h2>
                <button
                  type="button"
                  onClick={() => setTab("members")}
                  className="text-xs text-accent-soft hover:underline cursor-pointer"
                >
                  Tous →
                </button>
              </div>

              <div className="space-y-2.5">
                {profiles.slice(0, 6).map((m) => {
                  const isMe = m.username.toLowerCase() === profile.username.toLowerCase();
                  return (
                    <div
                      key={m.id}
                      className="p-2.5 rounded-xl bg-obsidian/65 border border-white/[0.06] hover:border-white/[0.14] transition-colors flex items-center gap-3"
                    >
                      <Link href={`/profile/${encodeURIComponent(m.username)}`}>
                        <UserAvatar
                          avatarUrl={m.avatarUrl}
                          initials={m.avatarInitials}
                          accentColor={m.accentColor}
                          alt={m.displayName}
                          size="sm"
                        />
                      </Link>
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/profile/${encodeURIComponent(m.username)}`}
                          className="text-xs font-semibold text-white hover:text-accent-hover truncate block"
                        >
                          {m.displayName}{" "}
                          {isMe && <span className="text-accent-soft">(Vous)</span>}
                        </Link>
                        <p className="text-[10.5px] font-mono text-[#7D8296] truncate">
                          @{m.username} · {m.stats.totalEntries} titres
                        </p>
                      </div>
                      {!isMe && (
                        <Link
                          href={`/messages?to=${encodeURIComponent(m.username)}`}
                          title={`Envoyer un message à ${m.displayName}`}
                          className="w-7 h-7 rounded-lg bg-white/[0.05] hover:bg-accent border border-white/[0.09] hover:border-accent text-[#C6CAD8] hover:text-accent-fg flex items-center justify-center transition-colors shrink-0"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </aside>
        </div>
      ) : tab === "activity" ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Feed Column */}
          <div className="lg:col-span-8 space-y-4">
            {/* Kind Filter Chips */}
            <div className="flex flex-wrap items-center gap-1.5">
              {ACTIVITY_FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setKindFilter(f.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors cursor-pointer",
                    kindFilter === f.id
                      ? "bg-white text-[#090A0F] border-white"
                      : "bg-surface border-white/[0.08] text-[#9A9EAE] hover:text-white"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {loadingFeed && activities.length === 0 ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-44 rounded-2xl card-surface animate-pulse" />
                ))}
              </div>
            ) : activities.length === 0 ? (
              <div className="rounded-2xl card-surface p-10 text-center space-y-2">
                <p className="text-sm font-semibold text-white">
                  Aucune activité dans cette catégorie pour le moment.
                </p>
                <p className="text-xs text-[#858A9E]">
                  Ajoutez un anime en coup de cœur, un Voice Actor favori ou attribuez une note
                  pour alimenter le fil en direct !
                </p>
              </div>
            ) : (
              <div className="space-y-3.5">
                {activities.map((item) => (
                  <ActivityCard
                    key={item.id}
                    item={item}
                    onUpdate={(updated) =>
                      setActivities((prev) =>
                        prev.map((a) => (a.id === updated.id ? updated : a))
                      )
                    }
                  />
                ))}
              </div>
            )}
          </div>

          {/* Right Sidebar: Quick Member Discovery */}
          <aside className="lg:col-span-4 space-y-4">
            <div className="rounded-2xl card-surface p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-accent" />
                  <span>Découvrir les membres</span>
                </h2>
                <button
                  type="button"
                  onClick={() => setTab("members")}
                  className="text-xs text-accent-soft hover:underline cursor-pointer"
                >
                  Tous →
                </button>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#7D8296] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={memberQuery}
                  onChange={(e) => setMemberQuery(e.target.value)}
                  placeholder="Chercher un @pseudo..."
                  className="w-full h-9 pl-8 pr-3 rounded-xl bg-obsidian/80 border border-white/[0.08] text-xs text-white placeholder:text-[#656A7E] focus:outline-none focus:border-accent"
                />
              </div>

              <div className="space-y-2.5">
                {profiles.slice(0, 6).map((m) => {
                  const isMe = m.username.toLowerCase() === profile.username.toLowerCase();
                  return (
                    <div
                      key={m.id}
                      className="p-2.5 rounded-xl bg-obsidian/65 border border-white/[0.06] hover:border-white/[0.14] transition-colors flex items-center gap-3"
                    >
                      <Link href={`/profile/${encodeURIComponent(m.username)}`}>
                        <UserAvatar
                          avatarUrl={m.avatarUrl}
                          initials={m.avatarInitials}
                          accentColor={m.accentColor}
                          alt={m.displayName}
                          size="sm"
                        />
                      </Link>
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/profile/${encodeURIComponent(m.username)}`}
                          className="text-xs font-semibold text-white hover:text-accent-hover truncate block"
                        >
                          {m.displayName} {isMe && <span className="text-accent-soft">(Vous)</span>}
                        </Link>
                        <p className="text-[10.5px] font-mono text-[#7D8296] truncate">
                          @{m.username} · {m.stats.totalEntries} titres
                        </p>
                      </div>
                      {!isMe && (
                        <Link
                          href={`/messages?to=${encodeURIComponent(m.username)}`}
                          title={`Envoyer un message à ${m.displayName}`}
                          className="w-7 h-7 rounded-lg bg-white/[0.05] hover:bg-accent border border-white/[0.09] hover:border-accent text-[#C6CAD8] hover:text-accent-fg flex items-center justify-center transition-colors shrink-0"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </aside>
        </div>
      ) : (
        /* TAB 2: FULL MEMBERS DIRECTORY */
        <div className="space-y-4">
          {loadingMembers ? (
            <div className="flex items-center justify-center py-12 text-xs text-[#8E93A6] gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-accent" />
              <span>Recherche des membres...</span>
            </div>
          ) : profiles.length === 0 ? (
            <div className="rounded-2xl card-surface p-10 text-center text-sm text-[#9A9EAE]">
              Aucun membre trouvé pour « {memberQuery} ».
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {profiles.map((m) => {
                const isMe = m.username.toLowerCase() === profile.username.toLowerCase();
                return (
                  <div
                    key={m.id}
                    className="rounded-2xl card-surface border border-white/[0.08] hover:border-white/[0.18] p-5 flex flex-col justify-between gap-4 transition-colors"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center gap-3.5">
                        <Link href={`/profile/${encodeURIComponent(m.username)}`}>
                          <UserAvatar
                            avatarUrl={m.avatarUrl}
                            initials={m.avatarInitials}
                            accentColor={m.accentColor}
                            alt={m.displayName}
                            size="lg"
                          />
                        </Link>
                        <div className="min-w-0">
                          <Link
                            href={`/profile/${encodeURIComponent(m.username)}`}
                            className="text-base font-bold text-white hover:text-accent-hover transition-colors truncate block"
                          >
                            {m.displayName}
                          </Link>
                          <p className="text-xs font-mono text-[#7D8296] truncate">
                            @{m.username}
                          </p>
                          <div className="flex items-center gap-2 mt-1 text-[11px] font-mono text-[#A6AAB8]">
                            <span>{m.stats.totalEntries} titres</span>
                            {m.stats.meanScore !== null && (
                              <span className="inline-flex items-center gap-0.5 text-kinpaku">
                                <Star className="w-3 h-3 fill-current" />
                                {m.stats.meanScore.toFixed(1)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {m.bio && (
                        <p className="text-xs text-[#9EA3B5] line-clamp-2 leading-relaxed">
                          {m.bio}
                        </p>
                      )}

                      {m.pinnedBadges && m.pinnedBadges.length > 0 && (
                        <PinnedBadgesRow badgeIds={m.pinnedBadges} size="xs" />
                      )}

                      {m.favoriteStaff.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Mic2 className="w-3 h-3 text-accent shrink-0" />
                          {m.favoriteStaff.slice(0, 2).map((s) => (
                            <span
                              key={s.id}
                              className="px-2 py-0.5 rounded-md bg-white/[0.05] border border-white/[0.08] text-[10.5px] text-[#C8CCE0]"
                            >
                              {s.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-3 border-t border-white/[0.07]">
                      <Link
                        href={`/profile/${encodeURIComponent(m.username)}`}
                        className="flex-1 h-9 rounded-xl bg-white/[0.07] hover:bg-white/[0.14] border border-white/[0.1] text-xs font-semibold text-white flex items-center justify-center transition-colors"
                      >
                        Voir le profil
                      </Link>
                      {!isMe && (
                        <Link
                          href={`/messages?to=${encodeURIComponent(m.username)}`}
                          className="h-9 px-3.5 rounded-xl bg-accent hover:bg-accent-hover text-accent-fg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>Message</span>
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
