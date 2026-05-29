import { type ReactNode } from "react";

interface SectionProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function Section({ title, subtitle, children, action, className = "" }: SectionProps) {
  return (
    <div className={`rounded-2xl p-5 md:p-6 ${className}`.trim()} style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "0 1px 8px -2px rgba(0,0,0,0.06)" }}>
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3
            style={{
              fontFamily: "'Outfit', sans-serif",
              fontSize: "1rem",
              fontWeight: 600,
              color: "var(--text-primary)",
              lineHeight: 1.3,
            }}
          >
            {title}
          </h3>
          {subtitle && (
            <p style={{ fontSize: "0.75rem", color: "var(--text-faint)", marginTop: 2 }}>
              {subtitle}
            </p>
          )}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}
