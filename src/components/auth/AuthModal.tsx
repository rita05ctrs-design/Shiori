"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Mail,
  Lock,
  User,
  AtSign,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  ShieldCheck,
  Sparkles,
  Cloud,
  Library,
  Check,
} from "lucide-react";
import { useShiori } from "@/context/ShioriContext";
import { useTranslation } from "@/hooks/useTranslation";
import { CINEMA_EASE } from "@/components/motion/MotionPrimitives";
import { cn } from "@/lib/utils";

function getPasswordStrength(pw: string): {
  level: 0 | 1 | 2 | 3;
  label: string;
  color: string;
} {
  if (!pw) return { level: 0, label: "", color: "bg-white/10" };
  let score = 0;
  if (pw.length >= 6) score += 1;
  if (pw.length >= 10 || (/[A-Z]/.test(pw) && /[0-9]/.test(pw))) score += 1;
  if (/[^A-Za-z0-9]/.test(pw) && pw.length >= 8) score += 1;
  if (score <= 1) return { level: 1, label: "Faible", color: "bg-rose-500" };
  if (score === 2) return { level: 2, label: "Correct", color: "bg-amber-400" };
  return { level: 3, label: "Robuste", color: "bg-emerald-400" };
}

export function AuthModal() {
  const {
    authModalOpen,
    authModalTab,
    setAuthModalOpen,
    supabaseReady,
    library,
    signInWithSupabase,
    signUpWithSupabase,
    signInWithGoogle,
  } = useShiori();
  const { tr } = useTranslation();

  const [tab, setTab] = useState<"signup" | "signin">("signup");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [keepLibrary, setKeepLibrary] = useState(true);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (authModalOpen) {
      setTab(authModalTab);
      setFeedback(null);
      setPassword("");
      setShowPassword(false);
    }
  }, [authModalOpen, authModalTab]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && authModalOpen) setAuthModalOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [authModalOpen, setAuthModalOpen]);

  const strength = getPasswordStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setSubmitting(true);

    try {
      const res =
        tab === "signin"
          ? await signInWithSupabase(email, password)
          : await signUpWithSupabase(email, password, displayName, {
              username: username.trim() || undefined,
              keepCurrentLibrary: keepLibrary,
            });
      setFeedback(res);
      if (res.ok) {
        setTimeout(() => {
          setAuthModalOpen(false);
          setDisplayName("");
          setUsername("");
          setEmail("");
          setPassword("");
          setFeedback(null);
        }, 650);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleAuth = async () => {
    setFeedback(null);
    setSubmitting(true);
    try {
      const res = await signInWithGoogle();
      setFeedback(res);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {authModalOpen && (
        <div className="fixed inset-0 z-[88] flex items-center justify-center px-3 sm:px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setAuthModalOpen(false)}
            className="fixed inset-0 bg-black/80 backdrop-blur-lg"
          />

          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 380, damping: 30, mass: 0.85 }}
            className="relative w-full max-w-[440px] max-h-[calc(100dvh-2rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] overflow-y-auto overscroll-contain rounded-3xl bg-[#0F111B] border border-white/[0.12] shadow-[0_36px_110px_rgba(0,0,0,0.9),0_0_60px_rgb(var(--shiori-accent-rgb)/0.12)]"
          >
            {/* Subtle top crimson ambient glow */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-72 h-40 rounded-full opacity-25 blur-3xl"
              style={{
                background: "radial-gradient(circle, var(--shiori-accent) 0%, transparent 72%)",
              }}
            />

            {/* Header */}
            <div className="relative z-10 px-6 pt-6 pb-4 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-gradient-to-br from-accent-hover to-accent-deep border border-white/20 text-accent-fg font-serif text-xs shadow">
                    栞
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[10.5px] font-mono uppercase tracking-[0.14em] px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/35 text-emerald-300">
                    {supabaseReady ? (
                      <>
                        <Cloud className="w-3 h-3" />
                        <span>{tr("Cloud Supabase actif")}</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-3 h-3" />
                        <span>{tr("Inscriptions actives")}</span>
                      </>
                    )}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-white tracking-tight">
                  {tab === "signup"
                    ? tr("Créer votre compte Shiori")
                    : tr("Connexion à Shiori")}
                </h3>
                <p className="text-xs text-[#8A8FA4] mt-0.5">
                  {tab === "signup"
                    ? tr("Sauvegardez votre bibliothèque, vos notes et vos statistiques.")
                    : tr("Retrouvez votre collection et votre progression sauvegardée.")}
                </p>
              </div>
              <motion.button
                type="button"
                whileTap={{ scale: 0.9 }}
                onClick={() => setAuthModalOpen(false)}
                className="p-1.5 rounded-full text-[#8D92A4] hover:text-white hover:bg-white/[0.08] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </motion.button>
            </div>

            {/* Animated 2-Tab Pill Switcher */}
            <div className="relative z-10 mx-6 grid grid-cols-2 gap-1 p-1 rounded-2xl bg-white/[0.04] border border-white/[0.07] mb-5">
              {[
                { id: "signup" as const, label: tr("Inscription") },
                { id: "signin" as const, label: tr("Connexion") },
              ].map((t) => {
                const active = tab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setTab(t.id);
                      setFeedback(null);
                    }}
                    className={cn(
                      "relative py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer",
                      active ? "text-white" : "text-[#8E93A6] hover:text-white"
                    )}
                  >
                    {active && (
                      <motion.span
                        layoutId="auth-modal-tab"
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                        className="absolute inset-0 rounded-xl bg-white/[0.11] border border-white/[0.12] shadow-sm"
                      />
                    )}
                    <span className="relative z-10">{t.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Google OAuth CTA (via Supabase) */}
            <div className="relative z-10 px-6 mb-4 space-y-3.5">
              <motion.button
                type="button"
                whileHover={{ scale: 1.015 }}
                whileTap={{ scale: 0.97 }}
                disabled={submitting}
                onClick={() => void handleGoogleAuth()}
                className="w-full h-10 rounded-xl bg-white/[0.06] hover:bg-white/[0.11] border border-white/[0.12] hover:border-white/[0.22] text-white text-xs font-semibold flex items-center justify-center gap-2.5 transition-all cursor-pointer disabled:opacity-60"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" aria-hidden="true">
                  <path
                    fill="#EA4335"
                    d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.9-5.5 3.9-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.9 1.5l2.6-2.5C16.8 3.4 14.6 2.5 12 2.5 6.8 2.5 2.5 6.8 2.5 12s4.3 9.5 9.5 9.5c5.5 0 9.1-3.8 9.1-9.2 0-.6-.1-1.1-.2-1.6H12z"
                  />
                  <path
                    fill="#34A853"
                    d="M3.6 7.5l3.2 2.3C7.7 7.7 9.7 6.3 12 6.3c1.9 0 3.1.8 3.9 1.5l2.6-2.5C16.8 3.4 14.6 2.5 12 2.5 8.2 2.5 5 4.6 3.6 7.5z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M12 21.5c2.5 0 4.7-.8 6.3-2.3l-2.9-2.4c-.8.5-1.9.9-3.4.9-2.6 0-4.8-1.7-5.6-4.1l-3.2 2.5C4.7 19.3 8.1 21.5 12 21.5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M21.1 12.3c0-.6-.1-1.1-.2-1.6H12v3.9h5.5c-.3 1.2-1 2.2-2.1 2.9l2.9 2.4c1.7-1.6 2.8-4 2.8-7.6z"
                  />
                </svg>
                <span>{tr("Continuer avec Google")}</span>
                {!supabaseReady && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.08] text-[#9A9EAE]">
                    Supabase
                  </span>
                )}
              </motion.button>

              <div className="flex items-center gap-3 text-[10.5px] font-mono uppercase tracking-widest text-[#686D82]">
                <span className="h-px flex-1 bg-white/[0.08]" />
                <span>{tr("ou par e-mail")}</span>
                <span className="h-px flex-1 bg-white/[0.08]" />
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="relative z-10 px-6 pb-6 space-y-3.5">
              <AnimatePresence mode="wait">
                <motion.div
                  key={tab}
                  initial={{ opacity: 0, x: tab === "signup" ? -10 : 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: tab === "signup" ? 10 : -10 }}
                  transition={{ duration: 0.2, ease: CINEMA_EASE }}
                  className="space-y-3.5"
                >
                  {tab === "signup" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10.5px] font-mono uppercase tracking-[0.14em] text-[#858A9E] mb-1.5">
                          {tr("Nom d'affichage")}
                        </label>
                        <div className="relative">
                          <User className="w-4 h-4 text-[#6E7387] absolute left-3.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            required
                            minLength={2}
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            placeholder="Yuki"
                            className="w-full h-10 pl-10 pr-3 rounded-xl bg-[#08090E] border border-white/[0.09] text-base sm:text-sm text-white placeholder:text-[#555A6E] focus:outline-none focus:border-accent"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10.5px] font-mono uppercase tracking-[0.14em] text-[#858A9E] mb-1.5">
                          {tr("Pseudo (optionnel)")}
                        </label>
                        <div className="relative">
                          <AtSign className="w-3.5 h-3.5 text-[#6E7387] absolute left-3.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="yuki_anime"
                            className="w-full h-10 pl-9 pr-3 rounded-xl bg-[#08090E] border border-white/[0.09] text-base sm:text-sm text-white font-mono placeholder:text-[#555A6E] focus:outline-none focus:border-accent"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-[10.5px] font-mono uppercase tracking-[0.14em] text-[#858A9E] mb-1.5">
                      {tab === "signin" && !supabaseReady
                        ? tr("Adresse e-mail ou pseudo")
                        : tr("Adresse e-mail")}
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-[#6E7387] absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type={tab === "signin" && !supabaseReady ? "text" : "email"}
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full h-10 pl-10 pr-3.5 rounded-xl bg-[#08090E] border border-white/[0.09] text-base sm:text-sm text-white placeholder:text-[#555A6E] focus:outline-none focus:border-accent"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[10.5px] font-mono uppercase tracking-[0.14em] text-[#858A9E]">
                        {tr("Mot de passe")}
                      </label>
                      {tab === "signup" && password && (
                        <span className="text-[10.5px] font-mono text-[#A5A9BB]">
                          {tr("Force :")} <strong className="text-white">{tr(strength.label)}</strong>
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-[#6E7387] absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={tr("6 caractères minimum")}
                        className="w-full h-10 pl-10 pr-10 rounded-xl bg-[#08090E] border border-white/[0.09] text-base sm:text-sm text-white placeholder:text-[#555A6E] focus:outline-none focus:border-accent"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={tr("Mot de passe")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7D8296] hover:text-white cursor-pointer"
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>

                    {/* Live password strength segments */}
                    {tab === "signup" && password.length > 0 && (
                      <div className="mt-2 grid grid-cols-3 gap-1.5">
                        {[1, 2, 3].map((step) => (
                          <div
                            key={step}
                            className={cn(
                              "h-1 rounded-full transition-colors duration-300",
                              strength.level >= step ? strength.color : "bg-white/[0.08]"
                            )}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Option to carry over current library on signup */}
                  {tab === "signup" && library.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setKeepLibrary((v) => !v)}
                      className={cn(
                        "w-full p-3 rounded-xl border flex items-center gap-3 text-left transition-all cursor-pointer",
                        keepLibrary
                          ? "bg-accent/[0.08] border-accent/35"
                          : "bg-white/[0.02] border-white/[0.08] hover:border-white/[0.15]"
                      )}
                    >
                      <span
                        className={cn(
                          "w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors",
                          keepLibrary
                            ? "bg-accent border-accent text-accent-fg"
                            : "bg-transparent border-white/25"
                        )}
                      >
                        {keepLibrary && <Check className="w-3.5 h-3.5 stroke-[2.8]" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-white flex items-center gap-1.5">
                          <Library className="w-3.5 h-3.5 text-accent-soft" />
                          <span>{tr("Importer ma bibliothèque actuelle ({n} titres)", { n: library.length })}</span>
                        </p>
                        <p className="text-[10.5px] text-[#83889C] mt-0.5">
                          {tr("Décochez pour démarrer avec une bibliothèque vierge.")}
                        </p>
                      </div>
                    </button>
                  )}
                </motion.div>
              </AnimatePresence>

              {feedback && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "p-3 rounded-xl text-xs flex items-start gap-2 border",
                    feedback.ok
                      ? "bg-emerald-500/12 border-emerald-500/35 text-emerald-300"
                      : "bg-rose-500/12 border-rose-500/35 text-rose-200"
                  )}
                >
                  {feedback.ok ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  )}
                  <span>{feedback.message}</span>
                </motion.div>
              )}

              <motion.button
                type="submit"
                whileHover={{ scale: 1.015 }}
                whileTap={{ scale: 0.97 }}
                disabled={submitting}
                className="w-full h-11 mt-1 rounded-xl bg-gradient-to-r from-accent via-accent-hover to-accent-deep hover:brightness-110 disabled:opacity-60 text-accent-fg text-sm font-semibold shadow-[0_12px_30px_rgb(var(--shiori-accent-rgb)/0.4)] flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>
                  {submitting
                    ? tr("Traitement...")
                    : tab === "signup"
                      ? tr("Créer mon compte Shiori")
                      : tr("Se connecter")}
                </span>
              </motion.button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
