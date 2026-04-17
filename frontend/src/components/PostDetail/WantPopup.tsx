import React, { useEffect, useRef } from "react";
import {
  View,
  Animated,
  TouchableOpacity,
  Image,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text, HStack } from "../ui";
import { theme } from "../../theme";

interface WantPopupProps {
  visible: boolean;
  isWanted: boolean;
  productImage?: string;
  productName?: string;
  brandName?: string;
  onWant: () => void;
  onDismiss: () => void;
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
}) => {
  const translateY = useRef(new Animated.Value(120)).current;
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
      translateY.setValue(120);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [visible]);

  const handleDismiss = () => {
    Animated.timing(translateY, {
      toValue: 120,
      duration: 250,
      useNativeDriver: true,
    }).start(() => onDismiss());
  };

  const handleWantPress = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    onWant();
    setTimeout(handleDismiss, 600);
  };

  if (!visible) return null;

  const label = isWanted ? "已想要" : "我想要";
  const iconName = isWanted ? "bag-check" : "bag-handle-outline";
  const accentColor = isWanted ? "#D4AF37" : theme.colors.black;

  return (
    <Animated.View
      style={[popupStyles.container, { transform: [{ translateY }] }]}
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
                color="$gray300"
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
                {productName}
              </Text>
            )}
            {!brandName && !productName && (
              <Text fontSize="$sm" fontWeight="$medium">
                想要这件单品？
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
          <Ionicons name={iconName as any} size={18} color={accentColor} />
          <Text
            fontSize="$sm"
            fontWeight="$semibold"
            style={{ color: accentColor, marginLeft: 4 }}
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

const popupStyles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 80,
    left: 12,
    right: 12,
    zIndex: 20,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingVertical: 10,
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
    backgroundColor: theme.colors.gray100,
  },
  wantButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
  },
  wantButtonActive: {
    borderColor: "#D4AF37",
    backgroundColor: "rgba(212, 175, 55, 0.08)",
  },
  closeButton: {
    padding: 4,
  },
});
