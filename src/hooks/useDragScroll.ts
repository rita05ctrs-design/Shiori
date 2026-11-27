"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface DragScrollOptions {
  /** Multiplier for drag responsiveness (default 1.12) */
  dragSpeed?: number;
  /** Friction factor per 60fps frame for inertia glide (0.90–0.96, default 0.935) */
  friction?: number;
}

/**
 * Locked-120fps zero-re-render horizontal scrolling with cached scroll metrics,
 * rAF-batched drag/scroll updates (zero layout thrashing even on 1000Hz mice),
 * and frame-rate-independent inertia glide.
 */
export function useDragScroll<T extends HTMLElement = HTMLDivElement>(
  options: DragScrollOptions = {}
) {
  const { dragSpeed = 1.12, friction = 0.935 } = options;

  const ref = useRef<T | null>(null);
  const trackThumbRef = useRef<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

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
      syncThumbAndBounds();
    });
  }, [syncThumbAndBounds]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    measureMaxScroll();
    el.addEventListener("scroll", scheduleScrollSync, { passive: true });
    window.addEventListener("resize", measureMaxScroll, { passive: true });

    const ro = new ResizeObserver(() => measureMaxScroll());
    ro.observe(el);

    const state = stateRef.current;
    return () => {
      el.removeEventListener("scroll", scheduleScrollSync);
      window.removeEventListener("resize", measureMaxScroll);
      ro.disconnect();
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
  }, [measureMaxScroll, scheduleScrollSync]);

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

  const onTouchStart = useCallback(() => {
    // Mobile touch uses native 120fps compositor scrolling with zero JS interception
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
      // Refresh cached scroll range once at drag start (never inside mousemove/scroll)
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
          setIsDragging(false);

          const timeSinceLastMove = performance.now() - st.lastTime;
          if (timeSinceLastMove < 90 && Math.abs(st.velocity) > 0.08) {
            let v = Math.max(-52, Math.min(52, st.velocity * 16 * dragSpeed));
            let prevTime = performance.now();
            const step = (now: number) => {
              if (!ref.current) return;
              const dtFrames = Math.min(2.5, Math.max(0.25, (now - prevTime) / 16.6667));
              prevTime = now;
              const nextLeft = ref.current.scrollLeft - v * dtFrames;
              ref.current.scrollLeft = nextLeft;
              v *= Math.pow(friction, dtFrames);
              const hitEdge = nextLeft <= 0 || nextLeft >= maxScrollRef.current;
              if (!hitEdge && Math.abs(v) > 0.35) {
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
