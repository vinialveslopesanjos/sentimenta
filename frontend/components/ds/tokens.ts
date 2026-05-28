// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Sentimenta Design Tokens — Teal / Rose / Gold Palette
// Uses CSS custom properties for light/dark mode
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const colors = {
  primary: {
    50: "var(--primary-bg, #ebf8f9)",
    100: "var(--primary-bg-hover, #d7f1f4)",
    200: "var(--primary-faint, #88d4dd)",
    300: "var(--primary-muted, #61c6d1)",
    400: "var(--primary, #39b8c6)",
    500: "var(--primary-hover, #2e939e)",
    600: "#226e77",
    700: "#1d4649",
    800: "#0e2325",
    900: "#071112",
  },
  secondary: {
    50: "var(--secondary-bg, #f8edf0)",
    100: "#f0dbe1",
    200: "#e2b6c4",
    300: "var(--secondary-light, #c56d89)",
    400: "var(--secondary-light, #c56d89)",
    500: "var(--secondary, #b6496b)",
    600: "#923a56",
    700: "#6d2c40",
    800: "#491d2b",
  },
  accent: {
    50: "var(--accent-bg, #f8f2ed)",
    100: "#f1e6da",
    200: "#e2cdb6",
    300: "#d4b491",
    400: "#c69a6c",
    500: "var(--accent, #b88147)",
    600: "#936739",
    700: "#6e4e2b",
    800: "#49341d",
  },
  bg: {
    base: "var(--bg-page, #ffffff)",
    raised: "var(--bg-card, #ffffff)",
    sunken: "var(--bg-subtle, #f4f9f9)",
    subtle: "var(--bg-subtle, #f4f9f9)",
    hover: "var(--bg-hover, #eaf4f5)",
  },
  text: {
    primary: "var(--text-primary, #0e2325)",
    secondary: "var(--text-secondary, #1d4649)",
    muted: "var(--text-muted, #226e77)",
    faint: "var(--text-faint, #398b93)",
    xfaint: "var(--text-xfaint, #6cbec6)",
  },
} as const;

// Chart palette
export const chartColors = {
  positive: "var(--sentiment-positive, #22c55e)",
  neutral: "var(--sentiment-neutral, #94a3b8)",
  negative: "var(--sentiment-negative, #b6496b)",
  series: [
    "var(--chart-1, #39b8c6)",
    "var(--chart-3, #b6496b)",
    "var(--chart-5, #b88147)",
    "var(--chart-2, #61c6d1)",
    "var(--chart-4, #c56d89)",
    "var(--chart-6, #c69a6c)",
    "var(--chart-7, #88d4dd)",
    "var(--chart-8, #d392a6)",
  ],
} as const;

// Sentiment mapping
export const sentiment = {
  positive: { color: "var(--sentiment-positive, #22c55e)", bg: "var(--sentiment-positive-bg, #dcfce7)", label: "Positivo" },
  neutral:  { color: "var(--sentiment-neutral, #94a3b8)", bg: "var(--sentiment-neutral-bg, #f1f5f9)", label: "Neutro" },
  negative: { color: "var(--sentiment-negative, #b6496b)", bg: "var(--sentiment-negative-bg, #f8edf0)", label: "Negativo" },
} as const;

// Score ranges
export function getScoreStyle(score: number) {
  if (score >= 7) return { color: "var(--sentiment-positive, #22c55e)", bg: "var(--sentiment-positive-bg, #dcfce7)" };
  if (score >= 4) return { color: "var(--primary, #39b8c6)", bg: "var(--primary-bg, #ebf8f9)" };
  return { color: "var(--sentiment-negative, #b6496b)", bg: "var(--sentiment-negative-bg, #f8edf0)" };
}

// ── Theme-aware color helpers (static fallbacks for chart libs that need hex) ──
export const themeHex = {
  light: {
    primary: "#39b8c6",
    primaryMuted: "#61c6d1",
    primaryFaint: "#88d4dd",
    primaryBg: "#ebf8f9",
    primaryBgHover: "#d7f1f4",
    secondary: "#b6496b",
    secondaryLight: "#c56d89",
    secondaryBg: "#f8edf0",
    accent: "#b88147",
    accentBg: "#f8f2ed",
    textPrimary: "#0e2325",
    textSecondary: "#1d4649",
    textMuted: "#226e77",
    textFaint: "#398b93",
    textXfaint: "#6cbec6",
    bgPage: "#edf7f7",
    bgCard: "#ffffff",
    bgSubtle: "#ebf8f9",
    bgHover: "#d7f1f4",
    border: "#b6dfe2",
    sentimentPositive: "#2fbc73",
    sentimentNeutral: "#849aa3",
    sentimentNegative: "#bd4b70",
    chart: ["#39b8c6", "#bd4b70", "#c08a4a", "#2fadb8", "#cf7890", "#7f8b54", "#2fbc73", "#849aa3"],
  },
  dark: {
    primary: "#61c6d1",
    primaryMuted: "#39b8c6",
    primaryFaint: "#2e939e",
    primaryBg: "#1d4649",
    primaryBgHover: "#226e77",
    secondary: "#c56d89",
    secondaryLight: "#d392a6",
    secondaryBg: "#491d2b",
    accent: "#c69a6c",
    accentBg: "#49341d",
    textPrimary: "#f0f4f5",
    textSecondary: "#d1dce0",
    textMuted: "#a0b3b6",
    textFaint: "#728c90",
    textXfaint: "#4a6468",
    bgPage: "#081212",
    bgCard: "#0f2424",
    bgSubtle: "#1d4649",
    bgHover: "#226e77",
    border: "#2b696e",
    sentimentPositive: "#54d69a",
    sentimentNeutral: "#91aab3",
    sentimentNegative: "#dd6e92",
    chart: ["#66d4de", "#dd6e92", "#d9ad74", "#46c6b8", "#e38aa5", "#9cad6f", "#54d69a", "#91aab3"],
  },
} as const;
