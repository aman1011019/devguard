import type { Config } from "tailwindcss";

/** Every colour is a semantic token backed by a CSS variable, so dark and light
 *  are two independently designed palettes — not one inverted into the other. */
const token = (name: string) => `rgb(var(${name}) / <alpha-value>)`;

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: token("--c-canvas"),
        surface: token("--c-surface"),
        elevated: token("--c-elevated"),
        overlay: token("--c-overlay"),
        line: token("--c-line"),
        strong: token("--c-strong"),
        ink: token("--c-ink"),
        muted: token("--c-muted"),
        faint: token("--c-faint"),
        brand: {
          DEFAULT: token("--c-brand"),
          soft: token("--c-brand-soft"),
          ink: token("--c-brand-ink"),
        },
        accent: token("--c-accent"),
        ok: token("--c-ok"),
        warn: token("--c-warn"),
        bad: token("--c-bad"),
        info: token("--c-info"),
      },
      fontFamily: {
        sans: ['"Inter var"', "Inter", "ui-sans-serif", "system-ui", "Segoe UI", "Roboto", "sans-serif"],
        mono: ['"JetBrains Mono"', '"Cascadia Code"', "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
      },
      /** Extra steps so tint utilities like `bg-brand/12` resolve without
       *  reaching for arbitrary-value brackets everywhere. */
      opacity: {
        4: "0.04",
        6: "0.06",
        8: "0.08",
        12: "0.12",
        14: "0.14",
        15: "0.15",
        16: "0.16",
        18: "0.18",
        22: "0.22",
        35: "0.35",
        45: "0.45",
        55: "0.55",
        65: "0.65",
        85: "0.85",
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.125rem",
        "3xl": "1.5rem",
      },
      boxShadow: {
        card: "0 1px 2px rgb(var(--c-shadow) / 0.32), 0 8px 28px -12px rgb(var(--c-shadow) / 0.36)",
        lift: "0 2px 4px rgb(var(--c-shadow) / 0.28), 0 24px 48px -20px rgb(var(--c-shadow) / 0.5)",
        glow: "0 0 0 1px rgb(var(--c-brand) / 0.35), 0 0 32px -6px rgb(var(--c-brand) / 0.45)",
        inset: "inset 0 1px 0 0 rgb(var(--c-hilite) / 0.06)",
      },
      backgroundImage: {
        "brand-sweep":
          "linear-gradient(120deg, rgb(var(--c-brand)) 0%, rgb(var(--c-brand-ink)) 45%, rgb(var(--c-accent)) 100%)",
        "grid-fine":
          "linear-gradient(to right, rgb(var(--c-line) / 0.55) 1px, transparent 1px), linear-gradient(to bottom, rgb(var(--c-line) / 0.55) 1px, transparent 1px)",
      },
      keyframes: {
        "pulse-ring": {
          "0%": { transform: "scale(0.85)", opacity: "0.7" },
          "70%": { transform: "scale(1.6)", opacity: "0" },
          "100%": { transform: "scale(1.6)", opacity: "0" },
        },
        shimmer: {
          "0%": { transform: "translateX(-120%)" },
          "100%": { transform: "translateX(320%)" },
        },
        "spin-slow": {
          to: { transform: "rotate(360deg)" },
        },
      },
      animation: {
        "pulse-ring": "pulse-ring 2s cubic-bezier(0.24,0.6,0.35,1) infinite",
        shimmer: "shimmer 1.6s infinite",
        "spin-slow": "spin-slow 9s linear infinite",
      },
      transitionTimingFunction: {
        swift: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  plugins: [],
} satisfies Config;
