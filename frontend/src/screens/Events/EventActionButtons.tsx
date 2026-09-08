/**
 * 收藏 / 预约 按钮组。PRD 3.1：收藏按钮需要设计得显眼；预约后活动前 2 小时推送提醒。
 * 状态走 eventInteractionStore，跨页面即时同步。
 */
import React, { useCallback } from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Pressable, Text } from "../../components/ui";
import { useAppTheme } from "../../theme";
import { Alert } from "../../utils/Alert";
import { EventSummary, isEventEnded } from "../../services/eventService";
import { useEventInteractionStore, useResolvedEvent } from "../../store/eventInteractionStore";

interface Props {
  event: EventSummary;
  size?: "sm" | "md";
  /** 是否显示计数 */
  showCounts?: boolean;
  /** 横向铺满 */
  fullWidth?: boolean;
}

export const EventActionButtons: React.FC<Props> = ({
  event,
  size = "sm",
  showCounts = false,
  fullWidth = false,
}) => {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const resolved = useResolvedEvent(event);
  const toggleFavorite = useEventInteractionStore((s) => s.toggleFavorite);
  const toggleReservation = useEventInteractionStore((s) => s.toggleReservation);
  const ended = isEventEnded(resolved);

  const onFavorite = useCallback(async () => {
    try {
      const nowFav = await toggleFavorite(event.id);
      Alert.show(nowFav ? t("events.favorited") : t("events.unfavorited"));
    } catch {
      Alert.show(t("common.operationFailed"));
    }
  }, [event.id, toggleFavorite, t]);

  const onReserve = useCallback(async () => {
    if (ended) return;
    try {
      const nowRes = await toggleReservation(event.id);
      Alert.show(nowRes ? t("events.reserved") : t("events.unreserved"), nowRes ? t("events.reservedHint") : undefined);
    } catch {
      Alert.show(t("common.operationFailed"));
    }
  }, [event.id, ended, toggleReservation, t]);

  const h = size === "sm" ? 32 : 40;
  const fs = size === "sm" ? 12 : 14;
  const icon = size === "sm" ? 14 : 16;

  return (
    <View style={[styles.row, fullWidth && { flex: 1 }]}>
      {/* 收藏：显眼 —— 已收藏为黑底白字 */}
      <Pressable
        onPress={onFavorite}
        style={[
          styles.btn,
          { height: h, borderColor: theme.colors.text, backgroundColor: resolved.isFavorited ? theme.colors.text : theme.colors.card },
          fullWidth && { flex: 1 },
        ]}
      >
        <Ionicons
          name={resolved.isFavorited ? "bookmark" : "bookmark-outline"}
          size={icon}
          color={resolved.isFavorited ? theme.colors.textInverted : theme.colors.text}
        />
        <Text fontSize={fs} fontWeight="$semibold" style={{ color: resolved.isFavorited ? theme.colors.textInverted : theme.colors.text }}>
          {resolved.isFavorited ? t("events.favoritedBtn") : t("events.favoriteBtn")}
          {showCounts && resolved.favoriteCount > 0 ? ` ${resolved.favoriteCount}` : ""}
        </Text>
      </Pressable>

      {/* 预约：活动结束后不可预约 */}
      <Pressable
        onPress={onReserve}
        disabled={ended}
        style={[
          styles.btn,
          {
            height: h,
            borderColor: ended ? theme.colors.gray200 : theme.colors.text,
            backgroundColor: theme.colors.card,
            opacity: ended ? 0.5 : 1,
          },
          fullWidth && { flex: 1 },
        ]}
      >
        <Ionicons
          name={resolved.isReserved ? "notifications" : "notifications-outline"}
          size={icon}
          color={ended ? theme.colors.gray300 : theme.colors.text}
        />
        <Text fontSize={fs} fontWeight="$semibold" style={{ color: ended ? theme.colors.gray300 : theme.colors.text }}>
          {ended ? t("events.ended") : resolved.isReserved ? t("events.reservedBtn") : t("events.reserveBtn")}
          {showCounts && !ended && resolved.reservationCount > 0 ? ` ${resolved.reservationCount}` : ""}
        </Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8 },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 4,
  },
});

export default EventActionButtons;
