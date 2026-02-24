import React, { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  radius: number;
  vx: number;
  vy: number;
  r: number;
  g: number;
  b: number;
  alpha: number;
  pulseSpeed: number;
  pulsePhase: number;
}

const FOG_COLORS = [
  { r: 196, g: 181, b: 253 }, // lilac
  { r: 103, g: 232, b: 249 }, // cyan
  { r: 167, g: 139, b: 250 }, // violet
  { r: 196, g: 181, b: 253 }, // lilac (more weight)
  { r: 224, g: 242, b: 254 }, // sky
  { r: 240, g: 232, b: 255 }, // lavender
];

export function FogBackground({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio, 2);

    const resize = () => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    };
    resize();

    const W = () => canvas.offsetWidth;
    const H = () => canvas.offsetHeight;

    const makeParticle = (): Particle => {
      const col = FOG_COLORS[Math.floor(Math.random() * FOG_COLORS.length)];
      return {
        x: Math.random() * W(),
        y: Math.random() * H(),
        radius: 80 + Math.random() * 160,
        vx: (Math.random() - 0.5) * 0.28,
        vy: (Math.random() - 0.5) * 0.22,
        r: col.r,
        g: col.g,
        b: col.b,
        alpha: 0.13 + Math.random() * 0.16,
        pulseSpeed: 0.004 + Math.random() * 0.005,
        pulsePhase: Math.random() * Math.PI * 2,
      };
    };

    const particles: Particle[] = Array.from({ length: 10 }, makeParticle);
    let t = 0;

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      const cw = W();
      const ch = H();

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#FDFBFF";
      ctx.fillRect(0, 0, w, h);

      particles.forEach((p) => {
        const pulse = 0.9 + 0.12 * Math.sin(t * p.pulseSpeed + p.pulsePhase);
        const r = p.radius * dpr * pulse;
        const alpha =
          p.alpha * (0.8 + 0.22 * Math.sin(t * p.pulseSpeed * 0.6 + p.pulsePhase));

        const px = p.x * dpr;
        const py = p.y * dpr;

        const grad = ctx.createRadialGradient(px, py, 0, px, py, r);
        grad.addColorStop(0, `rgba(${p.r},${p.g},${p.b},${alpha})`);
        grad.addColorStop(0.45, `rgba(${p.r},${p.g},${p.b},${alpha * 0.35})`);
        grad.addColorStop(1, `rgba(${p.r},${p.g},${p.b},0)`);

        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        p.x += p.vx;
        p.y += p.vy;

        const margin = p.radius + 20;
        if (p.x < -margin) p.x = cw + margin;
        if (p.x > cw + margin) p.x = -margin;
        if (p.y < -margin) p.y = ch + margin;
        if (p.y > ch + margin) p.y = -margin;
      });

      t++;
      rafRef.current = requestAnimationFrame(draw);
    };

    draw();

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
      }}
    />
  );
}
