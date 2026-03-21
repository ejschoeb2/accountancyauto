// Prompt brand colors — matching app/globals.css
export const colors = {
  // Background
  bg: "#faf8f0", // warm beige
  bgCard: "#ffffff",

  // Text
  foreground: "#1a1a1a",
  muted: "#64748b",

  // Brand
  primary: "#1e3a5f", // navy
  violet: "#8b5cf6",
  violetLight: "#ede9fe",

  // Traffic light status
  red: "#ef4444",
  orange: "#f97316",
  amber: "#eab308",
  blue: "#3b82f6",
  green: "#10b981",
  grey: "#94a3b8",

  // Borders
  border: "#e2e8f0",
} as const;

export const fonts = {
  sans: "Figtree, system-ui, sans-serif",
  mono: "JetBrains Mono, monospace",
} as const;
