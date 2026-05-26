import React, { useRef, useState, useEffect } from "react";
import { StyleSheet, Dimensions, Animated } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import type { VideoPlayerStatus } from "expo-video";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const HAS_OPENED_APP_KEY = "has_opened_app_before";

// Hard ceiling for how long the splash overlay is allowed to sit on top of
// the app. Even when the video itself is longer, we fade out at this point
// so the VideoToolbox decoder + compositor releases GPU budget back to the
// feed's first-paint pipeline (expo-image is decoding 26+ covers + avatars
// at the same time, and iOS ImageIO / VideoToolbox share the same high-
// priority media thread pool). 2500ms is long enough that the short splash
// variant plays fully and the first frame of the long variant is visible
// beyond the intro glyph, but short enough that the splash never contends
// with Discover's most sensitive cold-start window.
const MAX_SPLASH_DURATION_MS = 2500;

const startNew = require("../../assets/video/start_new.mp4");
const startShort = require("../../assets/video/start-short.mp4");

interface SplashVideoProps {
  onFinish: () => void;
}

export default function SplashVideo({ onFinish }: SplashVideoProps) {
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const overlayFadeAnim = useRef(new Animated.Value(1)).current;
  const [isFirstOpen, setIsFirstOpen] = useState<boolean | null>(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  // Race-free guard for the finish path. With the hard-limit timeout added
  // alongside `playToEnd` and the error handler, two (or three) exits can
  // race. A queued `setState` is too late — the second caller would still
  // read `false` from closure. A ref written synchronously inside
  // `finishWithFade` closes that window. We deliberately keep this as a
  // ref (not a state) because nothing in the render tree needs to react
  // to "has finished" — the fade-out is driven by `fadeAnim` instead.
  const hasFinishedRef = useRef(false);

  useEffect(() => {
    console.log("[SplashVideo] mounted");
    checkFirstOpen();
  }, []);

  // 无条件兜底:player / isFirstOpen 在最差情况下可能都不就绪
  // (AsyncStorage 卡住, expo-video native player 初始化失败等),
  // 此时 player-driven 的 hard limit 永远不会 setup, splash 会永远盖在
  // 最上层。这里独立跑一个 timer, 与 player 状态完全解耦, 保证 UI 绝不
  // 卡死;时长比 MAX_SPLASH_DURATION_MS 长一点, 让正常路径优先。
  useEffect(() => {
    const fallbackTimer = setTimeout(() => {
      if (hasFinishedRef.current) return;
      console.warn("[SplashVideo] fallback timer fired (player may be stuck)");
      hasFinishedRef.current = true;
      onFinish();
    }, MAX_SPLASH_DURATION_MS + 2000);
    return () => clearTimeout(fallbackTimer);
  }, [onFinish]);

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

    // Single exit path so hard-limit timeout, `playToEnd`, and error
    // all funnel through the same fade → unmount sequence. The ref guard
    // makes this safe against the two triggers firing in the same tick.
    const finishWithFade = () => {
      if (hasFinishedRef.current) return;
      hasFinishedRef.current = true;
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        onFinish();
      });
    };

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

    const endSub = player.addListener("playToEnd", finishWithFade);

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

    // Hard ceiling: if the video is longer than MAX_SPLASH_DURATION_MS,
    // force the fade-out anyway so the app can release the video decoder
    // and let the feed's first paint breathe. See the constant's comment
    // for the cold-start rationale.
    const hardLimitTimer = setTimeout(finishWithFade, MAX_SPLASH_DURATION_MS);

    return () => {
      playingSub.remove();
      endSub.remove();
      statusSub.remove();
      clearTimeout(hardLimitTimer);
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
