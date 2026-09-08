import React from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Text } from "../../components/ui";
import { useAppTheme } from "../../theme";
import { EVENT_TYPE_COLORS, EventType } from "../../services/eventService";

interface Props {
  type: EventType;
  size?: "sm" | "md";
  /** 只显示色点，不显示文字 */
  dotOnly?: boolean;
}

/**
 * 活动类型徽标：色点 + 类型名。五类分色是日历 / 地图上唯一的语义色。
 */
export const EventTypeBadge: React.FC<Props> = ({ type, size = "sm", dotOnly = false }) => {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const color = EVENT_TYPE_COLORS[type] ?? theme.colors.gray300;
  const dot = size === "sm" ? 6 : 8;
  return (
    <View style={styles.row}>
      <View style={{ width: dot, height: dot, borderRadius: dot / 2, backgroundColor: color }} />
      {!dotOnly && (
        <Text
          fontSize={size === "sm" ? "$xs" : "$sm"}
          style={{ color: theme.colors.textSecondary, marginLeft: 4 }}
        >
          {t(`events.type.${type}`)}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
});

export default EventTypeBadge;
