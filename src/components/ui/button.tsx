import React from 'react';
import { styled } from '@gluestack-style/react';
import { Pressable, Text as RNText, ActivityIndicator } from 'react-native';

const StyledPressable = styled(Pressable, {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  paddingHorizontal: '$lg',
  paddingVertical: '$md',
  borderRadius: '$md',
  backgroundColor: '$black',

  ':active': {
    opacity: 0.8,
  },

  ':disabled': {
    opacity: 0.5,
  },

  variants: {
    variant: {
      solid: {
        backgroundColor: '$black',
      },
      outline: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: '$black',
      },
      ghost: {
        backgroundColor: 'transparent',
      },
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
      primary: {
        backgroundColor: '$black',
      },
      secondary: {
        backgroundColor: '$gray400',
      },
      error: {
        backgroundColor: '$error',
      },
      success: {
        backgroundColor: '$success',
      },
    },
  },

  defaultProps: {
    variant: 'solid',
    size: 'md',
    colorScheme: 'primary',
  },
});

const StyledText = styled(RNText, {
  color: '$white',
  fontWeight: '$medium',
  fontSize: '$md',

  variants: {
    variant: {
      solid: {
        color: '$white',
      },
      outline: {
        color: '$black',
      },
      ghost: {
        color: '$black',
      },
    },
  },
});

export interface ButtonProps {
  children?: React.ReactNode;
  onPress?: () => void;
  variant?: 'solid' | 'outline' | 'ghost';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  colorScheme?: 'primary' | 'secondary' | 'error' | 'success';
  disabled?: boolean;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  [key: string]: any;
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
  ...props
}) => {
  return (
    <StyledPressable
      onPress={onPress}
      disabled={disabled || isLoading}
      variant={variant}
      size={size}
      colorScheme={colorScheme}
      {...props}
    >
      {isLoading ? (
        <ActivityIndicator size="small" color={variant === 'solid' ? 'white' : 'black'} />
      ) : (
        <>
          {leftIcon}
          {typeof children === 'string' ? (
            <StyledText variant={variant}>{children}</StyledText>
          ) : (
            children
          )}
          {rightIcon}
        </>
      )}
    </StyledPressable>
  );
};

export const ButtonText = StyledText;

