"use client";

import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  baseRadius: number;
  opacity: number;
  baseOpacity: number;
  phase: number;
  color: string;
}

const COLORS = [
  "196,181,253", // lilás
  "103,232,249", // ciano
  "167,139,250", // violeta
  "240,232,255", // lavanda
  "196,181,253", // lilás (repeat for density)
  "103,232,249", // ciano (repeat)
  "167,139,250", // violeta (repeat)
  "196,181,253",
  "103,232,249",
  "240,232,255",
];

export default function FogBackground({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    let animId: number;
    let particles: Particle[] = [];

    const resize = () => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.scale(dpr, dpr);
    };

    const initParticles = () => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      const baseR = Math.min(w, h) * 0.38;
      particles = COLORS.map((color) => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.56,
        vy: (Math.random() - 0.5) * 0.44,
        radius: baseR * (0.6 + Math.random() * 0.8),
        baseRadius: baseR * (0.6 + Math.random() * 0.8),
        opacity: 0.12 + Math.random() * 0.1,
        baseOpacity: 0.12 + Math.random() * 0.1,
        phase: Math.random() * Math.PI * 2,
        color,
      }));
    };

    const draw = (t: number) => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      ctx.clearRect(0, 0, w, h);

      for (const p of particles) {
        p.phase += 0.008;
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -p.radius) p.x = w + p.radius;
        if (p.x > w + p.radius) p.x = -p.radius;
        if (p.y < -p.radius) p.y = h + p.radius;
        if (p.y > h + p.radius) p.y = -p.radius;

        const pulse = Math.sin(p.phase);
        const r = p.baseRadius * (1 + pulse * 0.12);
        const op = p.baseOpacity * (1 + pulse * 0.3);

        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        grad.addColorStop(0, `rgba(${p.color},${Math.min(op, 0.28)})`);
        grad.addColorStop(0.5, `rgba(${p.color},${Math.min(op * 0.5, 0.14)})`);
        grad.addColorStop(1, `rgba(${p.color},0)`);

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      animId = requestAnimationFrame(draw);
    };

    const ro = new ResizeObserver(() => {
      resize();
      initParticles();
    });
    ro.observe(canvas);

    resize();
    initParticles();
    animId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 w-full h-full pointer-events-none ${className}`}
      aria-hidden="true"
    />
  );
}
