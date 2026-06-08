/**
 * UserReviewsScreen —— 卖家「历史评价」独立页。
 *
 * 入口：卖家主页（UserProfileScreen）评分卡片点击进入。
 *
 * 设计目的：把卖家的过往交易评价从主页默认展示内容（笔记 / 在售 / 愿望单 / 贡献）
 * 中拆出来，单独成页，避免「当前信息」与「历史评价」混在一起、层级不清。
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import ScreenHeader from "../../components/ScreenHeader";
import { TradeReviewStars } from "../../components/trading/TradeReviewStars";
import { HStack, Text, VStack, UserAvatar } from "../../components/ui";
import { OptimizedImage } from "../../components/ui/OptimizedImage";
import { ImageSize } from "../../utils/imageUtils";
import { resolveAvatarUrl } from "../../utils/avatarUtils";
import {
  listUserReviews,
  type TradeReview,
} from "../../services/aftersalesService";
import { getUserInfo } from "../../services/userInfoService";
import { useAppTheme, useThemedStyles, playfairFonts, type AppTheme } from "../../theme";

type RouteParams = {
  UserReviews: { userId: number; username?: string };
};

/**
 * 评价人用户名脱敏：保留首字符，其余用 * 隐藏（最多 3 个），
 * 例如 `unspoken` → `u***`、`李` → `李*`。用于卖家历史评价页保护买家隐私。
 */
function maskUsername(name?: string | null): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "***";
  const first = Array.from(trimmed)[0];
  const restLen = Array.from(trimmed).length - 1;
  const stars = "*".repeat(Math.min(Math.max(restLen, 1), 3));
  return `${first}${stars}`;
}

const ReviewCard: React.FC<{ review: TradeReview }> = ({ review }) => {
  const styles = useThemedStyles(makeStyles);
  const photos = (review.photos ?? []).filter(Boolean);
  const maskedName = maskUsername(review.reviewerUsername);
  return (
    <View style={styles.reviewCard}>
      <HStack alignItems="center" justifyContent="between">
        <HStack alignItems="center" space="sm" style={styles.reviewerInfo}>
          <UserAvatar
            uri={resolveAvatarUrl(review.reviewerAvatarUrl)}
            name={maskedName}
            size={28}
          />
          <Text style={styles.reviewRole} numberOfLines={1}>
            {maskedName}
          </Text>
        </HStack>
        <TradeReviewStars value={review.rating} size={12} alignSelf="flex-end" />
      </HStack>
      {!!review.comment && (
        <Text style={styles.comment}>{review.comment}</Text>
      )}
      {photos.length > 0 && (
        <HStack space="xs" flexWrap="wrap" style={styles.photoRow}>
          {photos.slice(0, 6).map((uri, idx) => (
            <View key={`${review.id}-photo-${idx}`} style={styles.photo}>
              <OptimizedImage
                uri={uri}
                size={ImageSize.THUMBNAIL}
                style={{ width: "100%", height: "100%" }}
                contentFit="cover"
              />
            </View>
          ))}
        </HStack>
      )}
      {!!review.submittedAt && (
        <Text style={styles.time}>{review.submittedAt.slice(0, 10)}</Text>
      )}
    </View>
  );
};

export default function UserReviewsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, "UserReviews">>();
  const { userId } = route.params;
  const { t } = useTranslation();
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);

  const [reviews, setReviews] = useState<TradeReview[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listUserReviews(userId);
      // 卖家历史评价页：评价人必须是真实购买的买家（reviewerRole=buyer）。
      // 后端已按 buyer 过滤；这里再兜底一次，兼容尚未部署过滤逻辑的旧接口。
      const items = (res.items ?? []).filter(
        (r) => r.reviewerRole === "buyer"
      );

      // 评价人头像 / 用户名优先用后端返回的字段；后端未提供时（如旧版接口），
      // 用 reviewerUserId 逐个补拉一次 user-info，保证买家头像能正常展示。
      const missingIds = Array.from(
        new Set(
          items
            .filter((r) => !r.reviewerAvatarUrl && !r.reviewerUsername)
            .map((r) => r.reviewerUserId)
            .filter((id): id is number => typeof id === "number")
        )
      );
      const profileMap = new Map<
        number,
        { username?: string | null; avatarUrl?: string | null }
      >();
      if (missingIds.length > 0) {
        const profiles = await Promise.all(
          missingIds.map((id) =>
            getUserInfo(id)
              .then((info) => ({ id, info }))
              .catch(() => null)
          )
        );
        for (const entry of profiles) {
          if (entry?.info) {
            profileMap.set(entry.id, {
              username: entry.info.username,
              avatarUrl: entry.info.avatarUrl,
            });
          }
        }
      }

      const enriched = items.map((r) => {
        const fallback = profileMap.get(r.reviewerUserId);
        return fallback
          ? {
              ...r,
              reviewerUsername: r.reviewerUsername ?? fallback.username,
              reviewerAvatarUrl: r.reviewerAvatarUrl ?? fallback.avatarUrl,
            }
          : r;
      });

      setReviews(enriched);
      // 用过滤后的买家评价条数，避免与列表/好评率不一致（旧接口 total 含卖家评价）。
      setTotal(enriched.length);
    } catch {
      setReviews([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const { averageRating, positiveRate } = useMemo(() => {
    if (reviews.length === 0) {
      return { averageRating: 0, positiveRate: 0 };
    }
    const sum = reviews.reduce((s, r) => s + r.rating, 0);
    const positives = reviews.filter((r) => r.rating >= 4).length;
    return {
      averageRating: sum / reviews.length,
      positiveRate: Math.round((positives / reviews.length) * 100),
    };
  }, [reviews]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader
        title={t("userReviews.title")}
        showBack
        onBackPress={() => navigation.goBack()}
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.gray400} />
        </View>
      ) : (
        <FlatList
          data={reviews}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.scroll}
          renderItem={({ item }) => <ReviewCard review={item} />}
          ListHeaderComponent={
            total > 0 ? (
              <View style={styles.summaryCard}>
                <HStack alignItems="center" space="md">
                  <Text style={styles.summaryScore}>
                    {averageRating.toFixed(1)}
                  </Text>
                  <VStack space="xs" style={styles.summaryRight}>
                    <TradeReviewStars value={Math.round(averageRating)} size={13} />
                    <Text style={styles.summaryMeta}>
                      {t("userReviews.summary", {
                        count: total,
                        rate: positiveRate,
                      })}
                    </Text>
                  </VStack>
                </HStack>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyBlock}>
              <Ionicons
                name="star-outline"
                size={28}
                color={theme.colors.gray300}
              />
              <Text style={styles.emptyText}>{t("userReviews.empty")}</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.colors.background },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    scroll: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 32,
      gap: 8,
    },
    summaryCard: {
      backgroundColor: t.colors.card,
      borderRadius: t.borderRadius.sm,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
    },
    summaryScore: {
      fontSize: 24,
      fontWeight: "700",
      color: t.colors.text,
      lineHeight: 28,
      fontFamily: playfairFonts.bold,
    },
    summaryRight: {
      flex: 1,
    },
    summaryMeta: {
      fontSize: 12,
      color: t.colors.gray400,
      lineHeight: 16,
      fontFamily: playfairFonts.regular,
    },
    reviewCard: {
      backgroundColor: t.colors.card,
      borderRadius: t.borderRadius.sm,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
      gap: 6,
    },
    reviewerInfo: {
      flex: 1,
      marginRight: 8,
    },
    reviewRole: {
      fontSize: 13,
      fontWeight: "600",
      color: t.colors.text,
      fontFamily: playfairFonts.medium,
      flexShrink: 1,
    },
    comment: {
      fontSize: 13,
      color: t.colors.text,
      lineHeight: 18,
      fontFamily: playfairFonts.regular,
    },
    photoRow: {
      marginTop: 2,
    },
    photo: {
      width: 56,
      height: 56,
      borderRadius: t.borderRadius.sm,
      overflow: "hidden",
      backgroundColor: t.colors.skeleton,
    },
    time: {
      fontSize: 11,
      color: t.colors.gray400,
      marginTop: 2,
      fontFamily: playfairFonts.regular,
    },
    emptyBlock: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 80,
      gap: 10,
    },
    emptyText: {
      fontSize: 13,
      color: t.colors.gray400,
      fontFamily: playfairFonts.regular,
    },
  });
