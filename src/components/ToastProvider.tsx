import React, { useState, useEffect, useCallback } from "react";
import { Animated, StyleSheet, Dimensions, View } from "react-native";
import { Image } from "expo-image";
import { toastEmitter, ToastConfig } from "../utils/Alert";
import { theme } from "../theme";

const { width } = Dimensions.get("window");

const ACTION_GIFS: { pattern: RegExp; source: any }[] = [
  { pattern: /取消关注/, source: require("../../assets/action-gif/取消关注.gif") },
  { pattern: /取消收藏/, source: require("../../assets/action-gif/取消收藏.gif") },
  { pattern: /取消点赞/, source: require("../../assets/action-gif/取消点赞.gif") },
  { pattern: /关注成功/, source: require("../../assets/action-gif/关注成功.gif") },
  { pattern: /评论已发布|回复已发布|评论成功/, source: require("../../assets/action-gif/评论成功.gif") },
  { pattern: /已屏蔽|屏蔽/, source: require("../../assets/action-gif/屏蔽.gif") },
  { pattern: /删除/, source: require("../../assets/action-gif/删除.gif") },
  { pattern: /上传.*成功/, source: require("../../assets/action-gif/上传秀场成功.gif") },
  { pattern: /提交.*买手店|买手店.*提交/, source: require("../../assets/action-gif/提交买手店.gif") },
  { pattern: /收藏/, source: require("../../assets/action-gif/收藏.gif") },
  { pattern: /点赞/, source: require("../../assets/action-gif/点赞.gif") },
  { pattern: /登.*成功|注册成功/, source: require("../../assets/action-gif/登陆成功.gif") },
];

function getActionGif(text: string) {
  for (const entry of ACTION_GIFS) {
    if (entry.pattern.test(text)) return entry.source;
  }
  return null;
}

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

  const gifSource = getActionGif(displayText);

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
          {gifSource && (
            <Image
              source={gifSource}
              style={styles.toastGif}
              contentFit="contain"
              autoplay={true}
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
    backgroundColor: theme.colors.black,
  },
  errorToast: {
    backgroundColor: theme.colors.error,
  },
  toastContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  toastGif: {
    width: 28,
    height: 28,
    marginRight: 10,
  },
  toastText: {
    color: "#ffffff",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 20,
    fontWeight: "500",
  },
});

