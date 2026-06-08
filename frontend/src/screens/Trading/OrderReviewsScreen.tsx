/**
 * OrderReviewsScreen —— 查看单笔订单的双盲互评。
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  View,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import Animated, { FadeInDown } from "react-native-reanimated";

import ScreenHeader from "../../components/ScreenHeader";
import { TradeReviewStars } from "../../components/trading/TradeReviewStars";
import { HStack, Pressable, Text } from "../../components/ui";
import { useAuthStore } from "../../store/authStore";
import {
  buildTradeReviewParams,
  getOrderReviewStatus,
  listOrderReviews,
  type OrderReviewStatus,
  type TradeReview,
} from "../../services/aftersalesService";
import { getOrder, type Order } from "../../services/orderService";
import { useAppTheme, useThemedStyles, type AppTheme } from "../../theme";

type RouteParams = {
  OrderReviews: { orderId: number };
};

const DIM_KEYS = [
  "asDescribed",
  "communication",
  "packaging",
  "shipping",
] as const;

const DIM_LABELS: Record<(typeof DIM_KEYS)[number], string> = {
  asDescribed: "trading.review.dimAsDescribed",
  communication: "trading.review.dimCommunication",
  packaging: "trading.review.dimPackaging",
  shipping: "trading.review.dimShipping",
};

function isAutoReview(review: TradeReview): boolean {
  if (review.autoClosedAt) return true;
  const payload = review.payload as Record<string, unknown> | null | undefined;
  return payload?.autoClosed === true;
}

export default function OrderReviewsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, "OrderReviews">>();
  const { orderId } = route.params;
  const { t } = useTranslation();
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const me = useAuthStore((s) => s.user);

  const [order, setOrder] = useState<Order | null>(null);
  const [reviews, setReviews] = useState<TradeReview[]>([]);
  const [status, setStatus] = useState<OrderReviewStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [o, items, st] = await Promise.all([
        getOrder(orderId),
        listOrderReviews(orderId),
        getOrderReviewStatus(orderId),
      ]);
      setOrder(o);
      setReviews(items);
      setStatus(st);
    } catch {
      setOrder(null);
      setReviews([]);
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load]);

  const myReview = useMemo(
    () => reviews.find((r) => r.reviewerUserId === me?.userId),
    [reviews, me?.userId],
  );

  const buyerReview = reviews.find((r) => r.reviewerRole === "buyer");
  const sellerReview = reviews.find((r) => r.reviewerRole === "seller");

  const renderDimensions = (review: TradeReview) => {
    const payload = review.payload as Record<string, number> | null | undefined;
    if (!payload) return null;
    const rows = DIM_KEYS.filter((k) => typeof payload[k] === "number");
    if (rows.length === 0) return null;

    return (
      <View style={styles.dimBlock}>
        {rows.map((key) => (
          <HStack
            key={key}
            style={styles.dimItem}
            justifyContent="between"
            alignItems="center"
          >
            <Text style={styles.dimLabel}>{t(DIM_LABELS[key])}</Text>
            <TradeReviewStars value={payload[key]} size={14} alignSelf="flex-end" />
          </HStack>
        ))}
      </View>
    );
  };

  const renderReviewCard = (
    role: "buyer" | "seller",
    review: TradeReview | undefined,
    index: number,
  ) => {
    const title =
      role === "buyer"
        ? t("trading.review.roleBuyer")
        : t("trading.review.roleSeller");

    if (!review) {
      return (
        <Animated.View
          entering={FadeInDown.delay(index * 80).duration(320)}
          style={styles.reviewCard}
        >
          <Text style={styles.reviewRole}>{title}</Text>
          <Text style={styles.emptyText}>{t("trading.review.noReviewYet")}</Text>
        </Animated.View>
      );
    }

    const isMine = review.reviewerUserId === me?.userId;
    const hidden = !review.visible;
    const auto = isAutoReview(review);

    return (
      <Animated.View
        entering={FadeInDown.delay(index * 80).duration(320)}
        style={styles.reviewCard}
      >
        <HStack justifyContent="between" alignItems="center">
          <Text style={styles.reviewRole}>{title}</Text>
          <HStack space="xs" alignItems="center">
            {auto ? (
              <Text style={styles.autoBadge}>
                {t("trading.review.autoReviewBadge")}
              </Text>
            ) : null}
            {hidden ? (
              <Text style={styles.hiddenBadge}>
                {isMine
                  ? t("trading.review.yourReviewPending")
                  : t("trading.review.hiddenHint")}
              </Text>
            ) : null}
          </HStack>
        </HStack>

        <TradeReviewStars value={review.rating} size={20} alignSelf="flex-start" />
        {renderDimensions(review)}

        {!!review.comment && (
          <Text style={styles.comment}>{review.comment}</Text>
        )}

        {!!review.photos?.length && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <HStack space="sm">
              {review.photos.map((url) => (
                <Image key={url} source={{ uri: url }} style={styles.photo} />
              ))}
            </HStack>
          </ScrollView>
        )}

        {!!review.submittedAt && (
          <Text style={styles.time}>
            {review.submittedAt.replace("T", " ").slice(0, 16)}
          </Text>
        )}
      </Animated.View>
    );
  };

  const canWrite = status?.canReview && !myReview && order;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader
        title={t("trading.review.viewTitle")}
        showBack
        onBackPress={() => navigation.goBack()}
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.gray400} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {renderReviewCard("buyer", buyerReview, 0)}
          {renderReviewCard("seller", sellerReview, 1)}

          {canWrite ? (
            <Animated.View entering={FadeInDown.delay(180).duration(320)}>
              <Pressable
                style={styles.primaryBtn}
                onPress={() =>
                  navigation.navigate("TradeReview", buildTradeReviewParams(order))
                }
              >
                <Text style={styles.primaryBtnText}>
                  {t("trading.review.writeReview")}
                </Text>
              </Pressable>
            </Animated.View>
          ) : null}
        </ScrollView>
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
      padding: 16,
      paddingBottom: 32,
      gap: 12,
    },
    reviewCard: {
      backgroundColor: t.colors.card,
      borderRadius: t.borderRadius.sm,
      padding: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
      gap: 10,
    },
    reviewRole: {
      fontSize: 15,
      fontWeight: "600",
      color: t.colors.text,
      lineHeight: 22,
    },
    hiddenBadge: {
      fontSize: 11,
      color: t.colors.gray400,
      flexShrink: 1,
      textAlign: "right",
      marginLeft: 12,
      lineHeight: 16,
    },
    autoBadge: {
      fontSize: 10,
      color: t.colors.gray400,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: t.borderRadius.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
      lineHeight: 14,
    },
    dimBlock: {
      gap: 6,
      marginTop: 4,
    },
    dimItem: {
      paddingVertical: 2,
    },
    dimLabel: {
      fontSize: 12,
      color: t.colors.gray300,
      lineHeight: 18,
    },
    comment: {
      fontSize: 14,
      color: t.colors.text,
      lineHeight: 20,
    },
    photo: {
      width: 64,
      height: 64,
      borderRadius: t.borderRadius.sm,
      backgroundColor: t.colors.skeleton,
    },
    time: {
      fontSize: 11,
      color: t.colors.gray400,
      lineHeight: 16,
    },
    emptyText: {
      fontSize: 13,
      color: t.colors.gray400,
      lineHeight: 18,
    },
    primaryBtn: {
      marginTop: 8,
      backgroundColor: t.colors.accent,
      borderRadius: t.borderRadius.sm,
      paddingVertical: 14,
      alignItems: "center",
    },
    primaryBtnText: {
      color: t.colors.textInverted,
      fontSize: 15,
      fontWeight: "600",
      lineHeight: 22,
    },
  });
