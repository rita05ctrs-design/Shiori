"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
  useInView,
  type HTMLMotionProps,
} from "framer-motion";
import { cn } from "@/lib/utils";

export const CINEMA_EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Ambient atmospheric cursor aura on the dark canvas.
 * Runs purely via MotionValues (no React re-renders on mousemove).
 */
export function AmbientSpotlight() {
  const mouseX = useMotionValue(-600);
  const mouseY = useMotionValue(-600);
  const smoothX = useSpring(mouseX, { stiffness: 120, damping: 28, mass: 0.6 });
  const smoothY = useSpring(mouseY, { stiffness: 120, damping: 28, mass: 0.6 });

  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
    };
    window.addEventListener("pointermove", handleMove, { passive: true });
    return () => window.removeEventListener("pointermove", handleMove);
  }, [mouseX, mouseY]);

  const background = useMotionTemplate`radial-gradient(560px circle at ${smoothX}px ${smoothY}px, rgba(229, 72, 77, 0.065), rgba(240, 185, 91, 0.02) 42%, transparent 72%)`;

  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[1] hidden md:block"
      style={{ background }}
    />
  );
}

/**
 * Scroll-triggered editorial section reveal.
 */
interface RevealSectionProps extends HTMLMotionProps<"div"> {
  delay?: number;
  yOffset?: number;
  children: React.ReactNode;
}

export function RevealSection({
  children,
  className,
  delay = 0,
  yOffset = 22,
  ...rest
}: RevealSectionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: yOffset, filter: "blur(4px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, amount: "some", margin: "120px 0px 120px 0px" }}
      transition={{ duration: 0.58, delay, ease: CINEMA_EASE }}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/**
 * Staggered container & child for rhythmic editorial grids / lists.
 */
export function StaggerContainer({
  children,
  className,
  stagger = 0.045,
  delay = 0.05,
}: {
  children: React.ReactNode;
  className?: string;
  stagger?: number;
  delay?: number;
}) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.05 }}
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: stagger,
            delayChildren: delay,
          },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 20, scale: 0.97 },
        visible: {
          opacity: 1,
          y: 0,
          scale: 1,
          transition: { duration: 0.5, ease: CINEMA_EASE },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * Scroll-linked parallax wrapper for full-bleed cinema banners.
 */
export function ParallaxBanner({
  children,
  className,
  speed = 90,
}: {
  children: React.ReactNode;
  className?: string;
  speed?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const y = useTransform(scrollYProgress, [0, 1], [0, speed]);
  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.09]);
  const opacity = useTransform(scrollYProgress, [0, 0.9], [1, 0.35]);

  return (
    <div ref={ref} className={cn("relative overflow-hidden", className)}>
      <motion.div
        style={{ y, scale, opacity }}
        className="w-full h-full will-change-transform"
      >
        {children}
      </motion.div>
    </div>
  );
}

/**
 * Animated number counter for KPIs (smooth spring roll-up when scrolled into view).
 */
export function AnimatedNumber({
  value,
  decimals = 0,
  formatLocale = true,
}: {
  value: number;
  decimals?: number;
  formatLocale?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.4 });
  const motionVal = useMotionValue(0);
  const springVal = useSpring(motionVal, { stiffness: 75, damping: 20, mass: 0.8 });
  const [display, setDisplay] = useState(
    decimals > 0 ? (0).toFixed(decimals) : "0"
  );

  useEffect(() => {
    if (isInView) {
      motionVal.set(value);
    }
  }, [isInView, value, motionVal]);

  useEffect(() => {
    const unsub = springVal.on("change", (latest) => {
      if (decimals > 0) {
        setDisplay(latest.toFixed(decimals));
      } else {
        const rounded = Math.round(latest);
        setDisplay(formatLocale ? rounded.toLocaleString("fr-FR") : String(rounded));
      }
    });
    return () => unsub();
  }, [springVal, decimals, formatLocale]);

  return <span ref={ref}>{display}</span>;
}
