"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  Mic2,
  Heart,
  ArrowRight,
  MessageCircle,
  Radio,
  Globe,
} from "lucide-react";
import { useShiori } from "@/context/ShioriContext";
import { useTranslation } from "@/hooks/useTranslation";
import { RevealSection } from "@/components/motion/MotionPrimitives";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { BadgeIcon } from "@/components/badges/BadgeIcon";
import { BADGE_BY_ID, RARITY_META } from "@/lib/badges";
import { cn } from "@/lib/utils";
import type { CommunityActivityItem, FavoriteVoiceActor } from "@/types/media";
import type { AniListFeedItem } from "@/app/api/anilist/activity/route";

export function HomeCommunityPulseSection() {
  const {
    profile,
    favoriteStaff,
    toggleFavoriteStaff,
    anilistConnection,
    recordSocialInteraction,
  } = useShiori();
  const { t, tr, tRelativeTime } = useTranslation();
  const [source, setSource] = useState<"anilist" | "shiori">("anilist");
  const [anilistFeed, setAnilistFeed] = useState<AniListFeedItem[]>([]);
  const [shioriFeed, setShioriFeed] = useState<CommunityActivityItem[]>([]);
  const [spotlightStaff, setSpotlightStaff] = useState<FavoriteVoiceActor[]>([]);

  useEffect(() => {
    let cancelled = false;
    const alScope = anilistConnection.connected ? "following" : "global";
    Promise.all([
      fetch(`/api/anilist/activity?scope=${alScope}&perPage=6`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : { activities: [] }))
        .catch(() => ({ activities: [] })),
      fetch("/api/community/activity", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : { activities: [] }))
        .catch(() => ({ activities: [] })),
      fetch("/api/anilist/staff", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .catch(() => ({ items: [] })),
    ]).then(([alData, actData, staffData]) => {
      if (cancelled) return;
      if (Array.isArray(alData?.activities)) {
        setAnilistFeed(alData.activities.slice(0, 4));
      }
      if (Array.isArray(actData?.activities)) {
        setShioriFeed(actData.activities.slice(0, 4));
      }
      if (Array.isArray(staffData?.items)) {
        setSpotlightStaff(staffData.items.slice(0, 4));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [anilistConnection.connected]);

  const handleQuickLikeShiori = async (item: CommunityActivityItem) => {
    const liked = item.likes.includes(profile.id);
    if (!liked) {
      recordSocialInteraction();
    }
    const nextLikes = liked
      ? item.likes.filter((id) => id !== profile.id)
      : [...item.likes, profile.id];
    setShioriFeed((prev) =>
      prev.map((a) => (a.id === item.id ? { ...a, likes: nextLikes } : a))
    );
    try {
      const res = await fetch(`/api/community/activity/${encodeURIComponent(item.id)}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: profile.id,
          username: profile.username,
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl ?? null,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.likes)) {
          setShioriFeed((prev) =>
            prev.map((a) => (a.id === item.id ? { ...a, likes: data.likes } : a))
          );
        }
      }
    } catch {
      // keep optimistic
    }
  };

  if (anilistFeed.length === 0 && shioriFeed.length === 0 && spotlightStaff.length === 0) {
    return null;
  }

  return (
    <RevealSection className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* LEFT: Live AniList / Shiori Activity Feed Preview */}
      <div className="lg:col-span-7 rounded-2xl card-surface p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-sky-400 flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5" />
              <span>{source === "anilist" ? tr("Fil d'actualités AniList") : tr("Communauté Shiori")}</span>
            </p>
            <h2 className="text-lg sm:text-xl font-semibold text-white mt-0.5 flex items-center gap-2">
              {source === "anilist" ? (
                <Globe className="w-4 h-4 text-sky-400" />
              ) : (
                <Activity className="w-4 h-4 text-accent" />
              )}
              <span>{tr("Activité en direct")}</span>
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex items-center p-0.5 rounded-full bg-obsidian/80 border border-white/[0.08] text-[11px]">
              <button
                type="button"
                onClick={() => setSource("anilist")}
                className={cn(
                  "px-2.5 py-1 rounded-full font-semibold transition-colors cursor-pointer",
                  source === "anilist"
                    ? "bg-[#02A9FF] text-[#06121C]"
                    : "text-[#9A9EAE] hover:text-white"
                )}
              >
                AniList
              </button>
              <button
                type="button"
                onClick={() => setSource("shiori")}
                className={cn(
                  "px-2.5 py-1 rounded-full font-semibold transition-colors cursor-pointer",
                  source === "shiori"
                    ? "bg-accent text-accent-fg"
                    : "text-[#9A9EAE] hover:text-white"
                )}
              >
                Shiori
              </button>
            </div>

            <Link
              href="/community"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-xs font-medium text-white transition-colors shrink-0"
            >
              <span>{t("common.viewAll")}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {source === "anilist" ? (
          <div className="space-y-2.5">
            {anilistFeed.map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-xl bg-obsidian/70 border border-white/[0.07] hover:border-white/[0.15] transition-colors flex items-center gap-3"
              >
                <a href={item.user.siteUrl} target="_blank" rel="noreferrer" className="shrink-0">
                  {item.user.avatarUrl ? (
                    <img
                      src={item.user.avatarUrl}
                      alt={item.user.name}
                      loading="lazy"
                      decoding="async"
                      className="w-8 h-8 rounded-full object-cover border border-white/15 bg-[#121522]"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-sky-500/20 flex items-center justify-center text-[11px] font-bold text-sky-300">
                      {item.user.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </a>

                <div className="min-w-0 flex-1">
                  <p className="text-xs text-[#C8CCE0] truncate">
                    <a
                      href={item.user.siteUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-white hover:text-sky-300"
                    >
                      {item.user.name}
                    </a>{" "}
                    <span className="text-[#8E93A6]">{item.actionLabel.toLowerCase()}</span>
                  </p>
                  {item.media ? (
                    <Link
                      href={`/media/${item.media.id}`}
                      className="block text-xs font-bold text-white hover:text-accent-hover truncate mt-0.5"
                    >
                      {item.media.title}
                    </Link>
                  ) : (
                    <p className="text-xs text-[#D8DBE6] line-clamp-1 mt-0.5">{item.text}</p>
                  )}
                  <p suppressHydrationWarning className="text-[10.5px] text-[#7D8296] mt-0.5">
                    {tRelativeTime(new Date(item.createdAt * 1000).toISOString())}
                  </p>
                </div>

                {item.media?.coverImage && (
                  <Link href={`/media/${item.media.id}`} className="shrink-0 hidden sm:block">
                    <img
                      src={item.media.coverImage}
                      alt={item.media.title}
                      loading="lazy"
                      decoding="async"
                      className="w-9 h-12 rounded-md object-cover border border-white/12"
                    />
                  </Link>
                )}

                <div className="flex items-center gap-1.5 shrink-0 text-[11px] font-mono text-[#9A9EAE]">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.07]">
                    <Heart className="w-3 h-3" />
                    {item.likeCount}
                  </span>
                  <Link
                    href="/community"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.07] hover:text-white"
                  >
                    <MessageCircle className="w-3 h-3" />
                    {item.replyCount}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2.5">
            {shioriFeed.map((item) => {
              const isLiked = item.likes.includes(profile.id);
              return (
                <div
                  key={item.id}
                  className="p-3 rounded-xl bg-obsidian/70 border border-white/[0.07] hover:border-white/[0.14] transition-colors flex items-center gap-3"
                >
                  <Link href={`/profile/${encodeURIComponent(item.actorUsername)}`}>
                    <UserAvatar
                      avatarUrl={item.actorAvatarUrl}
                      initials={item.actorDisplayName.slice(0, 2)}
                      accentColor={item.actorAccentColor}
                      alt={item.actorDisplayName}
                      size="sm"
                    />
                  </Link>

                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-[#C8CCE0] truncate">
                      <Link
                        href={`/profile/${encodeURIComponent(item.actorUsername)}`}
                        className="font-semibold text-white hover:text-accent-hover"
                      >
                        {item.actorDisplayName}
                      </Link>{" "}
                      <span className="text-[#8E93A6]">{item.action.toLowerCase()}</span>
                    </p>
                    <p className="text-xs font-bold text-white truncate mt-0.5">
                      {item.mediaTitle}
                    </p>
                    <p suppressHydrationWarning className="text-[10.5px] text-[#7D8296] mt-0.5">
                      {tRelativeTime(item.createdAt)}
                    </p>
                  </div>

                  {item.kind === "BADGE_UNLOCKED" ? (
                    (() => {
                      const def = item.badgeId ? BADGE_BY_ID.get(item.badgeId) : undefined;
                      const rarityMeta = RARITY_META[item.badgeRarity ?? def?.rarity ?? "gold"];
                      return (
                        <div
                          className={cn(
                            "w-9 h-9 rounded-xl bg-gradient-to-br flex items-center justify-center shrink-0 ring-1 ring-white/25 hidden sm:flex",
                            rarityMeta.iconBg
                          )}
                        >
                          <BadgeIcon iconKey={def?.iconKey} className="w-4 h-4 text-[#08090E]" />
                        </div>
                      );
                    })()
                  ) : item.coverImage ? (
                    <img
                      src={item.coverImage}
                      alt={item.mediaTitle}
                      loading="lazy"
                      decoding="async"
                      className="w-9 h-12 rounded-md object-cover border border-white/12 shrink-0 hidden sm:block"
                    />
                  ) : null}

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => void handleQuickLikeShiori(item)}
                      className={cn(
                        "h-7 px-2.5 rounded-full border text-[11px] font-mono font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer",
                        isLiked
                          ? "bg-rose-500/18 border-rose-400/40 text-rose-300"
                          : "bg-white/[0.04] hover:bg-white/[0.09] border-white/[0.08] text-[#A8ADBE] hover:text-white"
                      )}
                    >
                      <Heart className={cn("w-3 h-3", isLiked && "fill-current")} />
                      <span>{item.likes.length}</span>
                    </button>
                    <Link
                      href="/community"
                      className="h-7 px-2 rounded-full bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.08] text-[11px] font-mono text-[#A8ADBE] hover:text-white inline-flex items-center gap-1"
                    >
                      <MessageCircle className="w-3 h-3" />
                      <span>{item.comments.length}</span>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* RIGHT: Voice Actors (Seiyuu) Spotlight */}
      <div className="lg:col-span-5 rounded-2xl card-surface p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-kinpaku flex items-center gap-1.5">
              <Mic2 className="w-3.5 h-3.5" />
              <span>{tr("Seiyuu à l'honneur")}</span>
            </p>
            <h2 className="text-lg sm:text-xl font-semibold text-white mt-0.5">
              {tr("Voice Actors cultes")}
            </h2>
          </div>

          <Link
            href="/settings#voice-actors"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-xs font-medium text-white transition-colors shrink-0"
          >
            <span>{tr("Rechercher")}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {spotlightStaff.map((staff) => {
            const isFav = favoriteStaff.some((s) => s.id === staff.id);
            return (
              <div
                key={staff.id}
                className={cn(
                  "p-2.5 rounded-xl border transition-all flex items-center gap-2.5",
                  isFav
                    ? "bg-accent/12 border-accent/45"
                    : "bg-obsidian/70 border-white/[0.07] hover:border-white/[0.16]"
                )}
              >
                <img
                  src={staff.image}
                  alt={staff.name}
                  loading="lazy"
                  decoding="async"
                  className="w-11 h-14 rounded-lg object-cover border border-white/12 shrink-0 bg-[#121522]"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-white truncate">{staff.name}</p>
                  {staff.nativeName && (
                    <p className="text-[10px] text-[#858A9E] truncate">{staff.nativeName}</p>
                  )}
                  {staff.notableRoles?.[0]?.name && (
                    <p className="text-[10px] text-accent-soft truncate mt-0.5">
                      {staff.notableRoles[0].name}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => toggleFavoriteStaff(staff)}
                  title={isFav ? tr("Retirer des favoris") : tr("Ajouter aux favoris")}
                  className={cn(
                    "w-7 h-7 rounded-lg border flex items-center justify-center transition-colors cursor-pointer shrink-0",
                    isFav
                      ? "bg-accent border-accent text-accent-fg"
                      : "bg-white/[0.05] hover:bg-accent/25 border-white/[0.1] text-[#B8BCCB] hover:text-white"
                  )}
                >
                  <Heart className={cn("w-3.5 h-3.5", isFav && "fill-current")} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </RevealSection>
  );
}
