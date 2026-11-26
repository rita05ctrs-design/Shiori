"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Copy,
  Crown,
  ExternalLink,
  Globe,
  Heart,
  Server,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { useShiori } from "@/context/ShioriContext";
import { BadgeIcon } from "@/components/badges/BadgeIcon";
import { cn } from "@/lib/utils";
import type { ResolvedDonationLink } from "@/lib/donation";

interface SupportClientProps {
  donation: ResolvedDonationLink;
}

const FUND_USES = [
  {
    icon: Server,
    title: "Serveurs & Base de données",
    accent: "text-[#E5484D]",
    bg: "bg-[#E5484D]/12 border-[#E5484D]/30",
    share: "Hébergement & Cloud",
    description:
      "Financement de l'hébergement, de la base Supabase, de la synchronisation de votre bibliothèque et de la messagerie communautaire 24h/24.",
  },
  {
    icon: Globe,
    title: "Domaine & Infrastructure",
    accent: "text-[#F0B95B]",
    bg: "bg-[#F0B95B]/12 border-[#F0B95B]/35",
    share: "DNS, CDN & Fiabilité",
    description:
      "Renouvellement du nom de domaine, certificats sécurisés, cache rapide des visuels et déploiement continu des nouvelles fonctionnalités.",
  },
  {
    icon: Sparkles,
    title: "Shiori IA & Traduction",
    accent: "text-sky-300",
    bg: "bg-sky-400/12 border-sky-400/30",
    share: "Gemini IA & Vocal",
    description:
      "Couverture des quotas d'API pour l'assistant Shiori IA, la transcription vocale universelle, la traduction des synopsis et le guide de reprise Manga/Manhwa.",
  },
];

export function SupportClient({ donation }: SupportClientProps) {
  const { profile, isAuthenticated, unlockedBadges, openAuthModal, toast } = useShiori();
  const [copied, setCopied] = useState(false);

  const hasSupporterBadge = unlockedBadges.some((b) => b.badgeId === "supporter");

  const handleCopyUsername = async () => {
    const tag = `@${profile.username}`;
    try {
      await navigator.clipboard.writeText(tag);
      setCopied(true);
      toast({
        title: "Pseudo copié",
        description: `${tag} copié — collez-le dans votre message de soutien !`,
        variant: "success",
      });
      setTimeout(() => setCopied(false), 2200);
    } catch {
      toast({
        title: "Votre pseudo",
        description: `Indiquez ${tag} dans votre message de soutien.`,
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#07080C] pt-[calc(5.25rem+env(safe-area-inset-top))] pb-28 md:pb-20">
      <div className="max-w-[1080px] mx-auto px-4 sm:px-6 lg:px-8 space-y-10 sm:space-y-12">
        {/* Back Breadcrumb */}
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#9A9EAE] hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Retour à l&apos;accueil</span>
          </Link>
        </div>

        {/* Immersive Hero Card */}
        <section className="relative overflow-hidden rounded-3xl border border-[#F0B95B]/30 bg-gradient-to-br from-[#16110C] via-[#0D0E16] to-[#140B0E] p-6 sm:p-10 shadow-[0_32px_84px_-32px_rgba(240,185,91,0.35)]">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 -left-24 w-72 h-72 rounded-full bg-[#E5484D]/15 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-24 -right-24 w-80 h-80 rounded-full bg-[#F0B95B]/16 blur-3xl"
          />

          <div className="relative z-10 max-w-3xl space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F0B95B]/15 border border-[#F0B95B]/45 text-[11px] font-bold uppercase tracking-[0.16em] text-[#FDE68A]">
                <Heart className="w-3.5 h-3.5 text-[#E5484D] fill-[#E5484D]" />
                Projet Indépendant
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.05] border border-white/[0.1] text-[11px] font-medium text-[#CFD3E0]">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                100% gratuit · Sans publicité intrusive
              </span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-white leading-[1.08]">
              Aidez{" "}
              <span className="bg-gradient-to-r from-[#FDE68A] via-[#F0B95B] to-[#E5484D] bg-clip-text text-transparent">
                Shiori (栞)
              </span>{" "}
              à rester libre et indépendant.
            </h1>

            <p className="text-sm sm:text-base text-[#B6BAC9] leading-relaxed">
              Shiori est conçu et maintenu avec passion par un créateur indépendant pour offrir aux
              amateurs d&apos;animés et de mangas un espace soigné, rapide et sans trackers
              publicitaires. Chaque contribution — même symbolique — aide directement à maintenir
              les serveurs, le nom de domaine et l&apos;assistant IA accessibles à tous.
            </p>

            {/* Primary Configurable Donation Action */}
            <div className="pt-2">
              {donation.configured && donation.url ? (
                <div className="flex flex-col sm:flex-row sm:items-center gap-3.5">
                  <a
                    href={donation.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-[#F0B95B] via-[#E5A143] to-[#E5484D] hover:brightness-110 text-[#07080C] font-extrabold text-sm sm:text-base shadow-[0_18px_42px_-12px_rgba(240,185,91,0.65)] transition-all"
                  >
                    <Heart className="w-4 h-4 fill-current" />
                    <span>Soutenir via {donation.platformLabel}</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  <p className="text-xs text-[#9A9EAE]">
                    Don libre &amp; sécurisé sur{" "}
                    <span className="text-[#FDE68A] font-medium">{donation.platformLabel}</span> ·
                    Aucun abonnement obligatoire.
                  </p>
                </div>
              ) : (
                <div className="rounded-2xl border border-[#F0B95B]/30 bg-[#07080C]/75 p-4 sm:p-5 space-y-2.5 max-w-2xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-[#F0B95B]/16 border border-[#F0B95B]/45 text-[11px] font-semibold text-[#FDE68A]">
                      Lien de don bientôt disponible
                    </span>
                    <span className="text-[11px] font-mono text-[#7C8194]">
                      Ko-fi · Buy Me a Coffee · PayPal.me
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-[#C4C8D6] leading-relaxed">
                    La plateforme de soutien n&apos;est pas encore reliée sur cette instance. En
                    attendant son ouverture officielle, la meilleure façon d&apos;aider Shiori est de
                    partager le site avec vos amis et de faire vivre la communauté !
                  </p>
                  <div className="pt-1 flex flex-wrap gap-2">
                    <Link
                      href="/community"
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/[0.07] hover:bg-white/[0.13] border border-white/[0.1] text-xs font-semibold text-white transition-colors"
                    >
                      <Users className="w-3.5 h-3.5 text-[#F0B95B]" />
                      <span>Rejoindre la communauté</span>
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Transparency Breakdown: Where funds go */}
        <section className="space-y-5">
          <div className="space-y-1">
            <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#F0B95B]">
              Transparence totale
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              À quoi sert votre soutien ?
            </h2>
            <p className="text-sm text-[#9599AC]">
              100 % des dons sont réinvestis dans l&apos;infrastructure technique et l&apos;évolution
              continue de Shiori.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
            {FUND_USES.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="rounded-2xl border border-white/[0.08] bg-[#0D0F16] p-5 sm:p-6 space-y-4 hover:border-white/[0.16] transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div
                      className={cn(
                        "w-11 h-11 rounded-xl border flex items-center justify-center",
                        item.bg
                      )}
                    >
                      <Icon className={cn("w-5 h-5", item.accent)} />
                    </div>
                    <span className="text-[10.5px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-[#9EA3B5]">
                      {item.share}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="text-base font-bold text-white">{item.title}</h3>
                    <p className="text-xs sm:text-sm text-[#9A9EAE] leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Exclusive Supporter Badge Callout */}
        <section className="relative overflow-hidden rounded-3xl border border-[#F0B95B]/40 bg-gradient-to-r from-[#1A140B] via-[#11131D] to-[#0D0F16] p-6 sm:p-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            {/* Badge Preview Visual */}
            <div className="lg:col-span-4 flex flex-col items-center justify-center text-center p-5 rounded-2xl bg-[#07080C]/80 border border-[#F0B95B]/35 shadow-[0_16px_40px_-14px_rgba(240,185,91,0.45)] space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#FDE047] via-[#F0B95B] to-[#B45309] flex items-center justify-center ring-2 ring-[#FDE68A]/40 shadow-xl">
                <BadgeIcon iconKey="heart" className="w-8 h-8 text-[#07080C]" />
              </div>
              <div className="space-y-1">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#F0B95B]/20 border border-[#F0B95B]/55 text-[10.5px] font-bold uppercase tracking-wider text-[#FDE68A]">
                  <Crown className="w-3 h-3 text-[#F0B95B]" />
                  Distinction Or
                </span>
                <h3 className="text-lg font-bold text-white">Badge « Supporter »</h3>
                <p className="text-xs text-[#9EA3B5]">
                  Épinglable sur votre profil public et visible dans la communauté.
                </p>
              </div>
              {hasSupporterBadge && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/45 text-xs font-semibold text-emerald-200">
                  <Check className="w-3.5 h-3.5" />
                  Déjà débloqué sur votre profil !
                </span>
              )}
            </div>

            {/* Steps to receive the Supporter badge */}
            <div className="lg:col-span-8 space-y-4">
              <div className="space-y-1">
                <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#F0B95B]">
                  Merci pour votre geste
                </p>
                <h2 className="text-xl sm:text-2xl font-bold text-white">
                  Comment obtenir le badge « Supporter » sur votre profil ?
                </h2>
              </div>

              <ol className="space-y-3 text-xs sm:text-sm text-[#C7CBD8]">
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#F0B95B]/20 border border-[#F0B95B]/55 text-[#FDE68A] font-mono text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </span>
                  <span>
                    Lors de votre don, indiquez simplement votre{" "}
                    <strong className="text-white">@pseudo Shiori</strong> dans le champ message
                    (Ko-fi, Buy Me a Coffee ou PayPal).
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#F0B95B]/20 border border-[#F0B95B]/55 text-[#FDE68A] font-mono text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </span>
                  <span>
                    Le créateur vérifie votre soutien et active manuellement le badge doré{" "}
                    <strong className="text-[#FDE68A]">Supporter</strong> directement sur votre
                    compte depuis l&apos;administration Shiori.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#F0B95B]/20 border border-[#F0B95B]/55 text-[#FDE68A] font-mono text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </span>
                  <span>
                    Rendez-vous dans votre profil public pour épingler votre badge et le faire
                    apparaître à côté de votre pseudo !
                  </span>
                </li>
              </ol>

              {/* Quick username copy helper */}
              <div className="pt-2 flex flex-wrap items-center gap-3">
                {isAuthenticated ? (
                  <>
                    <button
                      type="button"
                      onClick={() => void handleCopyUsername()}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#F0B95B]/16 hover:bg-[#F0B95B]/26 border border-[#F0B95B]/50 text-xs font-semibold text-[#FDE68A] transition-colors cursor-pointer"
                    >
                      {copied ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-[#F0B95B]" />
                      )}
                      <span>Copier mon pseudo (@{profile.username})</span>
                    </button>
                    <Link
                      href={`/profile/${encodeURIComponent(profile.username)}#badges`}
                      className="text-xs font-medium text-[#9A9EAE] hover:text-white transition-colors"
                    >
                      Voir mes badges →
                    </Link>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => openAuthModal("signup")}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.14] text-xs font-semibold text-white transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#F0B95B]" />
                    <span>Créer un compte Shiori pour recevoir le badge</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
