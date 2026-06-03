/**
 * MyArchiveScreen —— PRD 模块 6 个人时间轴 + PDF p.21 独立上传入口。
 *
 * 视觉：跟随项目设计系统，ScreenHeader / useAppTheme / Box/HStack/Text。
 * 头部右上「+」按钮触发独立上传典藏页 (UploadArchiveItem)。
 */
import React, { useEffect, useState, useCallback } from "react";
import {
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import {
  Box,
  HStack,
  VStack,
  Text,
  Pressable,
  OptimizedImage,
} from "../../components/ui";
import ScreenHeader from "../../components/ScreenHeader";
import { playfairFonts, useAppTheme, useThemedStyles, type AppTheme } from "../../theme";
import { ImageSize } from "../../utils/imageUtils";
import {
  listArchive,
  getArchiveAnalyticsPreview,
  ArchiveItem,
  ArchiveAnalyticsPreview,
} from "../../services/archivePlusService";
import { useFormatPrice } from "../../utils/currency";

const MyArchiveScreen: React.FC = () => {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const formatPrice = useFormatPrice();

  const [items, setItems] = useState<ArchiveItem[]>([]);
  const [analytics, setAnalytics] = useState<ArchiveAnalyticsPreview | null>(
    null,
  );
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [res, a] = await Promise.all([
        listArchive({ pageSize: 50 }),
        getArchiveAnalyticsPreview(),
      ]);
      setItems(res.items);
      setAnalytics(a);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* PDF p.21 · 右上「+」独立上传 */}
      <ScreenHeader
        title={t("trading.archive.headerTitle")}
        showBack
        rightActions={[
          {
            icon: "add",
            style: "ghost",
            onPress: () => navigation.navigate("UploadArchiveItem"),
          },
        ]}
      />

      <FlatList
        data={items}
        keyExtractor={(i) => String(i.id)}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <Box style={{ height: 12 }} />}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={load}
            tintColor={theme.colors.text}
          />
        }
        ListHeaderComponent={
          analytics ? (
            <Box style={styles.analyticsCard}>
              <HStack
                justifyContent="between"
                alignItems="center"
                style={{ marginBottom: 12 }}
              >
                <VStack>
                  <Text style={styles.analyticsLabel}>
                    {t("trading.archive.countLabel")}
                  </Text>
                  <Text style={styles.analyticsValue}>
                    {analytics.totalItems}
                  </Text>
                </VStack>
                <Pressable
                  style={styles.unlockBtn}
                  onPress={() => navigation.navigate("PlusSubscribe")}
                >
                  <Text style={styles.unlockBtnText}>
                    {analytics.locked
                      ? t("trading.archive.unlockAnalytics")
                      : t("trading.archive.viewAnalytics")}
                  </Text>
                </Pressable>
              </HStack>
              <Text style={styles.analyticsLabel}>
                {t("trading.archive.brandBreakdown")}
              </Text>
              <HStack style={styles.brandRow} space="xs">
                {Object.entries(analytics.brandBreakdown).map(([brand, n]) => (
                  <Box key={brand} style={styles.brandChip}>
                    <Text style={styles.brandChipText}>
                      {brand} · {n}
                    </Text>
                  </Box>
                ))}
              </HStack>
            </Box>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() =>
              navigation.navigate("ArchiveDetail", { archiveId: item.id })
            }
          >
            <HStack space="md" alignItems="flex-start">
              {item.photos?.[0] ? (
                <OptimizedImage
                  uri={item.photos[0]}
                  size={ImageSize.THUMBNAIL}
                  style={styles.thumb}
                  contentFit="cover"
                  lazy
                />
              ) : (
                <Box style={[styles.thumb, styles.thumbPlaceholder]}>
                  <Ionicons
                    name="image-outline"
                    size={28}
                    color={theme.colors.gray300}
                  />
                </Box>
              )}
              <VStack flex={1} space="xs">
                <Text style={styles.title} numberOfLines={2}>
                  {item.title ?? t("trading.archive.placeholderTitle")}
                </Text>
                {item.brandName ? (
                  <Text style={styles.muted}>{item.brandName}</Text>
                ) : null}
                <Text style={styles.muted}>
                  {item.acquiredAt} · {formatPrice(item.acquiredPriceCents ?? 0)}
                </Text>
                <HStack space="xs" style={{ marginTop: 4, flexWrap: "wrap" }}>
                  {item.relistedProductId ? (
                    <Text style={[styles.tag, styles.tagSuccess]}>
                      {t("trading.archive.tagResold")}
                    </Text>
                  ) : null}
                  {item.source === "manual" ? (
                    <Text style={[styles.tag, styles.tagInfo]}>
                      {t("trading.archive.tagManual")}
                    </Text>
                  ) : null}
                  {item.isCurrentlyOwned === false ? (
                    <Text style={[styles.tag, styles.tagMuted]}>
                      {t("trading.archive.tagNotOwned")}
                    </Text>
                  ) : null}
                </HStack>
              </VStack>
            </HStack>
          </Pressable>
        )}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator
              style={{ marginTop: 32 }}
              color={theme.colors.text}
            />
          ) : (
            <Text style={styles.empty}>{t("trading.archive.empty")}</Text>
          )
        }
      />
    </SafeAreaView>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.colors.background },
    listContent: {
      padding: t.spacing.md,
      paddingBottom: t.spacing.xl,
    },

    analyticsCard: {
      backgroundColor: t.colors.accent,
      borderRadius: t.borderRadius.sm,
      padding: t.spacing.md,
      marginBottom: t.spacing.sm,
    },
    analyticsLabel: {
      ...t.typography.caption,
      color: t.colors.textInverted,
      opacity: 0.6,
    },
    analyticsValue: {
      ...t.typography.h2,
      fontFamily: playfairFonts.bold,
      color: t.colors.textInverted,
    },
    unlockBtn: {
      backgroundColor: t.colors.plusGold,
      paddingHorizontal: t.spacing.sm,
      paddingVertical: t.spacing.xs,
      borderRadius: t.borderRadius.sm,
    },
    unlockBtnText: {
      ...t.typography.caption,
      fontFamily: playfairFonts.medium,
      color: t.colors.textInverted,
    },
    brandRow: { flexWrap: "wrap", marginTop: 6 },
    brandChip: {
      backgroundColor: t.colors.brandChipBg,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: t.borderRadius.sm,
      marginBottom: 4,
    },
    brandChipText: {
      ...t.typography.caption,
      color: t.colors.textInverted,
    },

    card: {
      backgroundColor: t.colors.cardElevated,
      borderRadius: t.borderRadius.sm,
      padding: t.spacing.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
    },
    thumb: {
      width: 72,
      height: 72,
      borderRadius: t.borderRadius.sm,
      backgroundColor: t.colors.skeleton,
    },
    thumbPlaceholder: { alignItems: "center", justifyContent: "center" },
    title: {
      ...t.typography.bodySmall,
      fontFamily: playfairFonts.medium,
      color: t.colors.text,
    },
    muted: {
      ...t.typography.caption,
      color: t.colors.gray300,
    },

    tag: {
      ...t.typography.caption,
      fontFamily: playfairFonts.medium,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: t.borderRadius.sm,
      overflow: "hidden",
    },
    tagSuccess: {
      color: t.colors.success,
      backgroundColor: `${t.colors.success}22`,
    },
    tagInfo: {
      color: t.colors.text,
      backgroundColor: t.colors.gray100,
    },
    tagMuted: {
      color: t.colors.gray300,
      backgroundColor: t.colors.gray100,
    },

    empty: {
      ...t.typography.bodySmall,
      textAlign: "center",
      color: t.colors.gray300,
      marginTop: 48,
      paddingHorizontal: t.spacing.xl,
    },
  });

export default MyArchiveScreen;
