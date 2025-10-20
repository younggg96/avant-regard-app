import React from "react";
import { Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Box, Text, Pressable, HStack } from "./ui";
import { theme } from "../theme";

interface ImagePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectCamera: () => void;
  onSelectGallery: () => void;
  title?: string;
}

const ImagePickerModal: React.FC<ImagePickerModalProps> = ({
  visible,
  onClose,
  onSelectCamera,
  onSelectGallery,
  title = "选择图片",
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Box flex={1} bg="rgba(0,0,0,0.5)" justifyContent="flex-end">
        <Pressable flex={1} onPress={onClose} />
        <Box
          bg="$white"
          borderTopLeftRadius="$lg"
          borderTopRightRadius="$lg"
          pb={34}
        >
          <HStack
            px="$lg"
            py="$md"
            borderBottomWidth={1}
            borderBottomColor="$gray100"
            alignItems="center"
            justifyContent="between"
          >
            <Text fontSize="$lg" color="$black" fontWeight="$medium">
              {title}
            </Text>
            <Pressable p="$xs" onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.colors.gray600} />
            </Pressable>
          </HStack>

          <Pressable px="$lg" py="$lg" onPress={onSelectCamera}>
            <HStack alignItems="center">
              <Ionicons name="camera" size={24} color={theme.colors.accent} />
              <Text color="$black" fontSize="$md" ml="$md">
                拍照
              </Text>
            </HStack>
          </Pressable>

          <Pressable px="$lg" py="$lg" onPress={onSelectGallery}>
            <HStack alignItems="center">
              <Ionicons name="images" size={24} color={theme.colors.accent} />
              <Text color="$black" fontSize="$md" ml="$md">
                从相册选择
              </Text>
            </HStack>
          </Pressable>
        </Box>
      </Box>
    </Modal>
  );
};

export default ImagePickerModal;
