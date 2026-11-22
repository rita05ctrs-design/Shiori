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
} from "lucide-react";
import { useShiori } from "@/context/ShioriContext";
import { NotificationsPopover } from "@/components/notifications/NotificationsPopover";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Accueil", icon: Home },
  { href: "/discover", label: "Découvrir", icon: Compass },
  { href: "/library", label: "Bibliothèque", icon: Library },
  { href: "/calendar", label: "Calendrier", icon: CalendarDays },
  { href: "/stats", label: "Statistiques", icon: BarChart3 },
];

export function Navbar() {
  const pathname = usePathname();
  const {
    profile,
    library,
    setCommandOpen,
    setAuthModalOpen,
    signOutSupabase,
    supabaseReady,
  } = useShiori();

  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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
          "fixed top-0 inset-x-0 z-50 transition-all duration-300",
          scrolled
            ? "bg-[#07080C]/85 backdrop-blur-xl border-b border-white/[0.07] shadow-[0_8px_32px_rgba(0,0,0,0.45)]"
            : "bg-gradient-to-b from-[#07080C]/90 via-[#07080C]/45 to-transparent border-b border-transparent"
        )}
      >
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Brand Logo: Shiori 栞 */}
          <Link href="/" className="flex items-center gap-3 group shrink-0">
            <motion.div
              whileHover={{ rotate: -4, scale: 1.07 }}
              whileTap={{ scale: 0.94 }}
              transition={{ type: "spring", stiffness: 360, damping: 20 }}
              className="relative w-8 h-9 flex items-center justify-center"
            >
              {/* Red Silk Bookmark (Shiori) Ribbon SVG */}
              <svg
                viewBox="0 0 32 36"
                fill="none"
                className="w-7 h-8 drop-shadow-[0_0_12px_rgba(229,72,77,0.48)]"
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
                  fill="#FFF7F5"
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
                    <stop stopColor="#F45B62" />
                    <stop offset="1" stopColor="#B82530" />
                  </linearGradient>
                </defs>
              </svg>
            </motion.div>
            <div className="flex flex-col leading-none">
              <span className="text-[17px] font-semibold tracking-[0.14em] text-[#F4F3EE] uppercase">
                Shiori
              </span>
              <span className="text-[10px] tracking-[0.22em] text-[#8E93A4] uppercase mt-0.5">
                Anime · Manga
              </span>
            </div>
          </Link>

          {/* Primary Navigation (Desktop) */}
          <nav className="hidden md:flex items-center gap-0.5 lg:gap-1 p-1 rounded-full bg-white/[0.03] border border-white/[0.06]">
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
                    "relative px-3 lg:px-4 py-1.5 rounded-full text-[13px] font-medium transition-colors flex items-center gap-1.5 lg:gap-2 whitespace-nowrap",
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
                    <span className="relative z-10 text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-[#E5484D]/20 text-[#FF878B] border border-[#E5484D]/30">
                      {watchingCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Right Controls */}
          <div className="flex items-center gap-2.5">
            {/* Search Command Trigger */}
            <button
              type="button"
              onClick={() => setCommandOpen(true)}
              aria-label="Rechercher un anime ou manga"
              className="group flex items-center gap-2.5 h-9 px-3 sm:px-3.5 rounded-full bg-white/[0.045] hover:bg-white/[0.09] border border-white/[0.08] hover:border-white/[0.16] transition-all text-[13px] text-[#9A9EAE] hover:text-white cursor-pointer"
            >
              <Search className="w-3.5 h-3.5 text-[#9A9EAE] group-hover:text-white transition-colors" />
              <span className="hidden xl:inline">Rechercher...</span>
              <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white/[0.07] text-[10px] font-mono text-[#A6AAB8] border border-white/[0.08]">
                ⌘K
              </kbd>
            </button>

            {/* Notifications Bell Popover */}
            <NotificationsPopover />

            {/* Profile Dropdown */}
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setProfileMenuOpen((v) => !v)}
                className="flex items-center gap-2.5 h-9 pl-1.5 pr-3 rounded-full bg-white/[0.045] hover:bg-white/[0.09] border border-white/[0.08] hover:border-white/[0.18] transition-all cursor-pointer"
              >
                <div
                  className="w-6.5 h-6.5 rounded-full flex items-center justify-center text-[11px] font-semibold text-white shadow-inner"
                  style={{
                    background: `linear-gradient(135deg, ${profile.accentColor}, #881C24)`,
                  }}
                >
                  {profile.avatarInitials}
                </div>
                <span className="hidden sm:inline text-[13px] font-medium text-[#ECEBE6] max-w-[90px] truncate">
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
                    className="absolute right-0 mt-2.5 w-72 rounded-2xl glass-panel shadow-[0_24px_60px_rgba(0,0,0,0.65)] overflow-hidden"
                  >
                    <div className="p-4 border-b border-white/[0.07] bg-white/[0.02]">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold text-white shrink-0"
                          style={{
                            background: `linear-gradient(135deg, ${profile.accentColor}, #7F1D1D)`,
                          }}
                        >
                          {profile.avatarInitials}
                        </div>
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
                        ) : (
                          <>
                            <HardDrive className="w-3.5 h-3.5 text-amber-400" />
                            <span>
                              Mode Local{" "}
                              {supabaseReady ? "· Cloud prêt" : "· Persistance navigateur"}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="p-1.5">
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
                        <span>Compte & Notifications</span>
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          setProfileMenuOpen(false);
                          setAuthModalOpen(true);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] text-[#F4B860] hover:bg-[#F0B95B]/10 transition-colors cursor-pointer"
                      >
                        {profile.mode === "supabase" ? (
                          <>
                            <User className="w-4 h-4" />
                            <span>Gérer le compte cloud</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            <span>Connexion / Sync Supabase</span>
                          </>
                        )}
                      </button>

                      {profile.mode === "supabase" && (
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
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-[#0A0C12]/95 backdrop-blur-xl border-t border-white/[0.08] px-2 py-1.5">
        <div className="flex items-center justify-around">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-colors",
                  isActive ? "text-[#F45B62]" : "text-[#8A8FA3]"
                )}
              >
                <Icon className="w-4.5 h-4.5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
