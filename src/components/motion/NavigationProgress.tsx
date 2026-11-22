"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { motion, AnimatePresence, useScroll, useSpring } from "framer-motion";

/**
 * 1) Luminous Akane-to-Kinpaku route transition beam at the very top of viewport
 *    whenever the user clicks any internal link or navigates between routes.
 * 2) Subtle continuous reading scroll indicator along the bottom edge of the fixed navbar.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [navigating, setNavigating] = useState(false);
  const [progress, setProgress] = useState(0);

  // Scroll progress ribbon
  const { scrollYProgress } = useScroll();
  const smoothScroll = useSpring(scrollYProgress, {
    stiffness: 220,
    damping: 32,
    restDelta: 0.001,
  });

  // Detect internal link clicks to start the beam immediately
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      const target = (e.target as HTMLElement | null)?.closest("a");
      if (!target) return;
      const href = target.getAttribute("href");
      if (!href || !href.startsWith("/") || href.startsWith("//")) return;
      if (target.getAttribute("target") === "_blank") return;
      const currentUrl = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : "");
      if (href === currentUrl) return;

      setNavigating(true);
      setProgress(0.28);
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [pathname, searchParams]);

  // Trickle progress while navigating
  useEffect(() => {
    if (!navigating) return;
    const t1 = setTimeout(() => setProgress((p) => (p < 0.65 ? 0.65 : p)), 140);
    const t2 = setTimeout(() => setProgress((p) => (p < 0.85 ? 0.85 : p)), 450);
    const safety = setTimeout(() => {
      setProgress(1);
      setTimeout(() => {
        setNavigating(false);
        setProgress(0);
      }, 220);
    }, 3500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(safety);
    };
  }, [navigating]);

  // Complete beam cleanly when pathname/searchParams update
  useEffect(() => {
    if (navigating) {
      setProgress(1);
      const t = setTimeout(() => {
        setNavigating(false);
        setProgress(0);
      }, 260);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  return (
    <>
      {/* Top Route Transition Beam */}
      <AnimatePresence>
        {navigating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="fixed top-0 inset-x-0 z-[100] h-[2.5px] pointer-events-none"
          >
            <motion.div
              initial={{ scaleX: 0.08 }}
              animate={{ scaleX: progress }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              style={{ transformOrigin: "left center" }}
              className="h-full w-full bg-gradient-to-r from-[#E5484D] via-[#FF7A66] to-[#F0B95B] shadow-[0_0_16px_rgba(229,72,77,0.95),0_0_6px_rgba(240,185,91,0.8)]"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Subtle Scroll Progress Hairline under Navbar */}
      <motion.div
        aria-hidden="true"
        style={{ scaleX: smoothScroll, transformOrigin: "left center" }}
        className="fixed top-16 inset-x-0 z-[49] h-[1.5px] bg-gradient-to-r from-[#E5484D]/80 via-[#F45B62]/90 to-[#F0B95B]/80 pointer-events-none opacity-75"
      />
    </>
  );
}
