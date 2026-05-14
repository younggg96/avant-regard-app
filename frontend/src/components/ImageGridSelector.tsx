import React from "react";
import { Dimensions } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { Box, Text, HStack, Pressable } from "./ui";
import { OptimizedImage } from "./ui/OptimizedImage";
import { ImageSize } from "../utils/imageUtils";
import { theme, useAppTheme } from "../theme";

const { width: screenWidth } = Dimensions.get("window");

interface ImageGridSelectorProps {
  images: string[];
  onImagePress: (index: number) => void;
  onRemoveImage: (index: number) => void;
  onAddImage: () => void;
  maxImages?: number;
  label?: string;
  required?: boolean;
}

const ImageGridSelector: React.FC<ImageGridSelectorProps> = ({
  images,
  onImagePress,
  onRemoveImage,
  onAddImage,
  maxImages = 6,
  label,
  required = false,
}) => {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const displayLabel = label || t("publish.blockImage");
  const itemWidth = (screenWidth - 48 - 16) / 3;

  return (
    <Box mx="$md" mb="$md">
      <HStack mb="$sm" alignItems="center">
        <Text style={{ color: theme.colors.gray600 }} fontSize="$sm">
          {displayLabel}
        </Text>
        {required && (
          <Text style={{ color: theme.colors.error }} fontSize="$sm" ml="$xs">
            *
          </Text>
        )}
      </HStack>
      <HStack flexWrap="wrap" gap="$sm" pl="$sm">
        {images.map((image, index) => (
          <Box
            key={`image-${index}`}
            w={itemWidth}
            h={itemWidth}
            position="relative"
          >
            <Pressable onPress={() => onImagePress(index)}>
              <OptimizedImage
                uri={image}
                size={ImageSize.MEDIUM}
                style={{
                  width: "100%",
                  height: "100%",
                  borderRadius: 8,
                }}
                contentFit="cover"
                lazy={true}
              />
            </Pressable>
            <Pressable
              position="absolute"
              top={4}
              right={4}
              w={24}
              h={24}
              rounded="$sm"
              bg="rgba(0,0,0,0.6)"
              alignItems="center"
              justifyContent="center"
              onPress={() => onRemoveImage(index)}
            >
              <Ionicons name="close" size={16} color={theme.colors.white} />
            </Pressable>
          </Box>
        ))}
        {images.length < maxImages && (
          <Pressable
            w={itemWidth}
            h={itemWidth}
            rounded="$sm"
            style={{ backgroundColor: theme.colors.gray100 }}
            alignItems="center"
            justifyContent="center"
            onPress={onAddImage}
          >
            <Ionicons name="add" size={24} color={theme.colors.gray400} />
          </Pressable>
        )}
      </HStack>
    </Box>
  );
};

export default ImageGridSelector;
