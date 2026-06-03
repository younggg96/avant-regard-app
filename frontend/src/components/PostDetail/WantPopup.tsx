import React, { useEffect, useRef } from "react";
import {
  View,
  Animated,
  TouchableOpacity,
  Image,
  StyleSheet,
} from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { Text, HStack } from "../ui";
import { theme, useThemedStyles, type AppTheme, useAppTheme } from "../../theme";

interface WantPopupProps {
  visible: boolean;
  isWanted: boolean;
  productImage?: string;
  productName?: string;
  brandName?: string;
  onWant: () => void;
  onDismiss: () => void;
  /**
   * 弹窗位置：
   *   - "bottom"（默认）：从底部向上弹出，悬浮在底部栏之上。
   *   - "top"：从顶部向下弹出，悬浮在页面上方（避免遮挡底部交易按钮）。
   */
  placement?: "top" | "bottom";
  /**
   * 弹窗距底部的偏移量（px），仅在 placement="bottom" 时生效。默认 80。
   */
  bottomOffset?: number;
  /**
   * 弹窗距顶部的偏移量（px），仅在 placement="top" 时生效。默认 12，
   * 通常传入 安全区 + 导航头部高度，使其落在标题栏下方。
   */
  topOffset?: number;
}

const AUTO_DISMISS_MS = 30000;

export const WantPopup: React.FC<WantPopupProps> = ({
  visible,
  isWanted,
  productImage,
  productName,
  brandName,
  onWant,
  onDismiss,
  placement = "bottom",
  bottomOffset = 80,
  topOffset = 12,
}) => {
  const theme = useAppTheme();
  const popupStyles = useThemedStyles(makePopupStyles);
  // 隐藏态的偏移：底部弹窗藏在下方(+)，顶部弹窗藏在上方(-)。
  const hiddenY = placement === "top" ? -120 : 120;
  const translateY = useRef(new Animated.Value(hiddenY)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();

      timerRef.current = setTimeout(() => {
        handleDismiss();
      }, AUTO_DISMISS_MS);
    } else {
      translateY.setValue(hiddenY);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [visible]);

  const handleDismiss = () => {
    Animated.timing(translateY, {
      toValue: hiddenY,
      duration: 250,
      useNativeDriver: true,
    }).start(() => onDismiss());
  };

  const handleWantPress = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    onWant();
    setTimeout(handleDismiss, 600);
  };

  const { t } = useTranslation();

  if (!visible) return null;

  const label = isWanted ? t("postDetail.wanted") : t("postDetail.want");
  const iconName = isWanted ? "bag-check" : "bag-handle-outline";
  const accentColor = isWanted ? "#D4AF37" : theme.colors.black;

  return (
    <Animated.View
      style={[
        popupStyles.container,
        placement === "top"
          ? { top: topOffset }
          : { bottom: bottomOffset },
        { transform: [{ translateY }] },
      ]}
    >
      <View style={popupStyles.content}>
        <HStack alignItems="center" gap="$sm" style={{ flex: 1 }}>
          {productImage && (
            <Image
              source={{ uri: productImage }}
              style={popupStyles.thumbnail}
            />
          )}
          <View style={{ flex: 1 }}>
            {brandName && (
              <Text
                fontSize="$xs"
                style={{ color: theme.colors.gray300 }}
                numberOfLines={1}
              >
                {brandName}
              </Text>
            )}
            {productName && (
              <Text
                fontSize="$sm"
                fontWeight="$medium"
                numberOfLines={1}
              >
                {/* productName 可能含 \n (多单品), 单行展示时折叠成 · */}
                {productName.split("\n").map((s) => s.trim()).filter(Boolean).join(" · ")}
              </Text>
            )}
            {!brandName && !productName && (
              <Text fontSize="$sm" fontWeight="$medium">
                {t("postDetail.wantThisItem")}
              </Text>
            )}
          </View>
        </HStack>

        <TouchableOpacity
          style={[
            popupStyles.wantButton,
            isWanted && popupStyles.wantButtonActive,
          ]}
          onPress={handleWantPress}
          activeOpacity={0.7}
        >
          <Ionicons name={iconName as any} size={16} color={accentColor} />
          <Text
            fontSize="$xs"
            fontWeight="$semibold"
            style={{ color: accentColor, marginLeft: 2 }}
          >
            {label}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleDismiss}
          style={popupStyles.closeButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close" size={16} color={theme.colors.gray300} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const makePopupStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: {
      position: "absolute",
      left: 12,
      right: 12,
      zIndex: 20,
    },
    content: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: t.colors.card,
      borderRadius: 14,
      paddingVertical: 8,
      paddingHorizontal: 14,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 8,
      gap: 10,
    },
    thumbnail: {
      width: 40,
      height: 40,
      borderRadius: 8,
      backgroundColor: t.colors.gray100,
    },
    wantButton: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: t.colors.gray200,
    },
    wantButtonActive: {
      borderColor: "#D4AF37",
      backgroundColor: "rgba(212, 175, 55, 0.08)",
    },
    closeButton: {
      padding: 4,
    },
  });
