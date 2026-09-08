/**
 * 活动列表卡片（近期活动 / 活动回顾 / 我的收藏）
 * 左封面 + 标题 + 时间 + 地点 + 类型徽标；参考 PRD 「活动日历」原型图。
 */
import React from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Pressable, Text } from "../../components/ui";
import { OptimizedImage } from "../../components/ui/OptimizedImage";
import { ImageSize } from "../../utils/imageUtils";
import { useAppTheme, useThemedStyles, type AppTheme } from "../../theme";
import { EventSummary, EVENT_TYPE_COLORS, formatEventTimeRange, isEventEnded } from "../../services/eventService";
import { useResolvedEvent } from "../../store/eventInteractionStore";
import EventTypeBadge from "./EventTypeBadge";

interface Props {
  event: EventSummary;
  onPress: (event: EventSummary) => void;
  /** 显示「回顾」角标 */
  reviewMode?: boolean;
}

export const EventCard: React.FC<Props> = ({ event, onPress, reviewMode = false }) => {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const s = useThemedStyles(makeStyles);
  const resolved = useResolvedEvent(event);
  const time = formatEventTimeRange(resolved.startAt, resolved.endAt);
  const ended = reviewMode || isEventEnded(resolved);
  const place = resolved.isOnline
    ? t("events.online")
    : [resolved.city, resolved.locationName].filter(Boolean).join(" · ");

  return (
    <Pressable onPress={() => onPress(resolved)} style={s.card}>
      <View style={s.cover}>
        {resolved.coverImage ? (
          <OptimizedImage uri={resolved.coverImage} size={ImageSize.THUMBNAIL} style={s.coverImg} contentFit="cover" lazy />
        ) : (
          <View style={[s.coverImg, s.coverPlaceholder]}>
            <Ionicons name="calendar-outline" size={20} color={theme.colors.gray200} />
          </View>
        )}
        <View style={[s.typeStripe, { backgroundColor: EVENT_TYPE_COLORS[resolved.eventType] }]} />
      </View>
      <View style={s.body}>
        <View style={s.titleRow}>
          <Text fontSize="$sm" fontWeight="$semibold" numberOfLines={1} style={[s.title, { color: theme.colors.text }]}>
            {resolved.title}
          </Text>
          {ended && (
            <View style={[s.tag, { borderColor: theme.colors.gray200 }]}>
              <Text fontSize={10} style={{ color: theme.colors.gray300 }}>
                {t("events.reviewTag")}
              </Text>
            </View>
          )}
        </View>
        <Text fontSize="$xs" style={{ color: theme.colors.textSecondary, marginTop: 2 }} numberOfLines={1}>
          {time.date}
          {time.sameDay ? `  ${time.time}` : ""}
        </Text>
        <View style={s.metaRow}>
          <EventTypeBadge type={resolved.eventType} />
          {!!place && (
            <Text fontSize="$xs" style={{ color: theme.colors.gray300, marginLeft: 8, flex: 1 }} numberOfLines={1}>
              {place}
            </Text>
          )}
        </View>
      </View>
      <View style={s.right}>
        {resolved.isFavorited && <Ionicons name="bookmark" size={14} color={theme.colors.text} />}
        {resolved.isReserved && !ended && (
          <Ionicons name="notifications" size={14} color={theme.colors.text} style={{ marginTop: 4 }} />
        )}
      </View>
    </Pressable>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    card: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
      paddingHorizontal: 16,
      backgroundColor: t.colors.card,
    },
    cover: { width: 64, height: 64, borderRadius: 4, overflow: "hidden", position: "relative" },
    coverImg: { width: 64, height: 64 },
    coverPlaceholder: {
      backgroundColor: t.colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    typeStripe: { position: "absolute", left: 0, top: 0, bottom: 0, width: 3 },
    body: { flex: 1, marginLeft: 12 },
    titleRow: { flexDirection: "row", alignItems: "center" },
    title: { flex: 1 },
    tag: {
      marginLeft: 6,
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderWidth: 1,
      borderRadius: 4,
    },
    metaRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
    right: { width: 20, alignItems: "center", marginLeft: 8 },
  });

export default EventCard;
