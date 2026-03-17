interface LogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
}

const sizes = {
  sm: { icon: 28, svg: 14, text: "0.9rem" },
  md: { icon: 36, svg: 18, text: "1.1rem" },
  lg: { icon: 48, svg: 24, text: "1.5rem" },
};

export function Logo({ size = "md", showText = true }: LogoProps) {
  const s = sizes[size];
  return (
    <div className="flex items-center" style={{ gap: s.icon * 0.3 }}>
      <div
        className="flex items-center justify-center shrink-0"
        style={{
          width: s.icon,
          height: s.icon,
          borderRadius: s.icon * 0.28,
          background: "linear-gradient(135deg, #d9a0b2, #39b8c6)",
          boxShadow: "0 4px 16px -4px rgba(57,184,198,0.45)",
        }}
      >
        <svg
          fill="none"
          height={s.svg}
          stroke="white"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.5"
          viewBox="0 0 24 24"
          width={s.svg}
        >
          <path d="M3 17C3 17 7 22 12 19C17 16 18 10 22 8" />
        </svg>
      </div>
      {showText && (
        <span
          style={{
            fontFamily: "'Outfit', sans-serif",
            fontWeight: 500,
            fontSize: s.text,
            letterSpacing: "-0.02em",
            color: "var(--text-primary, #0f085e)",
          }}
        >
          sentimenta
        </span>
      )}
    </div>
  );
}