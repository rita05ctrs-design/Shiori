"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface DragScrollOptions {
  /** Multiplier for drag responsiveness (default 1.08) */
  dragSpeed?: number;
  /** Friction factor per 60fps frame for inertia glide (0.90–0.96, default 0.925) */
  friction?: number;
}

/**
 * Locked-120fps horizontal scroll & click-drag hook:
 * - Caches maxScroll via ResizeObserver + MutationObserver (handles async items cleanly)
 * - Batches scroll & mousemove updates to rAF (0 layout thrash even on 1000Hz mice)
 * - Floating-point accumulator during inertia (eliminates Windows 1x-DPI integer scrollLeft stutter)
 * - Toggles `shiori-rail-dragging` directly on the DOM node (0 React re-renders during drag)
 * - Immediately yields to native wheel/touch input so inertia never fights user scrolling
 */
export function useDragScroll<T extends HTMLElement = HTMLDivElement>(
  options: DragScrollOptions = {}
) {
  const { dragSpeed = 1.08, friction = 0.925 } = options;

  const ref = useRef<T | null>(null);
  const trackThumbRef = useRef<HTMLDivElement | null>(null);
  const [node, setNode] = useState<T | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const setRef = useCallback((el: T | null) => {
    ref.current = el;
    setNode((prev) => (prev === el ? prev : el));
  }, []);

  const boundsRef = useRef({ left: false, right: true });
  const maxScrollRef = useRef(0);
  const scrollRafRef = useRef(0);
  const dragRafRef = useRef(0);
  const pendingScrollLeftRef = useRef<number | null>(null);

  const stateRef = useRef({
    pointerDown: false,
    hasDragged: false,
    startX: 0,
    startScrollLeft: 0,
    lastX: 0,
    lastTime: 0,
    velocity: 0,
    rafId: 0,
    suppressClickUntil: 0,
    lastTouchAt: 0,
  });

  const syncThumbAndBounds = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const maxScroll = maxScrollRef.current;
    const scrollLeft = el.scrollLeft;
    const nextLeft = scrollLeft > 4;
    const nextRight = maxScroll - scrollLeft > 4;

    if (boundsRef.current.left !== nextLeft) {
      boundsRef.current.left = nextLeft;
      setCanScrollLeft(nextLeft);
    }
    if (boundsRef.current.right !== nextRight) {
      boundsRef.current.right = nextRight;
      setCanScrollRight(nextRight);
    }

    if (trackThumbRef.current) {
      const progress = maxScroll > 0 ? Math.min(1, Math.max(0, scrollLeft / maxScroll)) : 0;
      trackThumbRef.current.style.transform = `translate3d(${progress * 257}%, 0, 0)`;
    }
  }, []);

  const measureMaxScroll = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    maxScrollRef.current = Math.max(0, el.scrollWidth - el.clientWidth);
    syncThumbAndBounds();
  }, [syncThumbAndBounds]);

  const scheduleScrollSync = useCallback(() => {
    if (scrollRafRef.current) return;
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = 0;
      if (maxScrollRef.current === 0 && ref.current) {
        maxScrollRef.current = Math.max(0, ref.current.scrollWidth - ref.current.clientWidth);
      }
      syncThumbAndBounds();
    });
  }, [syncThumbAndBounds]);

  const stopInertia = useCallback(() => {
    if (stateRef.current.rafId) {
      cancelAnimationFrame(stateRef.current.rafId);
      stateRef.current.rafId = 0;
    }
    if (dragRafRef.current) {
      cancelAnimationFrame(dragRafRef.current);
      dragRafRef.current = 0;
    }
    pendingScrollLeftRef.current = null;
  }, []);

  useEffect(() => {
    const el = node ?? ref.current;
    if (!el) return;

    measureMaxScroll();
    const onWheel = () => {
      // Immediately yield running drag inertia if user scrolls via trackpad/wheel
      if (stateRef.current.rafId) stopInertia();
    };

    el.addEventListener("scroll", scheduleScrollSync, { passive: true });
    el.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("resize", measureMaxScroll, { passive: true });

    const ro = new ResizeObserver(() => measureMaxScroll());
    ro.observe(el);

    const mo = new MutationObserver(() => measureMaxScroll());
    mo.observe(el, { childList: true });

    const state = stateRef.current;
    return () => {
      el.removeEventListener("scroll", scheduleScrollSync);
      el.removeEventListener("wheel", onWheel);
      window.removeEventListener("resize", measureMaxScroll);
      ro.disconnect();
      mo.disconnect();
      el.classList.remove("shiori-rail-dragging");
      if (scrollRafRef.current) {
        cancelAnimationFrame(scrollRafRef.current);
        scrollRafRef.current = 0;
      }
      if (dragRafRef.current) {
        cancelAnimationFrame(dragRafRef.current);
        dragRafRef.current = 0;
      }
      if (state.rafId) {
        cancelAnimationFrame(state.rafId);
        state.rafId = 0;
      }
    };
  }, [node, measureMaxScroll, scheduleScrollSync, stopInertia]);

  const onTouchStart = useCallback(() => {
    // Mobile touch uses 100% native compositor scrolling with zero JS interference
    stateRef.current.lastTouchAt = performance.now();
    stateRef.current.pointerDown = false;
    stateRef.current.hasDragged = false;
    stopInertia();
  }, [stopInertia]);

  const onMouseDown = useCallback(
    (e: React.MouseEvent<T>) => {
      if (performance.now() - stateRef.current.lastTouchAt < 750) return;
      if (e.button !== 0) return;
      const el = ref.current;
      if (!el) return;
      if ((e.target as HTMLElement | null)?.closest("button")) return;

      stopInertia();
      maxScrollRef.current = Math.max(0, el.scrollWidth - el.clientWidth);

      const st = stateRef.current;
      st.pointerDown = true;
      st.hasDragged = false;
      st.startX = e.clientX;
      st.startScrollLeft = el.scrollLeft;
      st.lastX = e.clientX;
      st.lastTime = performance.now();
      st.velocity = 0;

      const flushDragScroll = () => {
        dragRafRef.current = 0;
        const target = pendingScrollLeftRef.current;
        if (target !== null && ref.current) {
          ref.current.scrollLeft = target;
          pendingScrollLeftRef.current = null;
        }
      };

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!st.pointerDown || !ref.current) return;
        const dx = moveEvent.clientX - st.startX;

        if (!st.hasDragged && Math.abs(dx) > 5) {
          st.hasDragged = true;
          // Direct DOM class avoids a synchronous React re-render mid-drag
          ref.current.classList.add("shiori-rail-dragging");
          setIsDragging(true);
        }

        if (st.hasDragged) {
          moveEvent.preventDefault();
          const clamped = Math.max(
            0,
            Math.min(maxScrollRef.current, st.startScrollLeft - dx * dragSpeed)
          );
          pendingScrollLeftRef.current = clamped;
          if (!dragRafRef.current) {
            dragRafRef.current = requestAnimationFrame(flushDragScroll);
          }

          const now = performance.now();
          const dt = Math.max(1, now - st.lastTime);
          const instantVel = (moveEvent.clientX - st.lastX) / dt;
          st.velocity = st.velocity * 0.45 + instantVel * 0.55;
          st.lastX = moveEvent.clientX;
          st.lastTime = now;
        }
      };

      const handleMouseUp = () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
        window.removeEventListener("blur", handleMouseUp);

        if (dragRafRef.current) {
          cancelAnimationFrame(dragRafRef.current);
          dragRafRef.current = 0;
        }
        if (pendingScrollLeftRef.current !== null && ref.current) {
          ref.current.scrollLeft = pendingScrollLeftRef.current;
          pendingScrollLeftRef.current = null;
        }

        if (!st.pointerDown) return;
        st.pointerDown = false;

        if (st.hasDragged) {
          st.suppressClickUntil = performance.now() + 200;
          ref.current?.classList.remove("shiori-rail-dragging");
          setIsDragging(false);

          const timeSinceLastMove = performance.now() - st.lastTime;
          if (timeSinceLastMove < 90 && Math.abs(st.velocity) > 0.1) {
            let v = Math.max(-46, Math.min(46, st.velocity * 15 * dragSpeed));
            // Floating-point accumulator prevents 1x-DPI integer scrollLeft stutter
            let virtualScroll = ref.current ? ref.current.scrollLeft : 0;
            let prevTime = performance.now();
            const step = (now: number) => {
              if (!ref.current) return;
              const dtFrames = Math.min(2.2, Math.max(0.25, (now - prevTime) / 16.6667));
              prevTime = now;
              virtualScroll -= v * dtFrames;
              const clampedNext = Math.max(0, Math.min(maxScrollRef.current, virtualScroll));
              ref.current.scrollLeft = clampedNext;
              v *= Math.pow(friction, dtFrames);
              const hitEdge = clampedNext <= 0 || clampedNext >= maxScrollRef.current;
              if (!hitEdge && Math.abs(v) > 0.45) {
                st.rafId = requestAnimationFrame(step);
              } else {
                st.rafId = 0;
              }
            };
            st.rafId = requestAnimationFrame(step);
          }
        }
      };

      window.addEventListener("mousemove", handleMouseMove, { passive: false });
      window.addEventListener("mouseup", handleMouseUp);
      window.addEventListener("blur", handleMouseUp);
    },
    [dragSpeed, friction, stopInertia]
  );

  const onClickCapture = useCallback((e: React.MouseEvent<T>) => {
    if (performance.now() < stateRef.current.suppressClickUntil) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, []);

  const onDragStart = useCallback((e: React.DragEvent<T>) => {
    e.preventDefault();
  }, []);

  const scrollByAmount = useCallback(
    (dir: -1 | 1) => {
      const el = ref.current;
      if (!el) return;
      stopInertia();
      el.scrollBy({
        left: dir * Math.min(720, el.clientWidth * 0.8),
        behavior: "smooth",
      });
    },
    [stopInertia]
  );

  return {
    ref,
    setRef,
    trackThumbRef,
    isDragging,
    canScrollLeft,
    canScrollRight,
    scrollByAmount,
    dragHandlers: {
      onTouchStart,
      onMouseDown,
      onClickCapture,
      onDragStart,
    },
  };
}
