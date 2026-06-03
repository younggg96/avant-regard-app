import React, { useEffect, useRef } from "react";
import {
  StyleSheet,
  TouchableOpacity,
  Animated,
  View,
  Text,
  ActivityIndicator,
} from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  useOrderAddressPromptStore,
  OrderAddressPrompt,
} from "../store/orderAddressPromptStore";
import { useAppTheme, useThemedStyles, type AppTheme } from "../theme";
import { createConversation } from "../services/chatService";
import { navigate } from "../utils/deepLinking";
import { OptimizedImage } from "./ui/OptimizedImage";
import { ImageSize } from "../utils/imageUtils";

const AUTO_DISMISS_MS = 8000;

/**
 * OrderAddressPromptBanner —— offer 成交后从顶部滑入的「填写收货地址」提示。
 *
 * 与 UploadProgressBanner 一样挂在导航树外, 因此用 deepLinking 的 navigate()
 * (基于 navigationRef) 而非 useNavigation。点击后进入与卖家的私聊, 并让 Chat
 * 自动弹出收货地址表单。
 */
export default function OrderAddressPromptBanner() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const prompt = useOrderAddressPromptStore((s) => s.prompt);
  const dismissPrompt = useOrderAddressPromptStore((s) => s.dismissPrompt);
  const insets = useSafeAreaInsets();

  const slideAnim = useRef(new Animated.Value(-160)).current;
  const checkScale = useRef(new Animated.Value(0)).current;
  const [busy, setBusy] = React.useState(false);

  const isVisible = prompt != null;

  useEffect(() => {
    if (isVisible) {
      checkScale.setValue(0);
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 80,
          friction: 11,
        }),
        Animated.spring(checkScale, {
          toValue: 1,
          useNativeDriver: true,
          tension: 90,
          friction: 6,
          delay: 120,
        }),
      ]).start();

      const timer = setTimeout(() => dismissPrompt(), AUTO_DISMISS_MS);
      return () => clearTimeout(timer);
    }
    Animated.timing(slideAnim, {
      toValue: -160,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [isVisible]);

  if (!prompt) return null;

  const openChatWithAddressForm = async (p: OrderAddressPrompt) => {
    if (busy) return;
    setBusy(true);
    try {
      let conversationId: number | null = null;
      if (p.sellerUserId) {
        const res = await createConversation(p.sellerUserId);
        conversationId = res.conversationId;
      }
      dismissPrompt();
      if (conversationId != null) {
        navigate("Chat", {
          conversationId,
          otherUserName: p.sellerName ?? undefined,
          otherUserAvatar: p.sellerAvatar ?? undefined,
          otherUserId: p.sellerUserId ?? undefined,
          openShippingForOrderId: p.orderId,
          shippingProductTitle: p.productTitle ?? undefined,
          shippingCoverImage: p.coverImage ?? undefined,
        });
      } else {
        // 没有卖家会话(理论上不会发生), 兜底跳支付页继续流程。
        navigate("Payment", { orderId: p.orderId });
      }
    } catch {
      dismissPrompt();
      navigate("Payment", { orderId: p.orderId });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Animated.View
      style={[
        styles.container,
        { top: insets.top, transform: [{ translateY: slideAnim }] },
      ]}
    >
      <TouchableOpacity
        style={styles.banner}
        onPress={() => openChatWithAddressForm(prompt)}
        activeOpacity={0.9}
        accessibilityRole="button"
      >
        <Animated.View
          style={[styles.iconWrap, { transform: [{ scale: checkScale }] }]}
        >
          <Ionicons name="checkmark" size={20} color={theme.colors.textInverted} />
        </Animated.View>

        {prompt.coverImage ? (
          <OptimizedImage
            uri={prompt.coverImage}
            size={ImageSize.THUMBNAIL}
            style={styles.thumb}
            contentFit="cover"
          />
        ) : null}

        <View style={styles.content}>
          <Text style={styles.title} numberOfLines={1}>
            {t("trading.addressPrompt.bannerTitle")}
          </Text>
          <Text style={styles.hint} numberOfLines={1}>
            {t("trading.addressPrompt.bannerHint")}
          </Text>
        </View>

        {busy ? (
          <ActivityIndicator size="small" color={theme.colors.accent} />
        ) : (
          <Ionicons
            name="chevron-forward"
            size={18}
            color={theme.colors.gray300}
          />
        )}

        <TouchableOpacity
          onPress={dismissPrompt}
          style={styles.closeButton}
          hitSlop={8}
        >
          <Ionicons name="close" size={16} color={theme.colors.gray300} />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: {
      position: "absolute",
      left: 0,
      right: 0,
      zIndex: 9999,
      elevation: 12,
    },
    banner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: t.colors.card,
      marginHorizontal: 12,
      paddingHorizontal: 12,
      paddingVertical: 12,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.16,
      shadowRadius: 12,
      elevation: 8,
    },
    iconWrap: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: t.colors.success,
      alignItems: "center",
      justifyContent: "center",
    },
    thumb: {
      width: 36,
      height: 36,
      borderRadius: 8,
    },
    content: {
      flex: 1,
    },
    title: {
      fontSize: 15,
      lineHeight: 20,
      fontFamily: "PlayfairDisplay-Bold",
      color: t.colors.text,
      marginBottom: 1,
    },
    hint: {
      fontSize: 12,
      lineHeight: 16,
      fontFamily: "PlayfairDisplay-Regular",
      color: t.colors.gray300,
    },
    closeButton: {
      padding: 2,
    },
  });
