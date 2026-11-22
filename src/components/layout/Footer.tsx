"use client";

import React from "react";
import Link from "next/link";
import { useShiori } from "@/context/ShioriContext";

export function Footer() {
  const { setCommandOpen, setAuthModalOpen } = useShiori();

  return (
    <footer className="mt-24 border-t border-white/[0.06] bg-[#06070A] pb-24 md:pb-12">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
          <div className="md:col-span-5">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-[#E5484D]/15 border border-[#E5484D]/35 text-[#F45B62] font-serif text-sm font-semibold">
                栞
              </span>
              <span className="text-base font-semibold tracking-[0.16em] uppercase text-[#F4F3EE]">
                Shiori
              </span>
            </div>
            <p className="mt-3.5 text-sm text-[#858A9E] max-w-sm leading-relaxed">
              Votre marque-page nocturne pour suivre, découvrir et archiver vos animés et mangas
              avec la précision d&apos;une cinémathèque moderne.
            </p>
          </div>

          <div className="md:col-span-2 space-y-2.5">
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
                <Link href="/discover" className="hover:text-white transition-colors">
                  Découvrir
                </Link>
              </li>
              <li>
                <Link href="/library" className="hover:text-white transition-colors">
                  Bibliothèque
                </Link>
              </li>
              <li>
                <Link href="/calendar" className="hover:text-white transition-colors">
                  Calendrier
                </Link>
              </li>
            </ul>
          </div>

          <div className="md:col-span-2 space-y-2.5">
            <h4 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6E7387]">
              Espace Membre
            </h4>
            <ul className="space-y-2 text-sm text-[#9A9EAE]">
              <li>
                <Link href="/stats" className="hover:text-white transition-colors">
                  Statistiques
                </Link>
              </li>
              <li>
                <Link href="/settings" className="hover:text-white transition-colors">
                  Paramètres & Sync
                </Link>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setCommandOpen(true)}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Recherche rapide (⌘K)
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setAuthModalOpen(true)}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Connexion Cloud
                </button>
              </li>
            </ul>
          </div>

          <div className="md:col-span-3 space-y-2.5">
            <h4 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6E7387]">
              Données & Infrastructure
            </h4>
            <p className="text-xs text-[#7D8296] leading-relaxed">
              Métadonnées et calendrier en direct propulsés par l&apos;API publique AniList GraphQL.
              Architecture prête pour Supabase Auth & PostgreSQL RLS.
            </p>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-white/[0.05] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#666B7E]">
          <span>© {new Date().getFullYear()} Shiori (栞). Conçu pour les passionnés d&apos;animation japonaise et de manga.</span>
          <span className="font-mono text-[11px] text-[#7D8296]">v1.0 · Next.js + Supabase Ready</span>
        </div>
      </div>
    </footer>
  );
}
