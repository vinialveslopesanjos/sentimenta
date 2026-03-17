import { type ReactNode } from "react";

type BadgeVariant = "primary" | "positive" | "warning" | "negative" | "muted";

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  dot?: boolean;
}

const styles: Record<BadgeVariant, { bg: string; color: string }> = {
  primary:  { bg: "var(--primary-bg, #e7e6fe)", color: "var(--primary, #3c39f9)" },
  positive: { bg: "var(--sentiment-positive-bg, #dcfce7)", color: "var(--sentiment-positive, #22c55e)" },
  warning:  { bg: "var(--secondary-bg, #fde8ef)", color: "var(--secondary, #eb1463)" },
  negative: { bg: "var(--sentiment-negative-bg, #fde8ef)", color: "var(--sentiment-negative, #ef4382)" },
  muted:    { bg: "var(--primary-bg-hover, #cecefd)", color: "var(--text-muted, #7c71f4)" },
};

export function Badge({ variant = "primary", children, dot }: BadgeProps) {
  const s = styles[variant];
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full"
      style={{ backgroundColor: s.bg, color: s.color, fontSize: "0.72rem", fontWeight: 600, fontFamily: "'Inter', sans-serif" }}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color }} />}
      {children}
    </span>
  );
}
