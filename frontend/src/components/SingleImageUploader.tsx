import React, { useState } from "react";
import { Modal } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { Box, Text, Pressable } from "./ui";
import { OptimizedImage } from "./ui/OptimizedImage";
import { ImageSize } from "../utils/imageUtils";
import { theme } from "../theme";
import ImagePickerModal from "./ImagePickerModal";
import ImageCropper, { AspectRatio } from "./ImageCropper";
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
  enableCropper?: boolean;
  defaultCropAspect?: AspectRatio;
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
  enableCropper = false,
  defaultCropAspect = "free",
}) => {
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [showCropper, setShowCropper] = useState(false);
  const [rawImageUri, setRawImageUri] = useState<string | null>(null);

  const handleAddImage = () => {
    setShowImagePicker(true);
  };

  const handleImageSelection = async (source: "camera" | "gallery") => {
    setShowImagePicker(false);

    try {
      if (source === "camera") {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") {
          Alert.show("需要相机权限才能拍照");
          return;
        }
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
          Alert.show("需要相册权限才能选择图片");
          return;
        }
      }

      const pickerEditing = enableCropper ? false : allowEditing;
      const result = source === "camera"
        ? await ImagePicker.launchCameraAsync({
            allowsEditing: pickerEditing,
            aspect: aspectRatio,
            quality: 1.0,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: pickerEditing,
            aspect: aspectRatio,
            quality: 1.0,
          });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedUri = result.assets[0].uri;
        if (enableCropper) {
          setRawImageUri(selectedUri);
          setShowCropper(true);
        } else {
          onImageSelected(selectedUri);
          Alert.show("图片已设置", "", 1500);
        }
      }
    } catch (error) {
      console.error("Image selection error:", error);
      Alert.show("错误: 图片选择失败，请重试");
    }
  };

  const handleCropDone = (croppedUri: string) => {
    setShowCropper(false);
    setRawImageUri(null);
    onImageSelected(croppedUri);
    Alert.show("图片已设置", "", 1500);
  };

  const handleCropCancel = () => {
    setShowCropper(false);
    setRawImageUri(null);
  };

  const handleEditWithCropper = () => {
    if (imageUri && enableCropper) {
      setRawImageUri(imageUri);
      setShowCropper(true);
    } else {
      handleAddImage();
    }
  };

  const handleRemoveImage = () => {
    onImageRemoved();
    Alert.show("图片已移除");
  };

  const cropperModal = enableCropper ? (
    <Modal
      visible={showCropper && !!rawImageUri}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
    >
      <SafeAreaProvider>
        {rawImageUri && (
          <ImageCropper
            sourceUri={rawImageUri}
            aspect={defaultCropAspect}
            onCancel={handleCropCancel}
            onDone={handleCropDone}
          />
        )}
      </SafeAreaProvider>
    </Modal>
  ) : null;

  if (!imageUri) {
    return (
      <>
        {cropperModal}
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
      {cropperModal}
      <Box mx="$md" mb="$md" position="relative">
        <Box h={height} rounded="$md" overflow="hidden">
          <OptimizedImage
            uri={imageUri}
            size={ImageSize.MEDIUM}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
            lazy={true}
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

        {/* Edit/crop button */}
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
          onPress={handleEditWithCropper}
        >
          <Text color="$white" fontSize="$xs" fontWeight="$medium">
            {enableCropper ? "裁剪" : "更换"}
          </Text>
        </Pressable>

        {/* Replace button (shown when cropper is enabled) */}
        {enableCropper && (
          <Pressable
            position="absolute"
            bottom={8}
            left={8}
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
        )}
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
