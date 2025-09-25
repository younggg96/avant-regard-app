// Helper to get font family with fallback for development
const getFontFamily = (customFont: string, systemFallback: string) => {
  // In development mode, use system fonts to avoid errors with placeholder font files
  if (__DEV__) {
    // Use known system fonts that work on both iOS and Android
    if (systemFallback === "serif") {
      return "Georgia"; // Available on both platforms
    } else if (systemFallback === "sans-serif") {
      return "System"; // iOS system font, fallback for Android
    }
    return systemFallback;
  }
  return customFont;
};

export const theme = {
  colors: {
    black: "#000000",
    white: "#FFFFFF",
    gray100: "#F5F5F5",
    gray200: "#AAAAAA",
    gray300: "#666666",
    gray400: "#444444",
    gray500: "#222222",
    gray600: "#111111",
    accent: "#000000", // Black
    error: "#FF3B30",
    success: "#34C759",
  },
  typography: {
    hero: {
      fontFamily: getFontFamily("PlayfairDisplay-Bold", "serif"),
      fontSize: 48,
      lineHeight: 52,
      letterSpacing: -0.5,
    },
    h1: {
      fontFamily: getFontFamily("PlayfairDisplay-Bold", "serif"),
      fontSize: 32,
      lineHeight: 38,
    },
    h2: {
      fontFamily: getFontFamily("PlayfairDisplay-Regular", "serif"),
      fontSize: 24,
      lineHeight: 30,
    },
    h3: {
      fontFamily: getFontFamily("Inter-Medium", "sans-serif"),
      fontSize: 18,
      lineHeight: 24,
    },
    body: {
      fontFamily: getFontFamily("Inter-Regular", "sans-serif"),
      fontSize: 16,
      lineHeight: 24,
    },
    bodySmall: {
      fontFamily: getFontFamily("Inter-Regular", "sans-serif"),
      fontSize: 14,
      lineHeight: 20,
    },
    caption: {
      fontFamily: getFontFamily("Inter-Regular", "sans-serif"),
      fontSize: 12,
      lineHeight: 16,
    },
    button: {
      fontFamily: getFontFamily("Inter-Medium", "sans-serif"),
      fontSize: 16,
      lineHeight: 20,
      letterSpacing: 0.5,
    },
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 12,
    full: 9999,
  },
  shadows: {
    sm: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
    },
    md: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 4,
    },
    lg: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 8,
    },
  },
};
