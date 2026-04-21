import type { Config } from "tailwindcss";

/**
 * Design tokens mirror frontend/src/theme/index.ts exactly:
 *
 *  colors:  black/white + gray50–700 scale
 *  spacing: 4-pt grid (xs=4, sm=8, md=16, lg=24, xl=32, xxl=48)
 *  radius:  sm=4, md=8, lg=12, xl=16, full=9999
 *  shadows: sm = 0.05 opacity / md = 0.10 / lg = 0.15  (extremely light)
 *  font:    Playfair Display for everything (like the app)
 */
const config: Config = {
  darkMode: "class",
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
          // App gray scale (exact match)
          700: "#000000",
          600: "#111111",
          500: "#222222",
          400: "#444444",
          300: "#666666",
          200: "#AAAAAA",
          100: "#F5F5F5", // app gray100
          50: "#F9F9F9", // app gray50
        },
        brand: {
          DEFAULT: "#000000",
          accent: "#000000",
          error: "#FF3B30",
          success: "#34C759",
        },
      },
      fontFamily: {
        // App uses Playfair for everything; Inter kept for label/utility classes only
        serif: ["var(--font-playfair)", "Playfair Display", "Georgia", "serif"],
        sans: [
          "var(--font-inter)",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Inter",
          "sans-serif",
        ],
      },
      fontSize: {
        // App hero: 48 / 52 / -0.5; translated to fluid clamp for web
        hero: [
          "clamp(2.75rem, 6.5vw, 5rem)",
          { lineHeight: "1.04", letterSpacing: "-0.02em" },
        ],
        display: [
          "clamp(2rem, 4vw, 3.25rem)",
          { lineHeight: "1.08", letterSpacing: "-0.015em" },
        ],
      },
      maxWidth: {
        content: "1200px",
      },
      borderRadius: {
        // Exact mirror of app theme.borderRadius
        sm: "4px",
        DEFAULT: "8px", // app md – used for buttons and cards
        lg: "12px", // app lg
        xl: "16px", // app xl
        "2xl": "20px", // modal top corners
        "3xl": "28px",
      },
      boxShadow: {
        // Exactly match app theme.shadows (opacity values are the key)
        soft: "0 1px 2px rgba(0,0,0,0.05)", // app sm
        card: "0 2px 4px rgba(0,0,0,0.10)", // app md
        float: "0 4px 8px rgba(0,0,0,0.15)", // app lg
        elevated: "0 4px 8px rgba(0,0,0,0.30)", // FAB-level
      },
      animation: {
        "fade-in": "fadeIn 0.8s ease-out both",
        "slide-up": "slideUp 0.7s ease-out both",
        "slide-up-sm": "slideUpSm 0.5s ease-out both",
        marquee: "marquee 50s linear infinite",
        "scale-in": "scaleIn 0.6s ease-out both",
        "line-expand": "lineExpand 0.9s ease-out both",
        shimmer: "shimmer 1.8s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(28px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideUpSm: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        lineExpand: {
          "0%": { transform: "scaleX(0)", transformOrigin: "left" },
          "100%": { transform: "scaleX(1)", transformOrigin: "left" },
        },
        shimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(200%)" },
        },
      },
      transitionDuration: {
        "400": "400ms",
        "600": "600ms",
        "800": "800ms",
      },
    },
  },
  plugins: [],
};

export default config;
