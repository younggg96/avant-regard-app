import React, { useRef, useState } from "react";
import {
  StyleSheet,
  Dimensions,
  Animated,
} from "react-native";
import { Video, ResizeMode, AVPlaybackStatus } from "expo-av";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

interface SplashVideoProps {
  onFinish: () => void;
}

export default function SplashVideo({ onFinish }: SplashVideoProps) {
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const [hasFinished, setHasFinished] = useState(false);

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

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <Video
        source={require("../../assets/video/starter.mp4")}
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

