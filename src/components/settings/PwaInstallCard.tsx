"use client";

import React, { useState } from "react";
import { CheckCircle2, Download, Laptop, Share, Smartphone } from "lucide-react";
import { usePwaInstall } from "@/components/pwa/PwaRegistrar";
import { useShiori } from "@/context/ShioriContext";

export function PwaInstallCard() {
  const { canInstall, isStandalone, isIos, triggerInstall } = usePwaInstall();
  const { toast } = useShiori();
  const [installing, setInstalling] = useState(false);

  const handleInstall = async () => {
    setInstalling(true);
    try {
      const outcome = await triggerInstall();
      if (outcome === "accepted") {
        toast({
          title: "Shiori installé !",
          description: "Vous pouvez désormais lancer Shiori depuis votre écran d'accueil ou bureau.",
          variant: "success",
          celebrate: true,
        });
      }
    } finally {
      setInstalling(false);
    }
  };

  return (
    <section
      id="pwa"
      className="rounded-2xl card-surface p-6 space-y-4 scroll-mt-24 border border-white/[0.08]"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-accent/18 border border-accent/40 flex items-center justify-center shrink-0">
            <img src="/icon.svg" alt="Shiori" className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <span>Installer Shiori sur votre appareil</span>
            </h2>
            <p className="text-xs text-[#858A9E] mt-0.5 max-w-xl">
              Ajoutez Shiori à votre écran d&apos;accueil ou bureau pour un accès direct en plein écran.
            </p>
          </div>
        </div>

        {isStandalone ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-400/35 text-xs font-semibold text-emerald-300 shrink-0 self-start sm:self-auto">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Installée</span>
          </span>
        ) : canInstall ? (
          <button
            type="button"
            disabled={installing}
            onClick={() => void handleInstall()}
            className="h-9 px-4 rounded-full bg-accent hover:bg-accent-hover text-accent-fg text-xs font-semibold shadow-accent inline-flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 self-start sm:self-auto"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{installing ? "Installation..." : "Installer Shiori"}</span>
          </button>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.1] text-xs text-[#B8BCCB] shrink-0 self-start sm:self-auto">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Disponible</span>
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <div className="p-3.5 rounded-xl bg-obsidian/70 border border-white/[0.07] flex items-start gap-2.5">
          <Laptop className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-white">Desktop (Chrome, Edge, Brave)</p>
            <p className="text-[#8E93A6] mt-0.5 leading-relaxed">
              Cliquez sur « Installer Shiori » ci-dessus ou sur l&apos;icône d&apos;installation dans la barre d&apos;adresse de votre navigateur.
            </p>
          </div>
        </div>
        <div className="p-3.5 rounded-xl bg-obsidian/70 border border-white/[0.07] flex items-start gap-2.5">
          {isIos ? (
            <Share className="w-4 h-4 text-accent-soft shrink-0 mt-0.5" />
          ) : (
            <Smartphone className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          )}
          <div>
            <p className="font-semibold text-white">Mobile (iOS Safari & Android)</p>
            <p className="text-[#8E93A6] mt-0.5 leading-relaxed">
              Sur iOS Safari : touchez <strong>Partager</strong> puis{" "}
              <strong>Sur l&apos;écran d&apos;accueil</strong>. Sur Android : menu{" "}
              <strong>⋮ → Installer l&apos;application</strong>.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
