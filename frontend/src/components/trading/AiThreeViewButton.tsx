/**
 * 「AI 生成三视图」按钮。
 *
 * 为什么不直接用 primaryBtn：这一步不是表单的主动作（主动作是「AI 识别」），
 * 而是一个会产生费用、会往图片网格里塞新东西的特殊动作。两个都做成白色实心
 * 按钮，用户分不出哪个是「走下一步」、哪个是「叫模型干活」。
 *
 * 为什么不用紫蓝渐变那套：全站的 AI 语汇是克制的黑白 —— 灰色 sparkles 加
 * Playfair 字距，见 AIPost/ 下的 AIInsightCard、EditorialHeader。这里沿用同
 * 一套，只在生成过程中扫一道流光来表达「正在算」（手法和 BrandCollections
 * 的 brandShine 一致），不引入体系外的颜色。
 */

import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  Text as RNText,
  type LayoutChangeEvent,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { Pressable } from "../ui";
import {
  playfairFonts,
  useAppTheme,
  useThemedStyles,
  type AppTheme,
} from "../../theme";

interface Props {
  label: string;
  loadingLabel: string;
  loading: boolean;
  disabled?: boolean;
  onPress: () => void;
}

const SHINE_WIDTH = 96;

const AiThreeViewButton: React.FC<Props> = ({
  label,
  loadingLabel,
  loading,
  disabled,
  onPress,
}) => {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const [width, setWidth] = useState(0);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (loading) {
      progress.value = withRepeat(
        withTiming(1, { duration: 1400, easing: Easing.linear }),
        -1,
        false,
      );
    } else {
      cancelAnimation(progress);
      progress.value = 0;
    }
    return () => cancelAnimation(progress);
  }, [loading, progress]);

  const shineStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(
          progress.value,
          [0, 1],
          [-SHINE_WIDTH, width || SHINE_WIDTH],
        ),
      },
    ],
  }));

  // 流光要压在按钮底色上，深色主题用白、浅色主题用黑，否则在自己的底色上
  // 是隐形的。
  const shineColor =
    theme.mode === "dark" ? "rgba(255,255,255,0.20)" : "rgba(0,0,0,0.07)";

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      // 只有「不可用」才压暗。生成中同样点不动，但那是「正在干活」，
      // 靠流光表达；一起压到 0.45 会让人以为功能坏了，也把流光洗没了。
      style={[styles.btn, disabled && !loading && styles.btnDim]}
    >
      {loading ? (
        <Animated.View
          style={[styles.shine, shineStyle]}
          pointerEvents="none"
        >
          <LinearGradient
            colors={["transparent", shineColor, "transparent"]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ) : null}

      <Ionicons name="sparkles-outline" size={15} color={theme.colors.text} />
      <RNText style={styles.label}>{loading ? loadingLabel : label}</RNText>
    </Pressable>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    btn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      alignSelf: "flex-start",
      gap: 8,
      paddingHorizontal: 20,
      // 和 primaryBtn / secondaryBtn 同一个高度档（padding 12 + 行高 20），
      // 三个按钮在同一页出现时不能高矮不齐。
      minHeight: 46,
      borderRadius: t.borderRadius.sm,
      // 关键：card 和 background 在两套主题里都是同一个值（#000 / #FFF），
      // 拿 card 当底色等于没有底色。surface 才是真正比页面高一层的面，
      // 配上 inputBorder 这条看得见的实线，才像个可以按的控件。
      backgroundColor: t.colors.surface,
      borderWidth: 1,
      borderColor: t.colors.inputBorder,
      // 流光不能溢出到按钮外面
      overflow: "hidden",
    },
    btnDim: { opacity: 0.45 },
    shine: {
      position: "absolute",
      top: 0,
      bottom: 0,
      width: SHINE_WIDTH,
    },
    label: {
      // 按钮规格：15 / 0.5。之前用的 12 / 1.6 是这套系统里的章节标签规格
      // （见 groupLabel），字一小、字距一拉就读成标题而不是按钮了。
      fontFamily: playfairFonts.medium,
      fontSize: 15,
      letterSpacing: 0.5,
      color: t.colors.text,
    },
  });

export default AiThreeViewButton;
