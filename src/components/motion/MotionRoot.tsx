"use client";

import React, { Suspense } from "react";
import { MotionConfig } from "framer-motion";
import { AmbientSpotlight } from "./MotionPrimitives";
import { NavigationProgress } from "./NavigationProgress";

export function MotionRoot({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <AmbientSpotlight />
      <Suspense fallback={null}>
        <NavigationProgress />
      </Suspense>
      <div className="relative z-[2] flex-1 flex flex-col">{children}</div>
    </MotionConfig>
  );
}
