import { styled } from '@gluestack-style/react';
import { Text as RNText } from 'react-native';

export const Text = styled(RNText, {
  color: '$black',
  fontFamily: 'System',
  fontSize: '$md',
  fontWeight: '$normal',
  lineHeight: '$md',
});

export const Heading = styled(RNText, {
  color: '$black',
  fontFamily: 'System',
  fontSize: '$2xl',
  fontWeight: '$bold',
  lineHeight: '$2xl',
});

