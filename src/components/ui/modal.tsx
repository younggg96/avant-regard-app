import React from 'react';
import { styled } from '@gluestack-style/react';
import { Modal as RNModal, View, Pressable as RNPressable } from 'react-native';

export const Modal = RNModal;

export const ModalBackdrop = styled(RNPressable, {
  flex: 1,
  backgroundColor: 'rgba(0,0,0,0.5)',
});

export const ModalContent = styled(View, {
  backgroundColor: '$white',
  borderTopLeftRadius: '$lg',
  borderTopRightRadius: '$lg',
  paddingBottom: 34, // Safe area bottom
});

