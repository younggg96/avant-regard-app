/**
 * 全屏升级庆祝动画 · 黑白冷峻款.
 *
 * 严格遵循 PRD:
 *   - 监听 useLevelStore.celebrateLevel, 非 null 即触发
 *   - 动画总时长 = 2 秒 (fadeIn 400 + hold 1200 + fadeOut 400)
 *   - 颜色只允许 #000 / #FFF / 灰度; 严禁任何彩色
 *   - 结束后调用 acknowledgeCelebration() 保证同一次升级不会重复播放
 *
 * 视觉要素:
 *   - 纯黑全屏背景
 *   - 居中大号 "Lv{N}" + 等级称号, 白色衬线字
 *   - 一条从左向右扫过的白色水平细线 (极简视觉强调)
 */

import React, { useEffect } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Dimensions,
  StatusBar,
} from "react-native";
import { useTranslation } from "react-i18next";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  runOnJS,
  Easing,
} from "react-native-reanimated";
import { theme } from "../../theme";
import { useLevelStore } from "../../store/levelStore";
import { LevelBadge } from "./LevelBadge";
import { getLevelTitleKey } from "./levelTitles";

const { width: SCREEN_W } = Dimensions.get("window");

const TOTAL_MS = 2000;
const FADE_IN_MS = 400;
const HOLD_MS = 1200;
const FADE_OUT_MS = 400;

export const LevelUpgradeModal: React.FC = () => {
  const { t } = useTranslation();
  const celebrateLevel = useLevelStore((s) => s.celebrateLevel);
  const acknowledge = useLevelStore((s) => s.acknowledgeCelebration);

  const visible = celebrateLevel != null;

  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.8);
  const lineWidth = useSharedValue(0);

  useEffect(() => {
    if (!visible) return;
    opacity.value = 0;
    scale.value = 0.8;
    lineWidth.value = 0;

    opacity.value = withSequence(
      withTiming(1, { duration: FADE_IN_MS, easing: Easing.out(Easing.cubic) }),
      withDelay(HOLD_MS, withTiming(0, {
        duration: FADE_OUT_MS,
        easing: Easing.in(Easing.cubic),
      }, (finished) => {
        if (finished) runOnJS(acknowledge)();
      }))
    );

    scale.value = withTiming(1, {
      duration: FADE_IN_MS + 200,
      easing: Easing.out(Easing.cubic),
    });

    lineWidth.value = withDelay(
      FADE_IN_MS - 100,
      withTiming(SCREEN_W * 0.6, {
        duration: 700,
        easing: Easing.out(Easing.cubic),
      })
    );
  }, [visible, opacity, scale, lineWidth, acknowledge]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const lineStyle = useAnimatedStyle(() => ({
    width: lineWidth.value,
  }));

  if (!visible || !celebrateLevel) return null;

  const title = t(getLevelTitleKey(celebrateLevel));

  return (
    <Modal visible transparent statusBarTranslucent animationType="none">
      <StatusBar barStyle="light-content" />
      <Animated.View style={[styles.overlay, containerStyle]}>
        <Animated.View style={[styles.content, contentStyle]}>
          <Text style={styles.congrats}>{t("level.congratsUpgrade")}</Text>

          <LevelBadge level={celebrateLevel} size="lg" style={styles.badge} />

          <Text style={styles.level}>Lv{celebrateLevel}</Text>

          {title ? <Text style={styles.title}>{title}</Text> : null}

          <Animated.View style={[styles.line, lineStyle]} />
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.black,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    alignItems: "center",
    justifyContent: "center",
  },
  congrats: {
    color: theme.colors.white,
    fontFamily: theme.typography.caption.fontFamily,
    fontSize: 14,
    letterSpacing: 6,
    marginBottom: 24,
    opacity: 0.7,
  },
  badge: {
    marginBottom: 32,
  },
  level: {
    color: theme.colors.white,
    fontFamily: theme.typography.hero.fontFamily,
    fontSize: 72,
    lineHeight: 78,
    letterSpacing: -1,
  },
  title: {
    color: theme.colors.white,
    fontFamily: theme.typography.h2.fontFamily,
    fontSize: 22,
    letterSpacing: 4,
    marginTop: 12,
    opacity: 0.85,
  },
  line: {
    height: 1,
    backgroundColor: theme.colors.white,
    marginTop: 32,
  },
});
