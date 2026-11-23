"use client";

import React, { Suspense } from "react";
import { MotionConfig } from "framer-motion";
import { useShiori } from "@/context/ShioriContext";
import { NavigationProgress } from "./NavigationProgress";
import { AmbientCanvas } from "./AmbientCanvas";

export function MotionRoot({ children }: { children: React.ReactNode }) {
  const { displayPrefs } = useShiori();
  const reducedMotion =
    displayPrefs.motion === "reduced"
      ? "always"
      : displayPrefs.motion === "full"
        ? "never"
        : "user";

  return (
    <MotionConfig reducedMotion={reducedMotion}>
      <AmbientCanvas />
      <Suspense fallback={null}>
        <NavigationProgress />
      </Suspense>
      <div className="relative z-[2] flex-1 flex flex-col">{children}</div>
    </MotionConfig>
  );
}
