import React, { useState, useEffect, useCallback } from "react";
import { Animated, StyleSheet, Dimensions } from "react-native";
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

  return (
    <>
      {children}
      <Animated.View
        style={[
          styles.toast,
          {
            opacity: fadeAnim,
            transform: [{ translateY }],
          },
        ]}
      >
        <Animated.Text style={styles.toastText}>{displayText}</Animated.Text>
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
  toastText: {
    color: "#ffffff",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 20,
  },
});

