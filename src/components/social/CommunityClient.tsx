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
  UserCircle2,
  Loader2,
  Globe,
  UserPlus,
  UserCheck,
  Clock,
} from "lucide-react";
import { useShiori } from "@/context/ShioriContext";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { ActivityCard } from "@/components/social/ActivityCard";
import { AniListActivityFeed } from "@/components/social/AniListActivityFeed";
import { FriendActionButton } from "@/components/social/FriendActionButton";
import { PinnedBadgesRow } from "@/components/badges/PinnedBadgesRow";
import {
  clearSessionState,
  FILTER_STORAGE_KEYS,
  readSessionState,
  syncUrlSearchParams,
  writeSessionState,
  type PersistedCommunityState,
} from "@/lib/filter-persistence";
import { cn } from "@/lib/utils";
import type {
  CommunityActivityItem,
  CommunityActivityKind,
  PublicUserProfile,
} from "@/types/media";

type CommunityTab = "feed" | "friends" | "members";
type FeedSource = "shiori" | "anilist";

const ACTIVITY_FILTERS: {
  id: "ALL" | CommunityActivityKind;
  label: string;
}[] = [
  { id: "ALL", label: "Tout" },
  { id: "FAVORITE_MEDIA", label: "Favoris" },
  { id: "COMPLETED", label: "Terminés" },
  { id: "SCORED", label: "Notes" },
  { id: "BADGE_UNLOCKED", label: "Badges" },
  { id: "FAVORITE_STAFF", label: "Doubleurs" },
];

export function CommunityClient() {
  const {
    profile,
    friends,
    incomingFriendRequests,
    outgoingFriendRequests,
    addFriend,
    getFriendRelation,
    isUserBlocked,
  } = useShiori();

  const [tab, setTab] = useState<CommunityTab>("feed");
  const [feedSource, setFeedSource] = useState<FeedSource>("shiori");
  const [kindFilter, setKindFilter] = useState<"ALL" | CommunityActivityKind>("ALL");
  const [memberQuery, setMemberQuery] = useState("");
  const [filtersReady, setFiltersReady] = useState(false);
  const [directAddUsername, setDirectAddUsername] = useState("");
  const [addingDirect, setAddingDirect] = useState(false);
  const [friendFeedback, setFriendFeedback] = useState<{
    type: "error" | "success";
    text: string;
  } | null>(null);
  const [activities, setActivities] = useState<CommunityActivityItem[]>([]);
  const [profiles, setProfiles] = useState<PublicUserProfile[]>([]);
  const [totalMembersCount, setTotalMembersCount] = useState<number>(0);
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const saved = readSessionState<PersistedCommunityState>(FILTER_STORAGE_KEYS.community);
    const hasUrl = Array.from(params.keys()).length > 0;

    if (hasUrl) {
      const tabParam = params.get("tab");
      if (tabParam === "friends") setTab("friends");
      else if (tabParam === "members") setTab("members");
      else if (tabParam === "anilist") {
        setTab("feed");
        setFeedSource("anilist");
      } else if (tabParam === "activity") {
        setTab("feed");
        setFeedSource("shiori");
      }

      const sourceParam = params.get("source");
      if (sourceParam === "anilist" || sourceParam === "shiori") {
        setFeedSource(sourceParam);
      }

      const kindParam = params.get("kind");
      if (
        kindParam === "ALL" ||
        kindParam === "FAVORITE_MEDIA" ||
        kindParam === "COMPLETED" ||
        kindParam === "SCORED" ||
        kindParam === "BADGE_UNLOCKED" ||
        kindParam === "FAVORITE_STAFF"
      ) {
        setKindFilter(kindParam);
      }

      const qParam = params.get("q");
      if (qParam) setMemberQuery(qParam);
    } else if (saved) {
      if (saved.tab === "feed" || saved.tab === "friends" || saved.tab === "members") {
        setTab(saved.tab);
      }
      if (saved.feedSource === "shiori" || saved.feedSource === "anilist") {
        setFeedSource(saved.feedSource);
      }
      if (
        saved.kindFilter === "ALL" ||
        saved.kindFilter === "FAVORITE_MEDIA" ||
        saved.kindFilter === "COMPLETED" ||
        saved.kindFilter === "SCORED" ||
        saved.kindFilter === "BADGE_UNLOCKED" ||
        saved.kindFilter === "FAVORITE_STAFF"
      ) {
        setKindFilter(saved.kindFilter);
      }
      if (typeof saved.memberQuery === "string" && saved.memberQuery) {
        setMemberQuery(saved.memberQuery);
      }
    }
    setFiltersReady(true);
  }, []);

  useEffect(() => {
    if (!filtersReady) return;
    const params = new URLSearchParams();
    if (tab !== "feed") params.set("tab", tab);
    if (feedSource !== "shiori") params.set("source", feedSource);
    if (kindFilter !== "ALL") params.set("kind", kindFilter);
    if (memberQuery.trim()) params.set("q", memberQuery.trim());

    const qs = syncUrlSearchParams("/community", params);
    if (qs) {
      writeSessionState<PersistedCommunityState>(FILTER_STORAGE_KEYS.community, {
        tab,
        feedSource,
        kindFilter,
        memberQuery,
      });
    } else {
      clearSessionState(FILTER_STORAGE_KEYS.community);
    }
  }, [filtersReady, tab, feedSource, kindFilter, memberQuery]);

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
          if (!q.trim()) {
            setTotalMembersCount(data.profiles.length);
          }
        }
      }
    } finally {
      setLoadingMembers(false);
    }
  }, []);

  useEffect(() => {
    if (!filtersReady) return;
    void loadActivities();
  }, [filtersReady, loadActivities, profile.id, profile.mode, profile.isActivityPublic]);

  useEffect(() => {
    if (!filtersReady) return;
    const t = setTimeout(() => {
      void loadProfiles(memberQuery);
    }, memberQuery ? 220 : 0);
    return () => clearTimeout(t);
  }, [filtersReady, memberQuery, loadProfiles, profile.id, profile.mode, profile.username]);

  // Subscribe to realtime updates transparently in the background
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    const channel = supabase
      .channel("shiori-community-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "activity_events" }, () => {
        void loadActivities();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "activity_likes" }, () => {
        void loadActivities();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "activity_comments" }, () => {
        void loadActivities();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadActivities]);

  const visibleActivities = activities.filter((a) => !isUserBlocked(a.userId));
  const visibleProfiles = profiles.filter((p) => !isUserBlocked(p.id));

  return (
    <div className="w-full pt-[calc(5rem+env(safe-area-inset-top))] sm:pt-24 pb-24 md:pb-16 max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
      {/* Clean Header — 1 clear goal: follow activity, add friends & browse members */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gradient-editorial">
            Communauté
          </h1>
          <p className="text-sm text-[#8A8FA4] mt-1">
            Suivez l&apos;activité des membres, ajoutez vos amis et discutez en privé.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Link
            href={`/profile/${encodeURIComponent(profile.username)}`}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-xs font-medium text-white transition-colors"
          >
            <UserCircle2 className="w-3.5 h-3.5 text-accent" />
            <span>Mon profil</span>
          </Link>
          <Link
            href="/messages"
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-accent hover:bg-accent-hover text-accent-fg text-xs font-semibold transition-colors"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Messages</span>
          </Link>
        </div>
      </div>

      {/* Primary 3-Tab Switch + Contextual Right Control */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="w-full sm:w-auto max-w-full overflow-x-auto no-scrollbar pb-0.5">
          <div className="inline-flex flex-nowrap items-center p-1 rounded-full bg-surface border border-white/[0.09] gap-0.5">
            <button
              type="button"
              onClick={() => setTab("feed")}
              className={cn(
                "px-4 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap shrink-0",
                tab === "feed"
                  ? "bg-accent text-accent-fg shadow-accent"
                  : "text-[#9A9EAE] hover:text-white"
              )}
            >
              <Activity className="w-3.5 h-3.5 shrink-0" />
              <span>Fil d&apos;activité</span>
            </button>
            <button
              type="button"
              onClick={() => setTab("friends")}
              className={cn(
                "px-4 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap shrink-0",
                tab === "friends"
                  ? "bg-emerald-500 text-[#061810]"
                  : "text-[#9A9EAE] hover:text-white"
              )}
            >
              <UserPlus className="w-3.5 h-3.5 shrink-0" />
              <span>Amis ({friends.length})</span>
              {incomingFriendRequests.length > 0 && (
                <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-mono font-bold leading-none">
                  +{incomingFriendRequests.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setTab("members")}
              className={cn(
                "px-4 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap shrink-0",
                tab === "members"
                  ? "bg-accent text-accent-fg shadow-accent"
                  : "text-[#9A9EAE] hover:text-white"
              )}
            >
              <Users className="w-3.5 h-3.5 shrink-0" />
              <span>Membres ({totalMembersCount || profiles.length})</span>
            </button>
          </div>
        </div>

        {tab === "feed" ? (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <div className="inline-flex items-center p-0.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs">
              <button
                type="button"
                onClick={() => setFeedSource("shiori")}
                className={cn(
                  "px-3 py-1.5 rounded-full font-medium transition-colors cursor-pointer",
                  feedSource === "shiori"
                    ? "bg-white/[0.12] text-white"
                    : "text-[#9A9EAE] hover:text-white"
                )}
              >
                Shiori
              </button>
              <button
                type="button"
                onClick={() => setFeedSource("anilist")}
                className={cn(
                  "px-3 py-1.5 rounded-full font-medium transition-colors cursor-pointer inline-flex items-center gap-1",
                  feedSource === "anilist"
                    ? "bg-[#02A9FF]/20 text-sky-200"
                    : "text-[#9A9EAE] hover:text-white"
                )}
              >
                <Globe className="w-3 h-3" />
                <span>AniList</span>
              </button>
            </div>

            {feedSource === "shiori" && (
              <button
                type="button"
                onClick={() => void loadActivities()}
                aria-label="Actualiser le fil"
                className="w-9 h-9 rounded-full bg-white/[0.05] hover:bg-white/[0.12] border border-white/[0.09] text-white inline-flex items-center justify-center cursor-pointer"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", loadingFeed && "animate-spin")} />
              </button>
            )}
          </div>
        ) : (
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-[#7D8296] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={memberQuery}
              onChange={(e) => setMemberQuery(e.target.value)}
              placeholder="Rechercher un membre ou @pseudo..."
              className="w-full h-10 pl-10 pr-4 rounded-xl bg-surface border border-white/[0.09] text-xs text-white placeholder:text-[#656A7E] focus:outline-none focus:border-accent"
            />
          </div>
        )}
      </div>

      {/* TAB 1: FULL-WIDTH ACTIVITY FEED + LIVE COMMUNITY SIDEBAR ON WIDE SCREENS */}
      {tab === "feed" ? (
        feedSource === "anilist" ? (
          <AniListActivityFeed />
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            <div className="xl:col-span-8 space-y-4 min-w-0">
              {/* Compact Frosted Category Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                {ACTIVITY_FILTERS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setKindFilter(f.id)}
                    className={cn(
                      "px-3.5 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap shrink-0 transition-all cursor-pointer",
                      kindFilter === f.id
                        ? "bg-accent/20 border-accent/55 text-white font-semibold shadow-[0_4px_16px_rgb(var(--shiori-accent-rgb)/0.25)]"
                        : "bg-obsidian/70 border-white/[0.08] text-[#9A9EAE] hover:text-white hover:border-white/[0.18]"
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {loadingFeed && visibleActivities.length === 0 ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-40 rounded-2xl card-surface animate-pulse" />
                  ))}
                </div>
              ) : visibleActivities.length === 0 ? (
                <div className="rounded-2xl card-surface p-10 text-center space-y-2">
                  <p className="text-sm font-semibold text-white">
                    Aucune activité dans cette catégorie pour le moment.
                  </p>
                  <p className="text-xs text-[#858A9E]">
                    Ajoutez un favori ou notez un titre pour partager votre activité avec la communauté.
                  </p>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {visibleActivities.map((item) => (
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

            {/* Right Sticky Community Overview Panel (fills wide fullscreen cleanly) */}
            <aside className="xl:col-span-4 xl:sticky xl:top-24 space-y-4 min-w-0">
              {/* Quick Social Hub Summary */}
              <div className="rounded-2xl card-surface border border-white/[0.09] p-5 space-y-4">
                <div className="flex items-center gap-3 min-w-0">
                  <Link href={`/profile/${encodeURIComponent(profile.username)}`} className="shrink-0">
                    <UserAvatar
                      avatarUrl={profile.avatarUrl}
                      initials={profile.avatarInitials}
                      accentColor={profile.accentColor}
                      alt={profile.displayName}
                      size="md"
                    />
                  </Link>
                  <div className="min-w-0">
                    <Link
                      href={`/profile/${encodeURIComponent(profile.username)}`}
                      className="text-sm font-bold text-white hover:text-accent-hover transition-colors truncate block"
                    >
                      {profile.displayName}
                    </Link>
                    <p className="text-xs font-mono text-[#7D8296] truncate">
                      @{profile.username}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setTab("friends")}
                    className="rounded-xl bg-obsidian/75 hover:bg-white/[0.06] border border-white/[0.07] p-2.5 text-center transition-colors cursor-pointer"
                  >
                    <p className="font-mono text-base font-bold text-emerald-400">
                      {friends.length}
                    </p>
                    <p className="text-[10.5px] text-[#8E93A6] mt-0.5">Amis</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab("members")}
                    className="rounded-xl bg-obsidian/75 hover:bg-white/[0.06] border border-white/[0.07] p-2.5 text-center transition-colors cursor-pointer"
                  >
                    <p className="font-mono text-base font-bold text-kinpaku">
                      {totalMembersCount || profiles.length}
                    </p>
                    <p className="text-[10.5px] text-[#8E93A6] mt-0.5">Membres</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab("friends")}
                    className="rounded-xl bg-obsidian/75 hover:bg-white/[0.06] border border-white/[0.07] p-2.5 text-center transition-colors cursor-pointer"
                  >
                    <p className="font-mono text-base font-bold text-accent">
                      {incomingFriendRequests.length}
                    </p>
                    <p className="text-[10.5px] text-[#8E93A6] mt-0.5">Demandes</p>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTab("friends")}
                    className="h-9 px-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.09] text-xs font-semibold text-white inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Gérer amis</span>
                  </button>
                  <Link
                    href="/messages"
                    className="h-9 px-3 rounded-xl bg-accent hover:bg-accent-hover text-accent-fg text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Messages</span>
                  </Link>
                </div>
              </div>

              {/* Active Community Members Directory Preview */}
              <div className="rounded-2xl card-surface border border-white/[0.09] p-5 space-y-3.5">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-xs font-mono uppercase tracking-[0.16em] text-kinpaku flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    <span>Membres actifs</span>
                  </h2>
                  <button
                    type="button"
                    onClick={() => setTab("members")}
                    className="text-[11px] font-semibold text-accent-soft hover:text-white transition-colors cursor-pointer"
                  >
                    Voir tout
                  </button>
                </div>

                {loadingMembers && visibleProfiles.length === 0 ? (
                  <div className="space-y-2.5">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="h-12 rounded-xl bg-white/[0.04] animate-pulse" />
                    ))}
                  </div>
                ) : visibleProfiles.length === 0 ? (
                  <p className="text-xs text-[#8A8FA4]">
                    Aucun membre public disponible pour le moment.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {visibleProfiles
                      .filter(
                        (m) => m.username.toLowerCase() !== profile.username.toLowerCase()
                      )
                      .slice(0, 5)
                      .map((m) => (
                        <div
                          key={m.id}
                          className="p-2.5 rounded-xl bg-obsidian/70 border border-white/[0.06] hover:border-white/[0.14] transition-colors flex items-center justify-between gap-2.5"
                        >
                          <Link
                            href={`/profile/${encodeURIComponent(m.username)}`}
                            className="flex items-center gap-2.5 min-w-0 flex-1"
                          >
                            <UserAvatar
                              avatarUrl={m.avatarUrl}
                              initials={m.avatarInitials}
                              accentColor={m.accentColor}
                              alt={m.displayName}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-white truncate">
                                {m.displayName}
                              </p>
                              <p className="text-[10.5px] font-mono text-[#7D8296] truncate">
                                @{m.username} · {m.stats.totalEntries} titres
                              </p>
                            </div>
                          </Link>
                          <FriendActionButton
                            target={{
                              id: m.id,
                              username: m.username,
                              displayName: m.displayName,
                              avatarUrl: m.avatarUrl,
                            }}
                          />
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </aside>
          </div>
        )
      ) : tab === "friends" ? (
        /* TAB 2: FRIENDS HUB */
        <div className="space-y-6">
          {/* Add Friend by @pseudo */}
          <div className="rounded-2xl card-surface border border-emerald-500/20 p-5 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-emerald-400" />
                  <span>Ajouter un ami</span>
                </h2>
                <p className="text-xs text-[#8D92A6] mt-0.5">
                  Saisissez le @pseudo d&apos;un membre Shiori pour lui envoyer une invitation.
                </p>
              </div>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const cleaned = directAddUsername.trim().replace(/^@+/, "");
                  if (!cleaned || addingDirect) return;
                  setAddingDirect(true);
                  setFriendFeedback(null);
                  try {
                    const match = profiles.find(
                      (p) => p.username.toLowerCase() === cleaned.toLowerCase()
                    );
                    const res = await addFriend({
                      id: match?.id,
                      username: match?.username || cleaned,
                      displayName: match?.displayName || cleaned,
                      avatarUrl: match?.avatarUrl ?? null,
                    });
                    if (res.ok) {
                      setDirectAddUsername("");
                      setMemberQuery("");
                      if (res.message) {
                        setFriendFeedback({ type: "success", text: res.message });
                      }
                    } else if (res.error) {
                      setFriendFeedback({ type: "error", text: res.error });
                    }
                  } finally {
                    setAddingDirect(false);
                  }
                }}
                className="flex items-center gap-2 w-full md:w-auto"
              >
                <input
                  type="text"
                  value={directAddUsername}
                  onChange={(e) => {
                    setDirectAddUsername(e.target.value);
                    setMemberQuery(e.target.value);
                    if (friendFeedback) setFriendFeedback(null);
                  }}
                  placeholder="@pseudo de votre ami..."
                  className="flex-1 md:w-60 h-10 px-3.5 rounded-xl bg-obsidian/85 border border-white/[0.1] text-xs font-mono text-white placeholder:text-[#656A7E] focus:outline-none focus:border-emerald-400"
                />
                <button
                  type="submit"
                  disabled={addingDirect || !directAddUsername.trim()}
                  className="h-10 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-45 text-[#061810] text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                >
                  {addingDirect ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <UserPlus className="w-3.5 h-3.5" />
                  )}
                  <span>Ajouter</span>
                </button>
              </form>
            </div>

            {friendFeedback && (
              <div
                role="status"
                className={cn(
                  "rounded-xl px-3.5 py-2.5 text-xs border flex items-center justify-between gap-3",
                  friendFeedback.type === "error"
                    ? "bg-rose-500/12 border-rose-400/35 text-rose-200"
                    : "bg-emerald-500/12 border-emerald-400/35 text-emerald-200"
                )}
              >
                <span>{friendFeedback.text}</span>
                <button
                  type="button"
                  onClick={() => setFriendFeedback(null)}
                  className="text-[11px] opacity-75 hover:opacity-100 cursor-pointer shrink-0"
                >
                  Fermer
                </button>
              </div>
            )}
          </div>

          {/* Pending Requests */}
          {(incomingFriendRequests.length > 0 || outgoingFriendRequests.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {incomingFriendRequests.length > 0 && (
                <div className="rounded-2xl card-surface border border-emerald-500/30 p-5 space-y-3">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-emerald-400" />
                    <span>Demandes reçues ({incomingFriendRequests.length})</span>
                  </h3>
                  <div className="space-y-2.5">
                    {incomingFriendRequests.map(({ friendship, user }) => (
                      <div
                        key={friendship.id}
                        className="p-3 rounded-xl bg-obsidian/75 border border-white/[0.08] flex items-center justify-between gap-3"
                      >
                        <Link
                          href={`/profile/${encodeURIComponent(user.username)}`}
                          className="flex items-center gap-3 min-w-0"
                        >
                          <UserAvatar
                            avatarUrl={user.avatarUrl}
                            initials={user.avatarInitials}
                            accentColor={user.accentColor}
                            alt={user.displayName}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-white truncate">
                              {user.displayName}
                            </p>
                            <p className="text-[11px] font-mono text-[#7D8296] truncate">
                              @{user.username}
                            </p>
                          </div>
                        </Link>
                        <FriendActionButton
                          target={{
                            id: user.id,
                            username: user.username,
                            displayName: user.displayName,
                            avatarUrl: user.avatarUrl,
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {outgoingFriendRequests.length > 0 && (
                <div className="rounded-2xl card-surface border border-amber-500/25 p-5 space-y-3">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-400" />
                    <span>Demandes envoyées ({outgoingFriendRequests.length})</span>
                  </h3>
                  <div className="space-y-2.5">
                    {outgoingFriendRequests.map(({ friendship, user }) => (
                      <div
                        key={friendship.id}
                        className="p-3 rounded-xl bg-obsidian/75 border border-white/[0.08] flex items-center justify-between gap-3"
                      >
                        <Link
                          href={`/profile/${encodeURIComponent(user.username)}`}
                          className="flex items-center gap-3 min-w-0"
                        >
                          <UserAvatar
                            avatarUrl={user.avatarUrl}
                            initials={user.avatarInitials}
                            accentColor={user.accentColor}
                            alt={user.displayName}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-white truncate">
                              {user.displayName}
                            </p>
                            <p className="text-[11px] font-mono text-[#7D8296] truncate">
                              @{user.username}
                            </p>
                          </div>
                        </Link>
                        <FriendActionButton
                          target={{
                            id: user.id,
                            username: user.username,
                            displayName: user.displayName,
                            avatarUrl: user.avatarUrl,
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* My Friends List */}
          <div className="space-y-3">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-400" />
              <span>Mes amis ({friends.length})</span>
            </h3>

            {friends.length === 0 ? (
              <div className="rounded-2xl card-surface p-8 text-center space-y-2">
                <p className="text-sm font-semibold text-white">
                  Vous n&apos;avez pas encore d&apos;ami sur Shiori.
                </p>
                <p className="text-xs text-[#8A8FA4] max-w-md mx-auto">
                  Entrez un @pseudo ci-dessus ou parcourez les membres suggérés ci-dessous.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {friends.map((f) => (
                  <div
                    key={f.id}
                    className="rounded-2xl card-surface border border-emerald-500/20 p-5 flex flex-col justify-between gap-4"
                  >
                    <div className="flex items-center gap-3.5">
                      <Link href={`/profile/${encodeURIComponent(f.username)}`}>
                        <UserAvatar
                          avatarUrl={f.avatarUrl}
                          initials={f.avatarInitials}
                          accentColor={f.accentColor}
                          alt={f.displayName}
                          size="md"
                        />
                      </Link>
                      <div className="min-w-0">
                        <Link
                          href={`/profile/${encodeURIComponent(f.username)}`}
                          className="text-sm font-bold text-white hover:text-accent-hover truncate block"
                        >
                          {f.displayName}
                        </Link>
                        <p className="text-xs font-mono text-[#7D8296] truncate">
                          @{f.username} · {f.stats.totalEntries} titres
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-3 border-t border-white/[0.07]">
                      <Link
                        href={`/profile/${encodeURIComponent(f.username)}`}
                        className="flex-1 h-9 rounded-xl bg-white/[0.07] hover:bg-white/[0.14] border border-white/[0.1] text-xs font-semibold text-white flex items-center justify-center transition-colors"
                      >
                        Profil
                      </Link>
                      <Link
                        href={`/messages?to=${encodeURIComponent(f.username)}`}
                        className="h-9 px-3 rounded-xl bg-accent hover:bg-accent-hover text-accent-fg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Message</span>
                      </Link>
                      <FriendActionButton
                        target={{
                          id: f.id,
                          username: f.username,
                          displayName: f.displayName,
                          avatarUrl: f.avatarUrl,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Suggestions */}
          {(() => {
            const suggestions = visibleProfiles.filter(
              (m) =>
                m.username.toLowerCase() !== profile.username.toLowerCase() &&
                getFriendRelation(m.id, m.username) === "NONE"
            );
            if (suggestions.length === 0) return null;
            return (
              <div className="space-y-3">
                <h3 className="text-base font-semibold text-white">
                  Membres à découvrir
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {suggestions.slice(0, 8).map((m) => (
                    <div
                      key={m.id}
                      className="rounded-2xl card-surface border border-white/[0.08] p-4 flex flex-col justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <Link href={`/profile/${encodeURIComponent(m.username)}`}>
                          <UserAvatar
                            avatarUrl={m.avatarUrl}
                            initials={m.avatarInitials}
                            accentColor={m.accentColor}
                            alt={m.displayName}
                            size="md"
                          />
                        </Link>
                        <div className="min-w-0">
                          <Link
                            href={`/profile/${encodeURIComponent(m.username)}`}
                            className="text-sm font-semibold text-white hover:text-accent-hover truncate block"
                          >
                            {m.displayName}
                          </Link>
                          <p className="text-xs font-mono text-[#7D8296] truncate">
                            @{m.username} · {m.stats.totalEntries} titres
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 pt-2.5 border-t border-white/[0.07]">
                        <FriendActionButton
                          target={{
                            id: m.id,
                            username: m.username,
                            displayName: m.displayName,
                            avatarUrl: m.avatarUrl,
                          }}
                          className="flex-1"
                        />
                        <Link
                          href={`/profile/${encodeURIComponent(m.username)}`}
                          className="h-9 px-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-xs font-semibold text-white inline-flex items-center justify-center transition-colors"
                        >
                          Profil
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      ) : (
        /* TAB 3: MEMBERS DIRECTORY */
        <div className="space-y-4">
          {loadingMembers ? (
            <div className="flex items-center justify-center py-12 text-xs text-[#8E93A6] gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-accent" />
              <span>Chargement des membres...</span>
            </div>
          ) : visibleProfiles.length === 0 ? (
            <div className="rounded-2xl card-surface p-10 text-center text-sm text-[#9A9EAE]">
              Aucun membre trouvé pour « {memberQuery} ».
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {visibleProfiles.map((m) => {
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
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Link
                              href={`/profile/${encodeURIComponent(m.username)}`}
                              className="text-base font-bold text-white hover:text-accent-hover transition-colors truncate"
                            >
                              {m.displayName}
                            </Link>
                            {(m.source === "community" || m.id.startsWith("community-")) && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-400/30 font-mono text-[9.5px] uppercase text-amber-200 shrink-0">
                                Exemple
                              </span>
                            )}
                          </div>
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

                    <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-white/[0.07]">
                      <Link
                        href={`/profile/${encodeURIComponent(m.username)}`}
                        className="flex-1 h-9 px-3 rounded-xl bg-white/[0.07] hover:bg-white/[0.14] border border-white/[0.1] text-xs font-semibold text-white flex items-center justify-center transition-colors"
                      >
                        Profil
                      </Link>
                      {!isMe && (
                        <>
                          <FriendActionButton
                            target={{
                              id: m.id,
                              username: m.username,
                              displayName: m.displayName,
                              avatarUrl: m.avatarUrl,
                            }}
                          />
                          <Link
                            href={`/messages?to=${encodeURIComponent(m.username)}`}
                            title={`Envoyer un message à ${m.displayName}`}
                            className="h-9 px-3 rounded-xl bg-accent hover:bg-accent-hover text-accent-fg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>Message</span>
                          </Link>
                        </>
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
