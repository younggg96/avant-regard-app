/**
 * 分享弹窗组件
 * 提供分享到微信、微博等平台的选项
 */

import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text, HStack, VStack, Image } from "./ui";
import { theme } from "../theme";
import { Post } from "./PostCard";
import {
  SharePlatform,
  shareToplatform,
  buildShareContent,
} from "../services/shareService";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

// 分享平台配置
interface PlatformConfig {
  id: SharePlatform;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  bgColor: string;
}

const SHARE_PLATFORMS: PlatformConfig[] = [
  {
    id: "wechat",
    name: "微信好友",
    icon: "chatbubble-ellipses",
    iconColor: "#fff",
    bgColor: "#07C160",
  },
  {
    id: "wechat_moments",
    name: "朋友圈",
    icon: "aperture",
    iconColor: "#fff",
    bgColor: "#07C160",
  },
  {
    id: "weibo",
    name: "微博",
    icon: "logo-rss",
    iconColor: "#fff",
    bgColor: "#E6162D",
  },
  {
    id: "copy",
    name: "复制链接",
    icon: "link",
    iconColor: theme.colors.gray700,
    bgColor: theme.colors.gray100,
  },
  {
    id: "more",
    name: "更多",
    icon: "ellipsis-horizontal",
    iconColor: theme.colors.gray700,
    bgColor: theme.colors.gray100,
  },
];

interface ShareModalProps {
  visible: boolean;
  post: Post | null;
  onClose: () => void;
  onShareComplete?: (platform: SharePlatform, success: boolean) => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  visible,
  post,
  onClose,
  onShareComplete,
}) => {
  const [slideAnim] = useState(new Animated.Value(SCREEN_HEIGHT));
  const [fadeAnim] = useState(new Animated.Value(0));
  const [isSharing, setIsSharing] = useState(false);
  const [sharingPlatform, setSharingPlatform] = useState<SharePlatform | null>(null);

  useEffect(() => {
    if (visible) {
      // 显示动画
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // 隐藏动画
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, slideAnim, fadeAnim]);

  const handleShare = async (platform: SharePlatform) => {
    if (!post || isSharing) return;

    setIsSharing(true);
    setSharingPlatform(platform);

    try {
      const success = await shareToplatform(platform, post);
      onShareComplete?.(platform, success);

      // 分享成功后关闭弹窗
      if (success && platform !== "copy") {
        setTimeout(() => {
          onClose();
        }, 300);
      }
    } catch (error) {
      console.error("分享失败:", error);
      onShareComplete?.(platform, false);
    } finally {
      setIsSharing(false);
      setSharingPlatform(null);
    }
  };

  const handleBackdropPress = () => {
    if (!isSharing) {
      onClose();
    }
  };

  if (!post) return null;

  const shareContent = buildShareContent(post);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleBackdropPress}
      statusBarTranslucent
    >
      {/* 背景遮罩 */}
      <TouchableWithoutFeedback onPress={handleBackdropPress}>
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]} />
      </TouchableWithoutFeedback>

      {/* 分享面板 */}
      <Animated.View
        style={[
          styles.container,
          { transform: [{ translateY: slideAnim }] },
        ]}
      >
        {/* 顶部拖动条 */}
        <View style={styles.handleContainer}>
          <View style={styles.handle} />
        </View>

        {/* 标题 */}
        <Text
          fontSize="$lg"
          fontWeight="$bold"
          color="$black"
          textAlign="center"
          mb="$md"
        >
          分享到
        </Text>

        {/* 分享内容预览卡片 */}
        <View style={styles.previewCard}>
          <HStack space="md" alignItems="center">
            {/* 预览图片 */}
            {shareContent.imageUrl && (
              <Image
                source={{ uri: shareContent.imageUrl }}
                style={styles.previewImage}
              />
            )}
            {/* 预览文字 */}
            <VStack flex={1} space="xs">
              <Text
                fontSize="$sm"
                fontWeight="$semibold"
                color="$black"
                numberOfLines={2}
              >
                {shareContent.title}
              </Text>
              <Text
                fontSize="$xs"
                color="$gray500"
                numberOfLines={2}
              >
                {shareContent.description}
              </Text>
            </VStack>
          </HStack>
        </View>

        {/* 分享平台列表 */}
        <View style={styles.platformsContainer}>
          <HStack flexWrap="wrap" justifyContent="flex-start">
            {SHARE_PLATFORMS.map((platform) => (
              <TouchableOpacity
                key={platform.id}
                style={styles.platformItem}
                onPress={() => handleShare(platform.id)}
                disabled={isSharing}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.platformIcon,
                    { backgroundColor: platform.bgColor },
                    isSharing && sharingPlatform !== platform.id && styles.platformIconDisabled,
                  ]}
                >
                  {isSharing && sharingPlatform === platform.id ? (
                    <ActivityIndicator size="small" color={platform.iconColor} />
                  ) : (
                    <Ionicons
                      name={platform.icon}
                      size={26}
                      color={platform.iconColor}
                    />
                  )}
                </View>
                <Text
                  fontSize="$xs"
                  color="$gray600"
                  mt="$xs"
                  textAlign="center"
                >
                  {platform.name}
                </Text>
              </TouchableOpacity>
            ))}
          </HStack>
        </View>

        {/* 取消按钮 */}
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={handleBackdropPress}
          disabled={isSharing}
          activeOpacity={0.7}
        >
          <Text fontSize="$md" fontWeight="$medium" color="$gray600">
            取消
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: 34, // Safe area for iPhone
  },
  handleContainer: {
    alignItems: "center",
    paddingVertical: theme.spacing.sm,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: theme.colors.gray300,
    borderRadius: 2,
  },
  previewCard: {
    backgroundColor: theme.colors.gray50,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.gray100,
  },
  previewImage: {
    width: 60,
    height: 60,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.gray200,
  },
  platformsContainer: {
    paddingVertical: theme.spacing.md,
  },
  platformItem: {
    width: "20%",
    alignItems: "center",
    marginBottom: theme.spacing.lg,
  },
  platformIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  platformIconDisabled: {
    opacity: 0.4,
  },
  cancelButton: {
    paddingVertical: theme.spacing.md,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray100,
    marginTop: theme.spacing.sm,
  },
});

export default ShareModal;
