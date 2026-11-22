"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  motion,
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
 * Pure GPU-composited scroll-triggered section reveal (opacity + transform ONLY —
 * zero filter:blur repaints for locked 60/120fps scrolling).
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
  yOffset = 18,
  ...rest
}: RevealSectionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: yOffset }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: "some", margin: "120px 0px 120px 0px" }}
      transition={{ duration: 0.42, delay, ease: CINEMA_EASE }}
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
  stagger = 0.035,
  delay = 0.03,
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
      viewport={{ once: true, amount: "some" }}
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
        hidden: { opacity: 0, y: 14 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.36, ease: CINEMA_EASE },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * Scroll-linked parallax wrapper for full-bleed cinema banners (GPU transform only).
 */
export function ParallaxBanner({
  children,
  className,
  speed = 70,
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
  const opacity = useTransform(scrollYProgress, [0, 0.92], [1, 0.4]);

  return (
    <div ref={ref} className={cn("relative overflow-hidden", className)}>
      <motion.div
        style={{ y, opacity }}
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
  const isInView = useInView(ref, { once: true, amount: "some" });
  const motionVal = useMotionValue(0);
  const springVal = useSpring(motionVal, { stiffness: 90, damping: 22, mass: 0.7 });
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
