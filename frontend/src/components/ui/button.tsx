import React, { createContext, useContext, useMemo } from 'react';
import { styled } from '@gluestack-style/react';
import { Pressable, Text as RNText, ActivityIndicator, StyleSheet } from 'react-native';
import { useAppTheme } from '../../theme';

/**
 * 结构与尺寸仍走 gluestack `styled`，颜色全部从 `useAppTheme()` 注入。
 * 避免 `$white` / `$black` 等 token 在 RN 上与 ThemeProvider 不同步
 * （dark mode 下 outline 按钮会变成白底白字）。
 */
const StyledPressable = styled(Pressable, {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '$xs',
  paddingHorizontal: '$lg',
  paddingVertical: '$md',
  borderRadius: '$md',

  ':active': {
    opacity: 0.8,
  },

  ':disabled': {
    opacity: 0.5,
  },

  variants: {
    variant: {
      solid: {},
      outline: {},
      ghost: {},
    },
    size: {
      xs: {
        paddingHorizontal: '$sm',
        paddingVertical: '$xs',
      },
      sm: {
        paddingHorizontal: '$md',
        paddingVertical: '$sm',
      },
      md: {
        paddingHorizontal: '$lg',
        paddingVertical: '$md',
      },
      lg: {
        paddingHorizontal: '$xl',
        paddingVertical: '$lg',
      },
    },
    colorScheme: {
      primary: {},
      secondary: {},
      error: {},
      success: {},
    },
  },

  defaultProps: {
    variant: 'solid',
    size: 'md',
    colorScheme: 'primary',
  },
});

const StyledText = styled(RNText, {
  fontWeight: '$medium',
  fontSize: '$md',
});

type ButtonVariant = 'solid' | 'outline' | 'ghost';
type ButtonColorScheme = 'primary' | 'secondary' | 'error' | 'success';

const ButtonTextColorContext = createContext<string | undefined>(undefined);

const LEGACY_WRONG_ICON_COLORS = new Set([
  '#fff',
  '#ffffff',
  'white',
  '#000',
  '#000000',
  'black',
]);

/** Outline/ghost 上误用 white/black 时自动对齐 Button 前景色；保留 accent 等语义色 */
function tintButtonIcon(
  icon: React.ReactNode,
  textColor: string,
  variant: ButtonVariant,
): React.ReactNode {
  if (!React.isValidElement(icon)) return icon;

  const props = icon.props as { color?: string };
  if (variant !== 'outline' && variant !== 'ghost') {
    if (props.color) return icon;
    return React.cloneElement(icon as React.ReactElement<{ color?: string }>, {
      color: textColor,
    });
  }

  const raw = props.color?.toLowerCase?.() ?? '';
  if (props.color && !LEGACY_WRONG_ICON_COLORS.has(raw)) {
    return icon;
  }

  return React.cloneElement(icon as React.ReactElement<{ color?: string }>, {
    color: textColor,
  });
}

function resolveButtonColors(
  t: ReturnType<typeof useAppTheme>,
  variant: ButtonVariant,
  colorScheme: ButtonColorScheme,
) {
  const scheme = {
    primary: {
      solidBg: t.colors.text,
      solidFg: t.colors.textInverted,
      outlineBorder: t.colors.border,
      outlineFg: t.colors.text,
    },
    secondary: {
      solidBg: t.colors.gray400,
      solidFg: t.colors.textInverted,
      outlineBorder: t.colors.gray300,
      outlineFg: t.colors.text,
    },
    error: {
      solidBg: t.colors.error,
      solidFg: t.colors.white,
      outlineBorder: t.colors.error,
      outlineFg: t.colors.error,
    },
    success: {
      solidBg: t.colors.success,
      solidFg: t.colors.white,
      outlineBorder: t.colors.success,
      outlineFg: t.colors.success,
    },
  }[colorScheme];

  if (variant === 'outline') {
    return {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: scheme.outlineBorder,
      textColor: scheme.outlineFg,
      spinnerColor: scheme.outlineFg,
    };
  }

  if (variant === 'ghost') {
    return {
      backgroundColor: 'transparent',
      borderWidth: 0,
      textColor: scheme.outlineFg,
      spinnerColor: scheme.outlineFg,
    };
  }

  return {
    backgroundColor: scheme.solidBg,
    borderWidth: 0,
    textColor: scheme.solidFg,
    spinnerColor: scheme.solidFg,
  };
}

export interface ButtonProps {
  children?: React.ReactNode;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  colorScheme?: ButtonColorScheme;
  disabled?: boolean;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  sx?: Record<string, unknown>;
  style?: object;
  [key: string]: unknown;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  onPress,
  variant = 'solid',
  size = 'md',
  colorScheme = 'primary',
  disabled = false,
  isLoading = false,
  leftIcon,
  rightIcon,
  sx: sxProp,
  style,
  ...props
}) => {
  const t = useAppTheme();

  const themeSx = useMemo(
    () => resolveButtonColors(t, variant, colorScheme),
    [t, variant, colorScheme],
  );

  const mergedSx = useMemo(
    () => ({
      backgroundColor: themeSx.backgroundColor,
      borderWidth: themeSx.borderWidth,
      borderColor: themeSx.borderColor,
      ...(sxProp as object),
    }),
    [themeSx, sxProp],
  );

  return (
    <ButtonTextColorContext.Provider value={themeSx.textColor}>
      <StyledPressable
        onPress={onPress}
        disabled={disabled || isLoading}
        variant={variant}
        size={size}
        colorScheme={colorScheme}
        sx={mergedSx}
        style={style}
        {...props}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={themeSx.spinnerColor} />
        ) : (
          <>
            {tintButtonIcon(leftIcon, themeSx.textColor, variant)}
            {typeof children === 'string' ? (
              <StyledText sx={{ color: themeSx.textColor }}>{children}</StyledText>
            ) : (
              children
            )}
            {tintButtonIcon(rightIcon, themeSx.textColor, variant)}
          </>
        )}
      </StyledPressable>
    </ButtonTextColorContext.Provider>
  );
};

export interface ButtonTextProps {
  children?: React.ReactNode;
  style?: object;
  sx?: Record<string, unknown>;
  [key: string]: unknown;
}

/** 与 Button 搭配使用；在 Button 内自动继承文字色 */
export const ButtonText: React.FC<ButtonTextProps> = ({ children, style, sx, ...props }) => {
  const inheritedColor = useContext(ButtonTextColorContext);
  const t = useAppTheme();
  const color = inheritedColor ?? t.colors.text;

  const flatStyle = StyleSheet.flatten(style) as { color?: string } | undefined;
  const styleColor = flatStyle?.color?.toLowerCase?.() ?? '';
  const resolvedStyle =
    inheritedColor &&
    flatStyle?.color &&
    LEGACY_WRONG_ICON_COLORS.has(styleColor)
      ? { ...flatStyle, color: inheritedColor }
      : style;

  return (
    <StyledText sx={{ color, ...(sx as object) }} style={resolvedStyle} {...props}>
      {children}
    </StyledText>
  );
};
