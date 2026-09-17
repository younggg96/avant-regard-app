import React, { useEffect, useRef } from "react";
import {
  Dimensions,
  LayoutChangeEvent,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import Animated, {
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { Text, Pressable, NotificationBadge } from "./ui";
import { useAppTheme, useThemedStyles, type AppTheme } from "../theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const INDICATOR_INSET = 0.2;

const CJK_RE =
  /[\u3000-\u303f\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff00-\uffef]/;

/**
 * 纯拉丁标签的光学下沉补偿，单位为 em。
 *
 * 一级 Tab 标签用 Playfair（设计上刻意的，二级 Tab 才用无衬线），但 Playfair
 * 没有中文字形，中文会回落到系统字体 —— 于是「论坛」和「Archive」是两套字体。
 * 两者基线其实是对齐的（截图实测底边只差 0.8px），问题出在字面高度：
 *
 *   Playfair cap-height ≈ 0.70em   墨迹占 [-0.70em, 0]，中心 -0.35em
 *   中文字形          ≈ 0.84em     墨迹占 [-0.84em, +0.04em]，中心 -0.40em
 *
 * 差 0.05em。`alignItems: "center"` 对齐的是行盒不是墨迹，补不了这一层，
 * 结果就是拉丁标签整块偏下、看着「不在同一水平线上」（实测顶边低 3px @2x）。
 * 把纯拉丁标签上提 0.05em，让两种字体的墨迹中心对齐。
 *
 * 英文语境下所有标签都是拉丁、整排一起上移，相对关系不变，无副作用。
 */
const LATIN_OPTICAL_RISE_EM = 0.05;

interface TabLayout {
  x: number;
  width: number;
}

interface TabItem<T extends string> {
  id: T;
  label: string;
  badge?: number;
}

interface CenteredTabBarProps<T extends string> {
  tabs: TabItem<T>[];
  activeTab: T;
  onTabChange: (tab: T) => void;
  /** 更紧凑的垂直内边距，给首页 Logo / Tab 叠放用 */
  compact?: boolean;
  /** 默认 true；首页 Tab 下方紧贴内容时关掉，避免多出一条分割线 */
  showBottomBorder?: boolean;
  /** 默认居中；首页可用 left / right */
  align?: "center" | "left" | "right";
  /** 选中项只加粗，字号不变 */
  emphasizeActive?: boolean;
  /**
   * 外部滑动进度（页码 + 0~1 offset）。传入后下划线跟手插值；
   * 不传则在切换 activeTab 时用 spring 滑过去。
   */
  pagerPosition?: SharedValue<number>;
}

function TabButton<T extends string>({
  tab,
  isActive,
  onPress,
  onLayout,
  compact,
  emphasizeActive,
  compactPad,
}: {
  tab: TabItem<T>;
  isActive: boolean;
  onPress: () => void;
  onLayout: (e: LayoutChangeEvent) => void;
  compact?: boolean;
  emphasizeActive?: boolean;
  compactPad?: boolean;
}) {
  const styles = useThemedStyles(makeStyles);
  // 不含中日韩字形 = 整个标签都由 Playfair 渲染，需要光学补偿；
  // 含中文的标签由回落字体渲染，本身就是对齐基准，不动。
  const needsOpticalRise = !CJK_RE.test(tab.label);
  const fontSize = compact ? 16 : 14;
  return (
    <Pressable
      style={[
        styles.tabItem,
        compact && styles.tabItemCompact,
        compactPad && styles.tabItemTight,
      ]}
      onPress={onPress}
      onLayout={onLayout}
    >
      <Text
        style={[
          styles.tabText,
          compact && styles.tabTextCompact,
          isActive ? styles.tabTextActive : styles.tabTextInactive,
          emphasizeActive && (isActive ? styles.tabTextActiveBold : styles.tabTextInactive),
          // 用 translateY 而不是 margin：下划线要靠 onLayout 量 Tab 宽高定位，
          // 位移不能进入布局，否则指示器会跟着偏。
          needsOpticalRise && {
            transform: [
              { translateY: -fontSize * LATIN_OPTICAL_RISE_EM },
            ],
          },
        ]}
        numberOfLines={1}
      >
        {tab.label}
      </Text>
      {!!tab.badge && tab.badge > 0 && (
        <NotificationBadge count={tab.badge} size="sm" style={styles.badge} />
      )}
    </Pressable>
  );
}

function indicatorFrame(layout: TabLayout) {
  "worklet";
  const inset = layout.width * INDICATOR_INSET;
  return { x: layout.x + inset, width: Math.max(0, layout.width - inset * 2) };
}

export function CenteredTabBar<T extends string>({
  tabs,
  activeTab,
  onTabChange,
  compact = false,
  showBottomBorder = true,
  align = "center",
  emphasizeActive = false,
  pagerPosition,
}: CenteredTabBarProps<T>) {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const scrollRef = useRef<ScrollView>(null);
  const tabLayoutsRef = useRef<
    Partial<Record<string, { x: number; width: number }>>
  >({});
  /** JS 侧累加，避免同一帧多个 onLayout 读到过期的 shared value。 */
  const jsLayoutsRef = useRef<TabLayout[]>([]);
  const layoutsSV = useSharedValue<TabLayout[]>([]);
  const fallbackPosition = useSharedValue(
    Math.max(0, tabs.findIndex((tab) => tab.id === activeTab))
  );
  const followPager = pagerPosition != null;

  const activeIndex = tabs.findIndex((tab) => tab.id === activeTab);
  useEffect(() => {
    if (followPager) return;
    if (activeIndex < 0) return;
    fallbackPosition.value = withSpring(activeIndex, { damping: 20, stiffness: 280 });
  }, [activeIndex, followPager, fallbackPosition]);

  /** 居中时把激活 tab 滚到可视区中央；左右对齐时不抢滚动，避免跳动 */
  useEffect(() => {
    if (align !== "center") return;
    const layout = tabLayoutsRef.current[activeTab];
    if (!layout || !scrollRef.current) return;
    const targetX = Math.max(
      0,
      layout.x - SCREEN_WIDTH / 2 + layout.width / 2
    );
    scrollRef.current.scrollTo({ x: targetX, animated: true });
  }, [activeTab, align]);

  const indicatorStyle = useAnimatedStyle(() => {
    const layouts = layoutsSV.value;
    const max = layouts.length - 1;
    const raw = followPager && pagerPosition ? pagerPosition.value : fallbackPosition.value;
    if (max < 0) {
      return { opacity: 0, width: 0, transform: [{ translateX: 0 }] };
    }
    const p = Math.min(max, Math.max(0, raw));
    const left = Math.floor(p);
    const right = Math.ceil(p);
    const a = layouts[left];
    const b = layouts[right];
    if (!a || a.width <= 0) {
      return { opacity: 0, width: 0, transform: [{ translateX: 0 }] };
    }
    const from = indicatorFrame(a);
    if (!b || b.width <= 0 || left === right) {
      return {
        opacity: 1,
        width: from.width,
        transform: [{ translateX: from.x }],
      };
    }
    const to = indicatorFrame(b);
    const t = p - left;
    return {
      opacity: 1,
      width: from.width + (to.width - from.width) * t,
      transform: [{ translateX: from.x + (to.x - from.x) * t }],
    };
  });

  return (
    <View
      style={{
        borderBottomWidth: showBottomBorder ? 1 : 0,
        borderBottomColor: theme.colors.gray100,
        backgroundColor: theme.colors.background,
      }}
    >
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          align === "left" && styles.scrollContentLeft,
          align === "right" && styles.scrollContentRight,
        ]}
      >
        <View style={styles.row} collapsable={false}>
          {tabs.map((tab, index) => (
            <TabButton
              key={tab.id}
              tab={tab}
              isActive={activeTab === tab.id}
              compact={compact}
              emphasizeActive={emphasizeActive}
              compactPad={align !== "center"}
              onPress={() => onTabChange(tab.id)}
              onLayout={(e) => {
                const { x, width } = e.nativeEvent.layout;
                tabLayoutsRef.current[tab.id] = { x, width };
                const next = jsLayoutsRef.current.slice();
                next[index] = { x, width };
                jsLayoutsRef.current = next;
                layoutsSV.value = next;
              }}
            />
          ))}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.indicator,
              { backgroundColor: theme.colors.text },
              indicatorStyle,
            ]}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    scrollContent: {
      flexGrow: 1,
      justifyContent: "center",
      paddingHorizontal: 8,
    },
    scrollContentLeft: {
      justifyContent: "flex-start",
      paddingLeft: 8,
      paddingRight: 4,
    },
    scrollContentRight: {
      justifyContent: "flex-end",
      paddingLeft: 4,
      paddingRight: 8,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      position: "relative",
      overflow: "visible",
    },
    tabItem: {
      paddingVertical: 8,
      paddingHorizontal: 14,
      position: "relative",
      alignItems: "center",
    },
    tabItemCompact: {
      paddingVertical: 6,
    },
    tabItemTight: {
      paddingHorizontal: 8,
    },
    // lineHeight 跟 ui/Text 的默认值（$md = 22）保持一致，别改动 —— 另外四个
    // 使用方的 Tab 栏高度都吃这个值。Android 关掉 includeFontPadding，否则
    // 中文回落字体和 Playfair 各自的字体留白不同，行盒会被撑得不一样高。
    tabText: {
      fontSize: 14,
      lineHeight: 22,
      fontWeight: "500",
      textAlign: "center",
      ...(Platform.OS === "android"
        ? { includeFontPadding: false, textAlignVertical: "center" as const }
        : {}),
    },
    tabTextCompact: {
      fontSize: 16,
    },
    tabTextActive: {
      color: t.colors.text,
      fontWeight: "600",
    },
    tabTextActiveBold: {
      color: t.colors.text,
      fontWeight: "700",
    },
    tabTextInactive: {
      color: t.colors.gray300,
      fontWeight: "500",
    },
    indicator: {
      position: "absolute",
      bottom: 0,
      left: 0,
      height: 2,
      borderRadius: 1,
    },
    badge: {
      top: 2,
      right: 2,
    },
  });
