import { styled } from '@gluestack-style/react';
import { Pressable as RNPressable } from 'react-native';

export const Pressable = styled(RNPressable, {
  ':active': {
    opacity: 0.8,
  },
});

