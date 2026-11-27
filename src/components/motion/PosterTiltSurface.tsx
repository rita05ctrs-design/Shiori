"use client";

import React from "react";
import { usePosterTilt } from "@/hooks/usePosterTilt";

interface PosterTiltSurfaceProps {
  maxTilt?: number;
  className?: string;
  children: React.ReactNode;
}

/**
 * Lightweight 3D magnetic perspective + cursor spotlight surface for anime/manga posters.
 * Safe to render inside .map() loops with zero React re-renders on mousemove.
 */
export function PosterTiltSurface({
  maxTilt = 7.5,
  className,
  children,
}: PosterTiltSurfaceProps) {
  const { tiltRef, tiltHandlers } = usePosterTilt<HTMLDivElement>({ maxTilt });

  return (
    <div ref={tiltRef} {...tiltHandlers} className={className}>
      {children}
    </div>
  );
}
