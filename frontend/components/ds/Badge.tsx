import { type ReactNode } from "react";

type BadgeVariant = "primary" | "positive" | "warning" | "negative" | "muted";

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  dot?: boolean;
}

const styles: Record<BadgeVariant, { bg: string; color: string; marker: string }> = {
  primary:  { bg: "var(--primary-bg, #e7e6fe)", color: "var(--text-primary, #0e2325)", marker: "var(--primary, #3c39f9)" },
  positive: { bg: "var(--sentiment-positive-bg, #dcfce7)", color: "var(--text-primary, #0e2325)", marker: "var(--sentiment-positive, #22c55e)" },
  warning:  { bg: "var(--accent-bg, #fff7ed)", color: "var(--text-primary, #0e2325)", marker: "var(--accent, #b88147)" },
  negative: { bg: "var(--sentiment-negative-bg, #fde8ef)", color: "var(--text-primary, #0e2325)", marker: "var(--sentiment-negative, #ef4382)" },
  muted:    { bg: "var(--bg-subtle, #f4f9f9)", color: "var(--text-primary, #0e2325)", marker: "var(--text-muted, #226e77)" },
};

export function Badge({ variant = "primary", children, dot }: BadgeProps) {
  const s = styles[variant];
  return (
    <span
      data-badge-variant={variant}
      data-contrast-role="state-badge"
      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full"
      style={{ backgroundColor: s.bg, color: s.color, fontSize: "0.75rem", fontWeight: 700, fontFamily: "'Inter', sans-serif" }}
    >
      {dot && <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.marker }} />}
      {children}
    </span>
  );
}
