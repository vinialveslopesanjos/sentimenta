import { type ButtonHTMLAttributes, type ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline" | "pill" | "pill-glass";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
  icon?: ReactNode;
  iconRight?: ReactNode;
  fullWidth?: boolean;
}

const variantStyles: Record<Variant, string> = {
  primary:
    "text-white shadow-[0_2px_8px_-2px_rgba(196,59,66,0.4)]",
  secondary:
    "",
  ghost:
    "bg-transparent",
  danger:
    "",
  outline:
    "bg-[var(--bg-card)] border",
  pill:
    "!rounded-full bg-white shadow-[0_4px_24px_-4px_rgba(0,0,0,0.08)]",
  "pill-glass":
    "!rounded-full backdrop-blur-[50px] shadow-[0_4px_24px_-4px_rgba(0,0,0,0.06)]",
};

const sizeStyles: Record<Size, string> = {
  sm: "px-3 py-1.5 gap-1.5",
  md: "px-4 py-2.5 gap-2",
  lg: "px-6 py-3 gap-2.5",
};

const sizeText: Record<Size, { fontSize: string; fontWeight: number }> = {
  sm: { fontSize: "0.8rem", fontWeight: 500 },
  md: { fontSize: "0.85rem", fontWeight: 500 },
  lg: { fontSize: "0.95rem", fontWeight: 500 },
};

export function Button({
  variant = "primary",
  size = "md",
  children,
  icon,
  iconRight,
  fullWidth,
  className = "",
  style: styleProp,
  ...props
}: ButtonProps) {
  const variantInline: Record<Variant, React.CSSProperties> = {
    primary: {
      backgroundColor: "var(--primary, #3c39f9)",
    },
    secondary: {
      backgroundColor: "var(--primary-bg, #e7e6fe)",
      color: "var(--primary, #3c39f9)",
    },
    ghost: {
      color: "var(--primary, #3c39f9)",
    },
    danger: {
      backgroundColor: "var(--sentiment-negative-bg, #fde8ef)",
      color: "var(--sentiment-negative, #ef4382)",
    },
    outline: {
      color: "var(--primary, #3c39f9)",
      borderColor: "var(--border, #d3d0fb)",
    },
    pill: {
      color: "var(--primary, #39b8c6)",
      backgroundColor: "white",
    },
    "pill-glass": {
      color: "var(--primary, #39b8c6)",
      backgroundColor: "rgba(255,255,255,0.85)",
      border: "1px solid rgba(255,255,255,0.6)",
    },
  };

  return (
    <button
      className={`
        inline-flex items-center justify-center rounded-xl transition-all duration-150
        hover:opacity-90 active:opacity-80
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${fullWidth ? "w-full" : ""}
        disabled:opacity-50 disabled:pointer-events-none
        ${className}
      `}
      style={{
        fontFamily: "'Inter', sans-serif",
        ...sizeText[size],
        ...variantInline[variant],
        ...styleProp,
      }}
      {...props}
    >
      {icon}
      {children}
      {iconRight}
    </button>
  );
}