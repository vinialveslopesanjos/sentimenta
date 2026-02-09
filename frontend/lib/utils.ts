import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return "--";
  return new Date(dateStr).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function scoreColor(score: number | null): string {
  if (score === null) return "text-text-muted";
  if (score >= 7) return "text-positive";
  if (score >= 4) return "text-neutral";
  return "text-negative";
}

export function scoreBg(score: number | null): string {
  if (score === null) return "bg-text-muted/10";
  if (score >= 7) return "bg-positive/10";
  if (score >= 4) return "bg-neutral/10";
  return "bg-negative/10";
}

export function platformIcon(platform: string): string {
  switch (platform) {
    case "instagram":
      return "/icons/instagram.svg";
    case "youtube":
      return "/icons/youtube.svg";
    case "twitter":
      return "/icons/twitter.svg";
    default:
      return "/icons/globe.svg";
  }
}
