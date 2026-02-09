import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0d1117",
        surface: "#161b22",
        "surface-hover": "#1c2128",
        border: "#30363d",
        "text-primary": "#e6edf3",
        "text-secondary": "#8b949e",
        "text-muted": "#484f58",
        accent: "#7c3aed",
        "accent-hover": "#6d28d9",
        positive: "#3fb950",
        neutral: "#d29922",
        negative: "#f85149",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["Geist Mono", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
