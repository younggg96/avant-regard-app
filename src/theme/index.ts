const getFontFamily = (customFont: string) => {
  if (__DEV__) {
    return "Georgia";
  }
  return customFont;
};

export const theme = {
  colors: {
    black: "#000000",
    white: "#FFFFFF",
    gray50: "#F9F9F9",
    gray100: "#F5F5F5",
    gray200: "#AAAAAA",
    gray300: "#666666",
    gray400: "#444444",
    gray500: "#222222",
    gray600: "#111111",
    gray700: "#000000",
    accent: "#000000", // Black
    error: "#FF3B30",
    success: "#34C759",
  },
  typography: {
    hero: {
      fontFamily: getFontFamily("PlayfairDisplay-Bold"),
      fontSize: 48,
      lineHeight: 52,
      letterSpacing: -0.5,
    },
    h1: {
      fontFamily: getFontFamily("PlayfairDisplay-Bold"),
      fontSize: 32,
      lineHeight: 38,
    },
    h2: {
      fontFamily: getFontFamily("PlayfairDisplay-Regular"),
      fontSize: 24,
      lineHeight: 30,
    },
    h3: {
      fontFamily: getFontFamily("PlayfairDisplay-Medium"),
      fontSize: 18,
      lineHeight: 24,
    },
    h4: {
      fontFamily: getFontFamily("PlayfairDisplay-Medium"),
      fontSize: 16,
      lineHeight: 22,
    },
    body: {
      fontFamily: getFontFamily("PlayfairDisplay-Regular"),
      fontSize: 16,
      lineHeight: 24,
    },
    bodySmall: {
      fontFamily: getFontFamily("PlayfairDisplay-Regular"),
      fontSize: 14,
      lineHeight: 20,
    },
    caption: {
      fontFamily: getFontFamily("PlayfairDisplay-Regular"),
      fontSize: 12,
      lineHeight: 16,
    },
    button: {
      fontFamily: getFontFamily("PlayfairDisplay-Medium"),
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
    xl: 16,
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
