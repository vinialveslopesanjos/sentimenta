import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Outfit"', "sans-serif"],
        body: ['"Inter"', "sans-serif"],
      },
      colors: {
        brand: {
          bg: "#FDFBFF",
          surface: "#FFFFFF",
          text: "#475569",
          heading: "#334155",
          lilac: "#C4B5FD",
          lilacLight: "#E9D5FF",
          lilacDark: "#8B5CF6",
          cyan: "#67E8F9",
          cyanLight: "#CFFAFE",
          cyanDark: "#06B6D4",
          border: "#F1F5F9",
        },
        sentiment: {
          joy: "#ECFEFF",
          joyText: "#0891B2",
          anger: "#FFF1F2",
          angerText: "#E11D48",
          neutral: "#F8FAFC",
          positive: "#10B981",
          negative: "#F43F5E",
        },
      },
      boxShadow: {
        dream: "0 10px 40px -10px rgba(196, 181, 253, 0.15), 0 0 20px rgba(103, 232, 249, 0.1)",
        "dream-lg": "0 20px 80px -20px rgba(196, 181, 253, 0.3), 0 0 40px rgba(103, 232, 249, 0.2)",
        card: "0 4px 20px -2px rgba(148, 163, 184, 0.05)",
        float: "0 10px 30px -5px rgba(139, 92, 246, 0.15)",
        input: "0 2px 6px -1px rgba(148, 163, 184, 0.05)",
        modal: "0 20px 60px -10px rgba(139, 92, 246, 0.25)",
        active: "0 8px 30px -4px rgba(139, 92, 246, 0.15)",
        glow: "0 0 20px rgba(139, 92, 246, 0.3)",
      },
      backgroundImage: {
        "gradient-dream": "linear-gradient(135deg, #E0E7FF 0%, #F3E8FF 100%)",
        "gradient-brand": "linear-gradient(135deg, #67E8F9 0%, #C4B5FD 100%)",
        "gradient-hero": "radial-gradient(ellipse at top center, #F5F3FF 0%, #FDFBFF 60%)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        shimmer: "shimmer 2s infinite linear",
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.4s ease-out",
        blob: "blob 7s infinite",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        blob: {
          "0%": { transform: "translate(0px, 0px) scale(1)" },
          "33%": { transform: "translate(30px, -50px) scale(1.1)" },
          "66%": { transform: "translate(-20px, 20px) scale(0.9)" },
          "100%": { transform: "translate(0px, 0px) scale(1)" },
        },
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};

export default config;
