"use client";

import React, { useState, useRef, useEffect } from "react";
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
} from "lucide-react";
import { useShiori } from "@/context/ShioriContext";
import { cn, formatRelativeTime } from "@/lib/utils";
import type { ShioriNotification } from "@/types/media";

function KindIcon({ kind }: { kind: ShioriNotification["kind"] }) {
  switch (kind) {
    case "AIRING":
      return <Tv className="w-3.5 h-3.5 text-sky-400" />;
    case "MILESTONE":
      return <Trophy className="w-3.5 h-3.5 text-[#F0B95B]" />;
    case "RECOMMENDATION":
      return <Sparkles className="w-3.5 h-3.5 text-[#F45B62]" />;
    default:
      return <Info className="w-3.5 h-3.5 text-[#9A9EAE]" />;
  }
}

export function NotificationsPopover() {
  const {
    notifications,
    unreadCount,
    markNotificationRead,
    markAllNotificationsRead,
    clearNotifications,
  } = useShiori();
  const [open, setOpen] = useState(false);
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

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        className="relative w-9 h-9 rounded-full flex items-center justify-center bg-white/[0.045] hover:bg-white/[0.09] border border-white/[0.08] hover:border-white/[0.16] text-[#B2B6C6] hover:text-white transition-all cursor-pointer"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] px-1 rounded-full bg-[#E5484D] text-[10px] font-bold text-white flex items-center justify-center shadow-[0_0_10px_rgba(229,72,77,0.8)]">
            {unreadCount > 9 ? "9+" : unreadCount}
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
            className="absolute right-0 mt-2.5 w-[350px] sm:w-[390px] rounded-2xl glass-panel shadow-[0_24px_64px_rgba(0,0,0,0.72)] overflow-hidden"
          >
            {/* Header */}
            <div className="px-4 py-3.5 border-b border-white/[0.07] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white">Notifications</span>
                {unreadCount > 0 && (
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#E5484D]/15 text-[#FF8A8E] border border-[#E5484D]/30">
                    {unreadCount} non lue{unreadCount > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllNotificationsRead}
                    title="Tout marquer comme lu"
                    className="p-1.5 rounded-lg text-[#9A9EAE] hover:text-white hover:bg-white/[0.07] transition-colors cursor-pointer"
                  >
                    <CheckCheck className="w-4 h-4" />
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    type="button"
                    onClick={clearNotifications}
                    title="Effacer tout"
                    className="p-1.5 rounded-lg text-[#9A9EAE] hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* List */}
            <div className="max-h-[380px] overflow-y-auto divide-y divide-white/[0.05]">
              {notifications.length === 0 ? (
                <div className="py-12 px-6 text-center">
                  <Bell className="w-8 h-8 text-[#4F5466] mx-auto mb-2.5" />
                  <p className="text-sm font-medium text-[#C5C8D6]">Tout est à jour</p>
                  <p className="text-xs text-[#797E92] mt-1">
                    Vos alertes de diffusion et paliers apparaîtront ici.
                  </p>
                </div>
              ) : (
                notifications.map((n) => {
                  const content = (
                    <div
                      onClick={() => markNotificationRead(n.id)}
                      className={cn(
                        "p-3.5 flex gap-3 hover:bg-white/[0.045] transition-colors cursor-pointer",
                        !n.isRead && "bg-[#E5484D]/[0.04]"
                      )}
                    >
                      {n.coverImage ? (
                        <img
                          src={n.coverImage}
                          alt=""
                          className="w-10 h-14 rounded-lg object-cover shrink-0 border border-white/[0.08]"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center shrink-0">
                          <KindIcon kind={n.kind} />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-[13px] font-medium text-[#F4F3EE] leading-snug">
                            {n.title}
                          </p>
                          {!n.isRead && (
                            <span className="w-2 h-2 rounded-full bg-[#E5484D] shrink-0 mt-1.5" />
                          )}
                        </div>
                        <p className="text-xs text-[#9A9EAE] mt-1 leading-relaxed line-clamp-2">
                          {n.body}
                        </p>
                        <div className="mt-1.5 flex items-center gap-2 text-[11px] text-[#6E7387]">
                          <KindIcon kind={n.kind} />
                          <span>{formatRelativeTime(n.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  );

                  if (n.mediaId) {
                    return (
                      <Link
                        key={n.id}
                        href={`/media/${n.mediaId}`}
                        onClick={() => {
                          markNotificationRead(n.id);
                          setOpen(false);
                        }}
                      >
                        {content}
                      </Link>
                    );
                  }
                  return <div key={n.id}>{content}</div>;
                })
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2.5 border-t border-white/[0.07] bg-white/[0.02] flex items-center justify-between">
              <Link
                href="/settings"
                onClick={() => setOpen(false)}
                className="text-xs text-[#9A9EAE] hover:text-white flex items-center gap-1.5 transition-colors"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Préférences d&apos;alertes</span>
              </Link>
              <Link
                href="/calendar"
                onClick={() => setOpen(false)}
                className="text-xs font-medium text-[#F45B62] hover:text-[#FF7A80] transition-colors"
              >
                Voir le calendrier →
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
