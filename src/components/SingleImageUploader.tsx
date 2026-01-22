import React, { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { Box, Text, Pressable, Image } from "./ui";
import { theme } from "../theme";
import ImagePickerModal from "./ImagePickerModal";
import { Alert } from "../utils/Alert";

interface SingleImageUploaderProps {
  imageUri: string | null;
  onImageSelected: (uri: string) => void;
  onImageRemoved: () => void;
  placeholder?: string;
  subtitle?: string;
  height?: number;
  aspectRatio?: [number, number];
  allowEditing?: boolean;
}

const SingleImageUploader: React.FC<SingleImageUploaderProps> = ({
  imageUri,
  onImageSelected,
  onImageRemoved,
  placeholder = "添加图片",
  subtitle = "建议尺寸 16:9",
  height = 180,
  aspectRatio = [16, 9],
  allowEditing = true,
}) => {
  const [showImagePicker, setShowImagePicker] = useState(false);

  const handleAddImage = () => {
    setShowImagePicker(true);
  };

  const handleImageSelection = async (source: "camera" | "gallery") => {
    setShowImagePicker(false);

    try {
      let result;

      if (source === "camera") {
        result = await ImagePicker.launchCameraAsync({
          allowsEditing: allowEditing,
          aspect: aspectRatio,
          quality: 1.0,
        });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: allowEditing,
          aspect: aspectRatio,
          quality: 1.0,
        });
      }

      if (!result.canceled && result.assets && result.assets.length > 0) {
        onImageSelected(result.assets[0].uri);
        Alert.show("图片已设置", "", 1500);
      }
    } catch (error) {
      console.error("Image selection error:", error);
      Alert.show("错误: 图片选择失败，请重试");
    }
  };

  const handleRemoveImage = () => {
    onImageRemoved();
    Alert.show("图片已移除");
  };

  if (!imageUri) {
    return (
      <>
        <Box mx="$md" mb="$md">
          <Pressable
            h={height}
            rounded="$md"
            overflow="hidden"
            bg="$gray100"
            alignItems="center"
            justifyContent="center"
            onPress={handleAddImage}
          >
            <Ionicons
              name="image-outline"
              size={40}
              color={theme.colors.gray400}
            />
            <Text color="$gray500" mt="$sm" fontSize="$sm">
              {placeholder}
            </Text>
            <Text color="$gray400" fontSize="$xs" mt="$xs">
              {subtitle}
            </Text>
          </Pressable>
        </Box>

        <ImagePickerModal
          visible={showImagePicker}
          onClose={() => setShowImagePicker(false)}
          onSelectCamera={() => handleImageSelection("camera")}
          onSelectGallery={() => handleImageSelection("gallery")}
        />
      </>
    );
  }

  return (
    <>
      <Box mx="$md" mb="$md" position="relative">
        <Box h={height} rounded="$md" overflow="hidden">
          <Image
            source={{ uri: imageUri }}
            style={{ width: "100%", height: "100%", resizeMode: "cover" }}
          />
        </Box>

        {/* Remove button */}
        <Pressable
          position="absolute"
          top={8}
          right={8}
          w={32}
          h={32}
          rounded="$sm"
          bg="rgba(0,0,0,0.6)"
          alignItems="center"
          justifyContent="center"
          onPress={handleRemoveImage}
        >
          <Ionicons name="close" size={20} color={theme.colors.white} />
        </Pressable>

        {/* Edit button */}
        <Pressable
          position="absolute"
          bottom={8}
          right={8}
          px="$sm"
          py="$xs"
          rounded="$md"
          bg="rgba(0,0,0,0.6)"
          alignItems="center"
          justifyContent="center"
          onPress={handleAddImage}
        >
          <Text color="$white" fontSize="$xs" fontWeight="$medium">
            更换
          </Text>
        </Pressable>
      </Box>

      <ImagePickerModal
        visible={showImagePicker}
        onClose={() => setShowImagePicker(false)}
        onSelectCamera={() => handleImageSelection("camera")}
        onSelectGallery={() => handleImageSelection("gallery")}
      />
    </>
  );
};

export default SingleImageUploader;
