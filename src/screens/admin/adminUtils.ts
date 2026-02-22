import { Alert } from "react-native";
import { config } from "../../config/env";
import { useAuthStore } from "../../store/authStore";

export const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, "0")}`;
};

export const getPostTypeName = (type: string) => {
  const typeMap: Record<string, string> = {
    OUTFIT: "穿搭",
    DAILY_SHARE: "日常分享",
    ITEM_REVIEW: "单品评价",
    ARTICLES: "文章",
  };
  return typeMap[type] || type;
};

export const getLinkTypeName = (type: string) => {
  const typeMap: Record<string, string> = {
    NONE: "无链接",
    POST: "帖子",
    BRAND: "品牌",
    SHOW: "秀场",
    EXTERNAL: "外部链接",
  };
  return typeMap[type] || type;
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
  throw new Error(data.message || "上传失败");
};

export const pickAndUploadImage = async (
  aspect: [number, number] = [1, 1]
): Promise<string | null> => {
  const ImagePicker = require("expo-image-picker");

  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== "granted") {
    Alert.alert("权限不足", "需要访问相册权限才能上传图片");
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
