import React, { useState, useEffect, useCallback } from "react";
import { Animated, StyleSheet, Dimensions, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { toastEmitter, ToastConfig } from "../utils/Alert";
import { theme } from "../theme";

const { width } = Dimensions.get("window");

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [visible, setVisible] = useState(false);
  const [config, setConfig] = useState<ToastConfig | null>(null);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const translateY = React.useRef(new Animated.Value(50)).current;

  const hideToast = useCallback(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 50,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setVisible(false);
      setConfig(null);
    });
  }, [fadeAnim, translateY]);

  const showToast = useCallback(
    (toastConfig: ToastConfig) => {
      setConfig(toastConfig);
      setVisible(true);

      // Reset animation values
      fadeAnim.setValue(0);
      translateY.setValue(50);

      // Animate in
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto hide after duration
      const duration = toastConfig.duration || 1000;
      setTimeout(() => {
        hideToast();
      }, duration);
    },
    [fadeAnim, translateY, hideToast]
  );

  useEffect(() => {
    const listener = (toastConfig: ToastConfig) => {
      showToast(toastConfig);
    };

    toastEmitter.on("show", listener);

    return () => {
      toastEmitter.off("show", listener);
    };
  }, [showToast]);

  if (!visible || !config) {
    return <>{children}</>;
  }

  const displayText = config.message
    ? `${config.title}: ${config.message}`
    : config.title;

  // 判断是否为成功消息
  const isSuccess = displayText.includes("成功") || displayText.includes("已");
  const isError = displayText.includes("失败") || displayText.includes("错误");

  return (
    <>
      {children}
      <Animated.View
        style={[
          styles.toast,
          isSuccess && styles.successToast,
          isError && styles.errorToast,
          {
            opacity: fadeAnim,
            transform: [{ translateY }],
          },
        ]}
      >
        <View style={styles.toastContent}>
          {isSuccess && (
            <Ionicons
              name="checkmark-circle"
              size={20}
              color="#ffffff"
              style={styles.toastIcon}
            />
          )}
          {isError && (
            <Ionicons
              name="close-circle"
              size={20}
              color="#ffffff"
              style={styles.toastIcon}
            />
          )}
          <Animated.Text style={styles.toastText}>{displayText}</Animated.Text>
        </View>
      </Animated.View>
    </>
  );
};

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    bottom: 100,
    left: 16,
    right: 16,
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 9999,
    alignSelf: "center",
    maxWidth: width - 32,
  },
  successToast: {
    backgroundColor: "rgba(34, 197, 94, 0.95)", // 绿色背景
  },
  errorToast: {
    backgroundColor: "rgba(239, 68, 68, 0.95)", // 红色背景
  },
  toastContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  toastIcon: {
    marginRight: 8,
  },
  toastText: {
    color: "#ffffff",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 20,
    fontWeight: "500",
  },
});

