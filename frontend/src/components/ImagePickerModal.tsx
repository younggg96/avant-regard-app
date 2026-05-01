import React from "react";
import { Modal } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { Box, Text, Pressable, HStack } from "./ui";
import { theme } from "../theme";

interface ImagePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectCamera: () => void;
  onSelectGallery: () => void;
  onSelectMultipleGallery?: () => void;
  onSelectVideo?: () => void;
  title?: string;
  showVideoOption?: boolean;
  showMultiSelectOption?: boolean;
}

const ImagePickerModal: React.FC<ImagePickerModalProps> = ({
  visible,
  onClose,
  onSelectCamera,
  onSelectGallery,
  onSelectMultipleGallery,
  onSelectVideo,
  title,
  showVideoOption = false,
  showMultiSelectOption = false,
}) => {
  const { t } = useTranslation();
  const displayTitle = title || t("imagePickerModal.title");
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
              {displayTitle}
            </Text>
            <Pressable p="$xs" onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.colors.gray600} />
            </Pressable>
          </HStack>

          <Pressable px="$lg" py="$lg" onPress={onSelectCamera}>
            <HStack alignItems="center">
              <Ionicons name="camera" size={24} color={theme.colors.accent} />
              <Text color="$black" fontSize="$md" ml="$md">
                {t("imagePickerModal.takePhoto")}
              </Text>
            </HStack>
          </Pressable>

          <Pressable px="$lg" py="$lg" onPress={onSelectGallery}>
            <HStack alignItems="center">
              <Ionicons name="images" size={24} color={theme.colors.accent} />
              <Text color="$black" fontSize="$md" ml="$md">
                {t("imagePickerModal.selectFromGallery")}
              </Text>
            </HStack>
          </Pressable>

          {showMultiSelectOption && onSelectMultipleGallery && (
            <Pressable px="$lg" py="$lg" onPress={onSelectMultipleGallery}>
              <HStack alignItems="center">
                <Ionicons
                  name="copy"
                  size={24}
                  color={theme.colors.accent}
                />
                <Text color="$black" fontSize="$md" ml="$md">
                  {t("imagePickerModal.selectMultiple")}
                </Text>
              </HStack>
            </Pressable>
          )}

          {showVideoOption && onSelectVideo && (
            <Pressable px="$lg" py="$lg" onPress={onSelectVideo}>
              <HStack alignItems="center">
                <Ionicons name="videocam" size={24} color={theme.colors.accent} />
                <Text color="$black" fontSize="$md" ml="$md">
                  {t("imagePickerModal.selectVideo")}
                </Text>
              </HStack>
            </Pressable>
          )}
        </Box>
      </Box>
    </Modal>
  );
};

export default ImagePickerModal;
