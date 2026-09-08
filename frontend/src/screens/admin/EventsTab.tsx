/**
 * 管理后台 · 活动管理（PRD 3 节 P0）
 * 列表 + 新建 / 编辑 / 删除 / 快速切换状态 / 手动触发调度（到期转回顾 + 提醒）。
 */
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useNavigation, useFocusEffect } from "@react-navigation/native";

import { Pressable, Text } from "../../components/ui";
import { OptimizedImage } from "../../components/ui/OptimizedImage";
import { ImageSize } from "../../utils/imageUtils";
import { useAppTheme, useThemedStyles, type AppTheme } from "../../theme";
import { Alert } from "../../utils/Alert";
import { request } from "../../services/http";
import {
  EventStatus,
  EventSummary,
  adminDeleteEvent,
  adminListEvents,
  adminUpdateEvent,
  formatEventTimeRange,
} from "../../services/eventService";
import EventTypeBadge from "../Events/EventTypeBadge";

const STATUS_FILTERS: (EventStatus | "ALL")[] = ["ALL", "PUBLISHED", "DRAFT", "ENDED", "HIDDEN"];

const EventsTab: React.FC = () => {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const s = useThemedStyles(makeStyles);
  const navigation = useNavigation<any>();

  const [items, setItems] = useState<EventSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<EventStatus | "ALL">("ALL");

  const load = useCallback(
    async (p: number, replace: boolean) => {
      setLoading(true);
      try {
        const res = await adminListEvents({
          page: p,
          pageSize: 30,
          status: statusFilter === "ALL" ? undefined : statusFilter,
        });
        setItems((prev) => (replace ? res.items : [...prev, ...res.items]));
        setTotal(res.total);
        setPage(p);
      } catch {
        Alert.show(t("common.loadFailed"));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [statusFilter, t],
  );

  useFocusEffect(
    useCallback(() => {
      load(1, true);
    }, [load]),
  );

  const remove = (e: EventSummary) => {
    Alert.alert(t("common.confirmDelete"), e.title, [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: async () => {
          try {
            await adminDeleteEvent(e.id);
            setItems((prev) => prev.filter((x) => x.id !== e.id));
          } catch {
            Alert.show(t("common.deleteFailed"));
          }
        },
      },
    ]);
  };

  const cycleStatus = async (e: EventSummary) => {
    const next: EventStatus = e.status === "PUBLISHED" ? "HIDDEN" : "PUBLISHED";
    try {
      const updated = await adminUpdateEvent(e.id, { status: next });
      setItems((prev) => prev.map((x) => (x.id === e.id ? { ...x, status: updated.status } : x)));
    } catch {
      Alert.show(t("common.operationFailed"));
    }
  };

  const runScheduler = async () => {
    try {
      const res = await request<{ ended: number; reminded: number }>("/api/events/admin/scheduler/run", {
        method: "POST",
        retries: 0,
      });
      Alert.show(t("events.admin.schedulerDone", { ended: res.ended, reminded: res.reminded }));
      load(1, true);
    } catch {
      Alert.show(t("common.operationFailed"));
    }
  };

  return (
    <View style={s.container}>
      {/* 工具栏 */}
      <View style={s.toolbar}>
        <View style={s.filters}>
          {STATUS_FILTERS.map((st) => (
            <Pressable
              key={st}
              onPress={() => setStatusFilter(st)}
              style={[s.chip, { borderColor: theme.colors.text, backgroundColor: statusFilter === st ? theme.colors.text : theme.colors.card }]}
            >
              <Text fontSize={11} style={{ color: statusFilter === st ? theme.colors.textInverted : theme.colors.text }}>
                {st === "ALL" ? t("common.all") : t(`events.status.${st}`)}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={s.toolbarRight}>
          <Pressable onPress={runScheduler} style={[s.iconBtn, { borderColor: theme.colors.divider }]} hitSlop={6}>
            <Ionicons name="refresh-outline" size={16} color={theme.colors.text} />
          </Pressable>
          <Pressable onPress={() => navigation.navigate("AdminEventEditor")} style={[s.newBtn, { backgroundColor: theme.colors.text }]}>
            <Ionicons name="add" size={16} color={theme.colors.textInverted} />
            <Text fontSize="$xs" fontWeight="$semibold" style={{ color: theme.colors.textInverted }}>
              {t("events.admin.new")}
            </Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={items}
        keyExtractor={(e) => String(e.id)}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load(1, true);
            }}
            tintColor={theme.colors.accent}
          />
        }
        onEndReached={() => {
          if (!loading && items.length < total) load(page + 1, false);
        }}
        renderItem={({ item }) => {
          const time = formatEventTimeRange(item.startAt, item.endAt);
          return (
            <View style={[s.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.divider }]}>
              {item.coverImage ? (
                <OptimizedImage uri={item.coverImage} size={ImageSize.THUMBNAIL} style={s.cover} contentFit="cover" />
              ) : (
                <View style={[s.cover, { backgroundColor: theme.colors.surface }]} />
              )}
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text fontSize="$sm" fontWeight="$semibold" numberOfLines={1} style={{ color: theme.colors.text }}>
                  {item.title}
                </Text>
                <Text fontSize={11} style={{ color: theme.colors.textSecondary, marginTop: 2 }}>
                  {time.date}
                  {time.sameDay ? ` ${time.time}` : ""}
                  {item.city ? ` · ${item.city}` : ""}
                </Text>
                <View style={s.metaRow}>
                  <EventTypeBadge type={item.eventType} />
                  <View style={[s.statusTag, { borderColor: theme.colors.divider }]}>
                    <Text fontSize={10} style={{ color: theme.colors.gray300 }}>
                      {t(`events.status.${item.status}`)}
                    </Text>
                  </View>
                  <Text fontSize={10} style={{ color: theme.colors.gray300 }}>
                    ♥ {item.favoriteCount} · ⏰ {item.reservationCount} · 💬 {item.commentCount}
                  </Text>
                </View>
              </View>
              <View style={s.actions}>
                <Pressable onPress={() => navigation.navigate("EventDetail", { eventId: item.id })} hitSlop={6}>
                  <Ionicons name="eye-outline" size={18} color={theme.colors.text} />
                </Pressable>
                <Pressable onPress={() => navigation.navigate("AdminEventEditor", { eventId: item.id })} hitSlop={6}>
                  <Ionicons name="create-outline" size={18} color={theme.colors.text} />
                </Pressable>
                <Pressable onPress={() => cycleStatus(item)} hitSlop={6}>
                  <Ionicons name={item.status === "PUBLISHED" ? "eye-off-outline" : "checkmark-circle-outline"} size={18} color={theme.colors.text} />
                </Pressable>
                <Pressable onPress={() => remove(item)} hitSlop={6}>
                  <Ionicons name="trash-outline" size={18} color={theme.colors.error} />
                </Pressable>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={{ padding: 40 }} color={theme.colors.gray300} />
          ) : (
            <Text fontSize="$sm" style={{ color: theme.colors.gray300, textAlign: "center", padding: 40 }}>
              {t("events.admin.empty")}
            </Text>
          )
        }
        contentContainerStyle={{ padding: 10, paddingBottom: 40 }}
      />
    </View>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: { flex: 1 },
    toolbar: { paddingHorizontal: 10, paddingTop: 8, gap: 8 },
    filters: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    toolbarRight: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
    chip: { height: 26, paddingHorizontal: 9, borderRadius: 4, borderWidth: 1, alignItems: "center", justifyContent: "center" },
    iconBtn: { width: 30, height: 30, borderRadius: 4, borderWidth: 1, alignItems: "center", justifyContent: "center" },
    newBtn: { flexDirection: "row", alignItems: "center", gap: 2, height: 30, paddingHorizontal: 10, borderRadius: 4 },
    card: { flexDirection: "row", alignItems: "center", padding: 10, borderRadius: 4, borderWidth: 1, marginBottom: 8 },
    cover: { width: 56, height: 56, borderRadius: 4 },
    metaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4, flexWrap: "wrap" },
    statusTag: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
    actions: { marginLeft: 8, gap: 10, alignItems: "center" },
  });

export default EventsTab;
