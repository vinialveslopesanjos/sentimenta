import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { themeHex } from "./ds/tokens";

type Theme = "light" | "dark";

type ThemeColors = (typeof themeHex)["light"] | (typeof themeHex)["dark"];

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  t: ThemeColors;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "light",
  toggleTheme: () => {},
  t: themeHex.light,
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("sentimenta-theme") as Theme) || "light";
    }
    return "light";
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("sentimenta-theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => (prev === "light" ? "dark" : "light"));
  const t = theme === "dark" ? themeHex.dark : themeHex.light;

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, t }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
