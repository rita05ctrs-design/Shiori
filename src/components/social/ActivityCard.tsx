"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Heart,
  MessageCircle,
  Send,
  Star,
  Mic2,
  CheckCircle2,
  Sparkles,
  Trophy,
  Flag,
} from "lucide-react";
import { useShiori } from "@/context/ShioriContext";
import { useTranslation } from "@/hooks/useTranslation";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { RoleBadge } from "@/components/ui/RoleBadge";
import { PinnedBadgesRow } from "@/components/badges/PinnedBadgesRow";
import { SpecialBadgesSpotlight } from "@/components/badges/SpecialBadgesSpotlight";
import { BadgeIcon } from "@/components/badges/BadgeIcon";
import { BADGE_BY_ID, RARITY_META } from "@/lib/badges";
import { cn } from "@/lib/utils";
import type { ActivityCommentItem, CommunityActivityItem, ReportReason } from "@/types/media";

const ACTIVITY_REPORT_REASONS: { id: ReportReason; label: string }[] = [
  { id: "spoiler", label: "Spoiler" },
  { id: "spam", label: "Spam" },
  { id: "harassment", label: "Abus" },
  { id: "inappropriate", label: "Inapproprié" },
  { id: "other", label: "Autre" },
];

interface ActivityCardProps {
  item: CommunityActivityItem;
  onUpdate: (updated: CommunityActivityItem) => void;
}

const KIND_META: Record<
  CommunityActivityItem["kind"],
  { label: string; icon: React.ComponentType<{ className?: string }>; badgeClass: string }
> = {
  FAVORITE_MEDIA: {
    label: "Coup de cœur",
    icon: Heart,
    badgeClass: "bg-rose-500/15 border-rose-400/35 text-rose-300",
  },
  FAVORITE_STAFF: {
    label: "Voice Actor favori",
    icon: Mic2,
    badgeClass: "bg-violet-500/15 border-violet-400/35 text-violet-300",
  },
  COMPLETED: {
    label: "Série terminée",
    icon: CheckCircle2,
    badgeClass: "bg-emerald-500/15 border-emerald-400/35 text-emerald-300",
  },
  SCORED: {
    label: "Nouvelle note",
    icon: Star,
    badgeClass: "bg-amber-500/15 border-amber-400/35 text-amber-300",
  },
  BADGE_UNLOCKED: {
    label: "Badge rare débloqué",
    icon: Trophy,
    badgeClass:
      "bg-gradient-to-r from-amber-500/20 via-fuchsia-500/20 to-cyan-400/20 border-amber-300/50 text-amber-200",
  },
  UPDATE: {
    label: "Activité",
    icon: Sparkles,
    badgeClass: "bg-sky-500/15 border-sky-400/35 text-sky-300",
  },
};

export function ActivityCard({ item, onUpdate }: ActivityCardProps) {
  const { profile, toast, recordSocialInteraction, reportContent } = useShiori();
  const { tr, tRelativeTime } = useTranslation();
  const [commentsOpen, setCommentsOpen] = useState(item.comments.length > 0);
  const [commentText, setCommentText] = useState("");
  const [commenting, setCommenting] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<ReportReason>("spoiler");
  const [reporting, setReporting] = useState(false);

  const isOwnActivity = item.userId === profile.id;
  const isLiked = item.likes.includes(profile.id);
  const meta = KIND_META[item.kind] ?? KIND_META.UPDATE;
  const KindIcon = meta.icon;

  const handleSubmitReport = async () => {
    if (reporting) return;
    setReporting(true);
    try {
      await reportContent({
        targetType: "activity",
        targetId: item.id,
        targetUserId: item.userId,
        reason: reportReason,
        details: `${item.actorUsername}: ${item.mediaTitle}`,
      });
      setReportOpen(false);
    } finally {
      setReporting(false);
    }
  };

  const handleToggleLike = async () => {
    // Optimistic instant toggle (supports rapid double clicks without blocking!)
    const addingLike = !isLiked;
    const optimisticLikes = isLiked
      ? item.likes.filter((id) => id !== profile.id)
      : [...item.likes, profile.id];
    onUpdate({ ...item, likes: optimisticLikes });
    if (addingLike) {
      recordSocialInteraction();
    }

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
          onUpdate({ ...item, likes: data.likes });
        }
      }
    } catch {
      onUpdate(item);
    }
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = commentText.trim();
    if (!cleaned || commenting) return;

    setCommenting(true);
    try {
      const res = await fetch(
        `/api/community/activity/${encodeURIComponent(item.id)}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            body: cleaned,
            userId: profile.id,
            username: profile.username,
            displayName: profile.displayName,
            avatarUrl: profile.avatarUrl ?? null,
            accentColor: profile.accentColor,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok || !data?.comment) {
        toast({
          title: tr("Commentaire refusé"),
          description: data?.error || tr("Impossible d'envoyer le commentaire."),
          variant: "warning",
        });
        return;
      }
      const added = data.comment as ActivityCommentItem;
      onUpdate({ ...item, comments: [...item.comments, added] });
      recordSocialInteraction();
      setCommentText("");
      setCommentsOpen(true);
    } finally {
      setCommenting(false);
    }
  };

  const isBadgeEvent = item.kind === "BADGE_UNLOCKED" || item.mediaType === "BADGE";
  const badgeDef = item.badgeId ? BADGE_BY_ID.get(item.badgeId) : undefined;
  const badgeRarity = item.badgeRarity ?? badgeDef?.rarity ?? "gold";
  const badgeRarityMeta = RARITY_META[badgeRarity];

  const targetHref = isBadgeEvent
    ? `/profile/${encodeURIComponent(item.actorUsername)}#badges`
    : item.mediaType === "STAFF"
      ? `https://anilist.co/staff/${item.mediaId}`
      : `/media/${item.mediaId}`;

  return (
    <article
      className={cn(
        "rounded-2xl card-surface border p-4 sm:p-5 space-y-3.5",
        isBadgeEvent ? badgeRarityMeta.border : "border-white/[0.08]"
      )}
    >
      {/* Top Author Row */}
      <div className="flex flex-wrap items-start justify-between gap-2.5 sm:gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Link
            href={`/profile/${encodeURIComponent(item.actorUsername)}`}
            className="shrink-0"
          >
            <UserAvatar
              avatarUrl={item.actorAvatarUrl}
              initials={item.actorDisplayName.slice(0, 2)}
              accentColor={item.actorAccentColor}
              alt={item.actorDisplayName}
              size="md"
            />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href={`/profile/${encodeURIComponent(item.actorUsername)}`}
                className="text-sm font-semibold text-white hover:text-accent-hover transition-colors truncate"
              >
                {item.actorDisplayName}
              </Link>
              <RoleBadge role={item.actorRole} size="xs" />
              <SpecialBadgesSpotlight
                badgeIds={item.actorSpecialBadges}
                variant="pill"
                size="md"
              />
              <Link
                href={`/profile/${encodeURIComponent(item.actorUsername)}`}
                className="text-xs font-mono text-[#7D8296] hover:text-white transition-colors truncate"
              >
                @{item.actorUsername}
              </Link>
              {(item.id.startsWith("act-seed-") || item.userId.startsWith("community-")) && (
                <span
                  title={tr("Exemple")}
                  className="px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-400/30 font-mono text-[9.5px] uppercase tracking-wider text-amber-200"
                >
                  {tr("Exemple")}
                </span>
              )}
              <PinnedBadgesRow
                badgeIds={(item.actorPinnedBadges ?? []).filter(
                  (id) => !(item.actorSpecialBadges ?? []).includes(id as "beta_tester" | "supporter" | "vip")
                )}
                size="xs"
              />
            </div>
            <p className="text-[11px] text-[#858A9E]">
              {tRelativeTime(item.createdAt)}
            </p>
          </div>
        </div>

        <span
          className={cn(
            "inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[10.5px] font-semibold shrink-0",
            meta.badgeClass
          )}
        >
          <KindIcon className="w-3 h-3" />
          <span>{tr(meta.label)}</span>
        </span>
      </div>

      {/* Main Content Card */}
      {isBadgeEvent ? (
        <Link
          href={targetHref}
          style={{ boxShadow: badgeRarityMeta.glow }}
          className={cn(
            "relative block rounded-xl border p-4 overflow-hidden badge-shine-sweep transition-transform hover:-translate-y-0.5",
            badgeRarityMeta.bg,
            badgeRarityMeta.border
          )}
        >
          {badgeRarity === "mythic" ? (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -inset-6 badge-mythic-aura opacity-75"
            />
          ) : badgeRarity === "legendary" ? (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -inset-6 badge-holo-aura opacity-65"
            />
          ) : null}
          <div className="relative z-10 flex items-center gap-4">
            <div
              className={cn(
                "w-14 h-14 rounded-2xl bg-gradient-to-br flex items-center justify-center shrink-0 ring-2 ring-white/25 shadow-xl",
                badgeRarityMeta.iconBg
              )}
            >
              <BadgeIcon
                iconKey={badgeDef?.iconKey}
                className="w-7 h-7 text-[#08090E]"
              />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={cn(
                    "px-2 py-0.5 rounded-full border text-[10px] font-mono font-bold uppercase tracking-wider",
                    badgeRarityMeta.pillClass
                  )}
                >
                  {badgeRarityMeta.shortLabel}
                </span>
                <span className="text-[11px] font-mono text-[#B5B9C9]">
                  {tr("Trophée rare Shiori")}
                </span>
              </div>
              <p className="text-sm sm:text-base font-bold text-white leading-snug">
                {item.actorDisplayName}{" "}
                <span className="font-normal text-[#D4D7E6]">
                  {tr("a débloqué le badge")}
                </span>{" "}
                <span className={badgeRarityMeta.color}>{item.mediaTitle}</span> !
              </p>
              {badgeDef?.description && (
                <p className="text-xs text-[#AEB3C6]">{badgeDef.description}</p>
              )}
            </div>
          </div>
        </Link>
      ) : (
        <div className="rounded-xl bg-obsidian/70 border border-white/[0.07] p-3 flex items-center gap-3.5">
          {item.coverImage && (
            item.mediaType === "STAFF" ? (
              <a href={targetHref} target="_blank" rel="noreferrer" className="shrink-0">
                <img
                  src={item.coverImage}
                  alt={item.mediaTitle}
                  loading="lazy"
                  decoding="async"
                  className="w-12 h-16 rounded-lg object-cover border border-white/12"
                />
              </a>
            ) : (
              <Link href={targetHref} className="shrink-0">
                <img
                  src={item.coverImage}
                  alt={item.mediaTitle}
                  loading="lazy"
                  decoding="async"
                  className="w-12 h-16 rounded-lg object-cover border border-white/12"
                />
              </Link>
            )
          )}

          <div className="min-w-0 flex-1">
            <p className="text-xs text-[#9EA3B5]">
              {(() => {
                const translateSegment = (seg: string) => {
                  const rated = seg.match(/^A attribué la note de (.+)$/i);
                  if (rated) return tr("A attribué la note de {score}", { score: rated[1] });
                  const epProg = seg.match(/^A progressé jusqu'à l'épisode (\d+)$/i);
                  if (epProg) return tr("A progressé jusqu'à l'épisode {n}", { n: epProg[1] });
                  const chProg = seg.match(/^A progressé jusqu'au chapitre (\d+)$/i);
                  if (chProg) return tr("A progressé jusqu'au chapitre {n}", { n: chProg[1] });
                  return tr(seg);
                };
                return item.action.split(" · ").map(translateSegment).join(" · ");
              })()}
            </p>
            {item.mediaType === "STAFF" ? (
              <a
                href={targetHref}
                target="_blank"
                rel="noreferrer"
                className="text-sm sm:text-base font-bold text-white hover:text-accent-hover transition-colors line-clamp-1 mt-0.5 block"
              >
                {item.mediaTitle}
              </a>
            ) : (
              <Link
                href={targetHref}
                className="text-sm sm:text-base font-bold text-white hover:text-accent-hover transition-colors line-clamp-1 mt-0.5 block"
              >
                {item.mediaTitle}
              </Link>
            )}
            {item.score !== null && item.score !== undefined && (
              <span className="inline-flex items-center gap-1 mt-1 font-mono text-xs font-semibold text-kinpaku">
                <Star className="w-3.5 h-3.5 fill-current" />
                {item.score.toFixed(1)} / 10
              </span>
            )}
          </div>
        </div>
      )}

      {/* Social Action Bar: Like + Comments + Report */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handleToggleLike()}
            className={cn(
              "h-8 px-3 rounded-full border text-xs font-semibold inline-flex items-center gap-1.5 transition-all cursor-pointer",
              isLiked
                ? "bg-rose-500/18 border-rose-400/45 text-rose-300"
                : "bg-white/[0.04] hover:bg-white/[0.09] border-white/[0.08] text-[#B5B9C9] hover:text-white"
            )}
          >
            <Heart className={cn("w-3.5 h-3.5", isLiked && "fill-current")} />
            <span className="font-mono">{item.likes.length}</span>
            <span>{tr("J'aime")}</span>
          </button>

          <button
            type="button"
            onClick={() => setCommentsOpen((v) => !v)}
            className={cn(
              "h-8 px-3 rounded-full border text-xs font-semibold inline-flex items-center gap-1.5 transition-all cursor-pointer",
              commentsOpen
                ? "bg-accent/18 border-accent/40 text-accent-soft"
                : "bg-white/[0.04] hover:bg-white/[0.09] border-white/[0.08] text-[#B5B9C9] hover:text-white"
            )}
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span className="font-mono">{item.comments.length}</span>
            <span>{tr("Commentaires")}</span>
          </button>
        </div>

        {!isOwnActivity && (
          <button
            type="button"
            onClick={() => setReportOpen((v) => !v)}
            className="h-8 px-2.5 rounded-full text-[11px] font-medium text-[#7D8296] hover:text-amber-300 hover:bg-amber-500/10 inline-flex items-center gap-1 transition-colors cursor-pointer"
            title={tr("Signaler")}
          >
            <Flag className="w-3 h-3" />
            <span>{tr("Signaler")}</span>
          </button>
        )}
      </div>

      {reportOpen && !isOwnActivity && (
        <div className="rounded-xl bg-obsidian/80 border border-amber-400/30 p-3 space-y-2.5">
          <p className="text-[11px] font-semibold text-amber-200">
            {tr("Motif du signalement :")}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {ACTIVITY_REPORT_REASONS.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setReportReason(r.id)}
                className={cn(
                  "px-2.5 py-1 rounded-full text-[11px] font-medium border cursor-pointer transition-colors",
                  reportReason === r.id
                    ? "bg-amber-500/20 border-amber-400/50 text-amber-100"
                    : "bg-white/[0.03] border-white/[0.08] text-[#A2A6B8] hover:text-white"
                )}
              >
                {tr(r.label)}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setReportOpen(false)}
              className="px-3 py-1 rounded-lg text-[11px] text-[#9A9EAE] hover:text-white cursor-pointer"
            >
              {tr("Annuler")}
            </button>
            <button
              type="button"
              disabled={reporting}
              onClick={() => void handleSubmitReport()}
              className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-[#090A0F] text-[11px] font-semibold cursor-pointer"
            >
              {reporting ? tr("Envoi...") : tr("Confirmer le signalement")}
            </button>
          </div>
        </div>
      )}

      {/* Comments Section */}
      {commentsOpen && (
        <div className="pt-3 border-t border-white/[0.07] space-y-3">
          {item.comments.length > 0 && (
            <div className="space-y-2.5">
              {item.comments.map((c) => (
                <div key={c.id} className="flex items-start gap-2.5">
                  <Link href={`/profile/${encodeURIComponent(c.authorUsername)}`}>
                    <UserAvatar
                      avatarUrl={c.authorAvatarUrl}
                      initials={c.authorDisplayName.slice(0, 2)}
                      accentColor={c.authorAccentColor}
                      alt={c.authorDisplayName}
                      size="xs"
                    />
                  </Link>
                  <div className="flex-1 min-w-0 rounded-xl bg-obsidian/70 border border-white/[0.06] px-3 py-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Link
                        href={`/profile/${encodeURIComponent(c.authorUsername)}`}
                        className="text-xs font-semibold text-white hover:text-accent-hover"
                      >
                        {c.authorDisplayName}
                      </Link>
                      <RoleBadge role={c.authorRole} size="xs" />
                      <SpecialBadgesSpotlight
                        badgeIds={c.authorSpecialBadges}
                        variant="pill"
                        size="sm"
                      />
                      <span className="text-[10px] text-[#7D8296]">
                        {tRelativeTime(c.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs text-[#D6D9E5] mt-0.5 leading-relaxed break-words">
                      {c.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add Comment Input */}
          <form onSubmit={handlePostComment} className="flex items-center gap-2">
            <UserAvatar
              avatarUrl={profile.avatarUrl}
              initials={profile.avatarInitials}
              accentColor={profile.accentColor}
              alt={profile.displayName}
              size="xs"
            />
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder={tr("Ajouter un commentaire...")}
              maxLength={600}
              className="flex-1 h-9 px-3 rounded-xl bg-obsidian/80 border border-white/[0.09] text-base sm:text-xs text-white placeholder:text-[#656A7E] focus:outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={commenting || !commentText.trim()}
              className="h-9 px-3 rounded-xl bg-accent hover:bg-accent-hover disabled:opacity-40 text-accent-fg text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}
    </article>
  );
}
