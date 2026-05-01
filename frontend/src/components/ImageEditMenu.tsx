import React from "react";
import { Modal, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { Box, Text, Pressable, VStack, HStack } from "./ui";
import { theme } from "../theme";

export interface ImageEditMenuProps {
  visible: boolean;
  imageUri: string;
  isCover: boolean;
  onClose: () => void;
  onEdit: () => void;
  onSetCover: () => void;
  onDelete: () => void;
}

export const ImageEditMenu: React.FC<ImageEditMenuProps> = ({
  visible,
  imageUri,
  isCover,
  onClose,
  onEdit,
  onSetCover,
  onDelete,
}) => {
  const { t } = useTranslation();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Box flex={1} bg="rgba(0,0,0,0.5)" justifyContent="flex-end">
        {/* 点击背景关闭 */}
        <Pressable flex={1} onPress={onClose} />

        {/* 菜单内容 */}
        <Box
          bg="$white"
          borderTopLeftRadius="$lg"
          borderTopRightRadius="$lg"
          pb={34}
        >
          {/* 标题栏 */}
          <HStack
            px="$lg"
            py="$md"
            borderBottomWidth={1}
            borderBottomColor="$gray100"
            alignItems="center"
            justifyContent="between"
          >
            <Text fontSize="$lg" color="$black" fontWeight="$medium">
              {t("imageEditMenu.title")}
            </Text>
            <Pressable p="$xs" onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.colors.gray600} />
            </Pressable>
          </HStack>

          {/* 菜单选项 */}
          <VStack>
            {/* 编辑/裁剪 */}
            <Pressable px="$lg" py="$lg" onPress={onEdit}>
              <HStack alignItems="center" space="md">
                <Box
                  w={40}
                  h={40}
                  bg="$gray100"
                  rounded="$sm"
                  alignItems="center"
                  justifyContent="center"
                >
                  <Ionicons name="crop" size={20} color={theme.colors.black} />
                </Box>
                <VStack flex={1}>
                  <Text color="$black" fontSize="$md" fontWeight="$medium">
                    {t("imageEditMenu.editAndCrop")}
                  </Text>
                  <Text color="$gray500" fontSize="$sm">
                    {t("imageEditMenu.adjustSize")}
                  </Text>
                </VStack>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={theme.colors.gray400}
                />
              </HStack>
            </Pressable>

            {/* 设为封面 */}
            {!isCover && (
              <Pressable px="$lg" py="$lg" onPress={onSetCover}>
                <HStack alignItems="center" space="md">
                  <Box
                    w={40}
                    h={40}
                    bg="$gray100"
                    rounded="$sm"
                    alignItems="center"
                    justifyContent="center"
                  >
                    <Ionicons
                      name="star"
                      size={20}
                      color={theme.colors.black}
                    />
                  </Box>
                  <VStack flex={1}>
                    <Text color="$black" fontSize="$md" fontWeight="$medium">
                      {t("imageEditMenu.setAsCover")}
                    </Text>
                    <Text color="$gray500" fontSize="$sm">
                      {t("imageEditMenu.setAsCoverDesc")}
                    </Text>
                  </VStack>
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={theme.colors.gray400}
                  />
                </HStack>
              </Pressable>
            )}

            {/* 当前封面提示 */}
            {isCover && (
              <Box px="$lg" py="$lg">
                <HStack alignItems="center" space="md">
                  <Box
                    w={40}
                    h={40}
                    bg="$accent"
                    rounded="$sm"
                    alignItems="center"
                    justifyContent="center"
                  >
                    <Ionicons
                      name="star"
                      size={20}
                      color={theme.colors.white}
                    />
                  </Box>
                  <VStack flex={1}>
                    <Text color="$black" fontSize="$md" fontWeight="$medium">
                      {t("imageEditMenu.currentCover")}
                    </Text>
                    <Text color="$gray500" fontSize="$sm">
                      {t("imageEditMenu.currentCoverDesc")}
                    </Text>
                  </VStack>
                  <Ionicons
                    name="checkmark-circle"
                    size={24}
                    color={theme.colors.accent}
                  />
                </HStack>
              </Box>
            )}

            {/* 分隔线 */}
            <Box h={1} bg="$gray100" mx="$lg" />

            {/* 删除 */}
            <Pressable px="$lg" py="$lg" onPress={onDelete}>
              <HStack alignItems="center" space="md">
                <Box
                  w={40}
                  h={40}
                  bg="#FFE5E5"
                  rounded="$sm"
                  alignItems="center"
                  justifyContent="center"
                >
                  <Ionicons name="trash" size={20} color={theme.colors.error} />
                </Box>
                <VStack flex={1}>
                  <Text color="$error" fontSize="$md" fontWeight="$medium">
                    {t("imageEditMenu.deleteImage")}
                  </Text>
                  <Text color="$gray500" fontSize="$sm">
                    {t("imageEditMenu.deleteImageDesc")}
                  </Text>
                </VStack>
              </HStack>
            </Pressable>
          </VStack>

          {/* 取消按钮 */}
          <Box px="$lg" pt="$md">
            <Pressable
              w="100%"
              py="$md"
              bg="$gray100"
              rounded="$md"
              alignItems="center"
              onPress={onClose}
            >
              <Text color="$gray600" fontSize="$md" fontWeight="$medium">
                {t("common.cancel")}
              </Text>
            </Pressable>
          </Box>
        </Box>
      </Box>
    </Modal>
  );
};

export default ImageEditMenu;
