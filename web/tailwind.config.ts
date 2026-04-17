import type { Config } from "tailwindcss";

/**
 * Tailwind theme mirrors the mobile app's design system defined in
 * frontend/src/theme/index.ts — same minimalist black/white/gray palette
 * and Playfair Display typography for brand consistency.
 */
const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx,mdx}",
    "./src/components/**/*.{ts,tsx,mdx}",
    "./src/lib/**/*.{ts,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#000000",
          soft: "#222222",
          900: "#000000",
          800: "#111111",
          700: "#222222",
          600: "#444444",
          500: "#666666",
          400: "#AAAAAA",
          200: "#F5F5F5",
          100: "#F9F9F9",
          50: "#FFFFFF",
        },
        brand: {
          DEFAULT: "#000000",
          accent: "#000000",
          error: "#FF3B30",
          success: "#34C759",
        },
      },
      fontFamily: {
        serif: ["var(--font-playfair)", "Playfair Display", "Georgia", "serif"],
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Inter",
          "sans-serif",
        ],
      },
      fontSize: {
        hero: ["clamp(2.5rem, 6vw, 4.5rem)", { lineHeight: "1.05", letterSpacing: "-0.02em" }],
        display: ["clamp(2rem, 4vw, 3rem)", { lineHeight: "1.1", letterSpacing: "-0.01em" }],
      },
      maxWidth: {
        content: "1200px",
      },
      borderRadius: {
        sm: "4px",
        DEFAULT: "8px",
        lg: "12px",
        xl: "16px",
      },
      boxShadow: {
        soft: "0 1px 2px rgba(0, 0, 0, 0.05)",
        card: "0 2px 4px rgba(0, 0, 0, 0.1)",
        float: "0 4px 8px rgba(0, 0, 0, 0.15)",
      },
      animation: {
        "fade-in": "fadeIn 0.6s ease-out",
        "slide-up": "slideUp 0.5s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
