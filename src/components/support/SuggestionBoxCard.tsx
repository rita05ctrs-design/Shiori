"use client";

import React, { useState } from "react";
import {
  Bug,
  CheckCircle2,
  Lightbulb,
  Loader2,
  MessageSquare,
  Send,
  Sparkles,
  Wrench,
} from "lucide-react";
import { useShiori } from "@/context/ShioriContext";
import { useTranslation } from "@/hooks/useTranslation";
import {
  notifyLocalSuggestionCreated,
  SUGGESTIONS_BROADCAST_NAME,
  SUGGESTIONS_REALTIME_CHANNEL,
  SUGGESTIONS_REALTIME_EVENT,
} from "@/lib/suggestions-live-bus";
import { cn } from "@/lib/utils";
import type { SuggestionCategory, UserSuggestionRecord } from "@/types/media";

export {
  SUGGESTIONS_BROADCAST_NAME,
  SUGGESTIONS_REALTIME_CHANNEL,
  SUGGESTIONS_REALTIME_EVENT,
};

const CATEGORIES: {
  id: SuggestionCategory;
  label: string;
  icon: typeof Sparkles;
  activeClass: string;
}[] = [
  {
    id: "feature",
    label: "Fonctionnalité",
    icon: Sparkles,
    activeClass: "bg-[#F0B95B]/18 border-[#F0B95B]/55 text-[#FDE68A]",
  },
  {
    id: "improvement",
    label: "Amélioration",
    icon: Wrench,
    activeClass: "bg-sky-500/18 border-sky-400/50 text-sky-200",
  },
  {
    id: "bug",
    label: "Bug",
    icon: Bug,
    activeClass: "bg-rose-500/18 border-rose-400/50 text-rose-200",
  },
  {
    id: "other",
    label: "Autre",
    icon: MessageSquare,
    activeClass: "bg-violet-500/18 border-violet-400/50 text-violet-200",
  },
];

function broadcastNewSuggestion(suggestion: UserSuggestionRecord): void {
  notifyLocalSuggestionCreated(suggestion);
}

export function SuggestionBoxCard() {
  const { profile, isAuthenticated, toast } = useShiori();
  const { tr } = useTranslation();

  const [category, setCategory] = useState<SuggestionCategory>("feature");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [guestName, setGuestName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const canSubmit = message.trim().length >= 8 && !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      const isMobile =
        typeof window !== "undefined" &&
        window.matchMedia("(max-width: 767px)").matches;

      const res = await fetch("/api/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          title: title.trim(),
          message: message.trim(),
          guestName: !isAuthenticated ? guestName.trim() : undefined,
          device: isMobile ? "mobile" : "desktop",
          pagePath: typeof window !== "undefined" ? window.location.pathname : "/support",
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || tr("Impossible d'envoyer votre suggestion."));
      }

      if (data.suggestion) {
        broadcastNewSuggestion(data.suggestion as UserSuggestionRecord);
      }

      setSubmitted(true);
      setTitle("");
      setMessage("");
      toast({
        title: tr("Suggestion envoyée !"),
        description: tr("Merci, 6t79 pourra la consulter directement dans son espace Créateur."),
        variant: "success",
      });
    } catch (err) {
      toast({
        title: tr("Envoi impossible"),
        description:
          err instanceof Error
            ? err.message
            : tr("Impossible d'envoyer votre suggestion."),
        variant: "warning",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      id="suggestions"
      className="scroll-mt-24 relative overflow-hidden rounded-3xl border border-accent/30 bg-gradient-to-br from-[#14111D] via-[#0E1019] to-[#0B0C12] p-5 sm:p-8 shadow-[0_24px_64px_-24px_rgb(var(--shiori-accent-rgb)/0.3)] space-y-5"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-20 -right-20 w-64 h-64 rounded-full bg-accent/12 blur-3xl"
      />

      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-[0.18em] text-kinpaku">
            <Lightbulb className="w-3.5 h-3.5" />
            <span>{tr("Boîte à idées communautaire")}</span>
          </p>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            {tr("Proposer une idée ou signaler un souci")}
          </h2>
          <p className="text-xs sm:text-sm text-[#9EA3B5] max-w-2xl">
            {tr("Vos suggestions arrivent directement dans l'espace Créateur de 6t79 pour faire évoluer Shiori.")}
          </p>
        </div>

        <span className="self-start sm:self-auto px-3 py-1 rounded-full bg-white/[0.05] border border-white/[0.1] text-[11px] font-mono text-[#CFD3E0] shrink-0">
          {isAuthenticated ? `@${profile.username}` : tr("Mode invité")}
        </span>
      </div>

      {submitted ? (
        <div className="relative z-10 rounded-2xl bg-emerald-500/12 border border-emerald-400/35 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </span>
            <div>
              <p className="text-sm sm:text-base font-semibold text-emerald-200">
                {tr("Merci pour votre suggestion !")}
              </p>
              <p className="text-xs sm:text-sm text-[#C6CAD8] mt-0.5">
                {tr("Elle a bien été transmise en direct à l'espace Créateur.")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSubmitted(false)}
            className="px-4 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.12] text-xs font-semibold text-white transition-colors cursor-pointer shrink-0 self-start sm:self-center"
          >
            {tr("Envoyer une autre idée")}
          </button>
        </div>
      ) : (
        <form onSubmit={(e) => void handleSubmit(e)} className="relative z-10 space-y-4">
          {/* Category Pills */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#CFD3E0] block">
              {tr("Type de suggestion")}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const active = category === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    className={cn(
                      "px-3 py-2 rounded-xl border text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer touch-manipulation active:scale-[0.97]",
                      active
                        ? cat.activeClass
                        : "bg-[#07080C]/80 border-white/[0.09] text-[#9A9EAE] hover:text-white hover:border-white/[0.18]"
                    )}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{tr(cat.label)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className={cn("space-y-1.5", isAuthenticated && "sm:col-span-2")}>
              <label className="text-xs font-semibold text-[#CFD3E0] block">
                {tr("Titre court (optionnel)")}
              </label>
              <input
                type="text"
                maxLength={100}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={tr("Ex. Ajouter un filtre par studio dans Découvrir")}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#07080C] border border-white/[0.1] focus:border-accent/65 focus:outline-none text-base sm:text-sm text-white placeholder:text-[#666B7D]"
              />
            </div>

            {!isAuthenticated && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#CFD3E0] block">
                  {tr("Votre pseudo (optionnel)")}
                </label>
                <input
                  type="text"
                  maxLength={40}
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder={tr("Ex. Sora")}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#07080C] border border-white/[0.1] focus:border-accent/65 focus:outline-none text-base sm:text-sm text-white placeholder:text-[#666B7D]"
                />
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-semibold text-[#CFD3E0]">
                {tr("Votre suggestion")}
              </label>
              <span className="text-[11px] font-mono text-[#7C8194]">
                {message.length}/1200
              </span>
            </div>
            <textarea
              rows={3}
              maxLength={1200}
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={tr("Décrivez votre idée, ce que vous aimeriez voir dans Shiori ou un bug rencontré...")}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#07080C] border border-white/[0.1] focus:border-accent/65 focus:outline-none text-base sm:text-sm text-white placeholder:text-[#666B7D] resize-y min-h-[88px]"
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <p className="text-[11px] text-[#858A9E]">
              {tr("Minimum 8 caractères · Visible uniquement par le créateur.")}
            </p>
            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-accent hover:bg-accent-hover disabled:opacity-40 text-accent-fg font-semibold text-xs sm:text-sm shadow-[0_10px_28px_-8px_rgb(var(--shiori-accent-rgb)/0.55)] transition-all cursor-pointer touch-manipulation active:scale-[0.97]"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              <span>{tr("Envoyer ma suggestion")}</span>
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
