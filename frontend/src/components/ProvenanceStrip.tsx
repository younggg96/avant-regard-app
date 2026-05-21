/**
 * PRD 3.1 · Provenance Strip 横向时间轴组件。
 *
 * 用法：在商品详情屏顶部展示该 listing 的履历事件。
 */
import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet } from "react-native";

import { Box, Text, VStack } from "./ui";
import { useThemedStyles, type AppTheme } from "../theme";
import {
  getProductProvenance,
  type ProvenanceEvent,
} from "../services/tradingExtrasService";

const TYPE_LABEL: Record<string, string> = {
  origin_show: "品牌秀场",
  merchant_acquired: "买手店入手",
  collector_owned: "藏家持有",
  on_sale_now: "正在售出",
  sold: "成交",
  resale: "转卖",
};

const ProvenanceStrip: React.FC<{ productId: number }> = ({ productId }) => {
  const styles = useThemedStyles(makeStyles);
  const [events, setEvents] = useState<ProvenanceEvent[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getProductProvenance(productId)
      .then((list) => {
        if (!cancelled) setEvents(list);
      })
      .catch(() => {
        if (!cancelled) setEvents([]);
      });
    return () => {
      cancelled = true;
    };
  }, [productId]);

  if (!events || events.length === 0) return null;

  return (
    <Box style={styles.container}>
      <Text style={styles.title}>履历</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.stripContent}
      >
        {events.map((e, i) => (
          <VStack key={e.id} style={styles.node} space="xs">
            <Box style={styles.dot} />
            {i < events.length - 1 && <Box style={styles.line} />}
            <Text style={styles.eventLabel}>
              {TYPE_LABEL[e.eventType] ?? e.eventType}
            </Text>
            {e.occurredAt && (
              <Text style={styles.eventDate}>{e.occurredAt}</Text>
            )}
            {e.description && (
              <Text style={styles.eventDesc} numberOfLines={2}>
                {e.description}
              </Text>
            )}
          </VStack>
        ))}
      </ScrollView>
    </Box>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: t.colors.surface,
      borderRadius: 8,
      marginHorizontal: 12,
      marginVertical: 8,
    },
    title: {
      fontSize: 14,
      fontWeight: "600",
      color: t.colors.text,
      marginBottom: 8,
    },
    stripContent: { paddingVertical: 4 },
    node: {
      width: 120,
      marginRight: 12,
    },
    dot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: t.colors.accent,
    },
    line: {
      position: "absolute",
      top: 5,
      left: 10,
      width: 110,
      height: 1,
      backgroundColor: t.colors.border,
    },
    eventLabel: { fontSize: 13, color: t.colors.text, fontWeight: "600" },
    eventDate: { fontSize: 11, color: t.colors.textSecondary },
    eventDesc: { fontSize: 12, color: t.colors.textSecondary },
  });

export default ProvenanceStrip;
