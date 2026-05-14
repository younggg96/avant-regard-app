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
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { Text, HStack, VStack } from "./ui";
import { OptimizedImage } from "./ui/OptimizedImage";
import { ImageSize } from "../utils/imageUtils";
import { theme, useAppTheme, useThemedStyles, type AppTheme } from "../theme";
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

// Built per-render via useAppTheme so neutral platform icons (copy / more)
// match the current theme rather than being frozen at module load.
const buildSharePlatforms = (
  t: AppTheme
): (PlatformConfig & { i18nKey: string })[] => [
  {
    id: "wechat",
    name: "",
    i18nKey: "shareTo.wechatFriend",
    icon: "chatbubble-ellipses",
    iconColor: "#fff",
    bgColor: "#07C160",
  },
  {
    id: "wechat_moments",
    name: "",
    i18nKey: "shareTo.moments",
    icon: "aperture",
    iconColor: "#fff",
    bgColor: "#07C160",
  },
  {
    id: "weibo",
    name: "",
    i18nKey: "shareTo.weibo",
    icon: "logo-rss",
    iconColor: "#fff",
    bgColor: "#E6162D",
  },
  {
    id: "copy",
    name: "",
    i18nKey: "shareTo.copyLink",
    icon: "link",
    iconColor: t.colors.gray700,
    bgColor: t.colors.gray100,
  },
  {
    id: "more",
    name: "",
    i18nKey: "shareTo.more",
    icon: "share-outline",
    iconColor: t.colors.gray700,
    bgColor: t.colors.gray100,
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
  const { t } = useTranslation();
  const [slideAnim] = useState(new Animated.Value(SCREEN_HEIGHT));
  const [fadeAnim] = useState(new Animated.Value(0));
  const [isSharing, setIsSharing] = useState(false);
  const [sharingPlatform, setSharingPlatform] = useState<SharePlatform | null>(null);
  const appTheme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const sharePlatforms = buildSharePlatforms(appTheme);

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
          style={{ color: theme.colors.black }}
          textAlign="center"
          mb="$md"
        >
          {t("shareTo.title")}
        </Text>

        {/* 分享内容预览卡片 */}
        <View style={styles.previewCard}>
          <HStack space="md" alignItems="center">
            {/* 预览图片 */}
            {shareContent.imageUrl && (
              <OptimizedImage
                uri={shareContent.imageUrl}
                size={ImageSize.THUMBNAIL}
                style={styles.previewImage}
                contentFit="cover"
                lazy={true}
              />
            )}
            {/* 预览文字 */}
            <VStack flex={1} space="xs">
              <Text
                fontSize="$sm"
                fontWeight="$semibold"
                style={{ color: theme.colors.black }}
                numberOfLines={2}
              >
                {shareContent.title}
              </Text>
              <Text
                fontSize="$xs"
                style={{ color: theme.colors.gray500 }}
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
            {sharePlatforms.map((platform) => (
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
                  style={{ color: theme.colors.gray600 }}
                  mt="$xs"
                  textAlign="center"
                >
                  {t(platform.i18nKey)}
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
          <Text fontSize="$md" fontWeight="$medium" style={{ color: theme.colors.gray600 }}>
            {t("common.cancel")}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: t.colors.overlay,
    },
    container: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: t.colors.background,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: t.spacing.lg,
      paddingBottom: 34, // Safe area for iPhone
    },
    handleContainer: {
      alignItems: "center",
      paddingVertical: t.spacing.sm,
    },
    handle: {
      width: 40,
      height: 4,
      backgroundColor: t.colors.gray300,
      borderRadius: 2,
    },
    previewCard: {
      backgroundColor: t.colors.gray50,
      borderRadius: t.borderRadius.lg,
      padding: t.spacing.md,
      marginBottom: t.spacing.lg,
      borderWidth: 1,
      borderColor: t.colors.gray100,
    },
    previewImage: {
      width: 60,
      height: 60,
      borderRadius: t.borderRadius.md,
      backgroundColor: t.colors.gray200,
    },
    platformsContainer: {
      paddingVertical: t.spacing.md,
    },
    platformItem: {
      width: "20%",
      alignItems: "center",
      marginBottom: t.spacing.lg,
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
      paddingVertical: t.spacing.md,
      alignItems: "center",
      borderTopWidth: 1,
      borderTopColor: t.colors.gray100,
      marginTop: t.spacing.sm,
    },
  });

export default ShareModal;
