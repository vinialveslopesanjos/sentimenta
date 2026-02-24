/**
 * Sentimenta design tokens — matches web frontend theme.
 */
export const colors = {
  // Background
  bg: {
    primary: "#0F0A1A",
    secondary: "#1A1425",
    card: "#231D30",
    elevated: "#2D2640",
  },
  // Text
  text: {
    primary: "#F5F0FF",
    secondary: "#A89BC2",
    muted: "#6B5F80",
  },
  // Accent
  accent: {
    purple: "#8B5CF6",
    purpleLight: "#A78BFA",
    purpleDark: "#6D28D9",
  },
  // Sentiment
  sentiment: {
    positive: "#10B981",
    neutral: "#F59E0B",
    negative: "#EF4444",
  },
  // Utility
  border: "#2D2640",
  error: "#EF4444",
  success: "#10B981",
} as const;
