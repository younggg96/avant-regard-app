/**
 * ThreeViewHistoryScreen —— 三视图生成记录。
 *
 * 成功和失败都列出来，这是刻意的：三视图按次计费、每天有上限，用户点了一次
 * 没拿到图，必须有个地方能看到「为什么」和「这次算不算数」。只展示成功的话，
 * 失败就变成了一次无法解释的额度蒸发，只能来问客服。
 *
 * 一行 = 一次生成（正 / 侧 / 背 三张）。左边是当时的源图，右边是三张结果，
 * 失败的那张显示占位和原因。
 */
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image as RNImage,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { Box, HStack, Pressable, Text } from "../../components/ui";
import ScreenHeader from "../../components/ScreenHeader";
import ImagePreviewModal from "../../components/ImagePreviewModal";
import {
  useAppTheme,
  useThemedStyles,
  type AppTheme,
} from "../../theme";
import {
  getThreeViewHistory,
  type ThreeViewHistoryBatch,
} from "../../services/passportService";

const STATUS_COLOR: Record<
  ThreeViewHistoryBatch["status"],
  (t: AppTheme) => string
> = {
  success: (t) => t.colors.success,
  partial: (t) => t.colors.plusGold,
  failed: (t) => t.colors.error,
};

const ThreeViewHistoryScreen: React.FC = () => {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const { t } = useTranslation();

  const [items, setItems] = useState<ThreeViewHistoryBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<string[] | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getThreeViewHistory(1, 50);
      setItems(res.items);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // 聚焦即刷新：刚生成完返回这页要能立刻看到那一批。
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const viewLabel = (slug: string) =>
    t(`trading.threeViewHistory.view_${slug}`, { defaultValue: slug });

  const renderBatch = ({ item }: { item: ThreeViewHistoryBatch }) => {
    const okUrls = item.views
      .map((v) => v.url)
      .filter((u): u is string => Boolean(u));
    // 同一批里三张的失败原因通常是同一个（key 失效、连不上），
    // 逐张重复一遍是噪音，去重后集中显示。
    const reasons = Array.from(
      new Set(
        item.views
          .map((v) => v.errorMessage)
          .filter((m): m is string => Boolean(m)),
      ),
    );

    return (
      <Box style={styles.card}>
        <HStack style={styles.cardHead}>
          <Text style={styles.time}>
            {new Date(item.createdAt).toLocaleString()}
          </Text>
          <View style={styles.badge}>
            <Text style={[styles.badgeText, { color: STATUS_COLOR[item.status](theme) }]}>
              {item.status === "success"
                ? t("trading.threeViewHistory.statusSuccess")
                : item.status === "partial"
                  ? t("trading.threeViewHistory.statusPartial", {
                      ok: item.okCount,
                      total: item.totalCount,
                    })
                  : t("trading.threeViewHistory.statusFailed")}
            </Text>
          </View>
        </HStack>

        <HStack style={styles.row}>
          <Pressable
            onPress={() => setPreview([item.sourceImageUrl])}
            accessibilityRole="imagebutton"
            accessibilityLabel={t("trading.threeViewHistory.source")}
          >
            <RNImage
              source={{ uri: item.sourceImageUrl }}
              style={styles.source}
            />
            <Text style={styles.caption}>
              {t("trading.threeViewHistory.source")}
            </Text>
          </Pressable>

          <Ionicons
            name="arrow-forward"
            size={14}
            color={theme.colors.gray300}
            style={styles.arrow}
          />

          <HStack style={styles.results}>
            {item.views.map((v) => (
              <View key={v.id}>
                {v.url ? (
                  <Pressable
                    onPress={() => setPreview(okUrls)}
                    accessibilityRole="imagebutton"
                    accessibilityLabel={viewLabel(v.slug)}
                  >
                    <RNImage source={{ uri: v.url }} style={styles.thumb} />
                  </Pressable>
                ) : (
                  <View style={[styles.thumb, styles.thumbFailed]}>
                    <Ionicons
                      name="close"
                      size={16}
                      color={theme.colors.gray300}
                    />
                  </View>
                )}
                <Text style={styles.caption}>{viewLabel(v.slug)}</Text>
              </View>
            ))}
          </HStack>
        </HStack>

        {reasons.length > 0 && (
          <View style={styles.reasons}>
            {reasons.map((r) => (
              <Text key={r} style={styles.reasonText}>
                {r}
              </Text>
            ))}
          </View>
        )}

      </Box>
    );
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      edges={["top"]}
    >
      <ScreenHeader title={t("trading.threeViewHistory.title")} showBack />

      {loading && items.length === 0 ? (
        <Box style={styles.center}>
          <ActivityIndicator color={theme.colors.text} />
        </Box>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(b) => `${b.createdAt}-${b.sourceImageUrl}`}
          renderItem={renderBatch}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={load}
              colors={[theme.colors.accent]}
              tintColor={theme.colors.accent}
            />
          }
          ListEmptyComponent={
            <Box style={styles.center}>
              <Ionicons
                name="sparkles-outline"
                size={32}
                color={theme.colors.gray300}
              />
              <Text style={styles.emptyText}>
                {t("trading.threeViewHistory.empty")}
              </Text>
            </Box>
          }
        />
      )}

      {/* 这些图是用户自己花额度生成的，给下载入口 */}
      <ImagePreviewModal
        visible={preview !== null}
        imageUrls={preview ?? undefined}
        onClose={() => setPreview(null)}
        allowSave
      />
    </SafeAreaView>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    list: { padding: 16, gap: 12, flexGrow: 1 },
    center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingTop: 80 },
    emptyText: { ...t.typography.caption, color: t.colors.gray300 },
    card: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
      borderRadius: t.borderRadius.sm,
      backgroundColor: t.colors.surface,
      padding: 12,
      gap: 10,
    },
    cardHead: { alignItems: "center", justifyContent: "space-between" },
    time: { ...t.typography.caption, color: t.colors.gray300 },
    badge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: t.borderRadius.full,
      backgroundColor: t.colors.gray100,
    },
    badgeText: { fontSize: 11 },
    row: { alignItems: "flex-start", gap: 8 },
    arrow: { marginTop: 24 },
    results: { gap: 6 },
    source: {
      width: 64,
      height: 64,
      borderRadius: t.borderRadius.sm,
      backgroundColor: t.colors.skeleton,
    },
    thumb: {
      width: 56,
      height: 56,
      borderRadius: t.borderRadius.sm,
      backgroundColor: t.colors.skeleton,
    },
    thumbFailed: {
      alignItems: "center",
      justifyContent: "center",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
    },
    caption: {
      fontSize: 10,
      lineHeight: 14,
      color: t.colors.gray300,
      textAlign: "center",
      marginTop: 3,
    },
    reasons: {
      gap: 3,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border,
      paddingTop: 8,
    },
    reasonText: { fontSize: 11, lineHeight: 16, color: t.colors.gray300 },
  });

export default ThreeViewHistoryScreen;
