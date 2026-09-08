/**
 * 点击日历上有活动的日期后弹出的活动卡片（PRD 3.2）：
 *  - 仅展示标题 + 时间 + 地点，附收藏 / 预约按钮
 *  - 点击底部「查看详情」banner → 活动详情页
 *  - 点击卡片以外任何地方、或右上角 × → 收起
 */
import React from "react";
import { Modal, ScrollView, StyleSheet, TouchableWithoutFeedback, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Pressable, Text } from "../../components/ui";
import { OptimizedImage } from "../../components/ui/OptimizedImage";
import { ImageSize } from "../../utils/imageUtils";
import { useAppTheme, useThemedStyles, type AppTheme } from "../../theme";
import { EventSummary, formatEventTimeRange } from "../../services/eventService";
import EventTypeBadge from "./EventTypeBadge";
import EventActionButtons from "./EventActionButtons";

interface Props {
  visible: boolean;
  dateKey: string | null;
  events: EventSummary[];
  onClose: () => void;
  onOpenDetail: (event: EventSummary) => void;
}

const EventRow: React.FC<{ event: EventSummary; onOpenDetail: (e: EventSummary) => void; last: boolean }> = ({
  event,
  onOpenDetail,
  last,
}) => {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const s = useThemedStyles(makeStyles);
  const time = formatEventTimeRange(event.startAt, event.endAt);
  const place = event.isOnline
    ? t("events.online")
    : [event.city, event.locationName].filter(Boolean).join(" · ");
  return (
    <View style={[s.item, !last && { borderBottomWidth: 1, borderBottomColor: theme.colors.divider }]}>
      <View style={s.itemHead}>
        {event.coverImage ? (
          <OptimizedImage uri={event.coverImage} size={ImageSize.THUMBNAIL} style={s.thumb} contentFit="cover" />
        ) : (
          <View style={[s.thumb, { backgroundColor: theme.colors.surface }]} />
        )}
        <View style={{ flex: 1 }}>
          <Text fontSize="$md" fontWeight="$semibold" numberOfLines={2} style={{ color: theme.colors.text }}>
            {event.title}
          </Text>
          <View style={s.metaLine}>
            <Ionicons name="time-outline" size={13} color={theme.colors.gray300} />
            <Text fontSize="$xs" style={{ color: theme.colors.textSecondary, marginLeft: 4 }}>
              {time.date}
              {time.sameDay ? `  ${time.time}` : ""}
            </Text>
          </View>
          {!!place && (
            <View style={s.metaLine}>
              <Ionicons name="location-outline" size={13} color={theme.colors.gray300} />
              <Text fontSize="$xs" style={{ color: theme.colors.textSecondary, marginLeft: 4 }} numberOfLines={1}>
                {place}
              </Text>
            </View>
          )}
          <View style={{ marginTop: 4 }}>
            <EventTypeBadge type={event.eventType} />
          </View>
        </View>
      </View>
      <View style={s.actions}>
        <EventActionButtons event={event} size="sm" fullWidth />
      </View>
      {/* 查看详情 banner */}
      <Pressable onPress={() => onOpenDetail(event)} style={[s.detailBanner, { backgroundColor: theme.colors.text }]}>
        <Text fontSize="$sm" fontWeight="$semibold" style={{ color: theme.colors.textInverted }}>
          {t("events.viewDetail")}
        </Text>
        <Ionicons name="arrow-forward" size={14} color={theme.colors.textInverted} />
      </Pressable>
    </View>
  );
};

export const EventDayPopup: React.FC<Props> = ({ visible, dateKey, events, onClose, onOpenDetail }) => {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const s = useThemedStyles(makeStyles);

  const dateLabel = (() => {
    if (!dateKey) return "";
    const [y, m, d] = dateKey.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    const weekdays = t("events.weekdays").split(",");
    const wd = weekdays.length === 7 ? weekdays[date.getDay()] : "";
    return t("events.dayTitle", { month: m, day: d, weekday: wd });
  })();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>
        <View style={s.card}>
          <View style={s.header}>
            <Text fontSize="$md" fontWeight="$semibold" style={{ color: theme.colors.text }}>
              {dateLabel}
            </Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={20} color={theme.colors.text} />
            </Pressable>
          </View>
          <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
            {events.map((e, i) => (
              <EventRow key={e.id} event={e} onOpenDetail={onOpenDetail} last={i === events.length - 1} />
            ))}
            {events.length === 0 && (
              <Text fontSize="$sm" style={{ color: theme.colors.gray300, padding: 16 }}>
                {t("events.noEventsThatDay")}
              </Text>
            )}
          </ScrollView>
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
      justifyContent: "center",
      paddingHorizontal: 20,
    },
    card: {
      backgroundColor: t.colors.card,
      borderRadius: 8,
      overflow: "hidden",
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: t.colors.divider,
    },
    item: { paddingHorizontal: 16, paddingVertical: 14 },
    itemHead: { flexDirection: "row", gap: 12 },
    thumb: { width: 72, height: 72, borderRadius: 4 },
    metaLine: { flexDirection: "row", alignItems: "center", marginTop: 4 },
    actions: { marginTop: 12 },
    detailBanner: {
      marginTop: 10,
      height: 40,
      borderRadius: 4,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    },
  });

export default EventDayPopup;
