"use client";

import React from "react";
import Link from "next/link";
import {
  Sparkles,
  UserCircle2,
  BarChart3,
  Users,
  Settings,
  Heart,
  CalendarDays,
  Cloud,
  HardDrive,
} from "lucide-react";
import { useShiori } from "@/context/ShioriContext";
import { useTranslation } from "@/hooks/useTranslation";
import { ShioriAiChatPanel } from "@/components/ai/ShioriAiChatPanel";
import { UserAvatar } from "@/components/ui/UserAvatar";

export default function AssistantPage() {
  const { profile, isAuthenticated, library, orderedFavorites, openAuthModal } = useShiori();
  const { t } = useTranslation();

  const watchingCount = library.filter((e) => e.status === "WATCHING").length;
  const completedCount = library.filter((e) => e.status === "COMPLETED").length;

  return (
    <div className="pt-[calc(4.5rem+env(safe-area-inset-top))] sm:pt-24 pb-24 md:pb-16 max-w-[1100px] mx-auto px-3.5 sm:px-6 lg:px-8 space-y-4 sm:space-y-6">
      {/* Compact Profile & Quick-Access Hub (streamlined for mobile Profil/IA tab & desktop) */}
      <section className="rounded-2xl card-surface border border-white/[0.09] p-3.5 sm:p-5 space-y-3 sm:space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <UserAvatar
              avatarUrl={profile.avatarUrl}
              initials={profile.avatarInitials}
              accentColor={profile.accentColor}
              alt={profile.displayName}
              size="md"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-xl font-bold text-[#F4F3EE] truncate">
                  {profile.displayName}
                </h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/[0.05] border border-white/[0.08] text-[10.5px] text-[#B8BCCB]">
                  {isAuthenticated ? (
                    <>
                      <Cloud className="w-3 h-3 text-emerald-400" />
                      <span>{t("nav.cloudSync")}</span>
                    </>
                  ) : (
                    <>
                      <HardDrive className="w-3 h-3 text-kinpaku" />
                      <span>{t("nav.localMode")}</span>
                    </>
                  )}
                </span>
              </div>
              <p className="text-xs text-[#8A8FA4] font-mono mt-0.5">
                @{profile.username} · {watchingCount} {t("home.inProgress").toLowerCase()} ·{" "}
                {completedCount} {t("home.completed").toLowerCase()} · {orderedFavorites.length}{" "}
                {t("nav.favorites").toLowerCase()}
              </p>
            </div>
          </div>

          {!isAuthenticated && (
            <button
              type="button"
              onClick={() => openAuthModal("signin")}
              className="px-4 py-2 rounded-full bg-accent hover:bg-accent-hover text-accent-fg text-xs font-semibold transition-colors cursor-pointer self-start sm:self-auto"
            >
              {t("nav.signIn")}
            </button>
          )}
        </div>

        {/* Quick Navigation Pills for Profile, Stats, Community, Calendar, Settings */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
          <Link
            href={`/profile/${encodeURIComponent(profile.username)}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.05] hover:bg-white/[0.11] border border-white/[0.09] text-xs font-medium text-[#E8E9F0] whitespace-nowrap transition-colors"
          >
            <UserCircle2 className="w-3.5 h-3.5 text-accent" />
            <span>{t("nav.myProfile")}</span>
          </Link>
          <Link
            href="/library?favorites=1"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.05] hover:bg-white/[0.11] border border-white/[0.09] text-xs font-medium text-[#E8E9F0] whitespace-nowrap transition-colors"
          >
            <Heart className="w-3.5 h-3.5 text-rose-400" />
            <span>
              {t("nav.favorites")} ({orderedFavorites.length})
            </span>
          </Link>
          <Link
            href="/stats"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.05] hover:bg-white/[0.11] border border-white/[0.09] text-xs font-medium text-[#E8E9F0] whitespace-nowrap transition-colors"
          >
            <BarChart3 className="w-3.5 h-3.5 text-kinpaku" />
            <span>{t("nav.stats")}</span>
          </Link>
          <Link
            href="/community"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.05] hover:bg-white/[0.11] border border-white/[0.09] text-xs font-medium text-[#E8E9F0] whitespace-nowrap transition-colors"
          >
            <Users className="w-3.5 h-3.5 text-sky-400" />
            <span>{t("nav.community")}</span>
          </Link>
          <Link
            href="/calendar"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.05] hover:bg-white/[0.11] border border-white/[0.09] text-xs font-medium text-[#E8E9F0] whitespace-nowrap transition-colors"
          >
            <CalendarDays className="w-3.5 h-3.5 text-emerald-400" />
            <span>{t("nav.releases")}</span>
          </Link>
          <Link
            href="/settings"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.05] hover:bg-white/[0.11] border border-white/[0.09] text-xs font-medium text-[#E8E9F0] whitespace-nowrap transition-colors"
          >
            <Settings className="w-3.5 h-3.5 text-[#9A9EAE]" />
            <span>{t("nav.settings")}</span>
          </Link>
        </div>
      </section>

      {/* Main Conversational AI Assistant */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-accent flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{t("ai.eyebrow")}</span>
            </p>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-gradient-editorial mt-0.5">
              {t("ai.pageTitle")}
            </h2>
          </div>
        </div>

        <ShioriAiChatPanel />
      </section>
    </div>
  );
}
