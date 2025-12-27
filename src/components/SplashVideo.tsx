import React, { useRef, useState, useEffect } from "react";
import { StyleSheet, Dimensions, Animated } from "react-native";
import { Video, ResizeMode, AVPlaybackStatus } from "expo-av";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// 存储key，用于判断是否是首次打开app
const HAS_OPENED_APP_KEY = "has_opened_app_before";

interface SplashVideoProps {
  onFinish: () => void;
}

export default function SplashVideo({ onFinish }: SplashVideoProps) {
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const [hasFinished, setHasFinished] = useState(false);
  const [isFirstOpen, setIsFirstOpen] = useState<boolean | null>(null);

  useEffect(() => {
    checkFirstOpen();
  }, []);

  const checkFirstOpen = async () => {
    try {
      const hasOpened = await AsyncStorage.getItem(HAS_OPENED_APP_KEY);
      if (hasOpened === null) {
        // 第一次打开app
        setIsFirstOpen(true);
        // 设置标记，表示已经打开过app
        await AsyncStorage.setItem(HAS_OPENED_APP_KEY, "true");
      } else {
        // 不是第一次打开
        setIsFirstOpen(false);
      }
    } catch (error) {
      console.error("Error checking first open:", error);
      // 出错时默认使用短视频
      setIsFirstOpen(false);
    }
  };

  const handlePlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded && status.didJustFinish && !hasFinished) {
      setHasFinished(true);
      // 视频播放完成，执行淡出动画
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        onFinish();
      });
    }
  };

  const handleError = (error: string) => {
    console.error("Video playback error:", error);
    // 如果视频加载失败，直接进入应用
    onFinish();
  };

  // 等待检查完成
  if (isFirstOpen === null) {
    return <Animated.View style={[styles.container, { opacity: fadeAnim }]} />;
  }

  // 根据是否首次打开选择视频
  const videoSource = isFirstOpen
    ? require("../../assets/video/start_new.mp4")
    : require("../../assets/video/start-short.mp4");

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <Video
        source={videoSource}
        style={styles.video}
        resizeMode={ResizeMode.COVER}
        shouldPlay={true}
        isLooping={false}
        isMuted={false}
        onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
        onError={handleError}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#000000",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },
  video: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
});
