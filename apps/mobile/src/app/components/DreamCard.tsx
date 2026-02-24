import React from "react";

interface DreamCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  glow?: boolean;
  tint?: "emerald" | "rose" | "amber" | "violet" | "cyan" | "none";
  style?: React.CSSProperties;
}

const tintStyles: Record<string, React.CSSProperties> = {
  emerald: {
    background: "rgba(240, 253, 244, 0.90)",
    borderColor: "rgba(52, 211, 153, 0.18)",
  },
  rose: {
    background: "rgba(255, 241, 242, 0.90)",
    borderColor: "rgba(251, 113, 133, 0.18)",
  },
  amber: {
    background: "rgba(255, 251, 235, 0.90)",
    borderColor: "rgba(251, 191, 36, 0.18)",
  },
  violet: {
    background: "rgba(245, 243, 255, 0.90)",
    borderColor: "rgba(139, 92, 246, 0.18)",
  },
  cyan: {
    background: "rgba(236, 254, 255, 0.90)",
    borderColor: "rgba(34, 211, 238, 0.18)",
  },
  none: {
    background: "rgba(255, 255, 255, 0.82)",
    borderColor: "rgba(255, 255, 255, 0.65)",
  },
};

export function DreamCard({
  children,
  className = "",
  onClick,
  glow,
  tint = "none",
  style: extraStyle,
}: DreamCardProps) {
  const base = tintStyles[tint] || tintStyles.none;

  return (
    <div
      onClick={onClick}
      className={`
        rounded-3xl border
        ${onClick ? "cursor-pointer active:scale-[0.98] transition-transform" : ""}
        ${className}
      `}
      style={{
        background: base.background,
        borderColor: base.borderColor,
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        boxShadow: glow
          ? "0 12px 48px -8px rgba(196,181,253,0.32), 0 0 28px rgba(103,232,249,0.14)"
          : "0 4px 24px -4px rgba(196,181,253,0.20), 0 1px 4px rgba(139,92,246,0.06)",
        ...extraStyle,
      }}
    >
      {children}
    </div>
  );
}
