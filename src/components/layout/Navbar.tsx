"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Compass,
  Library,
  CalendarDays,
  BarChart3,
  Search,
  Home,
  Settings,
  LogOut,
  Cloud,
  HardDrive,
  Sparkles,
  User,
  Flower2,
  ListChecks,
  Users,
  MessageSquare,
  UserCircle2,
  Heart,
  Languages,
  Crown,
  Lightbulb,
} from "lucide-react";
import { useShiori } from "@/context/ShioriContext";
import { useTranslation } from "@/hooks/useTranslation";
import { CONTENT_LANGUAGES } from "@/lib/i18n";
import type { UiMessageKey } from "@/lib/ui-translations";
import { NotificationsPopover } from "@/components/notifications/NotificationsPopover";
import { ThemeQuickPopover } from "@/components/layout/ThemeQuickPopover";
import { LanguageQuickPopover } from "@/components/layout/LanguageQuickPopover";
import { QuickEpisodesPopover } from "@/components/episodes/QuickEpisodesPopover";
import { GlobalAnnouncementBanner } from "@/components/layout/GlobalAnnouncementBanner";
import { RoleBadge } from "@/components/ui/RoleBadge";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { cn } from "@/lib/utils";

const NAV_ITEMS: {
  href: string;
  labelKey: UiMessageKey;
  icon: typeof Home;
  match: (p: string) => boolean;
}[] = [
  { href: "/", labelKey: "nav.home", icon: Home, match: (p: string) => p === "/" },
  {
    href: "/library",
    labelKey: "nav.library",
    icon: Library,
    match: (p: string) => p.startsWith("/library"),
  },
  {
    href: "/discover",
    labelKey: "nav.discover",
    icon: Compass,
    match: (p: string) =>
      p.startsWith("/discover") || p.startsWith("/media") || p.startsWith("/anime"),
  },
  {
    href: "/calendar",
    labelKey: "nav.releases",
    icon: CalendarDays,
    match: (p: string) => p.startsWith("/calendar") || p.startsWith("/episodes"),
  },
  {
    href: "/stats",
    labelKey: "nav.stats",
    icon: BarChart3,
    match: (p: string) => p.startsWith("/stats"),
  },
  {
    href: "/community",
    labelKey: "nav.community",
    icon: Users,
    match: (p: string) => p.startsWith("/community") || p.startsWith("/profile"),
  },
];

const MOBILE_BOTTOM_NAV: {
  href: string;
  labelKey: UiMessageKey;
  icon: typeof Home;
  match: (p: string) => boolean;
}[] = [
  {
    href: "/",
    labelKey: "nav.home",
    icon: Home,
    match: (p: string) => p === "/",
  },
  {
    href: "/episodes",
    labelKey: "nav.week",
    icon: ListChecks,
    match: (p: string) => p.startsWith("/episodes") || p.startsWith("/calendar"),
  },
  {
    href: "/library",
    labelKey: "nav.myList",
    icon: Library,
    match: (p: string) => p.startsWith("/library"),
  },
  {
    href: "/discover",
    labelKey: "nav.discover",
    icon: Compass,
    match: (p: string) =>
      p.startsWith("/discover") || p.startsWith("/media") || p.startsWith("/anime"),
  },
  {
    href: "/community",
    labelKey: "nav.community",
    icon: Users,
    match: (p: string) =>
      p.startsWith("/community") ||
      p.startsWith("/profile") ||
      p.startsWith("/messages"),
  },
  {
    href: "/assistant",
    labelKey: "nav.profileAi",
    icon: Sparkles,
    match: (p: string) => p.startsWith("/assistant"),
  },
];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { t, tr } = useTranslation();
  const {
    profile,
    isAuthenticated,
    isCreator,
    library,
    orderedFavorites,
    ambiance,
    updateAmbiance,
    unreadMessagesCount,
    contentLanguage,
    setContentLanguage,
    setCommandOpen,
    openAuthModal,
    signOutSupabase,
  } = useShiori();

  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [pendingMobileHref, setPendingMobileHref] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setProfileMenuOpen(false);
    setPendingMobileHref(null);
  }, [pathname]);

  // Safety fallback: clear optimistic mobile tab state if navigation is cancelled or identical
  useEffect(() => {
    if (!pendingMobileHref) return;
    const timer = window.setTimeout(() => setPendingMobileHref(null), 2500);
    return () => window.clearTimeout(timer);
  }, [pendingMobileHref]);

  // Eagerly warm Next.js Router Cache for all 6 mobile bottom tabs so tapping is immediate
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(max-width: 767px)").matches) return;
    const timer = window.setTimeout(() => {
      for (const item of MOBILE_BOTTOM_NAV) {
        if (!item.match(pathname)) {
          router.prefetch(item.href);
        }
      }
    }, 150);
    return () => window.clearTimeout(timer);
  }, [pathname, router]);

  // Keep browser tab <title> synced with the active UI language across every route
  useEffect(() => {
    if (typeof document === "undefined") return;
    const applyTitle = () => {
      if (pathname.startsWith("/library")) {
        document.title = `${t("nav.library")} | Shiori`;
      } else if (pathname.startsWith("/discover")) {
        document.title = `${t("nav.discover")} | Shiori`;
      } else if (pathname.startsWith("/calendar")) {
        document.title = `${t("nav.releases")} | Shiori`;
      } else if (pathname.startsWith("/episodes")) {
        document.title = `${t("episodes.title")} | Shiori`;
      } else if (pathname.startsWith("/stats")) {
        document.title = `${t("stats.title")} | Shiori`;
      } else if (pathname.startsWith("/community")) {
        document.title = `${t("nav.community")} | Shiori`;
      } else if (pathname.startsWith("/assistant")) {
        document.title = `${t("ai.pageTitle")} | Shiori`;
      } else if (pathname.startsWith("/messages")) {
        document.title = `${t("nav.messages")} | Shiori`;
      } else if (pathname.startsWith("/support")) {
        document.title = `${tr("Soutenir Shiori")} | Shiori`;
      } else if (pathname.startsWith("/admin")) {
        document.title = `${tr("Espace Créateur")} | Shiori`;
      } else if (pathname === "/") {
        document.title = `Shiori — ${tr("Suivi Anime & Manga")}`;
      }
    };
    applyTitle();
    const timer = window.setTimeout(applyTitle, 120);
    return () => window.clearTimeout(timer);
  }, [pathname, contentLanguage, t, tr]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 18);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setProfileMenuOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const watchingCount = library.filter((e) => e.status === "WATCHING").length;

  return (
    <>
      <header
        className={cn(
          "fixed top-0 inset-x-0 z-50 transition-all duration-300 pt-[env(safe-area-inset-top)]",
          scrolled
            ? "bg-obsidian/92 backdrop-blur-md border-b border-white/[0.09] shadow-[0_10px_28px_rgba(0,0,0,0.48),inset_0_-1px_0_rgba(255,255,255,0.04)]"
            : "bg-gradient-to-b from-obsidian/94 via-obsidian/55 to-transparent border-b border-transparent"
        )}
      >
        <div className="max-w-[1400px] mx-auto px-3 sm:px-5 lg:px-6 h-14 sm:h-16 flex items-center justify-between gap-2 lg:gap-3">
          {/* Brand Logo: Shiori 栞 */}
          <Link
            href="/"
            className="flex items-center gap-2 sm:gap-2.5 group shrink-0 min-w-0"
          >
            <motion.div
              whileHover={{ rotate: -4, scale: 1.07 }}
              whileTap={{ scale: 0.94 }}
              transition={{ type: "spring", stiffness: 360, damping: 20 }}
              className="relative w-7 h-8 sm:w-8 sm:h-9 flex items-center justify-center shrink-0"
            >
              <svg
                viewBox="0 0 32 36"
                fill="none"
                className="w-6 h-7 sm:w-7 sm:h-8"
                style={{
                  filter: "drop-shadow(0 0 12px rgb(var(--shiori-accent-rgb) / 0.45))",
                }}
              >
                <path
                  d="M5 4C5 2.34315 6.34315 1 8 1H24C25.6569 1 27 2.34315 27 4V33.5L16 26.2L5 33.5V4Z"
                  fill="url(#shioriRibbon)"
                />
                <path
                  d="M5.75 4C5.75 2.75736 6.75736 1.75 8 1.75H24C25.2426 1.75 26.25 2.75736 26.25 4V32.1L16.415 25.575L16 25.3L15.585 25.575L5.75 32.1V4Z"
                  stroke="rgba(255,255,255,0.22)"
                  strokeWidth="1.2"
                />
                <text
                  x="16"
                  y="18.5"
                  textAnchor="middle"
                  fill="var(--shiori-accent-fg)"
                  fontSize="12"
                  fontFamily="serif"
                  fontWeight="600"
                >
                  栞
                </text>
                <defs>
                  <linearGradient
                    id="shioriRibbon"
                    x1="5"
                    y1="1"
                    x2="27"
                    y2="34"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop stopColor="var(--shiori-accent-hover)" />
                    <stop offset="1" stopColor="var(--shiori-accent-deep)" />
                  </linearGradient>
                </defs>
              </svg>
            </motion.div>
            <div className="flex flex-col leading-none">
              <span className="text-[15px] sm:text-[17px] font-semibold tracking-[0.14em] text-[#F4F3EE] uppercase">
                Shiori
              </span>
              <span className="hidden 2xl:block text-[9.5px] tracking-[0.2em] text-[#8E93A4] uppercase mt-0.5">
                Anime · Manga
              </span>
            </div>
          </Link>

          {/* Primary Navigation (Desktop — adapts cleanly across narrow/windowed and wide screens) */}
          <nav
            aria-label={tr("Navigation principale")}
            className="hidden md:flex items-center gap-0.5 p-1 rounded-full bg-white/[0.03] border border-white/[0.06] min-w-0 max-w-full overflow-x-auto no-scrollbar"
          >
            {NAV_ITEMS.map((item) => {
              const isActive = item.match(pathname);
              const Icon = item.icon;
              const label = t(item.labelKey);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={label}
                  aria-label={label}
                  className={cn(
                    "relative px-2.5 lg:px-2 xl:px-3 py-1.5 rounded-full text-[11.5px] xl:text-[12.5px] font-medium transition-colors flex items-center gap-1 xl:gap-1.5 whitespace-nowrap shrink-0",
                    isActive
                      ? "text-white"
                      : "text-[#9A9EAE] hover:text-[#F4F3EE]"
                  )}
                >
                  {isActive && (
                    <motion.span
                      layoutId="shiori-nav-pill"
                      transition={{ type: "spring", stiffness: 420, damping: 32 }}
                      className="absolute inset-0 rounded-full bg-gradient-to-b from-white/[0.14] to-white/[0.07] border border-white/[0.16] shadow-[0_4px_16px_rgb(var(--shiori-accent-rgb)/0.18),inset_0_1px_0_rgba(255,255,255,0.16)]"
                    />
                  )}
                  <Icon className="w-3.5 h-3.5 relative z-10 opacity-85 shrink-0" />
                  <span className="hidden lg:inline relative z-10">{label}</span>
                  {item.href === "/library" && watchingCount > 0 && (
                    <span className="hidden xl:inline-flex relative z-10 text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-accent/22 text-accent-soft border border-accent/35">
                      {watchingCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Right Utility Controls */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {/* PC Quick Access: Épisodes de la semaine / À voir (mobile has Semaine right in the bottom dock) */}
            <div className="hidden sm:block">
              <QuickEpisodesPopover />
            </div>

            {/* Global Search & Quick-Add Trigger */}
            <button
              type="button"
              onClick={() => setCommandOpen(true)}
              aria-label={t("nav.search")}
              title={`${t("nav.search")} (⌘K)`}
              className="group flex items-center justify-center gap-1.5 w-8.5 h-8.5 sm:w-9 sm:h-9 xl:w-auto xl:px-3 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.09] hover:border-white/[0.18] transition-[transform,background-color,border-color,color] duration-200 hover:-translate-y-0.5 active:scale-95 text-xs text-[#B8BCCB] hover:text-white cursor-pointer"
            >
              <Search className="w-3.5 h-3.5 text-accent-soft group-hover:text-white group-hover:rotate-[-10deg] group-hover:scale-110 transition-transform duration-200" />
              <span className="hidden 2xl:inline">{t("nav.search")}</span>
              <kbd className="hidden xl:inline-flex items-center px-1.5 py-0.5 rounded bg-white/[0.07] text-[10px] font-mono text-[#9EA3B5] border border-white/[0.08]">
                ⌘K
              </kbd>
            </button>

            {/* Quick Theme Customizer (Desktop & Mobile — 2 taps anywhere) */}
            <ThemeQuickPopover />

            {/* Synopsis Content Language Selector (FR / EN / ES / IT) */}
            <LanguageQuickPopover />

            {/* Private Messages Shortcut (shown in top bar when authenticated) */}
            {isAuthenticated && (
              <Link
                href="/messages"
                aria-label={t("nav.messages")}
                title={t("nav.messages")}
                className={cn(
                  "hidden sm:flex relative w-9 h-9 rounded-full border items-center justify-center transition-[transform,background-color,border-color,color] duration-200 hover:-translate-y-0.5 active:scale-95",
                  pathname.startsWith("/messages")
                    ? "bg-accent/20 border-accent/55 text-white"
                    : "bg-white/[0.045] hover:bg-white/[0.09] border-white/[0.08] hover:border-white/[0.18] text-[#B8BCCB] hover:text-white"
                )}
              >
                <MessageSquare className="w-4 h-4" />
                {unreadMessagesCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] px-1 rounded-full bg-accent text-[10px] font-bold text-accent-fg flex items-center justify-center">
                    {unreadMessagesCount > 9 ? "9+" : unreadMessagesCount}
                  </span>
                )}
              </Link>
            )}

            {/* Notifications Bell Popover */}
            <NotificationsPopover />

            {/* Unified Profile & Account Dropdown (Desktop & Mobile) */}
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setProfileMenuOpen((v) => !v)}
                aria-label={tr("Menu profil et paramètres")}
                aria-expanded={profileMenuOpen}
                className={cn(
                  "flex items-center gap-2 h-8.5 sm:h-9 px-1 sm:px-1.5 xl:pr-2.5 rounded-full transition-[transform,background-color,border-color] duration-200 hover:-translate-y-0.5 active:scale-95 cursor-pointer border",
                  isCreator
                    ? "bg-[#F0B95B]/10 hover:bg-[#F0B95B]/18 border-[#F0B95B]/45 hover:border-[#F0B95B]/70"
                    : "bg-white/[0.045] hover:bg-white/[0.09] border-white/[0.08] hover:border-white/[0.18]"
                )}
              >
                <UserAvatar
                  avatarUrl={profile.avatarUrl}
                  initials={profile.avatarInitials}
                  accentColor={profile.accentColor}
                  alt={profile.displayName}
                  size="sm"
                  className="w-6.5 h-6.5"
                />
                <span className="hidden 2xl:inline text-[13px] font-medium text-[#ECEBE6] max-w-[78px] truncate">
                  {profile.displayName}
                </span>
                <RoleBadge
                  role={profile.role}
                  size="xs"
                  className="hidden xl:inline-flex"
                />
              </button>

              <AnimatePresence>
                {profileMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.97 }}
                    transition={{ duration: 0.16 }}
                    className="fixed inset-x-3 top-[calc(4rem+env(safe-area-inset-top))] sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2.5 sm:w-72 max-h-[calc(100dvh-6rem-env(safe-area-inset-top))] overflow-y-auto overscroll-contain rounded-2xl bg-surface-solid border border-white/[0.13] shadow-[0_28px_72px_rgba(0,0,0,0.92)] z-50"
                  >
                    {/* User Identity Summary */}
                    <div className="p-4 border-b border-white/[0.08] bg-surface-solid-header">
                      <div className="flex items-center gap-3">
                        <UserAvatar
                          avatarUrl={profile.avatarUrl}
                          initials={profile.avatarInitials}
                          accentColor={profile.accentColor}
                          alt={profile.displayName}
                          size="md"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-sm font-semibold text-white truncate">
                              {profile.displayName}
                            </p>
                            <RoleBadge role={profile.role} size="xs" />
                          </div>
                          <p className="text-xs text-[#8D92A4] truncate">
                            @{profile.username}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-[#B8BCCB]">
                        {isAuthenticated ? (
                          <>
                            <Cloud className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span>{t("nav.cloudSync")}</span>
                          </>
                        ) : (
                          <>
                            <HardDrive className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span>{t("nav.localMode")}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Streamlined Localized Profile Menu */}
                    <div className="p-2 space-y-0.5">
                      {isCreator && (
                        <Link
                          href="/admin"
                          onClick={() => setProfileMenuOpen(false)}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-semibold text-[#FDE68A] bg-[#F0B95B]/14 hover:bg-[#F0B95B]/22 border border-[#F0B95B]/40 transition-colors mb-1"
                        >
                          <Crown className="w-4 h-4 text-[#F0B95B]" />
                          <span>{tr("Espace Créateur")}</span>
                        </Link>
                      )}
                      <Link
                        href={`/profile/${encodeURIComponent(profile.username)}`}
                        onClick={() => setProfileMenuOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] text-[#D8DBE5] hover:bg-white/[0.07] hover:text-white transition-colors"
                      >
                        <UserCircle2 className="w-4 h-4 text-accent" />
                        <span>{t("nav.myProfile")}</span>
                      </Link>
                      <Link
                        href="/library?favorites=1"
                        onClick={() => setProfileMenuOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] text-[#D8DBE5] hover:bg-white/[0.07] hover:text-white transition-colors"
                      >
                        <Heart className="w-4 h-4 text-rose-400" />
                        <span>{t("footer.myFavorites")}</span>
                        {orderedFavorites.length > 0 && (
                          <span className="ml-auto text-xs font-mono text-[#7C8194]">
                            {orderedFavorites.length}
                          </span>
                        )}
                      </Link>
                      <Link
                        href="/community"
                        onClick={() => setProfileMenuOpen(false)}
                        className="md:hidden flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] text-[#D8DBE5] hover:bg-white/[0.07] hover:text-white transition-colors"
                      >
                        <Users className="w-4 h-4 text-sky-400" />
                        <span>{t("nav.community")}</span>
                      </Link>
                      <Link
                        href="/stats"
                        onClick={() => setProfileMenuOpen(false)}
                        className="md:hidden flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] text-[#D8DBE5] hover:bg-white/[0.07] hover:text-white transition-colors"
                      >
                        <BarChart3 className="w-4 h-4 text-kinpaku" />
                        <span>{t("nav.stats")}</span>
                      </Link>
                      <Link
                        href="/calendar"
                        onClick={() => setProfileMenuOpen(false)}
                        className="md:hidden flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] text-[#D8DBE5] hover:bg-white/[0.07] hover:text-white transition-colors"
                      >
                        <CalendarDays className="w-4 h-4 text-[#9A9EAE]" />
                        <span>{t("footer.releasesCalendar")}</span>
                      </Link>
                      <Link
                        href="/episodes"
                        onClick={() => setProfileMenuOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] text-[#D8DBE5] hover:bg-white/[0.07] hover:text-white transition-colors"
                      >
                        <ListChecks className="w-4 h-4 text-[#9A9EAE]" />
                        <span>{t("episodes.title")}</span>
                      </Link>
                      <Link
                        href="/assistant"
                        onClick={() => setProfileMenuOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] text-[#D8DBE5] hover:bg-white/[0.07] hover:text-white transition-colors"
                      >
                        <Sparkles className="w-4 h-4 text-kinpaku" />
                        <span>{t("ai.pageTitle")}</span>
                      </Link>
                      <Link
                        href="/messages"
                        onClick={() => setProfileMenuOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] text-[#D8DBE5] hover:bg-white/[0.07] hover:text-white transition-colors"
                      >
                        <MessageSquare className="w-4 h-4 text-[#9A9EAE]" />
                        <span>{t("nav.messages")}</span>
                        {unreadMessagesCount > 0 && (
                          <span className="ml-auto px-1.5 py-0.5 rounded-full bg-accent text-accent-fg text-[10px] font-mono font-bold">
                            {unreadMessagesCount}
                          </span>
                        )}
                      </Link>
                      <Link
                        href="/settings"
                        onClick={() => setProfileMenuOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] text-[#D8DBE5] hover:bg-white/[0.07] hover:text-white transition-colors"
                      >
                        <Settings className="w-4 h-4 text-[#9A9EAE]" />
                        <span>{t("nav.settings")}</span>
                      </Link>
                      <Link
                        href="/support#suggestions"
                        onClick={() => setProfileMenuOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] text-[#D8DBE5] hover:bg-white/[0.07] hover:text-white transition-colors"
                      >
                        <Lightbulb className="w-4 h-4 text-kinpaku" />
                        <span>{tr("Proposer une idée")}</span>
                      </Link>
                      <Link
                        href="/support"
                        onClick={() => setProfileMenuOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] text-[#FDE68A] hover:bg-[#F0B95B]/12 transition-colors"
                      >
                        <Heart className="w-4 h-4 text-[#F0B95B]" />
                        <span>{tr("Soutenir Shiori")}</span>
                      </Link>

                      {/* Inline Quick Preferences: Language (7 languages) + Ambiance */}
                      <div className="mt-1.5 pt-2 border-t border-white/[0.07] px-2.5 pb-1 space-y-2.5">
                        <div className="space-y-1.5">
                          <span className="text-[11.5px] text-[#9A9EAE] flex items-center gap-1.5">
                            <Languages className="w-3.5 h-3.5 text-accent-soft" />
                            <span>{t("nav.appLanguage")}</span>
                          </span>
                          <div className="flex flex-wrap items-center gap-1">
                            {CONTENT_LANGUAGES.map((lang) => (
                              <button
                                key={lang.id}
                                type="button"
                                onClick={() => setContentLanguage(lang.id)}
                                title={lang.label}
                                className={cn(
                                  "px-2 py-0.5 rounded-md font-mono text-[10.5px] font-bold transition-colors cursor-pointer",
                                  contentLanguage === lang.id
                                    ? "bg-accent text-accent-fg"
                                    : "bg-white/[0.05] text-[#9A9EAE] hover:text-white"
                                )}
                              >
                                {lang.code}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11.5px] text-[#9A9EAE] flex items-center gap-1.5">
                            <Flower2 className="w-3.5 h-3.5 text-accent-soft" />
                            <span>{t("nav.petals")}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              updateAmbiance({
                                effect: ambiance.effect === "none" ? "sakura" : "none",
                              })
                            }
                            className={cn(
                              "px-2.5 py-0.5 rounded-md text-[10.5px] font-semibold border transition-colors cursor-pointer",
                              ambiance.effect === "none"
                                ? "bg-white/[0.05] border-white/[0.1] text-[#8E93A6] hover:text-white"
                                : "bg-accent/18 border-accent/40 text-accent-soft"
                            )}
                          >
                            {ambiance.effect === "none" ? t("nav.petalsOff") : t("nav.petalsOn")}
                          </button>
                        </div>
                      </div>

                      {/* Account Action */}
                      {!isAuthenticated ? (
                        <div className="mt-1.5 pt-2 border-t border-white/[0.07] space-y-1">
                          <button
                            type="button"
                            onClick={() => {
                              setProfileMenuOpen(false);
                              openAuthModal("signup");
                            }}
                            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-[13px] font-semibold text-accent-fg bg-accent hover:bg-accent-hover transition-colors cursor-pointer"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>{t("auth.signUpTitle")}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setProfileMenuOpen(false);
                              openAuthModal("signin");
                            }}
                            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-[13px] text-[#D8DBE5] hover:bg-white/[0.07] hover:text-white transition-colors cursor-pointer"
                          >
                            <User className="w-3.5 h-3.5 text-[#9A9EAE]" />
                            <span>{t("nav.signIn")}</span>
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setProfileMenuOpen(false);
                            void signOutSupabase();
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer mt-1.5 border-t border-white/[0.07] pt-2.5"
                        >
                          <LogOut className="w-4 h-4" />
                          <span>{t("nav.signOut")}</span>
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
        <GlobalAnnouncementBanner />
      </header>

      {/* Mobile Floating Frosted-Glass Dock — 6 crisp tabs with zero-latency tap feedback */}
      <nav
        aria-label="Mobile navigation"
        data-mobile-bottom-nav="true"
        className="md:hidden fixed bottom-0 inset-x-0 z-50 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-1 pointer-events-none select-none touch-manipulation"
      >
        <div className="pointer-events-auto relative rounded-2xl bg-[#0B0D16]/94 backdrop-blur-md border border-white/[0.11] shadow-[0_14px_34px_rgba(0,0,0,0.78),inset_0_1px_0_rgba(255,255,255,0.1)] p-1">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-accent/65 to-transparent"
          />
          <div className="grid grid-cols-6 items-center gap-0">
            {MOBILE_BOTTOM_NAV.map((item) => {
              const matchedNow = item.match(pathname);
              const isActive =
                pendingMobileHref !== null
                  ? pendingMobileHref === item.href
                  : matchedNow;
              const Icon = item.icon;
              const label = t(item.labelKey);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={true}
                  onPointerDown={() => {
                    if (!matchedNow) {
                      router.prefetch(item.href);
                    }
                  }}
                  onClick={() => {
                    if (!matchedNow) {
                      setPendingMobileHref(item.href);
                    }
                  }}
                  className={cn(
                    "relative flex flex-col items-center justify-center gap-0.5 min-h-[48px] py-1 px-0 rounded-xl touch-manipulation select-none [-webkit-tap-highlight-color:transparent] transition-[transform,color,background-color] duration-100 active:scale-[0.92] active:bg-white/[0.08] min-w-0",
                    isActive ? "text-white" : "text-[#8A8FA3] hover:text-[#CFD3E2]"
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "pointer-events-none absolute inset-0.5 rounded-xl bg-gradient-to-b from-accent/25 to-accent/10 border border-accent/40 shadow-[0_4px_16px_rgb(var(--shiori-accent-rgb)/0.28)] transition-[opacity,transform] duration-120 ease-out",
                      isActive ? "opacity-100 scale-100" : "opacity-0 scale-95"
                    )}
                  />
                  <div
                    className={cn(
                      "relative z-10 transition-transform duration-120 ease-out",
                      isActive ? "-translate-y-0.5 scale-[1.08]" : "translate-y-0 scale-100"
                    )}
                  >
                    <Icon
                      className={cn(
                        "w-[17px] h-[17px] shrink-0 transition-colors duration-100",
                        isActive &&
                          "text-accent-soft drop-shadow-[0_0_8px_rgb(var(--shiori-accent-rgb)/0.65)]"
                      )}
                    />
                    {item.href === "/library" && watchingCount > 0 && (
                      <span className="absolute -top-1.5 -right-2.5 min-w-[15px] h-[15px] px-1 rounded-full bg-accent text-[9px] font-mono font-bold text-accent-fg flex items-center justify-center shadow-sm">
                        {watchingCount > 9 ? "9+" : watchingCount}
                      </span>
                    )}
                  </div>
                  <span
                    className={cn(
                      "relative z-10 text-[8px] min-[390px]:text-[8.5px] font-semibold tracking-[-0.025em] whitespace-nowrap truncate max-w-full leading-tight",
                      isActive ? "text-white" : "text-[#8A8FA3]"
                    )}
                  >
                    {label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </>
  );
}
