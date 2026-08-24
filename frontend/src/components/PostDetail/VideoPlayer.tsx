import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Image,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  ImageStyle,
  StyleProp,
  Animated,
  GestureResponderEvent,
  LayoutChangeEvent,
  Text,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useVideoPlayer, VideoView } from "expo-video";
import type { VideoContentFit, VideoPlayerStatus } from "expo-video";
import { Pressable } from "../ui";
import { getVideoThumbnail } from "../../utils/videoThumbnail";
import { rememberMediaAspectRatio } from "../../utils/useMediaAspectRatio";
import { cleanVideoUri, ensureCachedVideo } from "../../utils/videoCache";

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
}

interface VideoPlayerProps {
  uri: string;
  style: StyleProp<ViewStyle>;
  videoStyle: StyleProp<ViewStyle>;
  contentFit?: VideoContentFit;
  playIconSize?: number;
  showControls?: boolean;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  uri,
  style,
  videoStyle,
  contentFit = "cover",
  playIconSize = 48,
  showControls: enableControls = true,
}) => {
  const cleanUri = cleanVideoUri(uri);
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [status, setStatus] = useState<VideoPlayerStatus>("idle");
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(false);
  const [progressBarWidth, setProgressBarWidth] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);

  const controlsOpacity = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLocalUri(null);
    setLoadError(false);
    setStatus("idle");
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setThumbnail(null);

    (async () => {
      try {
        // Keeps the original container extension (.mov / .mp4 / .m4v / …).
        // Forcing ".mp4" for QuickTime uploads breaks AVPlayer on real devices.
        const cached = await ensureCachedVideo(cleanUri);
        if (cancelled) return;
        if (cached) {
          setLocalUri(cached);
        } else {
          console.warn("Video download failed for:", cleanUri);
          setLoadError(true);
        }
      } catch (e) {
        console.warn("Video cache error:", e);
        if (!cancelled) setLoadError(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [cleanUri]);

  const player = useVideoPlayer(localUri, (p) => {
    p.loop = true;
    p.muted = false;
  });

  useEffect(() => {
    if (!player) return;
    const statusSub = player.addListener(
      "statusChange",
      (
        newStatus: VideoPlayerStatus,
        _oldStatus: VideoPlayerStatus,
        error?: { message: string },
      ) => {
        setStatus(newStatus);
        if (newStatus === "readyToPlay" && player.duration > 0) {
          setDuration(player.duration);
        }
        if (newStatus === "error") {
          console.warn("Video error:", error?.message);
          setLoadError(true);
        }
      },
    );
    const playingSub = player.addListener(
      "playingChange",
      (newIsPlaying: boolean) => {
        setIsPlaying(newIsPlaying);
      },
    );
    return () => {
      statusSub.remove();
      playingSub.remove();
    };
  }, [player]);

  useEffect(() => {
    if (isPlaying && player && !isSeeking) {
      pollTimer.current = setInterval(() => {
        if (player.currentTime != null) {
          setCurrentTime(player.currentTime);
        }
        if (player.duration > 0 && duration === 0) {
          setDuration(player.duration);
        }
      }, 250);
    } else {
      if (pollTimer.current) clearInterval(pollTimer.current);
    }
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, [isPlaying, player, isSeeking, duration]);

  useEffect(() => {
    if (!localUri) return;
    let cancelled = false;
    getVideoThumbnail(localUri).then((thumb) => {
      if (cancelled || !thumb) return;
      setThumbnail(thumb.uri);
      rememberMediaAspectRatio(cleanUri, thumb.width, thumb.height);
    });
    return () => {
      cancelled = true;
    };
  }, [localUri, cleanUri]);

  const showControlsBar = useCallback(() => {
    setControlsVisible(true);
    Animated.timing(controlsOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      Animated.timing(controlsOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => setControlsVisible(false));
    }, 3500);
  }, [controlsOpacity]);

  const handlePress = useCallback(() => {
    if (!player || loadError) return;
    if (player.playing) {
      player.pause();
      showControlsBar();
    } else {
      player.play();
      showControlsBar();
    }
  }, [player, loadError, showControlsBar]);

  const handleMuteToggle = useCallback(() => {
    if (!player) return;
    const next = !isMuted;
    player.muted = next;
    setIsMuted(next);
    showControlsBar();
  }, [player, isMuted, showControlsBar]);

  const handleSeek = useCallback(
    (evt: GestureResponderEvent) => {
      if (!player || progressBarWidth === 0 || duration === 0) return;
      const x = evt.nativeEvent.locationX;
      const ratio = Math.max(0, Math.min(1, x / progressBarWidth));
      const seekTo = ratio * duration;
      player.currentTime = seekTo;
      setCurrentTime(seekTo);
      showControlsBar();
    },
    [player, progressBarWidth, duration, showControlsBar],
  );

  const handleSeekStart = useCallback(() => setIsSeeking(true), []);

  const handleSeekEnd = useCallback(
    (evt: GestureResponderEvent) => {
      setIsSeeking(false);
      handleSeek(evt);
    },
    [handleSeek],
  );

  const handleProgressLayout = useCallback((e: LayoutChangeEvent) => {
    setProgressBarWidth(e.nativeEvent.layout.width);
  }, []);

  const progress = duration > 0 ? currentTime / duration : 0;
  const isDownloading = !localUri && !loadError;
  const showPoster = thumbnail && !isPlaying;
  const showLoading = isDownloading || (isPlaying && status === "loading");

  return (
    <Pressable style={style} onPress={handlePress}>
      {localUri && player && !loadError && (
        <VideoView
          player={player}
          style={videoStyle}
          contentFit={contentFit}
          nativeControls={false}
        />
      )}

      {showPoster && (
        <Image
          source={{ uri: thumbnail }}
          style={[StyleSheet.absoluteFill, posterImageStyle]}
        />
      )}

      {showLoading && (
        <View style={playerStyles.centerOverlay}>
          <ActivityIndicator size="large" color="rgba(255,255,255,0.9)" />
        </View>
      )}

      {loadError && (
        <View style={playerStyles.centerOverlay}>
          <Ionicons
            name="alert-circle-outline"
            size={playIconSize}
            color="rgba(255,255,255,0.85)"
          />
          <Text style={playerStyles.errorLabel}>无法播放</Text>
        </View>
      )}

      {!isPlaying && !isDownloading && !loadError && (
        <View style={playerStyles.centerOverlay}>
          <Ionicons
            name="play-circle"
            size={playIconSize}
            color="rgba(255,255,255,0.85)"
          />
        </View>
      )}

      {enableControls && isPlaying && !loadError && (
        <Animated.View
          style={[playerStyles.controlsBar, { opacity: controlsOpacity }]}
          pointerEvents={controlsVisible ? "auto" : "none"}
        >
          <Pressable onPress={handlePress} hitSlop={8} style={playerStyles.controlBtn}>
            <Ionicons
              name={isPlaying ? "pause" : "play"}
              size={18}
              color="#fff"
            />
          </Pressable>

          <View style={playerStyles.timeText}>
            <Animated.Text style={playerStyles.timeLabel}>
              {formatTime(currentTime)}
            </Animated.Text>
          </View>

          <View
            style={playerStyles.progressContainer}
            onLayout={handleProgressLayout}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderGrant={handleSeekStart}
            onResponderMove={handleSeek}
            onResponderRelease={handleSeekEnd}
          >
            <View style={playerStyles.progressTrack}>
              <View
                style={[
                  playerStyles.progressFill,
                  { width: `${Math.min(progress * 100, 100)}%` },
                ]}
              />
              <View
                style={[
                  playerStyles.progressThumb,
                  { left: `${Math.min(progress * 100, 100)}%` },
                ]}
              />
            </View>
          </View>

          <View style={playerStyles.timeText}>
            <Animated.Text style={playerStyles.timeLabel}>
              {formatTime(duration)}
            </Animated.Text>
          </View>

          <Pressable onPress={handleMuteToggle} hitSlop={8} style={playerStyles.controlBtn}>
            <Ionicons
              name={isMuted ? "volume-mute" : "volume-medium"}
              size={18}
              color="#fff"
            />
          </Pressable>
        </Animated.View>
      )}
    </Pressable>
  );
};

const posterImageStyle: ImageStyle = {
  resizeMode: "cover",
  width: "100%",
  height: "100%",
};

const playerStyles = StyleSheet.create({
  centerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.15)",
  },
  errorLabel: {
    marginTop: 8,
    color: "rgba(255,255,255,0.85)",
    fontSize: 13,
  },
  controlsBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  controlBtn: {
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  timeText: {
    minWidth: 38,
    alignItems: "center",
  },
  timeLabel: {
    color: "#fff",
    fontSize: 11,
    fontVariant: ["tabular-nums"],
  },
  progressContainer: {
    flex: 1,
    height: 28,
    justifyContent: "center",
    marginHorizontal: 4,
  },
  progressTrack: {
    height: 3,
    backgroundColor: "rgba(255,255,255,0.3)",
    borderRadius: 1.5,
    overflow: "visible",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#fff",
    borderRadius: 1.5,
  },
  progressThumb: {
    position: "absolute",
    top: -4.5,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#fff",
    marginLeft: -6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
});
