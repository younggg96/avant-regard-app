/**
 * 活动列表页：近期活动 / 活动回顾 / 我收藏的活动 / 我预约的活动。
 * 从论坛日历 Tab 的「更多」或「我 → 收藏 → 活动」进入。
 */
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { Pressable, Text } from "../../components/ui";
import ScreenHeader from "../../components/ScreenHeader";
import { useAppTheme, useThemedStyles, type AppTheme } from "../../theme";
import {
  EventSummary,
  EventType,
  EVENT_TYPES,
  getEventReviews,
  getMyFavoriteEvents,
  getMyReservedEvents,
  getUpcomingEvents,
} from "../../services/eventService";
import { useEventInteractionStore } from "../../store/eventInteractionStore";
import EventCard from "./EventCard";
import EventTypeBadge from "./EventTypeBadge";

export type EventListMode = "upcoming" | "reviews" | "favorites" | "reservations";

type RouteParams = { EventList: { mode: EventListMode } };

const PAGE_SIZE = 20;

const EventListScreen: React.FC = () => {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const s = useThemedStyles(makeStyles);
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, "EventList">>();
  const mode = route.params?.mode ?? "upcoming";
  const syncFromEvents = useEventInteractionStore((st) => st.syncFromEvents);

  const [items, setItems] = useState<EventSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [typeFilter, setTypeFilter] = useState<EventType | null>(null);

  const fetchPage = useCallback(
    async (p: number) => {
      const params = { page: p, pageSize: PAGE_SIZE };
      switch (mode) {
        case "reviews":
          return getEventReviews(params);
        case "favorites":
          return getMyFavoriteEvents(params);
        case "reservations":
          return getMyReservedEvents(params);
        default:
          return getUpcomingEvents({ ...params, eventType: typeFilter ?? undefined });
      }
    },
    [mode, typeFilter],
  );

  const load = useCallback(
    async (p: number, replace: boolean) => {
      setLoading(true);
      try {
        const res = await fetchPage(p);
        setItems((prev) => (replace ? res.items : [...prev, ...res.items]));
        setTotal(res.total);
        setPage(p);
        syncFromEvents(res.items);
      } catch (e) {
        console.warn("[events] list failed", e);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [fetchPage, syncFromEvents],
  );

  useEffect(() => {
    load(1, true);
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load(1, true);
  }, [load]);

  const title = t(`events.listTitle.${mode}`);

  const openDetail = (e: EventSummary) => navigation.navigate("EventDetail", { eventId: e.id });

  return (
    <SafeAreaView style={s.container} edges={["top"]}>
      <ScreenHeader title={title} showBack />
      {mode === "upcoming" && (
        <View style={s.filterRow}>
          <Pressable
            onPress={() => setTypeFilter(null)}
            style={[s.chip, { borderColor: theme.colors.text, backgroundColor: typeFilter === null ? theme.colors.text : theme.colors.card }]}
          >
            <Text fontSize="$xs" style={{ color: typeFilter === null ? theme.colors.textInverted : theme.colors.text }}>
              {t("common.all")}
            </Text>
          </Pressable>
          {EVENT_TYPES.map((tp) => (
            <Pressable
              key={tp}
              onPress={() => setTypeFilter(tp)}
              style={[s.chip, { borderColor: typeFilter === tp ? theme.colors.text : theme.colors.divider, backgroundColor: theme.colors.card }]}
            >
              <EventTypeBadge type={tp} />
            </Pressable>
          ))}
        </View>
      )}
      <FlatList
        data={items}
        keyExtractor={(e) => String(e.id)}
        renderItem={({ item }) => <EventCard event={item} onPress={openDetail} reviewMode={mode === "reviews"} />}
        ItemSeparatorComponent={() => <View style={[s.sep, { backgroundColor: theme.colors.divider }]} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.accent} />}
        onEndReached={() => {
          if (!loading && items.length < total) load(page + 1, false);
        }}
        onEndReachedThreshold={0.4}
        ListFooterComponent={loading && items.length > 0 ? <ActivityIndicator style={{ padding: 16 }} color={theme.colors.gray300} /> : null}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={{ padding: 40 }} color={theme.colors.gray300} />
          ) : (
            <View style={s.empty}>
              <Ionicons name="calendar-clear-outline" size={40} color={theme.colors.gray200} />
              <Text fontSize="$sm" style={{ color: theme.colors.gray300, marginTop: 12 }}>
                {t(`events.listEmpty.${mode}`)}
              </Text>
            </View>
          )
        }
        contentContainerStyle={{ paddingBottom: 24 }}
      />
    </SafeAreaView>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.colors.background },
    filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
    chip: { height: 28, paddingHorizontal: 10, borderRadius: 4, borderWidth: 1, alignItems: "center", justifyContent: "center" },
    sep: { height: 1, marginLeft: 92 },
    empty: { alignItems: "center", paddingVertical: 60 },
  });

export default EventListScreen;
