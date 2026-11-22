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
  ArrowLeftRight,
  ListChecks,
  Users,
  MessageSquare,
  UserCircle2,
  Mic2,
  Download,
  Menu,
  X,
  Palette,
  Languages,
} from "lucide-react";
import { useShiori } from "@/context/ShioriContext";
import { CONTENT_LANGUAGES } from "@/lib/i18n";
import { usePwaInstall } from "@/components/pwa/PwaRegistrar";
import { AMBIANCE_OPTIONS } from "@/components/settings/AmbianceSettingsCard";
import { NotificationsPopover } from "@/components/notifications/NotificationsPopover";
import { ThemeQuickPopover } from "@/components/layout/ThemeQuickPopover";
import { LanguageQuickPopover } from "@/components/layout/LanguageQuickPopover";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Accueil", icon: Home },
  { href: "/discover", label: "Découvrir", icon: Compass },
  { href: "/library", label: "Bibliothèque", icon: Library },
  { href: "/episodes", label: "Épisodes", icon: ListChecks },
  { href: "/calendar", label: "Calendrier", icon: CalendarDays },
  { href: "/community", label: "Communauté", icon: Users },
  { href: "/stats", label: "Stats", icon: BarChart3 },
];

const MOBILE_BOTTOM_NAV = [
  { href: "/", label: "Accueil", icon: Home },
  { href: "/discover", label: "Découvrir", icon: Compass },
  { href: "/library", label: "Biblio", icon: Library },
  { href: "/community", label: "Social", icon: Users },
  { href: "/calendar", label: "Agenda", icon: CalendarDays },
];

export function Navbar() {
  const pathname = usePathname();
  const {
    profile,
    isAuthenticated,
    library,
    ambiance,
    updateAmbiance,
    anilistConnection,
    unreadMessagesCount,
    contentLanguage,
    setContentLanguage,
    setCommandOpen,
    openAuthModal,
    signOutSupabase,
  } = useShiori();

  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { canInstall, isStandalone, triggerInstall } = usePwaInstall();

  useEffect(() => {
    setMobileMenuOpen(false);
    setProfileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileMenuOpen]);

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
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const watchingCount = library.filter((e) => e.status === "WATCHING").length;

  return (
    <>
      <header
        className={cn(
          "fixed top-0 inset-x-0 z-50 transition-all duration-300 pt-[env(safe-area-inset-top)]",
          scrolled
            ? "bg-obsidian/88 backdrop-blur-xl border-b border-white/[0.07] shadow-[0_8px_32px_rgba(0,0,0,0.45)]"
            : "bg-gradient-to-b from-obsidian/92 via-obsidian/50 to-transparent border-b border-transparent"
        )}
      >
        <div className="max-w-[1400px] mx-auto px-3 sm:px-5 lg:px-6 h-14 sm:h-16 flex items-center justify-between gap-2 lg:gap-3">
          {/* Brand Logo: Shiori 栞 */}
          <Link href="/" className="flex items-center gap-2 sm:gap-3 group shrink-0 min-w-0">
            <motion.div
              whileHover={{ rotate: -4, scale: 1.07 }}
              whileTap={{ scale: 0.94 }}
              transition={{ type: "spring", stiffness: 360, damping: 20 }}
              className="relative w-7 h-8 sm:w-8 sm:h-9 flex items-center justify-center shrink-0"
            >
              {/* Silk Bookmark (Shiori) Ribbon SVG — adapts to user theme */}
              <svg
                viewBox="0 0 32 36"
                fill="none"
                className="w-6 h-7 sm:w-7 sm:h-8"
                style={{
                  filter: "drop-shadow(0 0 12px rgb(var(--shiori-accent-rgb) / 0.48))",
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
              <span className="hidden sm:block text-[10px] tracking-[0.22em] text-[#8E93A4] uppercase mt-0.5">
                Anime · Manga
              </span>
            </div>
          </Link>

          {/* Primary Navigation (Desktop) */}
          <nav className="hidden md:flex items-center gap-0.5 p-1 rounded-full bg-white/[0.03] border border-white/[0.06]">
            {NAV_ITEMS.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative px-2 xl:px-2.5 py-1.5 rounded-full text-[12px] font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap",
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
                  <Icon className="w-3.5 h-3.5 relative z-10 opacity-85" />
                  <span className="relative z-10">{item.label}</span>
                  {item.href === "/library" && watchingCount > 0 && (
                    <motion.span
                      key={watchingCount}
                      initial={{ scale: 1.45 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 420, damping: 18 }}
                      className="relative z-10 text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-accent/22 text-accent-soft border border-accent/35"
                    >
                      {watchingCount}
                    </motion.span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Right Controls */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Search Command Trigger */}
            <button
              type="button"
              onClick={() => setCommandOpen(true)}
              aria-label="Rechercher un anime ou manga"
              className="group flex items-center justify-center gap-1.5 w-8.5 h-8.5 sm:w-auto sm:h-9 sm:px-2.5 rounded-full bg-white/[0.045] hover:bg-white/[0.09] border border-white/[0.08] hover:border-white/[0.16] transition-all text-[13px] text-[#9A9EAE] hover:text-white cursor-pointer"
            >
              <Search className="w-3.5 h-3.5 text-[#9A9EAE] group-hover:text-white transition-colors" />
              <span className="hidden 2xl:inline">Rechercher...</span>
              <kbd className="hidden 2xl:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white/[0.07] text-[10px] font-mono text-[#A6AAB8] border border-white/[0.08]">
                ⌘K
              </kbd>
            </button>

            {/* Quick Theme & Color Customizer Popover (Desktop/Tablet; accessible in Mobile Menu Drawer) */}
            <div className="hidden md:block">
              <ThemeQuickPopover />
            </div>

            {/* Synopsis Content Language Selector (Desktop/Tablet; accessible in Mobile Menu Drawer) */}
            <div className="hidden md:block">
              <LanguageQuickPopover />
            </div>

            {/* Private Direct Messages Indicator */}
            <Link
              href="/messages"
              aria-label="Messages privés"
              title="Messages privés"
              className={cn(
                "relative w-8.5 h-8.5 sm:w-9 sm:h-9 rounded-full border flex items-center justify-center transition-all",
                pathname.startsWith("/messages")
                  ? "bg-accent/20 border-accent/55 text-white"
                  : "bg-white/[0.045] hover:bg-white/[0.09] border-white/[0.08] hover:border-white/[0.18] text-[#B8BCCB] hover:text-white"
              )}
            >
              <MessageSquare className="w-4 h-4" />
              {unreadMessagesCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] px-1 rounded-full bg-accent text-[10px] font-bold text-accent-fg flex items-center justify-center shadow-[0_0_10px_rgb(var(--shiori-accent-rgb)/0.8)]">
                  {unreadMessagesCount > 9 ? "9+" : unreadMessagesCount}
                </span>
              )}
            </Link>

            {/* Notifications Bell Popover */}
            <NotificationsPopover />

            {/* Profile Dropdown */}
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setProfileMenuOpen((v) => !v);
                }}
                aria-label="Menu profil"
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
                    className="fixed inset-x-3 top-[calc(4rem+env(safe-area-inset-top))] sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2.5 sm:w-72 max-h-[calc(100dvh-5.5rem-env(safe-area-inset-top))] overflow-y-auto overscroll-contain rounded-2xl bg-surface-solid border border-white/[0.13] shadow-[0_28px_72px_rgba(0,0,0,0.92)] z-50"
                  >
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
                        {profile.mode === "supabase" ? (
                          <>
                            <Cloud className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Synchronisation Cloud Supabase active</span>
                          </>
                        ) : profile.mode === "account" ? (
                          <>
                            <Cloud className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Compte Shiori connecté & sauvegardé</span>
                          </>
                        ) : (
                          <>
                            <HardDrive className="w-3.5 h-3.5 text-amber-400" />
                            <span>Session invité · Créez un compte</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="p-1.5">
                      <Link
                        href={`/profile/${encodeURIComponent(profile.username)}`}
                        onClick={() => setProfileMenuOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] text-[#D8DBE5] hover:bg-white/[0.07] hover:text-white transition-colors"
                      >
                        <UserCircle2 className="w-4 h-4 text-accent" />
                        <span>Mon profil public</span>
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
                        href="/settings#voice-actors"
                        onClick={() => setProfileMenuOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] text-[#D8DBE5] hover:bg-white/[0.07] hover:text-white transition-colors"
                      >
                        <Mic2 className="w-4 h-4 text-[#9A9EAE]" />
                        <span>Voice Actors favoris</span>
                      </Link>
                      <Link
                        href="/library"
                        onClick={() => setProfileMenuOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] text-[#D8DBE5] hover:bg-white/[0.07] hover:text-white transition-colors"
                      >
                        <Library className="w-4 h-4 text-[#9A9EAE]" />
                        <span>Ma Bibliothèque</span>
                        <span className="ml-auto text-xs font-mono text-[#7C8194]">
                          {library.length}
                        </span>
                      </Link>
                      <Link
                        href="/stats"
                        onClick={() => setProfileMenuOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] text-[#D8DBE5] hover:bg-white/[0.07] hover:text-white transition-colors"
                      >
                        <BarChart3 className="w-4 h-4 text-[#9A9EAE]" />
                        <span>Mes Statistiques</span>
                      </Link>
                      <Link
                        href="/settings"
                        onClick={() => setProfileMenuOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] text-[#D8DBE5] hover:bg-white/[0.07] hover:text-white transition-colors"
                      >
                        <Settings className="w-4 h-4 text-[#9A9EAE]" />
                        <span>Personnalisation & Compte</span>
                      </Link>
                      <Link
                        href="/settings#anilist-sync"
                        onClick={() => setProfileMenuOpen(false)}
                        className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-[13px] text-[#D8DBE5] hover:bg-white/[0.07] hover:text-white transition-colors"
                      >
                        <span className="flex items-center gap-2.5 min-w-0">
                          <ArrowLeftRight className="w-4 h-4 text-sky-400 shrink-0" />
                          <span className="truncate">
                            {anilistConnection.connected && anilistConnection.user
                              ? `AniList · @${anilistConnection.user.name}`
                              : "Connecter AniList"}
                          </span>
                        </span>
                        <span
                          className={cn(
                            "px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold border shrink-0",
                            anilistConnection.connected
                              ? "bg-emerald-500/15 border-emerald-500/35 text-emerald-300"
                              : "bg-sky-500/15 border-sky-400/35 text-sky-300"
                          )}
                        >
                          {anilistConnection.connected ? "SYNC" : "OAUTH"}
                        </span>
                      </Link>

                      {/* 1-Click Quick Ambiance Shortcut */}
                      <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl hover:bg-white/[0.05] transition-colors">
                        <Link
                          href="/settings#ambiance"
                          onClick={() => setProfileMenuOpen(false)}
                          className="flex items-center gap-2.5 text-[13px] text-[#D8DBE5] hover:text-white min-w-0 flex-1"
                        >
                          <Flower2 className="w-4 h-4 text-accent shrink-0" />
                          <span className="truncate">
                            {AMBIANCE_OPTIONS.find((o) => o.id === ambiance.effect)?.label ??
                              "Ambiance"}
                          </span>
                        </Link>
                        <button
                          type="button"
                          onClick={() =>
                            updateAmbiance({
                              effect: ambiance.effect === "none" ? "sakura" : "none",
                            })
                          }
                          className={cn(
                            "px-2 py-0.5 rounded-md text-[10.5px] font-mono font-semibold border transition-colors cursor-pointer shrink-0",
                            ambiance.effect === "none"
                              ? "bg-white/[0.05] border-white/[0.1] text-[#8E93A6] hover:text-white"
                              : "bg-accent/18 border-accent/40 text-accent-soft hover:bg-accent/28"
                          )}
                        >
                          {ambiance.effect === "none" ? "OFF" : "ON"}
                        </button>
                      </div>

                      {/* Progressive Web App (PWA) Quick Install Shortcut */}
                      {!isStandalone && (
                        canInstall ? (
                          <button
                            type="button"
                            onClick={() => {
                              setProfileMenuOpen(false);
                              void triggerInstall();
                            }}
                            className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-[13px] text-[#D8DBE5] hover:bg-white/[0.07] hover:text-white transition-colors cursor-pointer"
                          >
                            <span className="flex items-center gap-2.5 min-w-0">
                              <Download className="w-4 h-4 text-emerald-400 shrink-0" />
                              <span className="truncate">Installer l&apos;application</span>
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold border bg-emerald-500/15 border-emerald-500/35 text-emerald-300 shrink-0">
                              PWA
                            </span>
                          </button>
                        ) : (
                          <Link
                            href="/settings#pwa"
                            onClick={() => setProfileMenuOpen(false)}
                            className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-[13px] text-[#D8DBE5] hover:bg-white/[0.07] hover:text-white transition-colors"
                          >
                            <span className="flex items-center gap-2.5 min-w-0">
                              <Download className="w-4 h-4 text-[#9A9EAE] shrink-0" />
                              <span className="truncate">Installer l&apos;application</span>
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold border bg-white/[0.06] border-white/[0.12] text-[#A2A6B8] shrink-0">
                              PWA
                            </span>
                          </Link>
                        )
                      )}

                      {!isAuthenticated ? (
                        <div className="mt-1 pt-1.5 border-t border-white/[0.06] space-y-1">
                          <button
                            type="button"
                            onClick={() => {
                              setProfileMenuOpen(false);
                              openAuthModal("signup");
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-semibold text-accent-soft bg-accent/12 hover:bg-accent/22 transition-colors cursor-pointer"
                          >
                            <Sparkles className="w-4 h-4" />
                            <span>Créer un compte</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setProfileMenuOpen(false);
                              openAuthModal("signin");
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] text-[#D8DBE5] hover:bg-white/[0.07] hover:text-white transition-colors cursor-pointer"
                          >
                            <User className="w-4 h-4 text-[#9A9EAE]" />
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
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer mt-1 border-t border-white/[0.06] pt-2.5"
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

            {/* Mobile Burger Menu Trigger (gives clean 1-tap access to all pages, Language & Theme on small screens) */}
            <button
              type="button"
              onClick={() => {
                setProfileMenuOpen(false);
                setMobileMenuOpen((v) => !v);
              }}
              aria-label={mobileMenuOpen ? "Fermer le menu" : "Ouvrir le menu"}
              aria-expanded={mobileMenuOpen}
              className={cn(
                "md:hidden w-8.5 h-8.5 rounded-full border flex items-center justify-center transition-all cursor-pointer",
                mobileMenuOpen
                  ? "bg-accent/20 border-accent/55 text-white"
                  : "bg-white/[0.045] hover:bg-white/[0.09] border-white/[0.08] text-[#D4D7E5]"
              )}
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Burger Menu Drawer (full nav + synopsis language + theme/ambiance with safe-area padding) */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <div className="md:hidden fixed inset-x-0 bottom-0 top-[calc(3.5rem+env(safe-area-inset-top))] z-40">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-x-0 bottom-0 top-[calc(3.5rem+env(safe-area-inset-top))] bg-black/65 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: -12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-x-3 top-[calc(4rem+env(safe-area-inset-top))] max-h-[calc(100dvh-5.5rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] overflow-y-auto overscroll-contain rounded-2xl bg-surface-solid border border-white/[0.13] shadow-[0_28px_72px_rgba(0,0,0,0.95)] p-3.5 space-y-3.5 z-50"
            >
              {/* All Primary Navigation Routes */}
              <div>
                <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[#858A9E] px-1 mb-2">
                  Navigation
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {NAV_ITEMS.map((item) => {
                    const isActive =
                      item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={cn(
                          "flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-xs font-semibold transition-colors",
                          isActive
                            ? "bg-accent/18 border-accent/45 text-white"
                            : "bg-white/[0.03] border-white/[0.07] text-[#C8CCE0] hover:bg-white/[0.07] hover:text-white"
                        )}
                      >
                        <Icon className={cn("w-4 h-4 shrink-0", isActive ? "text-accent-soft" : "text-[#8E93A6]")} />
                        <span className="truncate">{item.label}</span>
                        {item.href === "/library" && watchingCount > 0 && (
                          <span className="ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-accent/22 text-accent-soft">
                            {watchingCount}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                  <Link
                    href="/settings"
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-xs font-semibold transition-colors",
                      pathname.startsWith("/settings")
                        ? "bg-accent/18 border-accent/45 text-white"
                        : "bg-white/[0.03] border-white/[0.07] text-[#C8CCE0] hover:bg-white/[0.07] hover:text-white"
                    )}
                  >
                    <Settings className="w-4 h-4 shrink-0 text-[#8E93A6]" />
                    <span className="truncate">Paramètres</span>
                  </Link>
                </div>
              </div>

              {/* Synopsis Language Switcher (FR / EN / ES / IT) */}
              <div className="pt-2.5 border-t border-white/[0.08] space-y-2">
                <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[#858A9E] px-1 flex items-center gap-1.5">
                  <Languages className="w-3.5 h-3.5 text-accent-soft" />
                  <span>Langue des synopsis</span>
                </p>
                <div className="grid grid-cols-4 gap-1.5">
                  {CONTENT_LANGUAGES.map((lang) => {
                    const active = lang.id === contentLanguage;
                    return (
                      <button
                        key={lang.id}
                        type="button"
                        onClick={() => setContentLanguage(lang.id)}
                        className={cn(
                          "py-2 rounded-xl border font-mono text-xs font-bold transition-colors cursor-pointer",
                          active
                            ? "bg-accent text-accent-fg border-accent"
                            : "bg-white/[0.04] border-white/[0.08] text-[#C8CCE0] hover:text-white"
                        )}
                      >
                        {lang.code}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Quick Theme & Ambiance Row */}
              <div className="pt-2.5 border-t border-white/[0.08] flex items-center gap-2">
                <Link
                  href="/settings#personnalisation"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex-1 flex items-center justify-center gap-2 h-10 px-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.09] text-xs font-semibold text-white transition-colors"
                >
                  <Palette className="w-3.5 h-3.5 text-accent-soft" />
                  <span>Thème & Couleurs</span>
                </Link>
                <button
                  type="button"
                  onClick={() =>
                    updateAmbiance({
                      effect: ambiance.effect === "none" ? "sakura" : "none",
                    })
                  }
                  className={cn(
                    "h-10 px-3.5 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer shrink-0",
                    ambiance.effect === "none"
                      ? "bg-white/[0.04] border-white/[0.09] text-[#9A9EAE]"
                      : "bg-accent/18 border-accent/40 text-accent-soft"
                  )}
                >
                  <Flower2 className="w-3.5 h-3.5" />
                  <span>{ambiance.effect === "none" ? "Effets OFF" : "Effets ON"}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mobile Bottom Navigation (5 well-spaced primary tabs + iPhone safe-area-inset-bottom) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-obsidian/95 backdrop-blur-xl border-t border-white/[0.08] px-1.5 pt-1.5 pb-[calc(0.4rem+env(safe-area-inset-bottom))]">
        <div className="grid grid-cols-5 items-center">
          {MOBILE_BOTTOM_NAV.map((item) => {
            const isActive =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
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
