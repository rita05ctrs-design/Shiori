"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  Archive,
  Bug,
  CheckCircle2,
  Clock,
  Lightbulb,
  Loader2,
  MessageSquare,
  Monitor,
  RefreshCw,
  Search,
  Smartphone,
  Sparkles,
  Trash2,
  Wrench,
} from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { cn } from "@/lib/utils";
import type {
  SuggestionCategory,
  SuggestionStatus,
  UserSuggestionRecord,
} from "@/types/media";

interface AdminSuggestionsTabProps {
  suggestions: UserSuggestionRecord[];
  loading: boolean;
  mutatingId: string | null;
  onRefresh: () => void;
  onUpdateStatus: (id: string, status: SuggestionStatus) => void;
  onDelete: (id: string) => void;
}

const CATEGORY_META: Record<
  SuggestionCategory,
  { label: string; icon: typeof Sparkles; badgeClass: string }
> = {
  feature: {
    label: "Fonctionnalité",
    icon: Sparkles,
    badgeClass: "bg-[#F0B95B]/15 border-[#F0B95B]/45 text-[#FDE68A]",
  },
  improvement: {
    label: "Amélioration",
    icon: Wrench,
    badgeClass: "bg-sky-500/15 border-sky-400/40 text-sky-200",
  },
  bug: {
    label: "Bug",
    icon: Bug,
    badgeClass: "bg-rose-500/15 border-rose-400/45 text-rose-200",
  },
  other: {
    label: "Autre",
    icon: MessageSquare,
    badgeClass: "bg-violet-500/15 border-violet-400/40 text-violet-200",
  },
};

const STATUS_META: Record<
  SuggestionStatus,
  { label: string; icon: typeof Sparkles; badgeClass: string }
> = {
  new: {
    label: "Nouvelle",
    icon: Lightbulb,
    badgeClass: "bg-accent/18 border-accent/50 text-accent-soft",
  },
  planned: {
    label: "Prévue",
    icon: Clock,
    badgeClass: "bg-sky-500/16 border-sky-400/45 text-sky-200",
  },
  done: {
    label: "Réalisée",
    icon: CheckCircle2,
    badgeClass: "bg-emerald-500/16 border-emerald-400/45 text-emerald-200",
  },
  archived: {
    label: "Archivée",
    icon: Archive,
    badgeClass: "bg-white/[0.06] border-white/[0.14] text-[#9A9EAE]",
  },
};

export function AdminSuggestionsTab({
  suggestions,
  loading,
  mutatingId,
  onRefresh,
  onUpdateStatus,
  onDelete,
}: AdminSuggestionsTabProps) {
  const { tr, tRelativeTime } = useTranslation();
  const [statusFilter, setStatusFilter] = useState<"all" | SuggestionStatus>("all");
  const [categoryFilter, setCategoryFilter] = useState<"all" | SuggestionCategory>("all");
  const [query, setQuery] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const counts = useMemo(() => {
    const res = { all: suggestions.length, new: 0, planned: 0, done: 0, archived: 0 };
    for (const s of suggestions) {
      res[s.status] += 1;
    }
    return res;
  }, [suggestions]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return suggestions.filter((s) => {
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (categoryFilter !== "all" && s.category !== categoryFilter) return false;
      if (q) {
        const hay = `${s.title} ${s.message} ${s.displayName} ${s.username ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [suggestions, statusFilter, categoryFilter, query]);

  return (
    <section className="rounded-2xl border border-white/[0.09] bg-[#0D0F16] p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-[0.18em] text-[#F0B95B]">
            <Lightbulb className="w-3.5 h-3.5" />
            <span>{tr("Boîte à idées reçues")}</span>
          </p>
          <h2 className="text-lg font-bold text-white mt-0.5">
            {tr("Suggestions des utilisateurs")} ({suggestions.length})
          </h2>
          <p className="text-xs text-[#8D92A4] mt-0.5">
            {tr("Consultez en direct les idées, améliorations et retours envoyés depuis Shiori.")}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/support#suggestions"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.1] text-xs font-medium text-[#D6D9E6] hover:text-white transition-colors"
          >
            <Lightbulb className="w-3.5 h-3.5 text-[#F0B95B]" />
            <span>{tr("Voir le formulaire")}</span>
          </Link>
          <button
            type="button"
            disabled={loading}
            onClick={onRefresh}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.11] border border-white/[0.1] text-xs font-semibold text-white transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={cn("w-3.5 h-3.5 text-[#F0B95B]", loading && "animate-spin")} />
            <span>{tr("Rafraîchir")}</span>
          </button>
        </div>
      </div>

      {/* Filters Row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: "all", label: `${tr("Toutes")} (${counts.all})` },
              { id: "new", label: `${tr("Nouvelles")} (${counts.new})` },
              { id: "planned", label: `${tr("Prévues")} (${counts.planned})` },
              { id: "done", label: `${tr("Réalisées")} (${counts.done})` },
              { id: "archived", label: `${tr("Archivées")} (${counts.archived})` },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setStatusFilter(f.id)}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer",
                statusFilter === f.id
                  ? "bg-[#F0B95B]/18 border-[#F0B95B]/55 text-[#FDE68A]"
                  : "bg-white/[0.03] hover:bg-white/[0.08] border-white/[0.08] text-[#A2A6B8] hover:text-white"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 sm:w-56">
            <Search className="w-3.5 h-3.5 text-[#8D92A4] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tr("Filtrer les suggestions...")}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-[#07080C] border border-white/[0.1] focus:border-[#F0B95B]/55 focus:outline-none text-base sm:text-xs text-white placeholder:text-[#666B7D]"
            />
          </div>
          <div className="flex items-center gap-1">
            {(["all", "feature", "improvement", "bug", "other"] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={cn(
                  "px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer",
                  categoryFilter === cat
                    ? "bg-white/[0.12] border-white/[0.22] text-white"
                    : "bg-white/[0.03] border-white/[0.07] text-[#8D92A4] hover:text-white"
                )}
              >
                {cat === "all" ? tr("Tout") : tr(CATEGORY_META[cat].label)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* List */}
      {loading && suggestions.length === 0 ? (
        <div className="py-12 flex items-center justify-center gap-2.5 text-xs text-[#9A9EAE]">
          <Loader2 className="w-4 h-4 animate-spin text-[#F0B95B]" />
          <span>{tr("Chargement des suggestions...")}</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 px-4 rounded-2xl border border-dashed border-white/[0.1] bg-[#07080C]/60 text-center space-y-2">
          <Lightbulb className="w-7 h-7 text-[#F0B95B]/60 mx-auto" />
          <p className="text-sm font-semibold text-white">
            {tr("Aucune suggestion pour le moment")}
          </p>
          <p className="text-xs text-[#8D92A4] max-w-md mx-auto">
            {tr("Dès qu'un utilisateur proposera une idée depuis « Proposer une idée » ou la page Soutien, elle apparaîtra ici en temps réel.")}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((s) => {
            const catMeta = CATEGORY_META[s.category] ?? CATEGORY_META.other;
            const CatIcon = catMeta.icon;
            const stMeta = STATUS_META[s.status] ?? STATUS_META.new;
            const StIcon = stMeta.icon;
            const busy = mutatingId === s.id;
            const confirmingDel = confirmDeleteId === s.id;

            return (
              <article
                key={s.id}
                className={cn(
                  "rounded-2xl bg-[#07080C] border p-4 space-y-3 transition-colors",
                  s.status === "new"
                    ? "border-[#F0B95B]/35 shadow-[0_10px_28px_-14px_rgba(240,185,91,0.3)]"
                    : "border-white/[0.08]"
                )}
              >
                {/* Top Meta Row */}
                <div className="flex flex-wrap items-start justify-between gap-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <UserAvatar
                      avatarUrl={s.avatarUrl}
                      initials={s.displayName.slice(0, 2).toUpperCase()}
                      accentColor={s.accentColor || "#E5484D"}
                      alt={s.displayName}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {s.username ? (
                          <Link
                            href={`/profile/${encodeURIComponent(s.username)}`}
                            className="text-xs sm:text-sm font-bold text-white hover:text-[#F0B95B] transition-colors truncate"
                          >
                            {s.displayName}
                          </Link>
                        ) : (
                          <span className="text-xs sm:text-sm font-bold text-white truncate">
                            {s.displayName}
                          </span>
                        )}
                        {s.username ? (
                          <span className="text-[11px] font-mono text-[#858A9E]">
                            @{s.username}
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.2 rounded bg-white/[0.06] text-[10px] font-mono text-[#8D92A4]">
                            {tr("Invité")}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 text-[10.5px] font-mono text-[#7C8194]">
                          {s.device === "mobile" ? (
                            <Smartphone className="w-3 h-3" />
                          ) : (
                            <Monitor className="w-3 h-3" />
                          )}
                          <span>{s.device === "mobile" ? "Mobile" : "PC"}</span>
                        </span>
                      </div>
                      <p className="text-[11px] text-[#7D8296]">
                        {tRelativeTime(s.createdAt)}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[10.5px] font-semibold",
                        catMeta.badgeClass
                      )}
                    >
                      <CatIcon className="w-3 h-3" />
                      <span>{tr(catMeta.label)}</span>
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[10.5px] font-semibold",
                        stMeta.badgeClass
                      )}
                    >
                      <StIcon className="w-3 h-3" />
                      <span>{tr(stMeta.label)}</span>
                    </span>
                  </div>
                </div>

                {/* Title & Body */}
                <div className="space-y-1 pl-0 sm:pl-1">
                  {s.title && (
                    <h3 className="text-sm font-bold text-[#F4F3EE] leading-snug">
                      {s.title}
                    </h3>
                  )}
                  <p className="text-xs sm:text-[13.5px] text-[#D4D7E5] leading-relaxed whitespace-pre-wrap break-words">
                    {s.message}
                  </p>
                </div>

                {/* Status Actions & Delete */}
                <div className="pt-2 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(["new", "planned", "done", "archived"] as SuggestionStatus[]).map(
                      (targetStatus) => {
                        const meta = STATUS_META[targetStatus];
                        const active = s.status === targetStatus;
                        return (
                          <button
                            key={targetStatus}
                            type="button"
                            disabled={busy || active}
                            onClick={() => onUpdateStatus(s.id, targetStatus)}
                            className={cn(
                              "px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-colors cursor-pointer disabled:cursor-default",
                              active
                                ? meta.badgeClass
                                : "bg-white/[0.03] hover:bg-white/[0.09] border-white/[0.08] text-[#9A9EAE] hover:text-white"
                            )}
                          >
                            {tr(meta.label)}
                          </button>
                        );
                      }
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {confirmingDel ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-2.5 py-1 rounded-lg text-[11px] text-[#9A9EAE] hover:text-white cursor-pointer"
                        >
                          {tr("Annuler")}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setConfirmDeleteId(null);
                            onDelete(s.id);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-rose-500 hover:bg-rose-400 text-white text-[11px] font-semibold cursor-pointer disabled:opacity-50"
                        >
                          {tr("Confirmer")}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setConfirmDeleteId(s.id)}
                        aria-label={tr("Supprimer")}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-rose-500/20 border border-white/[0.08] hover:border-rose-400/40 text-[11px] font-medium text-[#9A9EAE] hover:text-rose-200 transition-colors cursor-pointer"
                      >
                        {busy ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Trash2 className="w-3 h-3" />
                        )}
                        <span>{tr("Supprimer")}</span>
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
