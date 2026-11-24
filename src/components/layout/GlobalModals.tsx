"use client";

import React from "react";
import dynamic from "next/dynamic";
import { useShiori } from "@/context/ShioriContext";

const CommandPalette = dynamic(
  () => import("@/components/layout/CommandPalette").then((m) => m.CommandPalette),
  { ssr: false }
);

const QuickEditModal = dynamic(
  () => import("@/components/media/QuickEditModal").then((m) => m.QuickEditModal),
  { ssr: false }
);

const TrailerModal = dynamic(
  () => import("@/components/media/TrailerModal").then((m) => m.TrailerModal),
  { ssr: false }
);

const AuthModal = dynamic(
  () => import("@/components/auth/AuthModal").then((m) => m.AuthModal),
  { ssr: false }
);

/**
 * Lazy-loads heavy global overlays strictly on demand when opened,
 * reducing initial JS parsed on every route (especially on mobile).
 */
export function GlobalModals() {
  const { commandOpen, editingMedia, trailerVideo, authModalOpen } = useShiori();

  return (
    <>
      {commandOpen && <CommandPalette />}
      {editingMedia && <QuickEditModal />}
      {trailerVideo && <TrailerModal />}
      {authModalOpen && <AuthModal />}
    </>
  );
}
