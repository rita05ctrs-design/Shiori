"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Crown, Heart, Sparkles } from "lucide-react";
import { useShiori } from "@/context/ShioriContext";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";

export function Footer() {
  const pathname = usePathname();
  const { setCommandOpen, isAuthenticated, isCreator, openAuthModal } = useShiori();
  const { t, tr } = useTranslation();
  if (pathname.startsWith("/assistant")) return null;
  const hideOnMobile = pathname.startsWith("/messages");

  return (
    <footer
      className={cn(
        "mt-16 sm:mt-20 border-t border-white/[0.07] bg-[#07080C] pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-10",
        hideOnMobile && "hidden md:block"
      )}
    >
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          {/* Brand, Independent Creator Credit & Support CTA */}
          <div className="md:col-span-5 space-y-4">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#E5484D]/15 border border-[#E5484D]/40 text-[#E5484D] font-serif text-sm font-semibold">
                栞
              </span>
              <span className="text-base font-semibold tracking-[0.16em] uppercase text-[#F4F3EE]">
                Shiori
              </span>
              <span className="px-2 py-0.5 rounded-full bg-[#F0B95B]/12 border border-[#F0B95B]/35 text-[10px] font-semibold text-[#FDE68A] uppercase tracking-wider">
                {tr("Indépendant")}
              </span>
            </div>

            <p className="text-sm text-[#8B90A5] max-w-sm leading-relaxed">
              {t("footer.tagline")}
            </p>

            <p className="text-xs text-[#A3A7B8] flex items-center gap-1.5">
              <Crown className="w-3.5 h-3.5 text-[#F0B95B] shrink-0" />
              <span>
                {tr("Conçu et développé avec passion par")}{" "}
                <span className="text-[#FDE68A] font-semibold">6t79</span>.
              </span>
            </p>

            <div className="pt-1 flex flex-wrap items-center gap-2.5">
              <Link
                href="/support"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#F0B95B]/20 via-[#E5484D]/18 to-[#F0B95B]/20 hover:from-[#F0B95B]/30 hover:to-[#E5484D]/28 border border-[#F0B95B]/55 text-xs sm:text-sm font-semibold text-[#FDE68A] shadow-[0_10px_28px_-12px_rgba(240,185,91,0.55)] transition-all"
              >
                <Heart className="w-4 h-4 text-[#E5484D] fill-[#E5484D]/30" />
                <span>{tr("Soutenir Shiori")}</span>
              </Link>
              {isCreator && (
                <Link
                  href="/admin"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-[#F0B95B]/35 text-xs font-semibold text-[#FDE68A] transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#F0B95B]" />
                  <span>{tr("Espace Créateur")}</span>
                </Link>
              )}
            </div>
          </div>

          {/* Quick Links: Navigation */}
          <div className="md:col-span-3 space-y-2.5">
            <h4 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6E7387]">
              {t("footer.navigation")}
            </h4>
            <ul className="space-y-2 text-sm text-[#9A9EAE]">
              <li>
                <Link href="/" className="hover:text-white transition-colors">
                  {t("nav.home")}
                </Link>
              </li>
              <li>
                <Link href="/library" className="hover:text-white transition-colors">
                  {t("footer.myLibrary")}
                </Link>
              </li>
              <li>
                <Link href="/discover" className="hover:text-white transition-colors">
                  {t("nav.discover")}
                </Link>
              </li>
              <li>
                <Link href="/calendar" className="hover:text-white transition-colors">
                  {t("footer.releasesCalendar")}
                </Link>
              </li>
              <li>
                <Link href="/community" className="hover:text-white transition-colors">
                  {t("nav.community")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Quick Links: My Space & Support */}
          <div className="md:col-span-4 space-y-2.5">
            <h4 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6E7387]">
              {t("footer.mySpace")}
            </h4>
            <ul className="space-y-2 text-sm text-[#9A9EAE]">
              <li>
                <Link href="/library?favorites=1" className="hover:text-white transition-colors">
                  {t("footer.myFavorites")}
                </Link>
              </li>
              <li>
                <Link href="/stats" className="hover:text-white transition-colors">
                  {t("nav.stats")}
                </Link>
              </li>
              <li>
                <Link href="/settings" className="hover:text-white transition-colors">
                  {t("footer.settingsAppearance")}
                </Link>
              </li>
              <li>
                <Link
                  href="/support#suggestions"
                  className="hover:text-white transition-colors"
                >
                  {tr("Proposer une idée")}
                </Link>
              </li>
              <li>
                <Link
                  href="/support"
                  className="text-[#F0B95B] hover:text-[#FDE68A] font-medium transition-colors"
                >
                  {tr("Soutenir le projet & Badge Supporter")}
                </Link>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setCommandOpen(true)}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  {t("footer.quickSearch")}
                </button>
              </li>
              {!isAuthenticated && (
                <li>
                  <button
                    type="button"
                    onClick={() => openAuthModal("signin")}
                    className="hover:text-white transition-colors cursor-pointer"
                  >
                    {t("nav.signIn")}
                  </button>
                </li>
              )}
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-5 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#666B7E]">
          <span>
            © {new Date().getFullYear()} Shiori (栞) · {t("footer.rights")}
          </span>
          <span className="text-[11px] text-[#7D8296]">{t("footer.catalogBy")}</span>
        </div>
      </div>
    </footer>
  );
}
