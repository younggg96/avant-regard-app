import React from "react";
import { Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Box, Text, HStack, Pressable, Image } from "./ui";
import { theme } from "../theme";

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
  label = "图片",
  required = false,
}) => {
  const itemWidth = (screenWidth - 48 - 16) / 3;

  return (
    <Box mx="$md" mb="$md">
      <HStack mb="$sm" alignItems="center">
        <Text color="$gray600" fontSize="$sm">
          {label}
        </Text>
        {required && (
          <Text color="$red500" fontSize="$sm" ml="$xs">
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
              <Image
                source={{ uri: image }}
                style={{
                  width: "100%",
                  height: "100%",
                  borderRadius: 8,
                }}
              />
            </Pressable>
            <Pressable
              position="absolute"
              top={4}
              right={4}
              w={24}
              h={24}
              rounded="$full"
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
            bg="$gray100"
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
