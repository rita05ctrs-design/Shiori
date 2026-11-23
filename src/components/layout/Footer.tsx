"use client";

import React from "react";
import Link from "next/link";
import { useShiori } from "@/context/ShioriContext";

export function Footer() {
  const { setCommandOpen, isAuthenticated, openAuthModal } = useShiori();

  return (
    <footer className="mt-16 sm:mt-20 border-t border-white/[0.06] bg-obsidian pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-10">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          <div className="md:col-span-5">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-accent/15 border border-accent/35 text-accent-hover font-serif text-sm font-semibold">
                栞
              </span>
              <span className="text-base font-semibold tracking-[0.16em] uppercase text-[#F4F3EE]">
                Shiori
              </span>
            </div>
            <p className="mt-3 text-sm text-[#858A9E] max-w-sm leading-relaxed">
              Votre marque-page personnel pour suivre, organiser et découvrir vos animés et mangas en toute simplicité.
            </p>
          </div>

          <div className="md:col-span-3 space-y-2.5">
            <h4 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6E7387]">
              Navigation
            </h4>
            <ul className="space-y-2 text-sm text-[#9A9EAE]">
              <li>
                <Link href="/" className="hover:text-white transition-colors">
                  Accueil
                </Link>
              </li>
              <li>
                <Link href="/library" className="hover:text-white transition-colors">
                  Ma Bibliothèque
                </Link>
              </li>
              <li>
                <Link href="/discover" className="hover:text-white transition-colors">
                  Découvrir
                </Link>
              </li>
              <li>
                <Link href="/calendar" className="hover:text-white transition-colors">
                  Sorties & Calendrier
                </Link>
              </li>
            </ul>
          </div>

          <div className="md:col-span-4 space-y-2.5">
            <h4 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6E7387]">
              Mon espace
            </h4>
            <ul className="space-y-2 text-sm text-[#9A9EAE]">
              <li>
                <Link href="/library?favorites=1" className="hover:text-white transition-colors">
                  Mes favoris
                </Link>
              </li>
              <li>
                <Link href="/stats" className="hover:text-white transition-colors">
                  Statistiques
                </Link>
              </li>
              <li>
                <Link href="/settings" className="hover:text-white transition-colors">
                  Paramètres & Apparence
                </Link>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setCommandOpen(true)}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Recherche rapide
                </button>
              </li>
              {!isAuthenticated && (
                <li>
                  <button
                    type="button"
                    onClick={() => openAuthModal("signin")}
                    className="hover:text-white transition-colors cursor-pointer"
                  >
                    Se connecter
                  </button>
                </li>
              )}
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-5 border-t border-white/[0.05] flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#666B7E]">
          <span>© {new Date().getFullYear()} Shiori (栞) · Suivi Anime & Manga</span>
          <span className="text-[11px] text-[#7D8296]">Catalogue fourni par AniList</span>
        </div>
      </div>
    </footer>
  );
}
