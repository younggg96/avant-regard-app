/**
 * 论坛 Tab · 「活动日历」子 Tab 的头部内容（PRD 第 2 / 3 节）：
 *
 *   展开式时装日历 → 近期活动（点击更多进入列表）→ 活动回顾（点击进入详情）
 *   → 下方接现有论坛帖子流（由父 FlatList 渲染）
 *
 * 数据自取（日历 / 近期 / 回顾三路接口），通过 `refreshSignal` 响应父级下拉刷新。
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import { Pressable, Text } from "../../components/ui";
import { useAppTheme, useThemedStyles, type AppTheme } from "../../theme";
import {
  EventCalendarDay,
  EventSummary,
  getEventCalendar,
  getEventReviews,
  getUpcomingEvents,
  toMonthKey,
} from "../../services/eventService";
import { useEventInteractionStore } from "../../store/eventInteractionStore";
import EventCalendar from "./EventCalendar";
import EventDayPopup from "./EventDayPopup";
import EventCard from "./EventCard";

interface Props {
  refreshSignal?: number;
  /** 是否显示尾部「活动相关帖子」小标题（父级帖子流非空时） */
  showPostsHeading?: boolean;
}

const UPCOMING_LIMIT = 5;
const REVIEW_LIMIT = 3;

const SectionHeader: React.FC<{ title: string; onMore?: () => void }> = ({ title, onMore }) => {
  const { t } = useTranslation();
  const theme = useAppTheme();
  return (
    <View style={sectionStyles.header}>
      <Text fontSize="$md" fontWeight="$semibold" style={{ color: theme.colors.text }}>
        {title}
      </Text>
      {onMore && (
        <Pressable onPress={onMore} hitSlop={8} style={sectionStyles.more}>
          <Text fontSize="$sm" style={{ color: theme.colors.gray500 }}>
            {t("common.more")}
          </Text>
          <Ionicons name="chevron-forward" size={14} color={theme.colors.gray500} />
        </Pressable>
      )}
    </View>
  );
};

const sectionStyles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 6,
  },
  more: { flexDirection: "row", alignItems: "center" },
});

export const ForumCalendarSection: React.FC<Props> = ({ refreshSignal = 0, showPostsHeading = true }) => {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const s = useThemedStyles(makeStyles);
  const navigation = useNavigation();
  const syncFromEvents = useEventInteractionStore((st) => st.syncFromEvents);
  const flags = useEventInteractionStore((st) => st.flags);

  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [days, setDays] = useState<EventCalendarDay[]>([]);
  const [monthEvents, setMonthEvents] = useState<EventSummary[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);

  const [upcoming, setUpcoming] = useState<EventSummary[]>([]);
  const [reviews, setReviews] = useState<EventSummary[]>([]);
  const [listsLoading, setListsLoading] = useState(false);
  const [listsLoaded, setListsLoaded] = useState(false);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [popupVisible, setPopupVisible] = useState(false);

  const loadCalendar = useCallback(async (m: Date) => {
    setCalendarLoading(true);
    try {
      const res = await getEventCalendar(toMonthKey(m));
      setDays(res.days);
      setMonthEvents(res.events);
      syncFromEvents(res.events);
    } catch (e) {
      console.warn("[events] calendar load failed", e);
    } finally {
      setCalendarLoading(false);
    }
  }, [syncFromEvents]);

  const loadLists = useCallback(async () => {
    setListsLoading(true);
    try {
      const [u, r] = await Promise.all([
        getUpcomingEvents({ page: 1, pageSize: UPCOMING_LIMIT }),
        getEventReviews({ page: 1, pageSize: REVIEW_LIMIT }),
      ]);
      setUpcoming(u.items);
      setReviews(r.items);
      syncFromEvents([...u.items, ...r.items]);
    } catch (e) {
      console.warn("[events] lists load failed", e);
    } finally {
      setListsLoading(false);
      setListsLoaded(true);
    }
  }, [syncFromEvents]);

  useEffect(() => {
    loadCalendar(month);
  }, [month, loadCalendar, refreshSignal]);

  useEffect(() => {
    loadLists();
  }, [loadLists, refreshSignal]);

  // 收藏 / 预约在别处切换后，日历上的「已标记」外环要跟着变
  const daysWithFlags = useMemo(() => {
    if (!Object.keys(flags).length) return days;
    return days.map((d) => {
      let hasFavorite = false;
      let hasReserved = false;
      for (const id of d.eventIds) {
        const f = flags[id];
        const ev = monthEvents.find((e) => e.id === id);
        hasFavorite = hasFavorite || (f?.isFavorited ?? ev?.isFavorited ?? false);
        hasReserved = hasReserved || (f?.isReserved ?? ev?.isReserved ?? false);
      }
      return { ...d, hasFavorite, hasReserved };
    });
  }, [days, flags, monthEvents]);

  const selectedEvents = useMemo(() => {
    if (!selectedDate) return [];
    const day = days.find((d) => d.date === selectedDate);
    if (!day) return [];
    const set = new Set(day.eventIds);
    return monthEvents.filter((e) => set.has(e.id));
  }, [selectedDate, days, monthEvents]);

  const handleSelectDate = useCallback((key: string, day: EventCalendarDay | undefined) => {
    if (!day || day.eventIds.length === 0) return;
    setSelectedDate(key);
    setPopupVisible(true);
  }, []);

  const openDetail = useCallback(
    (event: EventSummary) => {
      setPopupVisible(false);
      (navigation.navigate as any)("EventDetail", { eventId: event.id });
    },
    [navigation],
  );

  const openList = useCallback(
    (mode: "upcoming" | "reviews") => {
      (navigation.navigate as any)("EventList", { mode });
    },
    [navigation],
  );

  return (
    <View style={s.container}>
      <EventCalendar
        month={month}
        days={daysWithFlags}
        selectedDate={selectedDate}
        loading={calendarLoading}
        onSelectDate={handleSelectDate}
        onChangeMonth={setMonth}
      />

      <View style={s.divider} />

      {/* 近期活动 */}
      <SectionHeader title={t("events.upcoming")} onMore={upcoming.length > 0 ? () => openList("upcoming") : undefined} />
      {listsLoading && !listsLoaded ? (
        <View style={s.loadingRow}>
          <ActivityIndicator size="small" color={theme.colors.gray300} />
        </View>
      ) : upcoming.length === 0 ? (
        <Text fontSize="$sm" style={[s.emptyText, { color: theme.colors.gray300 }]}>
          {t("events.noUpcoming")}
        </Text>
      ) : (
        upcoming.map((e) => <EventCard key={e.id} event={e} onPress={openDetail} />)
      )}

      {/* 活动回顾：放在近期活动板块下方（PRD 3.4） */}
      {reviews.length > 0 && (
        <>
          <View style={s.divider} />
          <SectionHeader title={t("events.reviews")} onMore={() => openList("reviews")} />
          {reviews.map((e) => (
            <EventCard key={e.id} event={e} onPress={openDetail} reviewMode />
          ))}
        </>
      )}

      {showPostsHeading && (
        <>
          <View style={s.divider} />
          <SectionHeader title={t("events.relatedPosts")} />
        </>
      )}

      <EventDayPopup
        visible={popupVisible}
        dateKey={selectedDate}
        events={selectedEvents}
        onClose={() => setPopupVisible(false)}
        onOpenDetail={openDetail}
      />
    </View>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: { backgroundColor: t.colors.card },
    divider: { height: 1, backgroundColor: t.colors.divider, marginHorizontal: 16 },
    loadingRow: { paddingVertical: 20, alignItems: "center" },
    emptyText: { paddingHorizontal: 16, paddingVertical: 14 },
  });

export default ForumCalendarSection;
