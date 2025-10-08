import { createConfig } from '@gluestack-style/react';

export const config = createConfig({
  aliases: {
    bg: 'backgroundColor',
    bgColor: 'backgroundColor',
    h: 'height',
    w: 'width',
    p: 'padding',
    px: 'paddingHorizontal',
    py: 'paddingVertical',
    pt: 'paddingTop',
    pb: 'paddingBottom',
    pl: 'paddingLeft',
    pr: 'paddingRight',
    m: 'margin',
    mx: 'marginHorizontal',
    my: 'marginVertical',
    mt: 'marginTop',
    mb: 'marginBottom',
    ml: 'marginLeft',
    mr: 'marginRight',
    rounded: 'borderRadius',
  },
  tokens: {
    colors: {
      black: '#000000',
      white: '#FFFFFF',
      gray50: '#F9F9F9',
      gray100: '#F5F5F5',
      gray200: '#AAAAAA',
      gray300: '#666666',
      gray400: '#444444',
      gray500: '#222222',
      gray600: '#111111',
      gray700: '#000000',
      accent: '#000000',
      error: '#FF3B30',
      success: '#34C759',
      primary: '#000000',
      secondary: '#666666',
    },
    space: {
      xs: 4,
      sm: 8,
      md: 16,
      lg: 24,
      xl: 32,
      '2xl': 48,
    },
    borderWidths: {
      0: 0,
      1: 1,
      2: 2,
      4: 4,
      8: 8,
    },
    radii: {
      none: 0,
      sm: 4,
      md: 8,
      lg: 12,
      full: 9999,
    },
    fontSizes: {
      '2xs': 10,
      xs: 12,
      sm: 14,
      md: 16,
      lg: 18,
      xl: 20,
      '2xl': 24,
      '3xl': 30,
      '4xl': 36,
      '5xl': 48,
      '6xl': 60,
      '7xl': 72,
      '8xl': 96,
      '9xl': 128,
    },
    lineHeights: {
      '2xs': 16,
      xs: 18,
      sm: 20,
      md: 22,
      lg: 24,
      xl: 28,
      '2xl': 32,
      '3xl': 40,
      '4xl': 48,
      '5xl': 56,
      '6xl': 72,
      '7xl': 90,
    },
    fontWeights: {
      hairline: '100',
      thin: '200',
      light: '300',
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
      extrabold: '800',
      black: '900',
    },
    letterSpacings: {
      xs: -1.5,
      sm: -0.5,
      md: 0,
      lg: 0.5,
      xl: 1,
      '2xl': 1.5,
    },
  },
  globalStyle: {
    variants: {
      hardShadow: {
        '1': {
          shadowColor: '$black',
          shadowOffset: {
            width: -2,
            height: 2,
          },
          shadowRadius: 8,
          shadowOpacity: 0.5,
          elevation: 10,
        },
        '2': {
          shadowColor: '$black',
          shadowOffset: {
            width: 0,
            height: 3,
          },
          shadowRadius: 8,
          shadowOpacity: 0.5,
          elevation: 10,
        },
        '3': {
          shadowColor: '$black',
          shadowOffset: {
            width: 2,
            height: 2,
          },
          shadowRadius: 8,
          shadowOpacity: 0.5,
          elevation: 10,
        },
        '4': {
          shadowColor: '$black',
          shadowOffset: {
            width: 0,
            height: -3,
          },
          shadowRadius: 8,
          shadowOpacity: 0.5,
          elevation: 10,
        },
      },
      softShadow: {
        '1': {
          shadowColor: '$black',
          shadowOffset: {
            width: 0,
            height: 0,
          },
          shadowRadius: 10,
          shadowOpacity: 0.1,
          _android: {
            shadowColor: '$black',
            elevation: 5,
            shadowOpacity: 0.05,
          },
        },
        '2': {
          shadowColor: '$black',
          shadowOffset: {
            width: 0,
            height: 0,
          },
          shadowRadius: 20,
          elevation: 3,
          shadowOpacity: 0.1,
          _android: {
            shadowColor: '$black',
            elevation: 10,
            shadowOpacity: 0.1,
          },
        },
        '3': {
          shadowColor: '$black',
          shadowOffset: {
            width: 0,
            height: 0,
          },
          shadowRadius: 30,
          shadowOpacity: 0.1,
          elevation: 4,
          _android: {
            shadowColor: '$black',
            elevation: 15,
            shadowOpacity: 0.15,
          },
        },
        '4': {
          shadowColor: '$black',
          shadowOffset: {
            width: 0,
            height: 0,
          },
          shadowRadius: 40,
          shadowOpacity: 0.1,
          elevation: 5,
          _android: {
            shadowColor: '$black',
            elevation: 20,
            shadowOpacity: 0.2,
          },
        },
      },
    },
  },
} as const);

export type Config = typeof config;

declare module '@gluestack-style/react' {
  interface ICustomConfig extends Config {}
}

