import React from 'react';
import { styled } from '@gluestack-style/react';
import { TextInput, View } from 'react-native';

const StyledTextInput = styled(TextInput, {
  width: '100%',
  paddingHorizontal: '$md',
  paddingVertical: '$sm',
  fontSize: '$md',
  color: '$black',
  backgroundColor: '$white',
  borderWidth: 1,
  borderColor: '$gray200',
  borderRadius: '$md',
  
  ':focus': {
    borderColor: '$black',
  },
  
  ':disabled': {
    backgroundColor: '$gray100',
    opacity: 0.6,
  },
  
  variants: {
    size: {
      sm: {
        paddingHorizontal: '$sm',
        paddingVertical: '$xs',
        fontSize: '$sm',
      },
      md: {
        paddingHorizontal: '$md',
        paddingVertical: '$sm',
        fontSize: '$md',
      },
      lg: {
        paddingHorizontal: '$lg',
        paddingVertical: '$md',
        fontSize: '$lg',
      },
    },
    variant: {
      outline: {
        borderWidth: 1,
        borderColor: '$gray200',
      },
      filled: {
        backgroundColor: '$gray100',
        borderWidth: 0,
      },
      underlined: {
        borderWidth: 0,
        borderBottomWidth: 1,
        borderRadius: 0,
        paddingHorizontal: 0,
      },
    },
  },
  
  defaultProps: {
    size: 'md',
    variant: 'outline',
  },
});

export interface InputProps {
  value?: string;
  onChangeText?: (text: string) => void;
  placeholder?: string;
  placeholderTextColor?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'outline' | 'filled' | 'underlined';
  disabled?: boolean;
  multiline?: boolean;
  numberOfLines?: number;
  secureTextEntry?: boolean;
  [key: string]: any;
}

export const Input: React.FC<InputProps> = ({
  value,
  onChangeText,
  placeholder,
  placeholderTextColor = '#999',
  size = 'md',
  variant = 'outline',
  disabled = false,
  multiline = false,
  numberOfLines,
  secureTextEntry = false,
  ...props
}) => {
  return (
    <StyledTextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={placeholderTextColor}
      size={size}
      variant={variant}
      editable={!disabled}
      multiline={multiline}
      numberOfLines={numberOfLines}
      secureTextEntry={secureTextEntry}
      {...props}
    />
  );
};

