import React, { useRef, useState, useEffect } from "react";
import { StyleSheet, Dimensions, Animated } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import type { VideoPlayerStatus } from "expo-video";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const HAS_OPENED_APP_KEY = "has_opened_app_before";

const startNew = require("../../assets/video/start_new.mp4");
const startShort = require("../../assets/video/start-short.mp4");

interface SplashVideoProps {
  onFinish: () => void;
}

export default function SplashVideo({ onFinish }: SplashVideoProps) {
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const overlayFadeAnim = useRef(new Animated.Value(1)).current;
  const [hasFinished, setHasFinished] = useState(false);
  const [isFirstOpen, setIsFirstOpen] = useState<boolean | null>(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  useEffect(() => {
    checkFirstOpen();
  }, []);

  const checkFirstOpen = async () => {
    try {
      const hasOpened = await AsyncStorage.getItem(HAS_OPENED_APP_KEY);
      if (hasOpened === null) {
        setIsFirstOpen(true);
        await AsyncStorage.setItem(HAS_OPENED_APP_KEY, "true");
      } else {
        setIsFirstOpen(false);
      }
    } catch (error) {
      console.error("Error checking first open:", error);
      setIsFirstOpen(false);
    }
  };

  const videoSource = isFirstOpen ? startNew : startShort;

  const player = useVideoPlayer(isFirstOpen !== null ? videoSource : null, (p) => {
    p.loop = false;
    p.muted = false;
  });

  useEffect(() => {
    if (!player || isFirstOpen === null) return;

    const playingSub = player.addListener(
      "playingChange",
      (newIsPlaying: boolean) => {
        if (newIsPlaying && !isVideoPlaying) {
          setIsVideoPlaying(true);
          Animated.timing(overlayFadeAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }).start();
        }
      }
    );

    const endSub = player.addListener("playToEnd", () => {
      if (!hasFinished) {
        setHasFinished(true);
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          onFinish();
        });
      }
    });

    const statusSub = player.addListener(
      "statusChange",
      (newStatus: VideoPlayerStatus, _oldStatus: VideoPlayerStatus, error?: { message: string }) => {
        if (newStatus === "error") {
          console.error("Video playback error:", error?.message);
          onFinish();
        }
        if (newStatus === "readyToPlay") {
          player.play();
        }
      }
    );

    return () => {
      playingSub.remove();
      endSub.remove();
      statusSub.remove();
    };
  }, [player, isFirstOpen]);

  if (isFirstOpen === null) {
    return <Animated.View style={[styles.container, { opacity: fadeAnim }]} />;
  }

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <VideoView
        player={player}
        style={styles.video}
        contentFit="cover"
        nativeControls={false}
      />
      {/* 黑色遮罩，覆盖在视频上方，防止加载时显示黄色帧 */}
      <Animated.View
        style={[styles.overlay, { opacity: overlayFadeAnim }]}
        pointerEvents="none"
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
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#000000",
  },
});
