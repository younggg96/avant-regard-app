import React, { useMemo } from "react";
import { styled } from "@gluestack-style/react";
import { TextInput } from "react-native";
import { useAppTheme } from "../../theme";

/**
 * 结构与尺寸仍走 gluestack `styled`，颜色全部从 `useAppTheme()` 注入。
 * 避免 `$white` / `$black` 等 token 在 RN 上与 `GluestackUIProvider` 的
 * colorMode 不同步（浅色模式下仍按深色 token 渲染 → 黑底黑字）。
 */
const StyledTextInput = styled(TextInput, {
  width: "100%",
  borderRadius: "$md",
  variants: {
    size: {
      sm: {
        paddingHorizontal: "$sm",
        paddingVertical: "$xs",
        fontSize: "$sm",
      },
      md: {
        paddingHorizontal: "$md",
        paddingVertical: "$sm",
        fontSize: "$md",
      },
      lg: {
        paddingHorizontal: "$lg",
        paddingVertical: "$md",
        fontSize: "$lg",
      },
    },
    variant: {
      outline: {},
      filled: {},
      underlined: {
        borderRadius: 0,
        paddingHorizontal: 0,
      },
    },
  },
  defaultProps: {
    size: "md",
    variant: "outline",
  },
});

export interface InputProps {
  value?: string;
  onChangeText?: (text: string) => void;
  placeholder?: string;
  placeholderTextColor?: string;
  size?: "sm" | "md" | "lg";
  variant?: "outline" | "filled" | "underlined";
  disabled?: boolean;
  multiline?: boolean;
  numberOfLines?: number;
  secureTextEntry?: boolean;
  sx?: Record<string, unknown>;
  [key: string]: unknown;
}

export const Input: React.FC<InputProps> = ({
  value,
  onChangeText,
  placeholder,
  placeholderTextColor,
  size = "md",
  variant = "outline",
  disabled = false,
  multiline = false,
  numberOfLines,
  secureTextEntry = false,
  sx: sxProp,
  ...props
}) => {
  const t = useAppTheme();

  const themeSx = useMemo(() => {
    const base = {
      color: t.colors.text,
      ...(disabled ? { opacity: 0.6 } : {}),
    };

    if (variant === "filled") {
      return {
        ...base,
        borderWidth: 0,
        backgroundColor: t.colors.gray100,
      };
    }

    if (variant === "underlined") {
      return {
        ...base,
        borderWidth: 0,
        borderBottomWidth: 1,
        borderBottomColor: t.colors.inputBorder,
        backgroundColor: t.colors.inputBackground,
        borderRadius: 0,
        paddingHorizontal: 0,
      };
    }

    return {
      ...base,
      borderWidth: 1,
      borderColor: t.colors.inputBorder,
      backgroundColor: t.colors.inputBackground,
    };
  }, [t, variant, disabled]);

  const mergedSx = { ...themeSx, ...(sxProp as object) };

  return (
    <StyledTextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={placeholderTextColor ?? t.colors.placeholder}
      size={size}
      variant={variant}
      editable={!disabled}
      multiline={multiline}
      numberOfLines={numberOfLines}
      secureTextEntry={secureTextEntry}
      sx={mergedSx}
      {...props}
    />
  );
};
