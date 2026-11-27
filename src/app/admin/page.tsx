import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Crown, Lock, ShieldAlert } from "lucide-react";
import {
  isAuthenticatedActor,
  resolveServerActor,
} from "@/lib/server/social-store";
import { getSiteConfig } from "@/lib/server/site-config";
import { listAllSuggestions } from "@/lib/server/suggestions-store";
import { AdminDashboardClient } from "@/components/admin/AdminDashboardClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Espace Créateur",
  robots: { index: false, follow: false },
};

type AdminTabParam = "spotlight" | "moderation" | "users" | "suggestions";

function resolveAdminTab(raw?: string): AdminTabParam {
  if (raw === "moderation" || raw === "users" || raw === "suggestions") {
    return raw;
  }
  return "spotlight";
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  const actor = await resolveServerActor();
  const authenticated = isAuthenticatedActor(actor);

  if (!authenticated || actor.role !== "creator") {
    return (
      <div className="min-h-[82vh] bg-[#07080C] flex items-center justify-center px-4 pt-24 pb-28">
        <div className="max-w-md w-full rounded-3xl border border-[#E5484D]/30 bg-gradient-to-b from-[#13141E] to-[#0B0C12] p-7 text-center shadow-[0_28px_72px_rgba(0,0,0,0.75)] space-y-5">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-[#E5484D]/15 border border-[#E5484D]/40 flex items-center justify-center">
            {authenticated ? (
              <ShieldAlert className="w-7 h-7 text-[#E5484D]" />
            ) : (
              <Lock className="w-7 h-7 text-[#F0B95B]" />
            )}
          </div>
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#F0B95B]/15 border border-[#F0B95B]/40 text-[11px] font-semibold text-[#FDE68A]">
              <Crown className="w-3 h-3 text-[#F0B95B]" />
              Accès restreint · 403
            </span>
            <h1 className="text-xl font-bold text-white">
              Espace réservé au Créateur
            </h1>
            <p className="text-sm text-[#9A9EAE] leading-relaxed">
              {authenticated
                ? `Votre compte (@${actor.username}) ne dispose pas du rôle Créateur requis pour accéder à l'administration de Shiori.`
                : "Vous devez être connecté avec le compte Créateur pour accéder au panneau d'administration."}
            </p>
          </div>
          <div className="pt-1 flex flex-col sm:flex-row items-center justify-center gap-2.5">
            <Link
              href="/"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white/[0.07] hover:bg-white/[0.13] border border-white/[0.12] text-sm font-semibold text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Retour à l&apos;accueil</span>
            </Link>
            <Link
              href="/support"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#F0B95B]/15 hover:bg-[#F0B95B]/25 border border-[#F0B95B]/45 text-sm font-semibold text-[#FDE68A] transition-colors"
            >
              <span>Soutenir Shiori</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const [resolvedParams, initialConfig, initialSuggestionsPayload] = await Promise.all([
    searchParams ? searchParams.catch(() => ({ tab: undefined })) : Promise.resolve({ tab: undefined }),
    getSiteConfig({ bypassCache: true }),
    listAllSuggestions(),
  ]);

  return (
    <AdminDashboardClient
      initialConfig={initialConfig}
      initialTab={resolveAdminTab(resolvedParams?.tab)}
      initialSuggestions={initialSuggestionsPayload.suggestions}
      creator={{
        id: actor.id,
        username: actor.username,
        displayName: actor.displayName,
      }}
    />
  );
}
