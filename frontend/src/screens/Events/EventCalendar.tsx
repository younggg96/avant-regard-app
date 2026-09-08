/**
 * 活动日历 · 月视图
 *
 * PRD 3.2：
 *  - 不同类型的活动用不同颜色的纯色圈圈住日期
 *  - 同一天有两个（及以上）类型的活动 → 圆圈一半一半分色
 *  - 用户收藏 / 预约过的活动所在日期加特殊标记（黑色外环）
 *  - 点击有活动的日期 → 由父组件弹出活动卡片
 */
import React, { useMemo } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Pressable, Text } from "../../components/ui";
import { useAppTheme, useThemedStyles, type AppTheme } from "../../theme";
import {
  EVENT_TYPE_COLORS,
  EventCalendarDay,
  toDateKey,
} from "../../services/eventService";

interface Props {
  /** 当前展示的月份（任意一天即可，取 year/month） */
  month: Date;
  days: EventCalendarDay[];
  selectedDate: string | null;
  loading?: boolean;
  onSelectDate: (dateKey: string, day: EventCalendarDay | undefined) => void;
  onChangeMonth: (next: Date) => void;
}

const CELL = 40;
const CIRCLE = 32;

const buildGrid = (month: Date) => {
  const year = month.getFullYear();
  const m = month.getMonth();
  const first = new Date(year, m, 1);
  const startOffset = first.getDay(); // 周日起
  const daysInMonth = new Date(year, m + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, m, d));
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
};

/**
 * 分色圆圈：1 个类型 → 纯色；2+ 个类型 → 左右各半（最多取前两种）。
 */
const TypeCircle: React.FC<{ types: string[]; ringColor?: string }> = ({ types, ringColor }) => {
  const colors = types.slice(0, 2).map((t) => EVENT_TYPE_COLORS[t as keyof typeof EVENT_TYPE_COLORS] ?? "#999");
  return (
    <View
      style={[
        styles.circle,
        ringColor ? { borderWidth: 2, borderColor: ringColor } : null,
      ]}
    >
      {colors.length <= 1 ? (
        <View style={[styles.circleFill, { backgroundColor: colors[0] ?? "#999" }]} />
      ) : (
        <View style={styles.halves}>
          <View style={[styles.half, { backgroundColor: colors[0] }]} />
          <View style={[styles.half, { backgroundColor: colors[1] }]} />
        </View>
      )}
    </View>
  );
};

export const EventCalendar: React.FC<Props> = ({
  month,
  days,
  selectedDate,
  loading = false,
  onSelectDate,
  onChangeMonth,
}) => {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const s = useThemedStyles(makeStyles);

  const rows = useMemo(() => buildGrid(month), [month]);
  const dayMap = useMemo(() => {
    const map: Record<string, EventCalendarDay> = {};
    for (const d of days) map[d.date] = d;
    return map;
  }, [days]);
  const todayKey = toDateKey(new Date());

  // 逗号分隔的 7 个星期简称（周日起），见 locales events.weekdays
  const weekdays = t("events.weekdays").split(",");
  const monthLabel = t("events.monthLabel", {
    year: month.getFullYear(),
    month: month.getMonth() + 1,
  });

  const shift = (delta: number) =>
    onChangeMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1));

  return (
    <View style={s.container}>
      {/* 月份切换 */}
      <View style={s.header}>
        <Pressable onPress={() => shift(-1)} hitSlop={8} p="$xs">
          <Ionicons name="chevron-back" size={18} color={theme.colors.text} />
        </Pressable>
        <View style={s.headerCenter}>
          <Text fontSize="$md" fontWeight="$semibold" style={{ color: theme.colors.text }}>
            {monthLabel}
          </Text>
          {loading && <ActivityIndicator size="small" color={theme.colors.gray300} style={{ marginLeft: 8 }} />}
        </View>
        <Pressable onPress={() => shift(1)} hitSlop={8} p="$xs">
          <Ionicons name="chevron-forward" size={18} color={theme.colors.text} />
        </Pressable>
      </View>

      {/* 星期 */}
      <View style={s.row}>
        {(weekdays.length === 7 ? weekdays : ["日", "一", "二", "三", "四", "五", "六"]).map((w, i) => (
          <View key={i} style={s.cell}>
            <Text fontSize="$xs" style={{ color: theme.colors.gray300 }}>
              {w}
            </Text>
          </View>
        ))}
      </View>

      {/* 日期格 */}
      {rows.map((row, ri) => (
        <View key={ri} style={s.row}>
          {row.map((date, ci) => {
            if (!date) return <View key={ci} style={s.cell} />;
            const key = toDateKey(date);
            const info = dayMap[key];
            const hasEvents = !!info && info.eventIds.length > 0;
            const isSelected = selectedDate === key;
            const isToday = key === todayKey;
            const marked = !!info && (info.hasFavorite || info.hasReserved);
            const textColor = hasEvents
              ? "#FFFFFF"
              : isToday
                ? theme.colors.text
                : theme.colors.textSecondary;
            return (
              <Pressable
                key={ci}
                style={s.cell}
                disabled={!hasEvents}
                onPress={() => onSelectDate(key, info)}
              >
                <View style={s.cellInner}>
                  {hasEvents && (
                    <TypeCircle
                      types={info!.eventTypes}
                      ringColor={marked ? theme.colors.text : isSelected ? theme.colors.gray200 : undefined}
                    />
                  )}
                  {!hasEvents && isToday && <View style={[s.todayRing, { borderColor: theme.colors.gray200 }]} />}
                  <Text
                    fontSize="$sm"
                    fontWeight={isToday || hasEvents ? "$semibold" : "$normal"}
                    style={{ color: textColor }}
                  >
                    {date.getDate()}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}

      {/* 图例 */}
      <View style={s.legend}>
        {(Object.keys(EVENT_TYPE_COLORS) as (keyof typeof EVENT_TYPE_COLORS)[]).map((k) => (
          <View key={k} style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: EVENT_TYPE_COLORS[k] }]} />
            <Text fontSize={11} style={{ color: theme.colors.gray300 }}>
              {t(`events.type.${k}`)}
            </Text>
          </View>
        ))}
        <View style={s.legendItem}>
          <View style={[s.legendRing, { borderColor: theme.colors.text }]} />
          <Text fontSize={11} style={{ color: theme.colors.gray300 }}>
            {t("events.legendMarked")}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  circle: {
    position: "absolute",
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    overflow: "hidden",
  },
  circleFill: { flex: 1 },
  halves: { flex: 1, flexDirection: "row" },
  half: { flex: 1 },
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: {
      paddingHorizontal: 12,
      paddingTop: 8,
      paddingBottom: 12,
      backgroundColor: t.colors.card,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 4,
      marginBottom: 6,
    },
    headerCenter: { flexDirection: "row", alignItems: "center" },
    row: { flexDirection: "row" },
    cell: {
      flex: 1,
      height: CELL,
      alignItems: "center",
      justifyContent: "center",
    },
    cellInner: {
      width: CIRCLE,
      height: CIRCLE,
      alignItems: "center",
      justifyContent: "center",
    },
    todayRing: {
      position: "absolute",
      width: CIRCLE,
      height: CIRCLE,
      borderRadius: CIRCLE / 2,
      borderWidth: 1,
    },
    legend: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
      marginTop: 10,
      paddingHorizontal: 4,
    },
    legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendRing: { width: 8, height: 8, borderRadius: 4, borderWidth: 1.5 },
  });

export default EventCalendar;
