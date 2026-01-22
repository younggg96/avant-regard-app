import { styled } from '@gluestack-style/react';
import { Text as RNText } from 'react-native';

// 字体常量
const FONT_REGULAR = 'PlayfairDisplay-Regular';
const FONT_BOLD = 'PlayfairDisplay-Bold';

export const Text = styled(RNText, {
  color: '$black',
  fontFamily: FONT_REGULAR,
  fontSize: '$md',
  fontWeight: '$normal',
  lineHeight: '$md',
});

export const Heading = styled(RNText, {
  color: '$black',
  fontFamily: FONT_BOLD,
  fontSize: '$2xl',
  fontWeight: '$bold',
  lineHeight: '$2xl',
});

