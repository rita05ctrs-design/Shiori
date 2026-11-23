"use client";

import React from "react";
import Link from "next/link";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fr" className="dark">
      <body className="bg-[#090A0F] text-[#F4F3EE] antialiased min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-3xl bg-[#11131C] border border-white/10 p-8 text-center space-y-5">
          <div className="text-3xl font-bold text-[#E5484D]">栞</div>
          <div className="space-y-2">
            <h1 className="text-xl font-bold text-white">
              Interruption temporaire de Shiori
            </h1>
            <p className="text-sm text-[#9EA4B8] leading-relaxed">
              Une erreur critique est survenue lors du chargement de l&apos;application. Vos données sauvegardées ne sont pas affectées.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => reset()}
              className="h-10 px-5 rounded-full bg-[#E5484D] hover:bg-[#DC3D43] text-white text-sm font-semibold cursor-pointer"
            >
              Recharger Shiori
            </button>
            <Link
              href="/"
              className="h-10 px-5 rounded-full bg-white/10 hover:bg-white/15 text-white text-sm font-medium inline-flex items-center"
            >
              Accueil
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
