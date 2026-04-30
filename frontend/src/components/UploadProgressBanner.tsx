import React, { useEffect, useRef } from "react";
import {
  StyleSheet,
  TouchableOpacity,
  Animated,
  View,
  Text,
} from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUploadStore, UploadStatus } from "../store/uploadStore";
import { theme } from "../theme";
import { isVideoUrl } from "../services/postService";
import { VideoThumbnailView } from "./VideoThumbnailView";
import { OptimizedImage } from "./ui/OptimizedImage";
import { ImageSize } from "../utils/imageUtils";

const STATUS_CONFIG_KEYS: Record<UploadStatus, { labelKey: string; hintKey: string; color: string }> = {
  idle: { labelKey: "", hintKey: "", color: "transparent" },
  uploading: { labelKey: "upload.uploading", hintKey: "upload.uploadingHint", color: theme.colors.black },
  publishing: { labelKey: "upload.publishing", hintKey: "upload.publishingHint", color: theme.colors.black },
  success: { labelKey: "upload.success", hintKey: "upload.successHint", color: theme.colors.success },
  error: { labelKey: "upload.error", hintKey: "upload.errorHint", color: theme.colors.error },
};

export default function UploadProgressBanner() {
  const { t } = useTranslation();
  const task = useUploadStore((s) => s.currentTask);
  const dismissTask = useUploadStore((s) => s.dismissTask);
  const retryUpload = useUploadStore((s) => s.retryUpload);
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  const isVisible = task != null;

  useEffect(() => {
    if (isVisible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 12,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [isVisible]);

  useEffect(() => {
    if (task) {
      Animated.timing(progressAnim, {
        toValue: task.progress / 100,
        duration: 300,
        useNativeDriver: false,
      }).start();
    } else {
      progressAnim.setValue(0);
    }
  }, [task?.progress]);

  if (!task) return null;

  const configKeys = STATUS_CONFIG_KEYS[task.status];
  const config = {
    label: configKeys.labelKey ? t(configKeys.labelKey) : "",
    hint: configKeys.hintKey ? t(configKeys.hintKey) : "",
    color: configKeys.color,
  };

  const handlePress = () => {
    if (task.status === "error") {
      retryUpload();
    } else if (task.status === "success") {
      dismissTask();
    }
  };

  const handleDismiss = () => {
    if (task.status === "success" || task.status === "error") {
      dismissTask();
    }
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  const isVideo = task.thumbnailUri ? isVideoUrl(task.thumbnailUri) : false;

  return (
    <Animated.View
      style={[
        styles.container,
        { top: insets.top, transform: [{ translateY: slideAnim }] },
      ]}
    >
      <TouchableOpacity
        style={styles.banner}
        onPress={handlePress}
        activeOpacity={0.85}
      >
        <View style={styles.bannerContent}>
          <View style={styles.thumbnailContainer}>
            {task.thumbnailUri ? (
              isVideo ? (
                <VideoThumbnailView
                  uri={task.thumbnailUri}
                  style={styles.thumbnail}
                />
              ) : (
                <OptimizedImage
                  uri={task.thumbnailUri}
                  size={ImageSize.THUMBNAIL}
                  style={styles.thumbnail}
                  contentFit="cover"
                />
              )
            ) : (
              <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
                <Ionicons name="document-text-outline" size={20} color={theme.colors.gray200} />
              </View>
            )}
            {(task.status === "uploading" || task.status === "publishing") && (
              <View style={styles.progressOverlay}>
                <Text style={styles.progressText}>{task.progress}%</Text>
              </View>
            )}
          </View>

          <View style={styles.contentContainer}>
            <Text style={styles.title} numberOfLines={1}>
              {config.label}
            </Text>
            <Text style={styles.hint} numberOfLines={1}>
              {task.status === "error" ? task.errorMessage || config.hint : config.hint}
            </Text>
          </View>

          {(task.status === "success" || task.status === "error") && (
            <TouchableOpacity onPress={handleDismiss} style={styles.closeButton}>
              <Ionicons name="close" size={18} color={theme.colors.gray300} />
            </TouchableOpacity>
          )}

          {task.status === "error" && (
            <TouchableOpacity onPress={retryUpload} style={styles.retryButton}>
              <Ionicons name="refresh" size={18} color={theme.colors.error} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.progressBarContainer}>
          <Animated.View
            style={[
              styles.progressBar,
              {
                width: progressWidth,
                backgroundColor:
                  task.status === "error"
                    ? theme.colors.error
                    : task.status === "success"
                      ? theme.colors.success
                      : "#FF2D55",
              },
            ]}
          />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 9999,
    elevation: 10,
  },
  banner: {
    backgroundColor: theme.colors.white,
    marginHorizontal: 12,
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
  },
  bannerContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  thumbnailContainer: {
    position: "relative",
    width: 48,
    height: 48,
    borderRadius: 8,
    overflow: "hidden",
    marginRight: 12,
  },
  thumbnail: {
    width: 48,
    height: 48,
  },
  thumbnailPlaceholder: {
    backgroundColor: theme.colors.gray100,
    justifyContent: "center",
    alignItems: "center",
  },
  progressOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
  },
  progressText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  contentContainer: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    color: theme.colors.black,
    marginBottom: 2,
  },
  hint: {
    fontSize: 12,
    color: theme.colors.gray300,
  },
  closeButton: {
    padding: 6,
    marginLeft: 4,
  },
  retryButton: {
    padding: 6,
    marginLeft: 2,
  },
  progressBarContainer: {
    height: 3,
    backgroundColor: theme.colors.gray100,
  },
  progressBar: {
    height: "100%",
  },
});
