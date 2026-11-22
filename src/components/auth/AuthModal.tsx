"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Cloud, HardDrive, Mail, Lock, User, CheckCircle2, AlertCircle } from "lucide-react";
import { useShiori } from "@/context/ShioriContext";

export function AuthModal() {
  const {
    authModalOpen,
    setAuthModalOpen,
    supabaseReady,
    profile,
    updateProfile,
    signInWithSupabase,
    signUpWithSupabase,
  } = useShiori();

  const [tab, setTab] = useState<"signin" | "signup" | "local">("signin");
  const [email, setEmail] = useState(profile.email || "");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState(profile.displayName || "");
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (tab === "local") {
      if (!displayName.trim()) return;
      updateProfile({
        displayName: displayName.trim(),
        username: displayName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_"),
        email: email.trim() || profile.email,
      });
      setAuthModalOpen(false);
      return;
    }

    setSubmitting(true);
    try {
      const res =
        tab === "signin"
          ? await signInWithSupabase(email, password)
          : await signUpWithSupabase(email, password, displayName || email.split("@")[0]);
      setFeedback(res);
      if (res.ok && tab === "signin") {
        setTimeout(() => setAuthModalOpen(false), 700);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {authModalOpen && (
        <div className="fixed inset-0 z-[88] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setAuthModalOpen(false)}
            className="fixed inset-0 bg-black/75 backdrop-blur-md"
          />

          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.96 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-md rounded-2xl bg-[#10121B] border border-white/[0.11] shadow-[0_32px_90px_rgba(0,0,0,0.85)] overflow-hidden"
          >
            <div className="px-6 pt-6 pb-4 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-[#E5484D]/15 border border-[#E5484D]/35 text-[#F45B62] font-serif text-xs">
                    栞
                  </span>
                  <span className="text-xs font-mono uppercase tracking-[0.16em] text-[#8E93A6]">
                    Compte Shiori
                  </span>
                </div>
                <h3 className="text-xl font-semibold text-white">
                  Synchronisation & Profil
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setAuthModalOpen(false)}
                className="p-1.5 rounded-lg text-[#8D92A4] hover:text-white hover:bg-white/[0.07] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Supabase Readiness Banner */}
            <div className="mx-6 mb-4 p-3 rounded-xl border flex items-start gap-2.5 text-xs bg-white/[0.025] border-white/[0.08]">
              {supabaseReady ? (
                <>
                  <Cloud className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <p className="text-[#C7CBD8]">
                    <span className="text-emerald-400 font-medium">Supabase détecté.</span>{" "}
                    Connectez-vous pour synchroniser votre bibliothèque dans le cloud.
                  </p>
                </>
              ) : (
                <>
                  <HardDrive className="w-4 h-4 text-[#F0B95B] shrink-0 mt-0.5" />
                  <p className="text-[#A8ADBE] leading-relaxed">
                    <span className="text-[#F0B95B] font-medium">Mode Local actif.</span>{" "}
                    Ajoutez <code className="text-white/90">NEXT_PUBLIC_SUPABASE_URL</code> dans{" "}
                    <code className="text-white/90">.env.local</code> pour activer le cloud, ou
                    personnalisez votre profil local ci-dessous.
                  </p>
                </>
              )}
            </div>

            {/* Mode tabs */}
            <div className="mx-6 grid grid-cols-3 gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/[0.06] mb-5">
              {[
                { id: "signin", label: "Connexion" },
                { id: "signup", label: "Inscription" },
                { id: "local", label: "Profil local" },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setTab(t.id as "signin" | "signup" | "local");
                    setFeedback(null);
                  }}
                  className={`py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    tab === t.id
                      ? "bg-white/[0.12] text-white"
                      : "text-[#8E93A6] hover:text-white"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-3.5">
              {(tab === "signup" || tab === "local") && (
                <div>
                  <label className="block text-[11px] font-medium uppercase tracking-[0.12em] text-[#858A9E] mb-1.5">
                    Nom d&apos;affichage
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-[#6E7387] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Ex: Kuro"
                      className="w-full h-10 pl-10 pr-3.5 rounded-xl bg-[#090A0F] border border-white/[0.09] text-sm text-white focus:outline-none focus:border-[#E5484D]"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-medium uppercase tracking-[0.12em] text-[#858A9E] mb-1.5">
                  Adresse e-mail
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#6E7387] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required={tab !== "local"}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="vous@exemple.fr"
                    className="w-full h-10 pl-10 pr-3.5 rounded-xl bg-[#090A0F] border border-white/[0.09] text-sm text-white focus:outline-none focus:border-[#E5484D]"
                  />
                </div>
              </div>

              {tab !== "local" && (
                <div>
                  <label className="block text-[11px] font-medium uppercase tracking-[0.12em] text-[#858A9E] mb-1.5">
                    Mot de passe
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-[#6E7387] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full h-10 pl-10 pr-3.5 rounded-xl bg-[#090A0F] border border-white/[0.09] text-sm text-white focus:outline-none focus:border-[#E5484D]"
                    />
                  </div>
                </div>
              )}

              {feedback && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-start gap-2 border ${
                    feedback.ok
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                      : "bg-amber-500/10 border-amber-500/30 text-amber-200"
                  }`}
                >
                  {feedback.ok ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  )}
                  <span>{feedback.message}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full h-10 mt-2 rounded-xl bg-[#E5484D] hover:bg-[#F2545B] disabled:opacity-60 text-white text-sm font-semibold shadow-[0_8px_24px_rgba(229,72,77,0.35)] transition-all cursor-pointer"
              >
                {submitting
                  ? "Traitement..."
                  : tab === "signin"
                    ? "Se connecter via Supabase"
                    : tab === "signup"
                      ? "Créer un compte cloud"
                      : "Enregistrer le profil local"}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
