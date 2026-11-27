"use client";

import { useCallback, useEffect, useRef } from "react";

interface PosterTiltOptions {
  /** Maximum 3D tilt angle in degrees (default 7.5) */
  maxTilt?: number;
}

/**
 * Zero-re-render 3D magnetic perspective tilt + cursor-tracking specular spotlight
 * for anime & manga posters.
 *
 * Performance & Stability Guarantees:
 * - Writes CSS custom properties (--rx, --ry, --mx, --my) directly via rAF (0 React re-renders)
 * - Caches getBoundingClientRect() once on pointerenter (0 reflows during pointermove)
 * - Mouse-only (pointerType === "mouse") so mobile touch scrolling is never touched
 * - Automatically skips while dragging a rail (.shiori-rail-dragging) or holding a mouse button
 * - Honors both OS prefers-reduced-motion and Shiori's data-motion="reduced" setting
 */
export function usePosterTilt<T extends HTMLElement = HTMLDivElement>(
  options: PosterTiltOptions = {}
) {
  const { maxTilt = 7.5 } = options;
  const tiltRef = useRef<T | null>(null);
  const rectRef = useRef<DOMRect | null>(null);
  const scrollSnapRef = useRef<{ sx: number; sy: number; rl: number }>({
    sx: 0,
    sy: 0,
    rl: 0,
  });
  const rafRef = useRef(0);
  const latestPointRef = useRef<{ x: number; y: number } | null>(null);

  const isReducedMotion = () => {
    if (typeof window === "undefined") return true;
    if (document.documentElement.dataset.motion === "reduced") return true;
    if (
      document.documentElement.dataset.motion !== "full" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      return true;
    }
    return false;
  };

  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
    };
  }, []);

  const resetTilt = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    rectRef.current = null;
    latestPointRef.current = null;
    const el = tiltRef.current;
    if (!el) return;
    delete el.dataset.tilting;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
  }, []);

  const captureRect = useCallback((el: HTMLElement) => {
    const rail = el.closest(".touch-rail") as HTMLElement | null;
    rectRef.current = el.getBoundingClientRect();
    scrollSnapRef.current = {
      sx: window.scrollX,
      sy: window.scrollY,
      rl: rail ? rail.scrollLeft : 0,
    };
  }, []);

  const onPointerEnter = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (e.pointerType !== "mouse" || e.buttons !== 0) return;
      if (isReducedMotion()) return;
      const el = tiltRef.current;
      if (!el || el.closest(".shiori-rail-dragging")) return;
      captureRect(el);
      el.dataset.tilting = "true";
    },
    [captureRect]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (e.pointerType !== "mouse" || e.buttons !== 0) return;
      const el = tiltRef.current;
      if (!el) return;
      if (el.closest(".shiori-rail-dragging")) {
        resetTilt();
        return;
      }

      if (!rectRef.current) {
        if (isReducedMotion()) return;
        captureRect(el);
        el.dataset.tilting = "true";
      }

      latestPointRef.current = { x: e.clientX, y: e.clientY };
      if (rafRef.current) return;

      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0;
        const target = tiltRef.current;
        const pt = latestPointRef.current;
        if (!target || !pt) return;

        // Re-measure only if page or horizontal rail scrolled while hovering
        const rail = target.closest(".touch-rail") as HTMLElement | null;
        const snap = scrollSnapRef.current;
        const curRl = rail ? rail.scrollLeft : 0;
        if (
          !rectRef.current ||
          window.scrollY !== snap.sy ||
          window.scrollX !== snap.sx ||
          curRl !== snap.rl
        ) {
          captureRect(target);
        }

        const rect = rectRef.current;
        if (!rect || rect.width <= 0 || rect.height <= 0) return;

        const px = Math.min(1, Math.max(0, (pt.x - rect.left) / rect.width));
        const py = Math.min(1, Math.max(0, (pt.y - rect.top) / rect.height));
        const rx = (0.5 - py) * (maxTilt * 2);
        const ry = (px - 0.5) * (maxTilt * 2);

        target.style.setProperty("--rx", `${rx.toFixed(2)}deg`);
        target.style.setProperty("--ry", `${ry.toFixed(2)}deg`);
        target.style.setProperty("--mx", `${(px * 100).toFixed(1)}%`);
        target.style.setProperty("--my", `${(py * 100).toFixed(1)}%`);
      });
    },
    [captureRect, maxTilt, resetTilt]
  );

  const onPointerDown = useCallback(() => {
    resetTilt();
  }, [resetTilt]);

  return {
    tiltRef,
    tiltHandlers: {
      onPointerEnter,
      onPointerMove,
      onPointerDown,
      onPointerLeave: resetTilt,
      onPointerCancel: resetTilt,
    },
  };
}
