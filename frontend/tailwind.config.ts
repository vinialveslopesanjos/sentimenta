import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

const config: Config = {
  darkMode: "class",
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
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
          hover: "var(--primary-hover)",
          muted: "var(--primary-muted)",
          faint: "var(--primary-faint)",
          bg: "var(--primary-bg)",
          "bg-hover": "var(--primary-bg-hover)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
          light: "var(--secondary-light)",
          bg: "var(--secondary-bg)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
          bg: "var(--accent-bg)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        border: "var(--border)",
        input: "var(--input)",
        "input-background": "var(--input-background)",
        ring: "var(--ring)",
        // Text shades
        "text-primary": "var(--text-primary)",
        "text-secondary": "var(--text-secondary)",
        "text-muted": "var(--text-muted)",
        "text-faint": "var(--text-faint)",
        "text-xfaint": "var(--text-xfaint)",
        // Bg shades
        "bg-page": "var(--bg-page)",
        "bg-card": "var(--bg-card)",
        "bg-subtle": "var(--bg-subtle)",
        "bg-hover": "var(--bg-hover)",
        // Sentiment
        sentiment: {
          positive: "var(--sentiment-positive)",
          "positive-bg": "var(--sentiment-positive-bg)",
          neutral: "var(--sentiment-neutral)",
          "neutral-bg": "var(--sentiment-neutral-bg)",
          negative: "var(--sentiment-negative)",
          "negative-bg": "var(--sentiment-negative-bg)",
        },
        // Charts
        "chart-1": "var(--chart-1)",
        "chart-2": "var(--chart-2)",
        "chart-3": "var(--chart-3)",
        "chart-4": "var(--chart-4)",
        "chart-5": "var(--chart-5)",
        "chart-6": "var(--chart-6)",
        "chart-7": "var(--chart-7)",
        "chart-8": "var(--chart-8)",
        // Sidebar
        sidebar: {
          DEFAULT: "var(--sidebar)",
          foreground: "var(--sidebar-foreground)",
          primary: "var(--sidebar-primary)",
          "primary-foreground": "var(--sidebar-primary-foreground)",
          accent: "var(--sidebar-accent)",
          "accent-foreground": "var(--sidebar-accent-foreground)",
          border: "var(--sidebar-border)",
          ring: "var(--sidebar-ring)",
        },
        // Legacy compat for existing pages during migration
        brand: {
          bg: "var(--background)",
          surface: "var(--card)",
          text: "var(--text-secondary)",
          heading: "var(--text-primary)",
          lilacDark: "var(--primary)",
          cyan: "var(--primary-faint)",
          border: "var(--border)",
        },
        positive: "var(--sentiment-positive)",
        negative: "var(--sentiment-negative)",
        neutral: "var(--sentiment-neutral)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "calc(var(--radius) + 4px)",
      },
      boxShadow: {
        dream: "0 4px 24px -6px rgba(0, 0, 0, 0.06)",
        card: "0 4px 20px -2px rgba(0, 0, 0, 0.04)",
        float: "0 10px 30px -5px rgba(0, 0, 0, 0.1)",
        active: "0 8px 30px -4px rgba(0, 0, 0, 0.1)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        shimmer: "shimmer 2s infinite linear",
        "fade-in": "fadeIn 0.3s ease-out",
        "fade-in-up": "fadeInUp 0.5s ease-out forwards",
        breathe: "breathe 3.8s ease-in-out infinite",
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
        fadeInUp: {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        breathe: {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.018)" },
        },
      },
    },
  },
  plugins: [typography],
};

export default config;
