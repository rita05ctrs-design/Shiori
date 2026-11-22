import React from "react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="pt-36 pb-24 max-w-xl mx-auto px-4 text-center">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-accent/15 border border-accent/35 font-serif text-2xl text-accent-hover mb-5">
        栞
      </div>
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#8E93A6]">
        Erreur 404
      </p>
      <h1 className="text-3xl sm:text-4xl font-bold text-white mt-2">
        Page introuvable
      </h1>
      <p className="text-sm text-[#8A8FA4] mt-2 leading-relaxed">
        Ce marque-page semble mener vers un chapitre inexistant. Revenez à l&apos;accueil ou explorez le catalogue.
      </p>
      <div className="mt-7 flex items-center justify-center gap-3">
        <Link
          href="/"
          className="px-5 py-2.5 rounded-full bg-accent hover:bg-accent-hover text-accent-fg text-sm font-semibold transition-colors"
        >
          Retour à l&apos;accueil
        </Link>
        <Link
          href="/discover"
          className="px-5 py-2.5 rounded-full bg-white/[0.07] hover:bg-white/[0.12] border border-white/[0.1] text-white text-sm font-medium transition-colors"
        >
          Découvrir
        </Link>
      </div>
    </div>
  );
}
