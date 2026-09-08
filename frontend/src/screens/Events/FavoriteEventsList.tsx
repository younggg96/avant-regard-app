/**
 * 「我 → 收藏 → 活动」子分支（PRD 3.3：用户主页收藏夹需要新增一个「活动」Tab）
 * 只展示收藏的活动；顶部提供「我预约的活动」入口。
 */
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useNavigation, useFocusEffect } from "@react-navigation/native";

import { Pressable, Text } from "../../components/ui";
import { useAppTheme, useThemedStyles, type AppTheme } from "../../theme";
import { EventSummary, getMyFavoriteEvents } from "../../services/eventService";
import { useEventInteractionStore } from "../../store/eventInteractionStore";
import EventCard from "./EventCard";

interface Props {
  /** 收藏总数回传，供父级 chip 计数 */
  onCount?: (n: number) => void;
}

export const FavoriteEventsList: React.FC<Props> = ({ onCount }) => {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const s = useThemedStyles(makeStyles);
  const navigation = useNavigation<any>();
  const syncFromEvents = useEventInteractionStore((st) => st.syncFromEvents);
  const flags = useEventInteractionStore((st) => st.flags);

  const [items, setItems] = useState<EventSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getMyFavoriteEvents({ page: 1, pageSize: 50 });
      setItems(res.items);
      setTotal(res.total);
      syncFromEvents(res.items);
      onCount?.(res.total);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, [syncFromEvents, onCount]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // 在别处取消收藏后，从本列表即时移除
  useEffect(() => {
    setItems((prev) => {
      const next = prev.filter((e) => flags[e.id]?.isFavorited !== false);
      if (next.length !== prev.length) onCount?.(next.length);
      return next;
    });
  }, [flags, onCount]);

  const openDetail = (e: EventSummary) => navigation.navigate("EventDetail", { eventId: e.id });

  return (
    <View>
      <Pressable
        onPress={() => navigation.navigate("EventList", { mode: "reservations" })}
        style={[s.reservedRow, { borderBottomColor: theme.colors.divider }]}
      >
        <Ionicons name="notifications-outline" size={16} color={theme.colors.text} />
        <Text fontSize="$sm" style={{ color: theme.colors.text, flex: 1, marginLeft: 8 }}>
          {t("events.myReservations")}
        </Text>
        <Ionicons name="chevron-forward" size={16} color={theme.colors.gray300} />
      </Pressable>

      {loading && !loaded ? (
        <ActivityIndicator style={{ padding: 32 }} color={theme.colors.gray300} />
      ) : items.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="bookmark-outline" size={24} color={theme.colors.gray300} />
          <Text fontSize="$sm" style={{ color: theme.colors.gray400, marginTop: 12, textAlign: "center" }}>
            {t("events.listEmpty.favorites")}
          </Text>
        </View>
      ) : (
        <>
          {items.map((e) => (
            <EventCard key={e.id} event={e} onPress={openDetail} />
          ))}
          {total > items.length && (
            <Pressable onPress={() => navigation.navigate("EventList", { mode: "favorites" })} style={s.more}>
              <Text fontSize="$sm" style={{ color: theme.colors.gray300 }}>
                {t("common.viewAll")}
              </Text>
            </Pressable>
          )}
        </>
      )}
    </View>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    reservedRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
    },
    empty: { alignItems: "center", justifyContent: "center", paddingVertical: 40, minHeight: 200 },
    more: { alignItems: "center", paddingVertical: 14 },
  });

export default FavoriteEventsList;
