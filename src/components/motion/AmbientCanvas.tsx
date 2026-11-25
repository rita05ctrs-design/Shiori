"use client";

import React, { useEffect, useRef } from "react";
import { useShiori } from "@/context/ShioriContext";
import type { AmbianceDensity, AmbianceEffect, AmbianceSpeed } from "@/types/media";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  angle: number;
  spin: number;
  tilt: number;
  tiltSpeed: number;
  swayPhase: number;
  swaySpeed: number;
  swayAmp: number;
  color: string;
  pulsePhase: number;
  pulseSpeed: number;
  length?: number;
}

interface ShootingStar {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  length: number;
}

const DENSITY_MULT: Record<AmbianceDensity, number> = {
  subtle: 0.55,
  balanced: 1,
  immersive: 1.65,
};

const SPEED_MULT: Record<AmbianceSpeed, number> = {
  slow: 0.65,
  normal: 1,
  brisk: 1.48,
};

const BASE_COUNTS: Record<Exclude<AmbianceEffect, "none">, number> = {
  sakura: 28,
  momiji: 22,
  snow: 46,
  fireflies: 26,
  rain: 62,
  stars: 42,
};

const SAKURA_COLORS = ["#FBCFE8", "#F9A8D4", "#FDA4AF", "#FFE4E6", "#F472B6"];
const MOMIJI_COLORS = ["#E5484D", "#EA580C", "#F59E0B", "#DC2626", "#F0B95B"];
const FIREFLY_COLORS = ["#F0B95B", "#FDE68A", "#6EE7B7", "#FBBF24"];
const RAIN_COLORS = [
  "rgba(186, 214, 255, 0.34)",
  "rgba(148, 197, 255, 0.28)",
  "rgba(244, 91, 98, 0.24)",
  "rgba(103, 232, 249, 0.26)",
];
const STAR_COLORS = ["#F4F3EE", "#FDE68A", "#BAE6FD", "#FBCFE8"];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function createParticle(
  effect: Exclude<AmbianceEffect, "none">,
  w: number,
  h: number,
  randomY: boolean
): Particle {
  const x = Math.random() * w;
  const y = randomY ? Math.random() * h : -24 - Math.random() * 60;

  if (effect === "sakura") {
    return {
      x,
      y,
      vx: -0.35 - Math.random() * 0.55,
      vy: 0.65 + Math.random() * 0.85,
      size: 6 + Math.random() * 6.5,
      alpha: 0.36 + Math.random() * 0.44,
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.03,
      tilt: Math.random() * Math.PI * 2,
      tiltSpeed: 0.02 + Math.random() * 0.035,
      swayPhase: Math.random() * Math.PI * 2,
      swaySpeed: 0.014 + Math.random() * 0.018,
      swayAmp: 0.45 + Math.random() * 0.7,
      color: pick(SAKURA_COLORS),
      pulsePhase: 0,
      pulseSpeed: 0,
    };
  }

  if (effect === "momiji") {
    return {
      x,
      y,
      vx: -0.4 - Math.random() * 0.6,
      vy: 0.75 + Math.random() * 0.95,
      size: 7.5 + Math.random() * 6.5,
      alpha: 0.42 + Math.random() * 0.42,
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.028,
      tilt: Math.random() * Math.PI * 2,
      tiltSpeed: 0.018 + Math.random() * 0.028,
      swayPhase: Math.random() * Math.PI * 2,
      swaySpeed: 0.012 + Math.random() * 0.016,
      swayAmp: 0.6 + Math.random() * 0.85,
      color: pick(MOMIJI_COLORS),
      pulsePhase: 0,
      pulseSpeed: 0,
    };
  }

  if (effect === "snow") {
    return {
      x,
      y,
      vx: -0.18 + Math.random() * 0.36,
      vy: 0.45 + Math.random() * 1.0,
      size: 1.6 + Math.random() * 3.1,
      alpha: 0.25 + Math.random() * 0.55,
      angle: 0,
      spin: 0,
      tilt: 0,
      tiltSpeed: 0,
      swayPhase: Math.random() * Math.PI * 2,
      swaySpeed: 0.01 + Math.random() * 0.018,
      swayAmp: 0.3 + Math.random() * 0.45,
      color: "#EEF4FF",
      pulsePhase: 0,
      pulseSpeed: 0,
    };
  }

  if (effect === "fireflies") {
    return {
      x,
      y: randomY ? Math.random() * h : h + 16 + Math.random() * 40,
      vx: (Math.random() - 0.5) * 0.4,
      vy: -(0.18 + Math.random() * 0.42),
      size: 2.2 + Math.random() * 2.8,
      alpha: 0.35 + Math.random() * 0.55,
      angle: 0,
      spin: 0,
      tilt: 0,
      tiltSpeed: 0,
      swayPhase: Math.random() * Math.PI * 2,
      swaySpeed: 0.012 + Math.random() * 0.02,
      swayAmp: 0.45 + Math.random() * 0.55,
      color: pick(FIREFLY_COLORS),
      pulsePhase: Math.random() * Math.PI * 2,
      pulseSpeed: 0.025 + Math.random() * 0.035,
    };
  }

  if (effect === "rain") {
    return {
      x: Math.random() * (w + 180),
      y: randomY ? Math.random() * h : -30 - Math.random() * 120,
      vx: -2.4 - Math.random() * 1.2,
      vy: 11 + Math.random() * 7.5,
      size: 1 + Math.random() * 0.65,
      length: 14 + Math.random() * 18,
      alpha: 0.35 + Math.random() * 0.45,
      angle: 0,
      spin: 0,
      tilt: 0,
      tiltSpeed: 0,
      swayPhase: 0,
      swaySpeed: 0,
      swayAmp: 0,
      color: pick(RAIN_COLORS),
      pulsePhase: 0,
      pulseSpeed: 0,
    };
  }

  // stars
  return {
    x,
    y: Math.random() * h,
    vx: -0.06 - Math.random() * 0.12,
    vy: 0.06 + Math.random() * 0.14,
    size: 1.1 + Math.random() * 2.0,
    alpha: 0.25 + Math.random() * 0.55,
    angle: 0,
    spin: 0,
    tilt: 0,
    tiltSpeed: 0,
    swayPhase: 0,
    swaySpeed: 0,
    swayAmp: 0,
    color: pick(STAR_COLORS),
    pulsePhase: Math.random() * Math.PI * 2,
    pulseSpeed: 0.018 + Math.random() * 0.03,
  };
}

function drawSakuraPetal(ctx: CanvasRenderingContext2D, p: Particle) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  const scaleY = 0.45 + 0.55 * Math.abs(Math.cos(p.tilt));
  ctx.scale(1, scaleY);
  ctx.globalAlpha = p.alpha;
  ctx.fillStyle = p.color;

  const s = p.size;
  ctx.beginPath();
  // Characteristic cherry blossom petal shape with delicate top cleft
  ctx.moveTo(0, s * 0.9);
  ctx.bezierCurveTo(-s * 0.95, s * 0.35, -s * 0.85, -s * 0.65, -s * 0.22, -s * 0.95);
  ctx.lineTo(0, -s * 0.62);
  ctx.lineTo(s * 0.22, -s * 0.95);
  ctx.bezierCurveTo(s * 0.85, -s * 0.65, s * 0.95, s * 0.35, 0, s * 0.9);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawMomijiLeaf(ctx: CanvasRenderingContext2D, p: Particle) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  const scaleY = 0.5 + 0.5 * Math.abs(Math.cos(p.tilt));
  ctx.scale(1, scaleY);
  ctx.globalAlpha = p.alpha;
  ctx.fillStyle = p.color;

  const s = p.size;
  ctx.beginPath();
  // Stylized 5-point Japanese maple (momiji) leaf silhouette
  ctx.moveTo(0, -s);
  ctx.lineTo(s * 0.22, -s * 0.35);
  ctx.lineTo(s * 0.9, -s * 0.45);
  ctx.lineTo(s * 0.42, 0.05 * s);
  ctx.lineTo(s * 0.72, s * 0.55);
  ctx.lineTo(s * 0.14, s * 0.36);
  ctx.lineTo(0, s * 0.85);
  ctx.lineTo(-s * 0.14, s * 0.36);
  ctx.lineTo(-s * 0.72, s * 0.55);
  ctx.lineTo(-s * 0.42, 0.05 * s);
  ctx.lineTo(-s * 0.9, -s * 0.45);
  ctx.lineTo(-s * 0.22, -s * 0.35);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * High-FPS single-canvas atmospheric renderer (<0.4ms per frame).
 * Unmounts completely when ambiance.effect === "none" (zero runtime cost).
 */
export function AmbientCanvas() {
  const { ambiance, displayPrefs } = useShiori();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (ambiance.effect === "none" || displayPrefs.motion === "reduced") return;

    // Respect OS reduced-motion preference when set to "system"
    if (
      displayPrefs.motion !== "full" &&
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const effect = ambiance.effect;
    const speedMult = SPEED_MULT[ambiance.speed];
    const isMobileViewport = window.innerWidth < 768;
    const mobileScale = isMobileViewport ? 0.55 : 1;
    const targetCount = Math.max(
      6,
      Math.round(BASE_COUNTS[effect] * DENSITY_MULT[ambiance.density] * mobileScale)
    );

    let width = window.innerWidth;
    let height = window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, isMobileViewport ? 1.25 : 1.5);

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, width < 768 ? 1.25 : 1.5);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener("resize", resize, { passive: true });

    const particles: Particle[] = Array.from({ length: targetCount }, () =>
      createParticle(effect, width, height, true)
    );

    let shootingStar: ShootingStar | null = null;
    let starCooldown = 140 + Math.random() * 200;

    let rafId = 0;
    let lastTime = performance.now();

    const frame = (now: number) => {
      rafId = requestAnimationFrame(frame);

      if (document.hidden) {
        lastTime = now;
        return;
      }

      // Normalize to 60fps steps, clamped to prevent jumps after tab switch
      const dt = Math.min(33, now - lastTime) / 16.6667;
      lastTime = now;

      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < particles.length; i += 1) {
        const p = particles[i];

        if (effect === "sakura" || effect === "momiji") {
          p.swayPhase += p.swaySpeed * dt * speedMult;
          p.angle += p.spin * dt * speedMult;
          p.tilt += p.tiltSpeed * dt * speedMult;
          p.x += (p.vx + Math.sin(p.swayPhase) * p.swayAmp) * dt * speedMult;
          p.y += p.vy * dt * speedMult;

          if (p.y > height + 26 || p.x < -36) {
            const fresh = createParticle(effect, width, height, false);
            fresh.x = Math.random() * (width + 120);
            particles[i] = fresh;
            continue;
          }

          if (effect === "sakura") drawSakuraPetal(ctx, p);
          else drawMomijiLeaf(ctx, p);
        } else if (effect === "snow") {
          p.swayPhase += p.swaySpeed * dt * speedMult;
          p.x += (p.vx + Math.sin(p.swayPhase) * p.swayAmp) * dt * speedMult;
          p.y += p.vy * dt * speedMult;

          if (p.y > height + 12) {
            particles[i] = createParticle("snow", width, height, false);
            continue;
          }
          if (p.x < -10) p.x = width + 10;
          if (p.x > width + 10) p.x = -10;

          ctx.globalAlpha = p.alpha;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        } else if (effect === "fireflies") {
          p.swayPhase += p.swaySpeed * dt * speedMult;
          p.pulsePhase += p.pulseSpeed * dt * speedMult;
          p.x += (p.vx + Math.sin(p.swayPhase) * p.swayAmp) * dt * speedMult;
          p.y += p.vy * dt * speedMult;

          if (p.y < -20) {
            particles[i] = createParticle("fireflies", width, height, false);
            continue;
          }
          if (p.x < -20) p.x = width + 20;
          if (p.x > width + 20) p.x = -20;

          const glow = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(p.pulsePhase));
          // Soft outer halo (cheap two-circle glow — zero canvas shadowBlur overhead!)
          ctx.globalAlpha = p.alpha * glow * 0.22;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 3.1, 0, Math.PI * 2);
          ctx.fill();

          // Bright core
          ctx.globalAlpha = p.alpha * glow;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 0.85, 0, Math.PI * 2);
          ctx.fill();
        } else if (effect === "rain") {
          p.x += p.vx * dt * speedMult;
          p.y += p.vy * dt * speedMult;

          if (p.y > height + 30 || p.x < -40) {
            particles[i] = createParticle("rain", width, height, false);
            continue;
          }

          ctx.globalAlpha = p.alpha;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = p.size;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          const len = p.length ?? 18;
          ctx.lineTo(p.x + p.vx * (len / p.vy), p.y - len);
          ctx.stroke();
        } else {
          // stars
          p.pulsePhase += p.pulseSpeed * dt * speedMult;
          p.x += p.vx * dt * speedMult;
          p.y += p.vy * dt * speedMult;

          if (p.x < -8) p.x = width + 8;
          if (p.y > height + 8) p.y = -8;

          const twinkle = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(p.pulsePhase));
          ctx.globalAlpha = p.alpha * twinkle;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Subtle occasional Makoto Shinkai shooting star in "stars" mode
      if (effect === "stars") {
        if (!shootingStar) {
          starCooldown -= dt * speedMult;
          if (starCooldown <= 0) {
            shootingStar = {
              x: width * (0.35 + Math.random() * 0.65),
              y: height * (0.04 + Math.random() * 0.28),
              vx: -11 - Math.random() * 5,
              vy: 4.5 + Math.random() * 3,
              life: 0,
              maxLife: 34 + Math.random() * 18,
              length: 75 + Math.random() * 55,
            };
          }
        } else {
          shootingStar.x += shootingStar.vx * dt * speedMult;
          shootingStar.y += shootingStar.vy * dt * speedMult;
          shootingStar.life += dt * speedMult;

          const progress = shootingStar.life / shootingStar.maxLife;
          const alpha = Math.sin(Math.min(1, progress) * Math.PI) * 0.72;
          const mag = Math.hypot(shootingStar.vx, shootingStar.vy) || 1;
          const tailX = shootingStar.x - (shootingStar.vx / mag) * shootingStar.length;
          const tailY = shootingStar.y - (shootingStar.vy / mag) * shootingStar.length;

          const grad = ctx.createLinearGradient(
            shootingStar.x,
            shootingStar.y,
            tailX,
            tailY
          );
          grad.addColorStop(0, `rgba(255, 250, 240, ${alpha})`);
          grad.addColorStop(1, "rgba(255, 250, 240, 0)");

          ctx.globalAlpha = 1;
          ctx.strokeStyle = grad;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(shootingStar.x, shootingStar.y);
          ctx.lineTo(tailX, tailY);
          ctx.stroke();

          if (shootingStar.life >= shootingStar.maxLife) {
            shootingStar = null;
            starCooldown = 220 + Math.random() * 320;
          }
        }
      }

      ctx.globalAlpha = 1;
    };

    rafId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
    };
  }, [ambiance.effect, ambiance.density, ambiance.speed, displayPrefs.motion]);

  if (ambiance.effect === "none" || displayPrefs.motion === "reduced") return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[15]"
    />
  );
}
