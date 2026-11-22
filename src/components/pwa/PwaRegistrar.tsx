"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installedState = false;
const listeners = new Set<() => void>();

function notifyListeners() {
  for (const l of listeners) l();
}

export function usePwaInstall() {
  const [, setTick] = useState(0);
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const sync = () => setTick((t) => t + 1);
    listeners.add(sync);

    if (typeof window !== "undefined") {
      const ua = window.navigator.userAgent || "";
      setIsIos(/iphone|ipad|ipod/i.test(ua));
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        Boolean((window.navigator as unknown as { standalone?: boolean }).standalone);
      setIsStandalone(standalone || installedState);
    }

    return () => {
      listeners.delete(sync);
    };
  }, []);

  const triggerInstall = async (): Promise<"accepted" | "dismissed" | "unavailable"> => {
    if (!deferredPrompt) return "unavailable";
    const ev = deferredPrompt;
    deferredPrompt = null;
    notifyListeners();
    try {
      await ev.prompt();
      const choice = await ev.userChoice;
      if (choice.outcome === "accepted") {
        installedState = true;
        setIsStandalone(true);
        notifyListeners();
      }
      return choice.outcome;
    } catch {
      return "dismissed";
    }
  };

  return {
    canInstall: Boolean(deferredPrompt) && !isStandalone,
    isStandalone,
    isIos,
    triggerInstall,
  };
}

/**
 * Registers the Shiori PWA Service Worker (`/sw.js`) and captures the browser's
 * native `beforeinstallprompt` event so Desktop & Mobile users can install Shiori as a native app.
 */
export function PwaRegistrar() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      deferredPrompt = e as BeforeInstallPromptEvent;
      notifyListeners();
    };

    const onAppInstalled = () => {
      deferredPrompt = null;
      installedState = true;
      notifyListeners();
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onAppInstalled);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch(() => {
          // Non-fatal in private browsing or restricted contexts
        });
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  return null;
}
