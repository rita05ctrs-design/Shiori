"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
} from "lucide-react";
import { useShiori } from "@/context/ShioriContext";
import { CONTENT_LANGUAGES } from "@/lib/i18n";
import { NotificationsPopover } from "@/components/notifications/NotificationsPopover";
import { ThemeQuickPopover } from "@/components/layout/ThemeQuickPopover";
import { LanguageQuickPopover } from "@/components/layout/LanguageQuickPopover";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Accueil", icon: Home, match: (p: string) => p === "/" },
  {
    href: "/library",
    label: "Bibliothèque",
    icon: Library,
    match: (p: string) => p.startsWith("/library"),
  },
  {
    href: "/discover",
    label: "Découvrir",
    icon: Compass,
    match: (p: string) => p.startsWith("/discover") || p.startsWith("/media"),
  },
  {
    href: "/calendar",
    label: "Sorties",
    icon: CalendarDays,
    match: (p: string) => p.startsWith("/calendar") || p.startsWith("/episodes"),
  },
  {
    href: "/stats",
    label: "Stats",
    icon: BarChart3,
    match: (p: string) => p.startsWith("/stats"),
  },
  {
    href: "/community",
    label: "Communauté",
    icon: Users,
    match: (p: string) => p.startsWith("/community") || p.startsWith("/profile"),
  },
];

const MOBILE_BOTTOM_NAV = [
  { href: "/", label: "Accueil", icon: Home, match: (p: string) => p === "/" },
  {
    href: "/library",
    label: "Bibliothèque",
    icon: Library,
    match: (p: string) => p.startsWith("/library"),
  },
  {
    href: "/discover",
    label: "Découvrir",
    icon: Compass,
    match: (p: string) => p.startsWith("/discover") || p.startsWith("/media"),
  },
  {
    href: "/stats",
    label: "Stats",
    icon: BarChart3,
    match: (p: string) => p.startsWith("/stats"),
  },
  {
    href: "/community",
    label: "Communauté",
    icon: Users,
    match: (p: string) => p.startsWith("/community") || p.startsWith("/profile"),
  },
];

export function Navbar() {
  const pathname = usePathname();
  const {
    profile,
    isAuthenticated,
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
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setProfileMenuOpen(false);
  }, [pathname]);

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
            ? "bg-obsidian/90 backdrop-blur-xl border-b border-white/[0.07] shadow-[0_8px_32px_rgba(0,0,0,0.45)]"
            : "bg-gradient-to-b from-obsidian/94 via-obsidian/55 to-transparent border-b border-transparent"
        )}
      >
        <div className="max-w-[1400px] mx-auto px-3 sm:px-5 lg:px-6 h-14 sm:h-16 flex items-center justify-between gap-2 lg:gap-3">
          {/* Brand Logo: Shiori 栞 */}
          <Link href="/" className="flex items-center gap-2 sm:gap-2.5 group shrink-0 min-w-0">
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
              <span className="hidden lg:block text-[9.5px] tracking-[0.2em] text-[#8E93A4] uppercase mt-0.5">
                Anime · Manga
              </span>
            </div>
          </Link>

          {/* Primary Navigation (Desktop — 6 clear, balanced pillars) */}
          <nav
            aria-label="Navigation principale"
            className="hidden md:flex items-center gap-0.5 p-1 rounded-full bg-white/[0.03] border border-white/[0.06] min-w-0"
          >
            {NAV_ITEMS.map((item) => {
              const isActive = item.match(pathname);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative px-2 lg:px-3 py-1.5 rounded-full text-[12px] lg:text-[12.5px] font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap",
                    isActive
                      ? "text-white"
                      : "text-[#9A9EAE] hover:text-[#F4F3EE]"
                  )}
                >
                  {isActive && (
                    <motion.span
                      layoutId="shiori-nav-pill"
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                      className="absolute inset-0 rounded-full bg-white/[0.1] border border-white/[0.12] shadow-sm"
                    />
                  )}
                  <Icon className="w-3.5 h-3.5 relative z-10 opacity-85 shrink-0" />
                  <span className="relative z-10">{item.label}</span>
                  {item.href === "/library" && watchingCount > 0 && (
                    <span className="relative z-10 text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-accent/22 text-accent-soft border border-accent/35">
                      {watchingCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Right Utility Controls (4 clean actions: Search, Theme, Notifications, Profile/Menu) */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Global Search & Quick-Add Trigger */}
            <button
              type="button"
              onClick={() => setCommandOpen(true)}
              aria-label="Rechercher ou ajouter un anime ou manga"
              className="group flex items-center justify-center gap-1.5 w-8.5 h-8.5 sm:w-auto sm:h-9 sm:px-3 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.09] hover:border-white/[0.18] transition-all text-xs text-[#B8BCCB] hover:text-white cursor-pointer"
            >
              <Search className="w-3.5 h-3.5 text-accent-soft group-hover:text-white transition-colors" />
              <span className="hidden lg:inline">Rechercher</span>
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
                aria-label="Messages privés"
                title="Messages privés"
                className={cn(
                  "hidden sm:flex relative w-9 h-9 rounded-full border items-center justify-center transition-all",
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
                aria-label="Menu profil et paramètres"
                aria-expanded={profileMenuOpen}
                className="flex items-center gap-2 h-8.5 sm:h-9 px-1 sm:px-1.5 xl:pr-2.5 rounded-full bg-white/[0.045] hover:bg-white/[0.09] border border-white/[0.08] hover:border-white/[0.18] transition-all cursor-pointer"
              >
                <UserAvatar
                  avatarUrl={profile.avatarUrl}
                  initials={profile.avatarInitials}
                  accentColor={profile.accentColor}
                  alt={profile.displayName}
                  size="sm"
                  className="w-6.5 h-6.5"
                />
                <span className="hidden xl:inline text-[13px] font-medium text-[#ECEBE6] max-w-[78px] truncate">
                  {profile.displayName}
                </span>
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
                          <p className="text-sm font-semibold text-white truncate">
                            {profile.displayName}
                          </p>
                          <p className="text-xs text-[#8D92A4] truncate">
                            @{profile.username}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-[#B8BCCB]">
                        {isAuthenticated ? (
                          <>
                            <Cloud className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span>Compte connecté et sauvegardé</span>
                          </>
                        ) : (
                          <>
                            <HardDrive className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span>Mode invité · Sauvegarde locale</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Streamlined Plain-French Menu */}
                    <div className="p-2 space-y-0.5">
                      <Link
                        href={`/profile/${encodeURIComponent(profile.username)}`}
                        onClick={() => setProfileMenuOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] text-[#D8DBE5] hover:bg-white/[0.07] hover:text-white transition-colors"
                      >
                        <UserCircle2 className="w-4 h-4 text-accent" />
                        <span>Mon profil</span>
                      </Link>
                      <Link
                        href="/library?favorites=1"
                        onClick={() => setProfileMenuOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] text-[#D8DBE5] hover:bg-white/[0.07] hover:text-white transition-colors"
                      >
                        <Heart className="w-4 h-4 text-rose-400" />
                        <span>Mes favoris</span>
                        {orderedFavorites.length > 0 && (
                          <span className="ml-auto text-xs font-mono text-[#7C8194]">
                            {orderedFavorites.length}
                          </span>
                        )}
                      </Link>
                      <Link
                        href="/calendar"
                        onClick={() => setProfileMenuOpen(false)}
                        className="md:hidden flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] text-[#D8DBE5] hover:bg-white/[0.07] hover:text-white transition-colors"
                      >
                        <CalendarDays className="w-4 h-4 text-[#9A9EAE]" />
                        <span>Sorties & Calendrier</span>
                      </Link>
                      <Link
                        href="/episodes"
                        onClick={() => setProfileMenuOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] text-[#D8DBE5] hover:bg-white/[0.07] hover:text-white transition-colors"
                      >
                        <ListChecks className="w-4 h-4 text-[#9A9EAE]" />
                        <span>Épisodes de la semaine</span>
                      </Link>
                      <Link
                        href="/messages"
                        onClick={() => setProfileMenuOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] text-[#D8DBE5] hover:bg-white/[0.07] hover:text-white transition-colors"
                      >
                        <MessageSquare className="w-4 h-4 text-[#9A9EAE]" />
                        <span>Messages privés</span>
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
                        <span>Paramètres</span>
                      </Link>

                      {/* Inline Quick Preferences: Language + Ambiance */}
                      <div className="mt-1.5 pt-2 border-t border-white/[0.07] px-2.5 pb-1 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11.5px] text-[#9A9EAE] flex items-center gap-1.5">
                            <Languages className="w-3.5 h-3.5 text-accent-soft" />
                            <span>Synopsis</span>
                          </span>
                          <div className="inline-flex items-center gap-1">
                            {CONTENT_LANGUAGES.map((lang) => (
                              <button
                                key={lang.id}
                                type="button"
                                onClick={() => setContentLanguage(lang.id)}
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
                            <span>Effets d&apos;ambiance</span>
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
                            {ambiance.effect === "none" ? "Désactivés" : "Activés"}
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
                            <span>Créer un compte</span>
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
                            <span>Se connecter</span>
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
                          <span>Déconnexion</span>
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation — 5 clear, consistent tabs matching Desktop */}
      <nav
        aria-label="Navigation mobile"
        className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-obsidian/95 backdrop-blur-xl border-t border-white/[0.08] px-1 pt-1.5 pb-[calc(0.4rem+env(safe-area-inset-bottom))]"
      >
        <div className="grid grid-cols-5 items-center">
          {MOBILE_BOTTOM_NAV.map((item) => {
            const isActive = item.match(pathname);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 min-h-[44px] py-1 rounded-xl transition-colors min-w-0",
                  isActive ? "text-accent-hover bg-accent/10" : "text-[#8A8FA3]"
                )}
              >
                <Icon className="w-4.5 h-4.5 shrink-0" />
                <span className="text-[10px] font-medium truncate max-w-full px-0.5">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
