"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface DragScrollOptions {
  /** Multiplier for drag responsiveness (default 1.15) */
  dragSpeed?: number;
  /** Friction factor per frame for inertia glide (0.90–0.96, default 0.935) */
  friction?: number;
}

/**
 * Zero-re-render left-click-and-drag horizontal scrolling with smooth physics inertia.
 * Updates the optional glide track DOM transform directly via ref (0 React renders per frame).
 */
export function useDragScroll<T extends HTMLElement = HTMLDivElement>(
  options: DragScrollOptions = {}
) {
  const { dragSpeed = 1.15, friction = 0.935 } = options;

  const ref = useRef<T | null>(null);
  const trackThumbRef = useRef<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const boundsRef = useRef({ left: false, right: true });
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
  });

  const updateScrollBounds = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
    const nextLeft = el.scrollLeft > 4;
    const nextRight = maxScroll - el.scrollLeft > 4;

    // Only trigger React state updates when boundary booleans actually change
    if (boundsRef.current.left !== nextLeft) {
      boundsRef.current.left = nextLeft;
      setCanScrollLeft(nextLeft);
    }
    if (boundsRef.current.right !== nextRight) {
      boundsRef.current.right = nextRight;
      setCanScrollRight(nextRight);
    }

    // Update progress track directly on GPU without causing React re-renders
    if (trackThumbRef.current) {
      const progress = maxScroll > 0 ? Math.min(1, Math.max(0, el.scrollLeft / maxScroll)) : 0;
      trackThumbRef.current.style.transform = `translate3d(${progress * 257}%, 0, 0)`;
    }
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    updateScrollBounds();
    el.addEventListener("scroll", updateScrollBounds, { passive: true });
    window.addEventListener("resize", updateScrollBounds, { passive: true });

    const ro = new ResizeObserver(() => updateScrollBounds());
    ro.observe(el);

    const state = stateRef.current;
    return () => {
      el.removeEventListener("scroll", updateScrollBounds);
      window.removeEventListener("resize", updateScrollBounds);
      ro.disconnect();
      if (state.rafId) {
        cancelAnimationFrame(state.rafId);
      }
    };
  }, [updateScrollBounds]);

  const stopInertia = useCallback(() => {
    if (stateRef.current.rafId) {
      cancelAnimationFrame(stateRef.current.rafId);
      stateRef.current.rafId = 0;
    }
  }, []);

  const onMouseDown = useCallback(
    (e: React.MouseEvent<T>) => {
      if (e.button !== 0) return;
      const el = ref.current;
      if (!el) return;
      if ((e.target as HTMLElement | null)?.closest("button")) return;

      stopInertia();

      const st = stateRef.current;
      st.pointerDown = true;
      st.hasDragged = false;
      st.startX = e.clientX;
      st.startScrollLeft = el.scrollLeft;
      st.lastX = e.clientX;
      st.lastTime = performance.now();
      st.velocity = 0;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!st.pointerDown || !ref.current) return;
        const dx = moveEvent.clientX - st.startX;

        if (!st.hasDragged && Math.abs(dx) > 5) {
          st.hasDragged = true;
          setIsDragging(true);
        }

        if (st.hasDragged) {
          moveEvent.preventDefault();
          ref.current.scrollLeft = st.startScrollLeft - dx * dragSpeed;

          const now = performance.now();
          const dt = Math.max(1, now - st.lastTime);
          const instantVel = (moveEvent.clientX - st.lastX) / dt;
          st.velocity = st.velocity * 0.4 + instantVel * 0.6;
          st.lastX = moveEvent.clientX;
          st.lastTime = now;
        }
      };

      const handleMouseUp = () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
        window.removeEventListener("blur", handleMouseUp);

        if (!st.pointerDown) return;
        st.pointerDown = false;

        if (st.hasDragged) {
          st.suppressClickUntil = performance.now() + 200;
          setIsDragging(false);

          const timeSinceLastMove = performance.now() - st.lastTime;
          if (timeSinceLastMove < 90 && Math.abs(st.velocity) > 0.08) {
            let v = Math.max(-52, Math.min(52, st.velocity * 16 * dragSpeed));
            const step = () => {
              if (!ref.current) return;
              ref.current.scrollLeft -= v;
              v *= friction;
              if (Math.abs(v) > 0.35) {
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
      onMouseDown,
      onClickCapture,
      onDragStart,
    },
  };
}
