import React, { useRef, useState, useEffect } from "react";
import { StyleSheet, Dimensions, Animated } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import type { VideoPlayerStatus } from "expo-video";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const HAS_OPENED_APP_KEY = "has_opened_app_before";

// Hard ceiling for how long the splash overlay is allowed to sit on top of
// the app after playback starts. Even when the video itself is longer, we
// fade out at this point so the VideoToolbox decoder + compositor releases
// GPU budget back to the feed's first-paint pipeline (expo-image is decoding
// 26+ covers + avatars at the same time, and iOS ImageIO / VideoToolbox share
// the same high-priority media thread pool). 2500ms is long enough that the
// short splash variant plays fully and the first frame of the long variant
// is visible beyond the intro glyph, but short enough that the splash never
// contends with Discover's most sensitive cold-start window.
const MAX_SPLASH_DURATION_MS = 2500;

// Absolute ceiling from effect mount: if the player never becomes ready
// (missed event, decode failure, etc.) we must still leave the black overlay
// rather than sitting on a blank screen forever.
const MAX_READY_WAIT_MS = 4000;

const startNew = require("../../assets/video/start_new.mp4");
const startShort = require("../../assets/video/start-short.mp4");

interface SplashVideoProps {
  onFinish: () => void;
}

export default function SplashVideo({ onFinish }: SplashVideoProps) {
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const overlayFadeAnim = useRef(new Animated.Value(1)).current;
  const [isFirstOpen, setIsFirstOpen] = useState<boolean | null>(null);
  // Race-free guard for the finish path. With the hard-limit timeout added
  // alongside `playToEnd` and the error handler, two (or three) exits can
  // race. A queued `setState` is too late — the second caller would still
  // read `false` from closure. A ref written synchronously inside
  // `finishWithFade` closes that window. We deliberately keep this as a
  // ref (not a state) because nothing in the render tree needs to react
  // to "has finished" — the fade-out is driven by `fadeAnim` instead.
  const hasFinishedRef = useRef(false);
  const hasRevealedRef = useRef(false);

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

    let playLimitTimer: ReturnType<typeof setTimeout> | null = null;
    let readyWaitTimer: ReturnType<typeof setTimeout> | null = null;

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

    const revealVideo = () => {
      if (hasRevealedRef.current || hasFinishedRef.current) return;
      hasRevealedRef.current = true;
      if (readyWaitTimer) {
        clearTimeout(readyWaitTimer);
        readyWaitTimer = null;
      }
      Animated.timing(overlayFadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
      // Start the playback-duration ceiling only once the video is visible,
      // so load delay doesn't eat into the animation budget.
      if (!playLimitTimer) {
        playLimitTimer = setTimeout(finishWithFade, MAX_SPLASH_DURATION_MS);
      }
    };

    const tryPlay = () => {
      if (hasFinishedRef.current) return;
      try {
        player.play();
      } catch (error) {
        console.error("Video play() failed:", error);
        finishWithFade();
      }
    };

    const playingSub = player.addListener(
      "playingChange",
      (newIsPlaying: boolean) => {
        if (newIsPlaying) {
          revealVideo();
        }
      }
    );

    const endSub = player.addListener("playToEnd", finishWithFade);

    const statusSub = player.addListener(
      "statusChange",
      (newStatus: VideoPlayerStatus, _oldStatus: VideoPlayerStatus, error?: { message: string }) => {
        if (newStatus === "error") {
          console.error("Video playback error:", error?.message);
          finishWithFade();
          return;
        }
        if (newStatus === "readyToPlay") {
          tryPlay();
          // readyToPlay means the first frame is decoded — safe to lift the
          // black overlay (it only exists to hide the yellow loading flash).
          // Don't wait solely on playingChange: that event can also be missed
          // if playback was already underway when listeners attached.
          revealVideo();
        }
      }
    );

    // Local assets can become readyToPlay (and even start buffering) before
    // this effect attaches listeners. Without this sync check, play() never
    // runs, the black overlay never lifts, and the user stares at a black
    // screen until the ready-wait timeout tears the splash down.
    if (player.status === "readyToPlay") {
      tryPlay();
      revealVideo();
    } else if (player.playing) {
      revealVideo();
    }

    // Only used if we never reveal — cleared inside revealVideo once playback
    // is visible so it can't cut a slow-to-start video short.
    readyWaitTimer = setTimeout(() => {
      if (!hasRevealedRef.current) {
        finishWithFade();
      }
    }, MAX_READY_WAIT_MS);

    return () => {
      playingSub.remove();
      endSub.remove();
      statusSub.remove();
      if (readyWaitTimer) clearTimeout(readyWaitTimer);
      if (playLimitTimer) clearTimeout(playLimitTimer);
    };
  }, [player, isFirstOpen, fadeAnim, overlayFadeAnim, onFinish]);

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
