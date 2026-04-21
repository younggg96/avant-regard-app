/**
 * FpsMonitor
 * -----------------------------------------------------------------------------
 * Dev-only floating HUD that measures the JS-thread frame rate using
 * `requestAnimationFrame` ticks, and renders a draggable pill in the top-right
 * corner.
 *
 * Why RAF ticks?
 *   In React Native the JS thread drives `requestAnimationFrame`. When JS is
 *   blocked (e.g. heavy re-renders during a `MasonryFlashList` scroll), RAF
 *   ticks slow down and the measured FPS drops — which is exactly the signal
 *   we want for scroll-perf debugging.
 *
 * Rendering is fully skipped in production (`__DEV__` guard) so there is zero
 * runtime cost for shipped builds.
 */
import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  PanResponder,
  Animated,
  Dimensions,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const SAMPLE_WINDOW_MS = 500; // how often the HUD refreshes
const HUD_WIDTH = 96;
const HUD_HEIGHT = 36;
const EDGE_PADDING = 8;

function pickColor(fps: number): string {
  if (fps >= 55) return "#3BD16F"; // green
  if (fps >= 30) return "#F5C542"; // amber
  return "#FF3B30"; // red
}

export default function FpsMonitor() {
  if (!__DEV__) return null;
  return <FpsMonitorImpl />;
}

function FpsMonitorImpl() {
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = Dimensions.get("window");

  const [fps, setFps] = useState(60);
  const [minFps, setMinFps] = useState(60);

  // RAF accounting lives in refs so the measurement loop itself never
  // triggers a React re-render.
  const rafRef = useRef<number | null>(null);
  const frameCountRef = useRef(0);
  const windowStartRef = useRef<number>(0);
  const minFpsRef = useRef<number>(Infinity);

  useEffect(() => {
    let cancelled = false;

    const tick = (now: number) => {
      if (cancelled) return;

      if (windowStartRef.current === 0) {
        windowStartRef.current = now;
      }
      frameCountRef.current += 1;

      const elapsed = now - windowStartRef.current;
      if (elapsed >= SAMPLE_WINDOW_MS) {
        const measured = Math.round((frameCountRef.current * 1000) / elapsed);
        const clamped = Math.min(measured, 120); // cap for ProMotion/weird spikes

        if (clamped < minFpsRef.current) minFpsRef.current = clamped;

        setFps(clamped);
        setMinFps(minFpsRef.current);

        frameCountRef.current = 0;
        windowStartRef.current = now;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Draggable position. Default to the top-right corner just below the notch.
  const initialX = screenW - HUD_WIDTH - EDGE_PADDING;
  const initialY = insets.top + EDGE_PADDING;
  const pan = useRef(new Animated.ValueXY({ x: initialX, y: initialY })).current;
  const panOffset = useRef({ x: initialX, y: initialY });

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_e, g) =>
          Math.abs(g.dx) > 2 || Math.abs(g.dy) > 2,
        onPanResponderGrant: () => {
          pan.setOffset({ x: panOffset.current.x, y: panOffset.current.y });
          pan.setValue({ x: 0, y: 0 });
        },
        onPanResponderMove: Animated.event(
          [null, { dx: pan.x, dy: pan.y }],
          { useNativeDriver: false },
        ),
        onPanResponderRelease: (_e, g) => {
          pan.flattenOffset();
          const nextX = Math.max(
            EDGE_PADDING,
            Math.min(
              screenW - HUD_WIDTH - EDGE_PADDING,
              panOffset.current.x + g.dx,
            ),
          );
          const nextY = Math.max(
            insets.top + EDGE_PADDING,
            Math.min(
              screenH - HUD_HEIGHT - insets.bottom - EDGE_PADDING,
              panOffset.current.y + g.dy,
            ),
          );
          panOffset.current = { x: nextX, y: nextY };
          Animated.spring(pan, {
            toValue: { x: nextX, y: nextY },
            useNativeDriver: false,
            bounciness: 0,
          }).start();
        },
      }),
    [pan, screenW, screenH, insets.top, insets.bottom],
  );

  const resetMin = () => {
    minFpsRef.current = Infinity;
    setMinFps(fps);
  };

  const color = pickColor(fps);
  const minColor = pickColor(minFps);

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.container,
        {
          transform: pan.getTranslateTransform(),
          width: HUD_WIDTH,
          height: HUD_HEIGHT,
        },
      ]}
      {...panResponder.panHandlers}
    >
      <Pressable onPress={resetMin} style={styles.pill}>
        <Text style={[styles.fpsText, { color }]}>{fps}</Text>
        <Text style={styles.label}>fps</Text>
        <View style={styles.divider} />
        <Text style={[styles.minText, { color: minColor }]}>{minFps}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    zIndex: 9999,
    elevation: 9999,
  },
  pill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.72)",
    borderRadius: 18,
    paddingHorizontal: 10,
  },
  fpsText: {
    fontSize: 15,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  label: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 10,
    marginLeft: 2,
    marginTop: 2,
  },
  divider: {
    width: 1,
    height: 14,
    backgroundColor: "rgba(255,255,255,0.25)",
    marginHorizontal: 6,
  },
  minText: {
    fontSize: 11,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
});
