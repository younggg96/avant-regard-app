import { Alert } from "react-native";
import i18n from "@/i18n";
import { config } from "../../config/env";
import { useAuthStore } from "../../store/authStore";

export const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, "0")}`;
};

export const getPostTypeName = (type: string) => {
  const key = `admin.postType_${type}`;
  const translated = i18n.t(key);
  return translated !== key ? translated : type;
};

export const getLinkTypeName = (type: string) => {
  const key = `admin.linkType_${type}`;
  const translated = i18n.t(key);
  return translated !== key ? translated : type;
};

export const uploadImageFromUri = async (uri: string): Promise<string> => {
  const formData = new FormData();
  const filename = uri.split("/").pop() || "image.jpg";
  const match = /\.(\w+)$/.exec(filename);
  const type = match ? `image/${match[1]}` : "image/jpeg";

  formData.append("file", {
    uri,
    name: filename,
    type,
  } as any);

  const token = useAuthStore.getState().getAccessToken();
  const response = await fetch(
    `${config.EXPO_PUBLIC_API_BASE_URL}/api/files/upload-image`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    }
  );

  const data = await response.json();
  if (data.code === 0 && data.data?.url) {
    return data.data.url;
  }
  throw new Error(data.message || i18n.t("admin.uploadFailed"));
};

export const pickAndUploadImage = async (
  aspect: [number, number] = [1, 1]
): Promise<string | null> => {
  const ImagePicker = require("expo-image-picker");

  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== "granted") {
    Alert.alert(i18n.t("common.permissionDenied"), i18n.t("common.photoPermissionRequired"));
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect,
    quality: 0.8,
  });

  if (!result.canceled && result.assets[0]) {
    return uploadImageFromUri(result.assets[0].uri);
  }
  return null;
};
