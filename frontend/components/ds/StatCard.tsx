import { type ReactNode } from "react";

type CardVariant = "default" | "highlighted" | "tinted";

interface StatCardProps {
  icon?: ReactNode;
  label: string;
  value: string;
  sub?: string;
  variant?: CardVariant;
  tintColor?: string;
  tintBg?: string;
}

export function StatCard({ icon, label, value, sub, variant = "default", tintColor, tintBg }: StatCardProps) {
  if (variant === "tinted" && tintBg) {
    return (
      <div className="rounded-2xl p-4 md:p-5" style={{ backgroundColor: tintBg, border: "1px solid var(--border)" }}>
        {icon && <div className="mb-3">{icon}</div>}
        <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.75rem", fontWeight: 700, color: tintColor || "var(--text-primary)", lineHeight: 1.1 }}>
          {value}
        </p>
        {sub && <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 2 }}>{sub}</p>}
        <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 500, marginTop: 4 }}>{label}</p>
      </div>
    );
  }

  if (variant === "highlighted") {
    return (
      <div className="rounded-2xl p-4 md:p-5 text-white shadow-[0_8px_24px_-4px_rgba(196,59,66,0.3)]" style={{ backgroundColor: "var(--primary)" }}>
        {icon && <div className="mb-3 opacity-60">{icon}</div>}
        <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.75rem", fontWeight: 700, lineHeight: 1.1 }}>
          {value}
        </p>
        {sub && <p style={{ fontSize: "0.72rem", opacity: 0.6, marginTop: 2 }}>{sub}</p>}
        <p style={{ fontSize: "0.75rem", opacity: 0.7, fontWeight: 500, marginTop: 4 }}>{label}</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl p-4 md:p-5" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <div className="flex items-center gap-3">
        {icon && (
          <div className="shrink-0">
            {icon}
          </div>
        )}
        <div>
          <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.5rem", fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.1 }}>
            {value}
          </p>
          <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 2 }}>{label}</p>
          {sub && <p style={{ fontSize: "0.65rem", color: "var(--text-faint)" }}>{sub}</p>}
        </div>
      </div>
    </div>
  );
}