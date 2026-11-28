"use client";

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import type { UiMessageKey } from "@/lib/ui-translations";
import { cn } from "@/lib/utils";

export interface MobileDockTabItem {
  href: string;
  labelKey: UiMessageKey;
  icon: LucideIcon;
  match: (pathname: string) => boolean;
}

interface MobileLiquidDockProps {
  items: readonly MobileDockTabItem[];
  pathname: string;
  watchingCount: number;
}

const SPRING_TRANSITION =
  "transform 340ms cubic-bezier(0.22, 1.32, 0.36, 1), opacity 180ms ease";
const RELEASE_GUARD_MS = 1800;

/**
 * Apple iOS-inspired "Liquid Glass" interactive bottom dock for mobile.
 *
 * - Touch & glide your finger horizontally across tabs without lifting:
 *   a translucent frosted-glass lens tracks your thumb directly on the GPU
 *   (translate3d + velocity-reactive liquid squash/stretch, 0 React re-renders per pixel).
 * - Prefetches every hovered tab during the glide so releasing your finger switches
 *   routes almost instantaneously via non-blocking `startTransition(() => router.push(...))`.
 */
export function MobileLiquidDock({
  items,
  pathname,
  watchingCount,
}: MobileLiquidDockProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const [, startTransition] = useTransition();

  const trackRef = useRef<HTMLDivElement>(null);
  const lensRef = useRef<HTMLDivElement>(null);

  // Optimistic selected index while Next.js commits the route transition
  const routeIndex = Math.max(
    0,
    items.findIndex((item) => item.match(pathname))
  );
  const [pendingIndex, setPendingIndex] = useState<number | null>(null);
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const dragRef = useRef<{
    active: boolean;
    pointerId: number;
    startX: number;
    lastX: number;
    lastTime: number;
    moved: boolean;
    currentIndex: number;
    cancelled: boolean;
    trackLeft: number;
    trackWidth: number;
    slotWidth: number;
  }>({
    active: false,
    pointerId: -1,
    startX: 0,
    lastX: 0,
    lastTime: 0,
    moved: false,
    currentIndex: 0,
    cancelled: false,
    trackLeft: 0,
    trackWidth: 0,
    slotWidth: 0,
  });

  const prefetchedRef = useRef(new Set<string>());
  const activeVisualIndex = scrubIndex ?? pendingIndex ?? routeIndex;

  // Clear optimistic pending index once pathname arrives
  useEffect(() => {
    setPendingIndex(null);
  }, [pathname]);

  useEffect(() => {
    if (pendingIndex === null) return;
    const timer = window.setTimeout(() => setPendingIndex(null), RELEASE_GUARD_MS);
    return () => window.clearTimeout(timer);
  }, [pendingIndex]);

  // Eagerly warm Next.js Router Cache for all 6 mobile routes so tab switches are instant
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(max-width: 767px)").matches) return;
    const warm = () => {
      for (const item of items) {
        if (!prefetchedRef.current.has(item.href)) {
          prefetchedRef.current.add(item.href);
          router.prefetch(item.href);
        }
      }
    };
    const timer = window.setTimeout(warm, 80);
    return () => window.clearTimeout(timer);
  }, [items, router]);

  const positionLensToIndex = useCallback(
    (index: number, animate: boolean) => {
      const track = trackRef.current;
      const lens = lensRef.current;
      if (!track || !lens) return;
      const count = items.length;
      if (count === 0) return;

      const slotWidth = track.clientWidth / count;
      const clamped = Math.max(0, Math.min(count - 1, index));
      const x = clamped * slotWidth;

      lens.style.width = `${slotWidth}px`;
      lens.style.transition = animate ? SPRING_TRANSITION : "none";
      lens.style.transform = `translate3d(${x}px, 0, 0) scale3d(1, 1, 1)`;
    },
    [items.length]
  );

  // Keep lens synced on active index change & viewport resize/orientation change
  useLayoutEffect(() => {
    if (dragRef.current.active) return;
    positionLensToIndex(activeVisualIndex, true);
  }, [activeVisualIndex, positionLensToIndex]);

  useEffect(() => {
    const onResize = () => {
      if (!dragRef.current.active) {
        positionLensToIndex(activeVisualIndex, false);
      }
    };
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, [activeVisualIndex, positionLensToIndex]);

  const navigateToIndex = useCallback(
    (targetIdx: number) => {
      const target = items[targetIdx];
      if (!target) return;
      if (target.match(pathname)) {
        // Already on this tab: scroll smoothly to top for crisp native app feel
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      setPendingIndex(targetIdx);
      startTransition(() => {
        router.push(target.href);
      });
    },
    [items, pathname, router]
  );

  const indexFromClientX = (clientX: number, trackLeft: number, slotWidth: number) => {
    if (slotWidth <= 0) return 0;
    const raw = Math.floor((clientX - trackLeft) / slotWidth);
    return Math.max(0, Math.min(items.length - 1, raw));
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    const track = trackRef.current;
    const lens = lensRef.current;
    if (!track || !lens) return;

    const rect = track.getBoundingClientRect();
    const slotWidth = rect.width / items.length;
    const idx = indexFromClientX(e.clientX, rect.left, slotWidth);

    dragRef.current = {
      active: true,
      pointerId: e.pointerId,
      startX: e.clientX,
      lastX: e.clientX,
      lastTime: performance.now(),
      moved: false,
      currentIndex: idx,
      cancelled: false,
      trackLeft: rect.left,
      trackWidth: rect.width,
      slotWidth,
    };

    try {
      track.setPointerCapture(e.pointerId);
    } catch {
      // ignore if capture unavailable
    }

    setIsDragging(true);
    setScrubIndex(idx);

    const targetItem = items[idx];
    if (targetItem && !prefetchedRef.current.has(targetItem.href)) {
      prefetchedRef.current.add(targetItem.href);
      router.prefetch(targetItem.href);
    }

    // Immediate tactile liquid swell right under the thumb
    const centerX = Math.max(
      0,
      Math.min(rect.width - slotWidth, e.clientX - rect.left - slotWidth / 2)
    );
    lens.style.width = `${slotWidth}px`;
    lens.style.transition = "transform 130ms cubic-bezier(0.22, 1, 0.36, 1)";
    lens.style.transform = `translate3d(${centerX}px, 0, 0) scale3d(1.07, 1.11, 1)`;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d.active || e.pointerId !== d.pointerId) return;
    const lens = lensRef.current;
    const track = trackRef.current;
    if (!lens || !track) return;

    const rect = track.getBoundingClientRect();
    // Allow cancelling if finger slides far above the dock (> 96px upward)
    const verticalDrift = rect.top - e.clientY;
    if (verticalDrift > 96) {
      d.cancelled = true;
      setScrubIndex(null);
      positionLensToIndex(routeIndex, true);
      return;
    }
    d.cancelled = false;

    const dx = e.clientX - d.lastX;
    const now = performance.now();
    const dt = Math.max(8, now - d.lastTime);
    const velocity = Math.min(1.6, Math.abs(dx) / dt); // px/ms

    if (Math.abs(e.clientX - d.startX) > 4) {
      d.moved = true;
    }

    // Direct GPU position tracking (zero React re-renders per pixel!)
    const maxX = Math.max(0, d.trackWidth - d.slotWidth);
    const rawX = e.clientX - d.trackLeft - d.slotWidth / 2;
    // Soft rubber-band resistance at left/right edges like iOS
    let x = rawX;
    if (rawX < 0) x = rawX * 0.24;
    else if (rawX > maxX) x = maxX + (rawX - maxX) * 0.24;

    // Velocity-reactive liquid glass droplet stretch
    const stretchX = 1.07 + Math.min(0.11, velocity * 0.085);
    const stretchY = 1.11 - Math.min(0.05, velocity * 0.03);

    lens.style.transition = "none";
    lens.style.transform = `translate3d(${x}px, 0, 0) scale3d(${stretchX.toFixed(3)}, ${stretchY.toFixed(3)}, 1)`;

    const nextIdx = indexFromClientX(e.clientX, d.trackLeft, d.slotWidth);
    if (nextIdx !== d.currentIndex) {
      d.currentIndex = nextIdx;
      setScrubIndex(nextIdx);
      const hoveredItem = items[nextIdx];
      if (hoveredItem) {
        router.prefetch(hoveredItem.href);
        prefetchedRef.current.add(hoveredItem.href);
      }
      // Subtle native haptic tick when gliding into a new tab (Android / supported devices)
      if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
        try {
          navigator.vibrate(6);
        } catch {
          // ignore
        }
      }
    }

    d.lastX = e.clientX;
    d.lastTime = now;
  };

  const finishGesture = (e: React.PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const d = dragRef.current;
    if (!d.active || e.pointerId !== d.pointerId) return;
    d.active = false;

    const track = trackRef.current;
    if (track) {
      try {
        if (track.hasPointerCapture(e.pointerId)) {
          track.releasePointerCapture(e.pointerId);
        }
      } catch {
        // ignore
      }
    }

    setIsDragging(false);
    setScrubIndex(null);

    if (cancelled || d.cancelled) {
      positionLensToIndex(pendingIndex ?? routeIndex, true);
      return;
    }

    const finalIdx = indexFromClientX(e.clientX, d.trackLeft, d.slotWidth);
    positionLensToIndex(finalIdx, true);
    navigateToIndex(finalIdx);
  };

  return (
    <nav
      aria-label="Mobile navigation"
      data-mobile-bottom-nav="true"
      className="md:hidden fixed bottom-0 inset-x-0 z-50 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-1 pointer-events-none select-none"
    >
      <div
        className={cn(
          "shiori-liquid-dock pointer-events-auto relative rounded-[26px] p-[5px] transition-transform duration-200 ease-out",
          isDragging && "scale-[1.015]"
        )}
      >
        {/* Top glass specular hairline */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-7 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent"
        />

        {/* Interactive Scrubbable Track */}
        <div
          ref={trackRef}
          role="tablist"
          aria-label="Mobile navigation tabs"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={(e) => finishGesture(e, false)}
          onPointerCancel={(e) => finishGesture(e, true)}
          className="relative grid grid-cols-6 items-center touch-none select-none cursor-pointer"
        >
          {/* Floating Apple Liquid Glass Lens */}
          <div
            ref={lensRef}
            aria-hidden="true"
            data-liquid-lens="true"
            className={cn(
              "shiori-liquid-lens pointer-events-none absolute left-0 top-0 bottom-0 rounded-[21px] will-change-transform",
              isDragging && "shiori-liquid-lens-active"
            )}
            style={{ width: `${100 / items.length}%` }}
          />

          {items.map((item, idx) => {
            const isActive = activeVisualIndex === idx;
            const Icon = item.icon;
            const label = t(item.labelKey);

            return (
              <button
                key={item.href}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-label={label}
                onClick={(e) => {
                  // Pointer gestures already navigated on pointerUp; keep keyboard Enter/Space accessible
                  if (e.detail === 0) {
                    positionLensToIndex(idx, true);
                    navigateToIndex(idx);
                  }
                }}
                className={cn(
                  "relative z-10 flex flex-col items-center justify-center gap-0.5 min-h-[48px] py-1 px-0 rounded-[20px] select-none [-webkit-tap-highlight-color:transparent] min-w-0 bg-transparent border-0 outline-none focus-visible:ring-1 focus-visible:ring-white/40 transition-colors duration-150",
                  isActive ? "text-white" : "text-[#9297AC]"
                )}
              >
                <div
                  className={cn(
                    "relative transition-transform duration-200 ease-[cubic-bezier(0.22,1.3,0.36,1)]",
                    isActive
                      ? isDragging
                        ? "-translate-y-1 scale-[1.18]"
                        : "-translate-y-0.5 scale-[1.09]"
                      : "translate-y-0 scale-100"
                  )}
                >
                  <Icon
                    className={cn(
                      "w-[17px] h-[17px] shrink-0 transition-colors duration-150",
                      isActive &&
                        "text-white drop-shadow-[0_0_10px_rgb(var(--shiori-accent-rgb)/0.85)]"
                    )}
                  />
                  {item.href === "/library" && watchingCount > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 min-w-[15px] h-[15px] px-1 rounded-full bg-accent text-[9px] font-mono font-bold text-accent-fg flex items-center justify-center shadow-sm">
                      {watchingCount > 9 ? "9+" : watchingCount}
                    </span>
                  )}
                </div>
                <span
                  className={cn(
                    "text-[8px] min-[390px]:text-[8.5px] font-semibold tracking-[-0.025em] whitespace-nowrap truncate max-w-full leading-tight transition-opacity duration-150",
                    isActive ? "text-white opacity-100" : "text-[#9297AC] opacity-85"
                  )}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
