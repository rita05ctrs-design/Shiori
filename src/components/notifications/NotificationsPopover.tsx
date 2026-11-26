"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  CheckCheck,
  Sparkles,
  Tv,
  Trophy,
  Info,
  Settings,
  Trash2,
  UserPlus,
  MessageSquare,
  Heart,
  Award,
  Check,
  Loader2,
} from "lucide-react";
import { useShiori } from "@/context/ShioriContext";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";
import type { ShioriNotification } from "@/types/media";

type FilterTab = "ALL" | "FRIEND_REQUEST" | "MESSAGE" | "SOCIAL" | "BADGE";

const FILTER_TABS: { id: FilterTab; label: string }[] = [
  { id: "ALL", label: "Toutes" },
  { id: "FRIEND_REQUEST", label: "Amis" },
  { id: "MESSAGE", label: "Messages" },
  { id: "SOCIAL", label: "Social" },
  { id: "BADGE", label: "Badges" },
];

function KindIcon({ kind }: { kind: ShioriNotification["kind"] }) {
  switch (kind) {
    case "FRIEND_REQUEST":
      return <UserPlus className="w-3.5 h-3.5 text-emerald-400" />;
    case "MESSAGE":
      return <MessageSquare className="w-3.5 h-3.5 text-sky-400" />;
    case "SOCIAL":
      return <Heart className="w-3.5 h-3.5 text-rose-400" />;
    case "BADGE":
      return <Award className="w-3.5 h-3.5 text-[#F0B95B]" />;
    case "AIRING":
      return <Tv className="w-3.5 h-3.5 text-sky-400" />;
    case "MILESTONE":
      return <Trophy className="w-3.5 h-3.5 text-[#F0B95B]" />;
    case "RECOMMENDATION":
      return <Sparkles className="w-3.5 h-3.5 text-accent-hover" />;
    default:
      return <Info className="w-3.5 h-3.5 text-[#9A9EAE]" />;
  }
}

function getKindMeta(kind: ShioriNotification["kind"]): {
  label: string;
  boxClass: string;
} {
  switch (kind) {
    case "FRIEND_REQUEST":
      return {
        label: "Demande d'ami",
        boxClass: "bg-emerald-500/12 border-emerald-500/30",
      };
    case "MESSAGE":
      return {
        label: "Message privé",
        boxClass: "bg-sky-500/12 border-sky-400/30",
      };
    case "SOCIAL":
      return {
        label: "Communauté",
        boxClass: "bg-rose-500/12 border-rose-500/30",
      };
    case "BADGE":
      return {
        label: "Badge",
        boxClass: "bg-[#F0B95B]/14 border-[#F0B95B]/35",
      };
    case "AIRING":
      return {
        label: "Diffusion",
        boxClass: "bg-sky-500/12 border-sky-500/25",
      };
    case "MILESTONE":
      return {
        label: "Palier",
        boxClass: "bg-[#F0B95B]/12 border-[#F0B95B]/30",
      };
    case "RECOMMENDATION":
      return {
        label: "Découverte",
        boxClass: "bg-accent/15 border-accent/30",
      };
    default:
      return {
        label: "Système",
        boxClass: "bg-white/[0.05] border-white/[0.08]",
      };
  }
}

export function NotificationsPopover() {
  const {
    notifications,
    unreadCount,
    refreshNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    clearNotifications,
    acceptFriend,
  } = useShiori();
  const { tr, tRelativeTime } = useTranslation();

  const [open, setOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("ALL");
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const tabCounts = useMemo(() => {
    const counts: Record<FilterTab, number> = {
      ALL: notifications.length,
      FRIEND_REQUEST: 0,
      MESSAGE: 0,
      SOCIAL: 0,
      BADGE: 0,
    };
    for (const n of notifications) {
      if (n.kind === "FRIEND_REQUEST") counts.FRIEND_REQUEST += 1;
      else if (n.kind === "MESSAGE") counts.MESSAGE += 1;
      else if (n.kind === "SOCIAL") counts.SOCIAL += 1;
      else if (n.kind === "BADGE" || n.kind === "MILESTONE") counts.BADGE += 1;
    }
    return counts;
  }, [notifications]);

  const filteredNotifications = useMemo(() => {
    if (activeFilter === "ALL") return notifications;
    if (activeFilter === "BADGE") {
      return notifications.filter((n) => n.kind === "BADGE" || n.kind === "MILESTONE");
    }
    return notifications.filter((n) => n.kind === activeFilter);
  }, [notifications, activeFilter]);

  const handleToggleOpen = () => {
    setOpen((prev) => {
      const next = !prev;
      if (next) {
        void refreshNotifications();
      }
      return next;
    });
  };

  const handleQuickAcceptFriend = async (
    e: React.MouseEvent,
    notif: ShioriNotification
  ) => {
    e.preventDefault();
    e.stopPropagation();
    if (!notif.actorUsername) return;
    setAcceptingId(notif.id);
    try {
      await acceptFriend({
        id: notif.actorId,
        username: notif.actorUsername,
        displayName: notif.actorDisplayName,
      });
      markNotificationRead(notif.id);
      await refreshNotifications();
    } finally {
      setAcceptingId(null);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={handleToggleOpen}
        aria-label={tr("Notifications")}
        title={tr("Notifications")}
        className={cn(
          "relative w-8.5 h-8.5 sm:w-9 sm:h-9 rounded-full flex items-center justify-center border transition-all cursor-pointer",
          open
            ? "bg-accent/20 border-accent/55 text-white"
            : "bg-white/[0.045] hover:bg-white/[0.09] border-white/[0.08] hover:border-white/[0.16] text-[#B2B6C6] hover:text-white"
        )}
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-[10px] font-bold text-accent-fg flex items-center justify-center shadow-[0_0_12px_rgb(var(--shiori-accent-rgb)/0.85)]">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ duration: 0.16 }}
            className="fixed inset-x-3 top-[calc(4rem+env(safe-area-inset-top))] sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2.5 sm:w-[420px] max-h-[calc(100dvh-5.5rem-env(safe-area-inset-top))] flex flex-col rounded-2xl bg-surface-solid border border-white/[0.13] shadow-[0_28px_72px_rgba(0,0,0,0.94)] overflow-hidden z-50"
          >
            {/* Header */}
            <div className="px-3.5 sm:px-4 pt-3.5 pb-3 bg-surface-solid-header border-b border-white/[0.08] space-y-2.5 shrink-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-semibold text-white">{tr("Notifications")}</span>
                  {unreadCount > 0 ? (
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-accent/18 text-accent-soft border border-accent/35 shrink-0">
                      {tr("{n} non lue(s)", { n: unreadCount })}
                    </span>
                  ) : (
                    <span className="text-[10.5px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/12 text-emerald-300 border border-emerald-500/25 shrink-0">
                      {tr("À jour")}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={markAllNotificationsRead}
                      className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-full bg-white/[0.06] hover:bg-accent/20 border border-white/[0.1] hover:border-accent/40 text-[10.5px] sm:text-[11px] font-semibold text-[#E8EAF2] hover:text-white transition-all cursor-pointer whitespace-nowrap"
                    >
                      <CheckCheck className="w-3.5 h-3.5 text-accent-soft shrink-0" />
                      <span>{tr("Tout marquer comme lu")}</span>
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button
                      type="button"
                      onClick={clearNotifications}
                      title={tr("Effacer tout")}
                      aria-label={tr("Effacer tout")}
                      className="p-1.5 rounded-lg text-[#8D92A4] hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Category Filter Pills */}
              <div className="flex flex-wrap items-center gap-1.5">
                {FILTER_TABS.map((tab) => {
                  const active = activeFilter === tab.id;
                  const count = tabCounts[tab.id];
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveFilter(tab.id)}
                      className={cn(
                        "px-2.5 py-1 rounded-full text-[11px] font-medium transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 border",
                        active
                          ? "bg-accent text-accent-fg border-accent shadow-[0_4px_12px_rgb(var(--shiori-accent-rgb)/0.35)]"
                          : "bg-white/[0.04] hover:bg-white/[0.08] text-[#A2A6B8] hover:text-white border-white/[0.07]"
                      )}
                    >
                      <span>{tr(tab.label)}</span>
                      {count > 0 && (
                        <span
                          className={cn(
                            "text-[10px] font-mono px-1 rounded-full",
                            active ? "bg-black/20 text-accent-fg" : "text-[#7A7F94]"
                          )}
                        >
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* List */}
            <div className="flex-1 min-h-0 max-h-[400px] overflow-y-auto overscroll-contain bg-surface-solid divide-y divide-white/[0.06]">
              {filteredNotifications.length === 0 ? (
                <div className="py-12 px-6 text-center">
                  <Bell className="w-8 h-8 text-[#4F5466] mx-auto mb-2.5" />
                  <p className="text-sm font-medium text-[#C5C8D6]">
                    {activeFilter === "ALL"
                      ? tr("Tout est à jour")
                      : tr("Aucune notification dans cette catégorie")}
                  </p>
                  <p className="text-xs text-[#797E92] mt-1">
                    {tr("Demandes d'amis, messages privés, likes, commentaires et badges débloqués apparaîtront ici en temps réel.")}
                  </p>
                </div>
              ) : (
                filteredNotifications.map((n) => {
                  const meta = getKindMeta(n.kind);
                  const isPersonAvatar =
                    n.kind === "FRIEND_REQUEST" || n.kind === "MESSAGE";
                  const targetHref =
                    n.href ?? (n.mediaId ? `/media/${n.mediaId}` : undefined);

                  const rowBody = (
                    <div
                      onClick={() => markNotificationRead(n.id)}
                      className={cn(
                        "p-3.5 flex gap-3 hover:bg-white/[0.045] transition-colors cursor-pointer",
                        !n.isRead && "bg-accent/[0.045]"
                      )}
                    >
                      {n.coverImage ? (
                        <img
                          src={n.coverImage}
                          alt=""
                          className={cn(
                            "object-cover shrink-0 border border-white/[0.1]",
                            isPersonAvatar
                              ? "w-10 h-10 rounded-full"
                              : "w-10 h-13 rounded-lg"
                          )}
                        />
                      ) : (
                        <div
                          className={cn(
                            "w-10 h-10 rounded-xl border flex items-center justify-center shrink-0",
                            meta.boxClass
                          )}
                        >
                          <KindIcon kind={n.kind} />
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className={cn(
                              "text-[13px] leading-snug",
                              n.isRead
                                ? "font-medium text-[#C8CCE0]"
                                : "font-semibold text-[#F4F3EE]"
                            )}
                          >
                            {n.title}
                          </p>
                          {!n.isRead && (
                            <span className="w-2 h-2 rounded-full bg-accent shrink-0 mt-1.5 shadow-[0_0_8px_rgb(var(--shiori-accent-rgb)/0.9)]" />
                          )}
                        </div>
                        <p className="text-xs text-[#9A9EAE] mt-0.5 leading-relaxed line-clamp-2">
                          {n.body}
                        </p>

                        <div className="mt-2 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 text-[11px] text-[#757A8E]">
                            <KindIcon kind={n.kind} />
                            <span>{tr(meta.label)}</span>
                            <span>·</span>
                            <span>{tRelativeTime(n.createdAt)}</span>
                          </div>

                          {n.kind === "FRIEND_REQUEST" && n.actorUsername && (
                            <button
                              type="button"
                              disabled={acceptingId === n.id}
                              onClick={(e) => handleQuickAcceptFriend(e, n)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/18 hover:bg-emerald-500/30 border border-emerald-400/40 text-[11px] font-semibold text-emerald-200 transition-colors cursor-pointer disabled:opacity-60"
                            >
                              {acceptingId === n.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Check className="w-3 h-3" />
                              )}
                              <span>{tr("Accepter")}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );

                  if (targetHref) {
                    return (
                      <Link
                        key={n.id}
                        href={targetHref}
                        onClick={() => {
                          markNotificationRead(n.id);
                          setOpen(false);
                        }}
                      >
                        {rowBody}
                      </Link>
                    );
                  }
                  return <div key={n.id}>{rowBody}</div>;
                })
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2.5 border-t border-white/[0.08] bg-surface-solid-header flex items-center justify-between shrink-0">
              <Link
                href="/settings"
                onClick={() => setOpen(false)}
                className="text-xs text-[#9A9EAE] hover:text-white flex items-center gap-1.5 transition-colors"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>{tr("Préférences")}</span>
              </Link>
              <Link
                href="/community?tab=activity"
                onClick={() => setOpen(false)}
                className="text-xs font-medium text-accent-hover hover:text-[#FF7A80] transition-colors"
              >
                {tr("Voir la communauté →")}
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
