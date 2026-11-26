"use client";

import React from "react";
import Link from "next/link";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

export default function AppErrorBoundary({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t, tr } = useTranslation();

  return (
    <div className="min-h-[75vh] pt-28 pb-16 px-4 flex items-center justify-center">
      <div className="max-w-md w-full rounded-3xl card-surface border border-white/[0.08] p-8 text-center space-y-5">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6 text-rose-400" />
        </div>
        <div className="space-y-2">
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-rose-400">
            {tr("Erreur inattendue · 500")}
          </p>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {tr("Quelque chose s'est mal passé")}
          </h1>
          <p className="text-sm text-[#9EA4B8] leading-relaxed">
            {tr("Cette page a rencontré une erreur temporaire. Vos données enregistrées dans Shiori restent intactes.")}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
          <button
            type="button"
            onClick={() => reset()}
            className="h-10 px-5 rounded-full bg-accent hover:bg-accent-hover text-accent-fg text-sm font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>{tr("Réessayer")}</span>
          </button>
          <Link
            href="/"
            className="h-10 px-5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.12] text-white text-sm font-medium inline-flex items-center gap-2 transition-colors"
          >
            <Home className="w-4 h-4" />
            <span>{t("nav.home")}</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
