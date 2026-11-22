"use client";

import React, { Suspense } from "react";
import { MotionConfig } from "framer-motion";
import { NavigationProgress } from "./NavigationProgress";
import { AmbientCanvas } from "./AmbientCanvas";

export function MotionRoot({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <AmbientCanvas />
      <Suspense fallback={null}>
        <NavigationProgress />
      </Suspense>
      <div className="relative z-[2] flex-1 flex flex-col">{children}</div>
    </MotionConfig>
  );
}
