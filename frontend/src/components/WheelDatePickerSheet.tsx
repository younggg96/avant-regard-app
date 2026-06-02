/**
 * WheelDatePickerSheet —— 底部弹窗年月日滚轮选择（可选日期）。
 * 输出格式固定为 YYYY-MM-DD，与后端 original_acquired_at 一致。
 */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  FlatList,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
  type FlatListProps,
} from "react-native";
import { useTranslation } from "react-i18next";

import { HStack, Text } from "./ui";
import { useAppTheme, useThemedStyles, type AppTheme } from "../theme";

const ITEM_HEIGHT = 44;
const VISIBLE_COUNT = 5;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_COUNT;
const WHEEL_PADDING = (PICKER_HEIGHT - ITEM_HEIGHT) / 2;

const MIN_YEAR = 1990;

export function parseIsoDate(value: string | null | undefined): Date | null {
  if (!value?.trim()) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const date = new Date(y, mo - 1, d);
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== mo - 1 ||
    date.getDate() !== d
  ) {
    return null;
  }
  return date;
}

export function formatIsoDate(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function clampDay(year: number, month: number, day: number): number {
  return Math.min(day, daysInMonth(year, month));
}

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList) as React.ForwardRefExoticComponent<
  FlatListProps<number> & React.RefAttributes<FlatList<number>>
>;

interface WheelColumnProps {
  items: number[];
  selected: number;
  onSelect: (value: number) => void;
  formatLabel: (value: number) => string;
  styles: ReturnType<typeof makeStyles>;
  theme: AppTheme;
}

const WheelColumn: React.FC<WheelColumnProps> = ({
  items,
  selected,
  onSelect,
  formatLabel,
  styles,
  theme,
}) => {
  const listRef = useRef<FlatList<number>>(null);
  const selectedIndex = Math.max(0, items.indexOf(selected));
  // 跟踪滚动位置, 用于平滑插值透明度/缩放。
  const scrollY = useRef(new Animated.Value(selectedIndex * ITEM_HEIGHT))
    .current;
  // 标记一次由用户滚动产生的选中, 避免随后的 prop 同步再次回滚造成抖动。
  const settlingFromUser = useRef(false);

  // 选中值因外部原因变化时(如月份变化导致日被钳制), 同步滚轮位置。
  useEffect(() => {
    if (settlingFromUser.current) {
      settlingFromUser.current = false;
      return;
    }
    const id = setTimeout(() => {
      listRef.current?.scrollToOffset({
        offset: selectedIndex * ITEM_HEIGHT,
        animated: false,
      });
      scrollY.setValue(selectedIndex * ITEM_HEIGHT);
    }, 0);
    return () => clearTimeout(id);
  }, [selectedIndex, scrollY]);

  const handleScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offset = e.nativeEvent.contentOffset.y;
      const index = Math.min(
        items.length - 1,
        Math.max(0, Math.round(offset / ITEM_HEIGHT))
      );
      const next = items[index];
      if (next !== undefined && next !== selected) {
        settlingFromUser.current = true;
        onSelect(next);
      }
    },
    [items, onSelect, selected]
  );

  const onScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
        useNativeDriver: true,
      }),
    [scrollY]
  );

  return (
    <View style={styles.wheelColumn}>
      <AnimatedFlatList
        ref={listRef}
        data={items}
        keyExtractor={(n) => String(n)}
        renderItem={({ item, index }) => {
          const center = index * ITEM_HEIGHT;
          const inputRange = [
            center - 2 * ITEM_HEIGHT,
            center - ITEM_HEIGHT,
            center,
            center + ITEM_HEIGHT,
            center + 2 * ITEM_HEIGHT,
          ];
          const opacity = scrollY.interpolate({
            inputRange,
            outputRange: [0.25, 0.5, 1, 0.5, 0.25],
            extrapolate: "clamp",
          });
          const scale = scrollY.interpolate({
            inputRange,
            outputRange: [0.82, 0.9, 1, 0.9, 0.82],
            extrapolate: "clamp",
          });
          return (
            <Animated.View style={[styles.wheelItem, { opacity }]}>
              <Animated.Text
                style={[
                  styles.wheelItemText,
                  { color: theme.colors.text, transform: [{ scale }] },
                ]}
              >
                {formatLabel(item)}
              </Animated.Text>
            </Animated.View>
          );
        }}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        bounces={false}
        nestedScrollEnabled
        scrollEventThrottle={16}
        initialScrollIndex={selectedIndex}
        getItemLayout={(_, index) => ({
          length: ITEM_HEIGHT,
          offset: ITEM_HEIGHT * index,
          index,
        })}
        contentContainerStyle={{ paddingVertical: WHEEL_PADDING }}
        onScroll={onScroll}
        onMomentumScrollEnd={handleScrollEnd}
        onScrollEndDrag={handleScrollEnd}
      />
    </View>
  );
};

export interface WheelDatePickerSheetProps {
  visible: boolean;
  value: string | null;
  title?: string;
  onClose: () => void;
  onConfirm: (isoDate: string) => void;
  /** 提供后, 弹窗内出现「清除」按钮, 点击回传 null。 */
  onClear?: () => void;
}

const WheelDatePickerSheet: React.FC<WheelDatePickerSheetProps> = ({
  visible,
  value,
  title,
  onClose,
  onConfirm,
  onClear,
}) => {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const maxYear = new Date().getFullYear();

  const initial = useMemo(() => {
    const parsed = parseIsoDate(value);
    const base = parsed ?? new Date();
    const y = Math.min(maxYear, Math.max(MIN_YEAR, base.getFullYear()));
    const m = base.getMonth() + 1;
    const d = clampDay(y, m, base.getDate());
    return { y, m, d };
    // visible 变化时重算, 保证每次打开都同步到当前值。
  }, [value, maxYear, visible]);

  const [year, setYear] = useState(initial.y);
  const [month, setMonth] = useState(initial.m);
  const [day, setDay] = useState(initial.d);

  useEffect(() => {
    if (visible) {
      setYear(initial.y);
      setMonth(initial.m);
      setDay(initial.d);
    }
  }, [visible, initial.y, initial.m, initial.d]);

  const years = useMemo(
    () =>
      Array.from({ length: maxYear - MIN_YEAR + 1 }, (_, i) => MIN_YEAR + i),
    [maxYear]
  );
  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);
  const days = useMemo(() => {
    const n = daysInMonth(year, month);
    return Array.from({ length: n }, (_, i) => i + 1);
  }, [year, month]);

  useEffect(() => {
    setDay((prev) => clampDay(year, month, prev));
  }, [year, month]);

  const yearSuffix = t("trading.publishListing.datePicker.yearSuffix");
  const monthSuffix = t("trading.publishListing.datePicker.monthSuffix");
  const daySuffix = t("trading.publishListing.datePicker.daySuffix");

  const formatYear = useCallback(
    (y: number) => (yearSuffix ? `${y}${yearSuffix}` : String(y)),
    [yearSuffix]
  );
  const formatMonth = useCallback(
    (m: number) => {
      const n = String(m).padStart(2, "0");
      return monthSuffix ? `${n}${monthSuffix}` : n;
    },
    [monthSuffix]
  );
  const formatDay = useCallback(
    (d: number) => {
      const n = String(d).padStart(2, "0");
      return daySuffix ? `${n}${daySuffix}` : n;
    },
    [daySuffix]
  );

  const handleConfirm = () => {
    onConfirm(formatIsoDate(year, month, day));
    onClose();
  };

  const handleClear = () => {
    onClear?.();
    onClose();
  };

  const sheetTitle =
    title ?? t("trading.publishListing.fields.selectAcquiredDateOptional");

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>
        <View style={styles.sheet}>
          <HStack style={styles.header}>
            <Pressable onPress={onClose} hitSlop={12} style={styles.headerBtn}>
              <Text style={styles.headerAction}>{t("common.cancel")}</Text>
            </Pressable>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {sheetTitle}
            </Text>
            <Pressable
              onPress={handleConfirm}
              hitSlop={12}
              style={styles.headerBtn}
            >
              <Text style={[styles.headerAction, styles.headerConfirm]}>
                {t("common.confirm")}
              </Text>
            </Pressable>
          </HStack>

          <View style={styles.wheelsWrap}>
            <View
              style={[
                styles.selectionBar,
                { backgroundColor: theme.colors.surface },
              ]}
              pointerEvents="none"
            />
            <HStack style={styles.wheelsRow}>
              <WheelColumn
                items={years}
                selected={year}
                onSelect={setYear}
                formatLabel={formatYear}
                styles={styles}
                theme={theme}
              />
              <WheelColumn
                items={months}
                selected={month}
                onSelect={setMonth}
                formatLabel={formatMonth}
                styles={styles}
                theme={theme}
              />
              <WheelColumn
                items={days}
                selected={day}
                onSelect={setDay}
                formatLabel={formatDay}
                styles={styles}
                theme={theme}
              />
            </HStack>
          </View>

          {onClear && value ? (
            <Pressable onPress={handleClear} style={styles.clearBtn} hitSlop={8}>
              <Text style={styles.clearText}>{t("common.clear")}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: t.colors.overlay,
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: t.colors.card,
      borderTopLeftRadius: t.borderRadius.sm,
      borderTopRightRadius: t.borderRadius.sm,
      paddingBottom: 28,
    },
    header: {
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 8,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    headerBtn: {
      minWidth: 64,
      paddingHorizontal: 8,
      alignItems: "center",
    },
    headerTitle: {
      flex: 1,
      textAlign: "center",
      ...t.typography.h4,
      color: t.colors.text,
    },
    headerAction: {
      ...t.typography.body,
      color: t.colors.textSecondary,
    },
    headerConfirm: {
      ...t.typography.button,
      color: t.colors.accent,
    },
    wheelsWrap: {
      height: PICKER_HEIGHT,
      position: "relative",
    },
    wheelsRow: {
      flex: 1,
    },
    wheelColumn: {
      flex: 1,
      height: PICKER_HEIGHT,
      overflow: "hidden",
    },
    wheelItem: {
      height: ITEM_HEIGHT,
      justifyContent: "center",
      alignItems: "center",
    },
    wheelItemText: {
      ...t.typography.h3,
    },
    selectionBar: {
      position: "absolute",
      left: 12,
      right: 12,
      top: WHEEL_PADDING,
      height: ITEM_HEIGHT,
      borderRadius: t.borderRadius.sm,
      opacity: 0.85,
    },
    clearBtn: {
      marginTop: 12,
      marginHorizontal: 16,
      paddingVertical: 12,
      alignItems: "center",
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border,
    },
    clearText: {
      ...t.typography.bodySmall,
      color: t.colors.error,
    },
  });

export default WheelDatePickerSheet;
