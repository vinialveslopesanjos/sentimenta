/**
 * Consolidated helper/utility functions for the Sentimenta dashboard.
 * Import from "@/lib/helpers" instead of defining locally.
 */
import React from "react";

// ─── Score helpers ──────────────────────────────────────────────────────────

export function scoreColor(score: number | null): string {
  if (score === null) return "text-slate-300";
  if (score >= 8) return "text-emerald-500";
  if (score >= 6) return "text-brand-lilacDark";
  if (score >= 4) return "text-amber-500";
  return "text-rose-500";
}

export function scoreBg(s: number | null): string {
  if (s === null) return "bg-slate-50 text-slate-400 border-slate-100";
  if (s >= 7) return "bg-emerald-50 text-emerald-600 border-emerald-100";
  if (s >= 4) return "bg-amber-50 text-amber-600 border-amber-100";
  return "bg-rose-50 text-rose-500 border-rose-100";
}

export function scoreLabel(score: number | null): { text: string; cls: string } | null {
  if (score === null) return null;
  if (score >= 9) return { text: "Excelente", cls: "bg-emerald-50 text-emerald-700 border-emerald-100" };
  if (score >= 8) return { text: "\u00d3timo", cls: "bg-cyan-50 text-cyan-700 border-cyan-100" };
  if (score >= 6.5) return { text: "Bom", cls: "bg-violet-50 text-violet-700 border-violet-100" };
  if (score >= 4) return { text: "Regular", cls: "bg-amber-50 text-amber-700 border-amber-100" };
  return { text: "Cr\u00edtico", cls: "bg-rose-50 text-rose-700 border-rose-100" };
}

// ─── Number formatting ──────────────────────────────────────────────────────

export function fmt(n: number): string {
  return n.toLocaleString("pt-BR");
}

// ─── Date formatting ────────────────────────────────────────────────────────

export function fmtDate(s: string | null | undefined): string {
  if (!s) return "\u2014";
  return new Date(s).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function fmtDatetime(s: string | null | undefined): string {
  if (!s) return "\u2014";
  return new Date(s).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Period parsing (for chart axes) ────────────────────────────────────────

export function parsePeriod(period: string): Date {
  if (/^\d{4}-\d{2}$/.test(period)) return new Date(`${period}-01T00:00:00`);
  if (/^\d{4}-\d{2}-\d{2}$/.test(period)) return new Date(`${period}T00:00:00`);
  const dt = new Date(period);
  return Number.isNaN(dt.getTime()) ? new Date("1970-01-01T00:00:00") : dt;
}

export function formatMonthYear(period: string): string {
  return parsePeriod(period).toLocaleDateString("pt-BR", { month: "2-digit", year: "numeric" });
}

export function formatDayLabel(period: string): string {
  return parsePeriod(period).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Granularity-aware tick formatter for chart x-axes. */
export function formatTickLabel(period: string, granularity: string): string {
  const d = parsePeriod(period);
  if (granularity === "month") {
    return d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
  }
  // day or week: "dd/MM"
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

// ─── Relative time ──────────────────────────────────────────────────────────

export function relativeTime(dateStr: string | null): string {
  if (!dateStr) return "\u2014";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Agora";
  if (mins < 60) return `H\u00e1 ${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `H\u00e1 ${hrs}h`;
  return `H\u00e1 ${Math.floor(hrs / 24)}d`;
}

// ─── Platform icon (img-based) ──────────────────────────────────────────────

export function platformIcon(platform: string | null, size = 16): React.ReactElement | null {
  if (!platform) return null;
  const p = platform.toLowerCase();
  const src = p === "instagram"
    ? "/icons/instagram.svg"
    : p === "twitter"
      ? "/icons/twitter-x.svg"
      : "/icons/youtube.svg";
  return React.createElement("img", { src, alt: platform, style: { width: size, height: size } });
}
