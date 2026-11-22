"use client";

import React, { useState, useRef } from "react";
import {
  User,
  Bell,
  Cloud,
  HardDrive,
  Download,
  Upload,
  RotateCcw,
  Check,
  Database,
  ShieldCheck,
  Sparkles,
  Copy,
} from "lucide-react";
import { useShiori } from "@/context/ShioriContext";
import { cn } from "@/lib/utils";

const ACCENT_SWATCHES = [
  { name: "Akane Crimson", color: "#E5484D" },
  { name: "Sakura Ember", color: "#EC4899" },
  { name: "Indigo Nocturne", color: "#6366F1" },
  { name: "Jade Kyōto", color: "#10B981" },
  { name: "Kinpaku Gold", color: "#D97706" },
];

export default function SettingsPage() {
  const {
    profile,
    supabaseReady,
    updateProfile,
    updateNotificationPrefs,
    setAuthModalOpen,
    signOutSupabase,
    pushNotification,
    exportLibraryJson,
    importLibraryJson,
    resetDemoData,
    library,
    toast,
  } = useShiori();

  const [displayName, setDisplayName] = useState(profile.displayName);
  const [username, setUsername] = useState(profile.username);
  const [bio, setBio] = useState(profile.bio);
  const [accentColor, setAccentColor] = useState(profile.accentColor);
  const [copiedEnv, setCopiedEnv] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile({
      displayName: displayName.trim() || "Membre Shiori",
      username: username.trim().replace(/\s+/g, "_") || "shiori_user",
      bio: bio.trim(),
      accentColor,
    });
  };

  const handleExport = () => {
    const json = exportLibraryJson();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `shiori-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Sauvegarde JSON exportée", variant: "success" });
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const res = importLibraryJson(text);
    if (!res.ok) {
      toast({
        title: "Échec de l'import",
        description: res.error,
        variant: "warning",
      });
    }
    e.target.value = "";
  };

  const handleTestNotification = () => {
    pushNotification({
      kind: "AIRING",
      title: "Alerte de test Shiori",
      body: "Les notifications temps réel sont opérationnelles pour vos séries en cours.",
      mediaId: library[0]?.mediaId,
      coverImage: library[0]?.coverImage,
    });
    toast({
      title: "Notification envoyée",
      description: "Consultez l'icône cloche dans la barre supérieure.",
      variant: "info",
    });
  };

  const envSnippet = `NEXT_PUBLIC_SUPABASE_URL=https://votre-projet.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre-cle-anon-publique`;

  const handleCopyEnv = async () => {
    try {
      await navigator.clipboard.writeText(envSnippet);
      setCopiedEnv(true);
      setTimeout(() => setCopiedEnv(false), 1800);
    } catch {
      // ignore clipboard restrictions
    }
  };

  return (
    <div className="pt-24 pb-16 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
      {/* Header */}
      <div>
        <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#E5484D] mb-1.5">
          Configuration & Infrastructure
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gradient-editorial">
          Compte, Supabase & Notifications
        </h1>
        <p className="text-sm text-[#8A8FA4] mt-1.5">
          Gérez votre profil, connectez votre instance Supabase et configurez vos alertes de sorties.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT: Profile & Notifications */}
        <div className="lg:col-span-7 space-y-6">
          {/* Profile Card */}
          <form onSubmit={handleSaveProfile} className="rounded-2xl card-surface p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-base font-bold text-white shadow-lg"
                style={{
                  background: `linear-gradient(135deg, ${accentColor}, #7F1D1D)`,
                }}
              >
                {displayName.trim().slice(0, 2).toUpperCase() || "SH"}
              </div>
              <div>
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <User className="w-4 h-4 text-[#E5484D]" />
                  <span>Profil public</span>
                </h2>
                <p className="text-xs text-[#858A9E]">
                  Visible dans la barre de navigation et sur votre page Statistiques.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-[#858A9E] mb-1.5">
                  Nom d&apos;affichage
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full h-10 px-3.5 rounded-xl bg-[#08090E] border border-white/[0.09] text-sm text-white focus:outline-none focus:border-[#E5484D]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-[#858A9E] mb-1.5">
                  Identifiant (@)
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full h-10 px-3.5 rounded-xl bg-[#08090E] border border-white/[0.09] text-sm text-white font-mono focus:outline-none focus:border-[#E5484D]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-[#858A9E] mb-1.5">
                Bio éditoriale
              </label>
              <textarea
                rows={2}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#08090E] border border-white/[0.09] text-sm text-[#ECEBE6] focus:outline-none focus:border-[#E5484D] resize-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-[#858A9E] mb-2">
                Teinte d&apos;avatar
              </label>
              <div className="flex items-center gap-2.5">
                {ACCENT_SWATCHES.map((s) => (
                  <button
                    key={s.color}
                    type="button"
                    onClick={() => setAccentColor(s.color)}
                    title={s.name}
                    style={{ backgroundColor: s.color }}
                    className={cn(
                      "w-7 h-7 rounded-full flex items-center justify-center transition-transform cursor-pointer",
                      accentColor === s.color
                        ? "ring-2 ring-white ring-offset-2 ring-offset-[#0E1017] scale-110"
                        : "opacity-75 hover:opacity-100"
                    )}
                  >
                    {accentColor === s.color && <Check className="w-3.5 h-3.5 text-white" />}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-[#E5484D] hover:bg-[#F2545B] text-white text-xs font-semibold shadow-[0_8px_22px_rgba(229,72,77,0.35)] transition-all cursor-pointer"
              >
                Enregistrer le profil
              </button>
            </div>
          </form>

          {/* Notification Preferences Card */}
          <div className="rounded-2xl card-surface p-6 space-y-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <Bell className="w-4 h-4 text-[#F0B95B]" />
                  <span>Centre de notifications</span>
                </h2>
                <p className="text-xs text-[#858A9E] mt-0.5">
                  Choisissez les événements qui déclenchent une alerte dans Shiori.
                </p>
              </div>
              <button
                type="button"
                onClick={handleTestNotification}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-xs font-medium text-white transition-colors cursor-pointer shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#F0B95B]" />
                <span>Tester</span>
              </button>
            </div>

            <div className="divide-y divide-white/[0.06]">
              {[
                {
                  key: "airingAlerts" as const,
                  title: "Sorties d'épisodes suivis",
                  desc: "Soyez averti lorsqu'un nouvel épisode de votre liste Watching est diffusé.",
                },
                {
                  key: "weeklyDigest" as const,
                  title: "Récapitulatif hebdomadaire",
                  desc: "Résumé chaque dimanche soir des sorties de la semaine à venir.",
                },
                {
                  key: "milestones" as const,
                  title: "Paliers & séries terminées",
                  desc: "Célébrez vos séries complétées et nouveaux records d'épisodes/chapitres.",
                },
                {
                  key: "recommendations" as const,
                  title: "Suggestions éditoriales",
                  desc: "Recommandations ciblées basées sur vos coups de cœur.",
                },
              ].map((item) => {
                const enabled = profile.notificationPrefs[item.key];
                return (
                  <div
                    key={item.key}
                    className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-4"
                  >
                    <div>
                      <p className="text-sm font-medium text-[#ECEBE6]">{item.title}</p>
                      <p className="text-xs text-[#808599] mt-0.5">{item.desc}</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={enabled}
                      onClick={() =>
                        updateNotificationPrefs({ [item.key]: !enabled })
                      }
                      className={cn(
                        "w-11 h-6 rounded-full p-0.5 transition-colors shrink-0 cursor-pointer",
                        enabled ? "bg-[#E5484D]" : "bg-white/[0.12]"
                      )}
                    >
                      <span
                        className={cn(
                          "block w-5 h-5 rounded-full bg-white shadow transition-transform",
                          enabled ? "translate-x-5" : "translate-x-0"
                        )}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT: Supabase Cloud Sync + Data Portability */}
        <div className="lg:col-span-5 space-y-6">
          {/* Supabase Architecture Card */}
          <div className="rounded-2xl card-surface p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-400" />
                  <span>Supabase Cloud Sync</span>
                </h2>
                <p className="text-xs text-[#858A9E] mt-0.5">
                  Authentification, PostgreSQL & Row Level Security prêts à l&apos;emploi.
                </p>
              </div>
              <span
                className={cn(
                  "px-2.5 py-1 rounded-full text-[10.5px] font-mono font-semibold border shrink-0",
                  profile.mode === "supabase"
                    ? "bg-emerald-500/15 border-emerald-500/35 text-emerald-300"
                    : "bg-amber-500/15 border-amber-500/35 text-amber-300"
                )}
              >
                {profile.mode === "supabase" ? "Cloud actif" : "Mode Local"}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.07] space-y-2 text-xs text-[#B5B9C9]">
              <div className="flex items-center gap-2">
                {supabaseReady ? (
                  <Cloud className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <HardDrive className="w-4 h-4 text-amber-400 shrink-0" />
                )}
                <span>
                  {supabaseReady
                    ? "Variables d'environnement Supabase détectées."
                    : "Persistance automatique via localStorage active."}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-sky-400 shrink-0" />
                <span>
                  Schéma SQL complet fourni dans <code className="text-white">supabase/schema.sql</code> (tables{" "}
                  <code className="text-white">profiles</code>, <code className="text-white">library_entries</code>,{" "}
                  <code className="text-white">notifications</code>, <code className="text-white">activity_events</code>).
                </span>
              </div>
            </div>

            <div className="rounded-xl bg-[#07080C] border border-white/[0.08] p-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10.5px] font-mono text-[#7D8296]">.env.local</span>
                <button
                  type="button"
                  onClick={handleCopyEnv}
                  className="inline-flex items-center gap-1 text-[11px] text-[#A8ADBE] hover:text-white cursor-pointer"
                >
                  {copiedEnv ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span>Copié</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copier</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="text-[11px] font-mono text-[#C8CCE0] whitespace-pre-wrap break-all leading-relaxed">
                {envSnippet}
              </pre>
            </div>

            <div className="flex items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="flex-1 h-10 rounded-xl bg-white text-[#090A0F] hover:bg-[#ECEBE6] text-xs font-semibold transition-colors cursor-pointer"
              >
                {profile.mode === "supabase"
                  ? "Changer de compte"
                  : "Ouvrir la connexion Cloud"}
              </button>
              {profile.mode === "supabase" && (
                <button
                  type="button"
                  onClick={() => void signOutSupabase()}
                  className="h-10 px-4 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs font-semibold cursor-pointer"
                >
                  Déconnexion
                </button>
              )}
            </div>
          </div>

          {/* Data Backup / Portability */}
          <div className="rounded-2xl card-surface p-6 space-y-4">
            <div>
              <h2 className="text-base font-semibold text-white">
                Sauvegarde & Portabilité
              </h2>
              <p className="text-xs text-[#858A9E] mt-0.5">
                {library.length} œuvres actuellement enregistrées dans votre espace.
              </p>
            </div>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={handleExport}
                className="w-full h-10 px-4 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.09] text-xs font-medium text-white flex items-center justify-between transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Download className="w-4 h-4 text-sky-400" />
                  Exporter ma bibliothèque (JSON)
                </span>
                <span className="font-mono text-[#858A9E]">{library.length} titres</span>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="application/json"
                onChange={handleImportFile}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-10 px-4 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.09] text-xs font-medium text-white flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Upload className="w-4 h-4 text-emerald-400" />
                <span>Importer une sauvegarde JSON</span>
              </button>

              <button
                type="button"
                onClick={resetDemoData}
                className="w-full h-10 px-4 rounded-xl bg-rose-500/10 hover:bg-rose-500/18 border border-rose-500/25 text-xs font-medium text-rose-300 flex items-center gap-2 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Restaurer la bibliothèque de démonstration</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
