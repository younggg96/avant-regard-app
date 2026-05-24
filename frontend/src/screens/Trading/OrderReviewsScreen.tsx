/**
 * OrderReviewsScreen —— 查看单笔订单的双盲互评。
 *
 * 入口：Profile 订单卡「查看评价」、订单详情等。
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import ScreenHeader from "../../components/ScreenHeader";
import { HStack, Pressable, Text } from "../../components/ui";
import { useAuthStore } from "../../store/authStore";
import {
  listOrderReviews,
  type TradeReview,
} from "../../services/aftersalesService";
import { getOrder, type Order } from "../../services/orderService";
import { useAppTheme, useThemedStyles, type AppTheme } from "../../theme";

type RouteParams = {
  OrderReviews: { orderId: number };
};

const Stars: React.FC<{ value: number; size?: number }> = ({
  value,
  size = 18,
}) => {
  const theme = useAppTheme();
  return (
    <HStack space="xs">
      {[1, 2, 3, 4, 5].map((n) => (
        <Ionicons
          key={n}
          name={n <= value ? "star" : "star-outline"}
          size={size}
          color={n <= value ? theme.colors.starRated : theme.colors.gray200}
        />
      ))}
    </HStack>
  );
};

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
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [o, items] = await Promise.all([
        getOrder(orderId),
        listOrderReviews(orderId),
      ]);
      setOrder(o);
      setReviews(items);
    } catch {
      setOrder(null);
      setReviews([]);
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

  const renderReviewCard = (
    role: "buyer" | "seller",
    review: TradeReview | undefined,
  ) => {
    const title =
      role === "buyer"
        ? t("trading.review.roleBuyer")
        : t("trading.review.roleSeller");

    if (!review) {
      return (
        <View style={styles.reviewCard}>
          <Text style={styles.reviewRole}>{title}</Text>
          <Text style={styles.emptyText}>{t("trading.review.noReviewYet")}</Text>
        </View>
      );
    }

    const isMine = review.reviewerUserId === me?.userId;
    const hidden = !review.visible;

    return (
      <View style={styles.reviewCard}>
        <HStack justifyContent="between" alignItems="center">
          <Text style={styles.reviewRole}>{title}</Text>
          {hidden ? (
            <Text style={styles.hiddenBadge}>
              {isMine
                ? t("trading.review.yourReviewPending")
                : t("trading.review.hiddenHint")}
            </Text>
          ) : null}
        </HStack>
        <Stars value={review.rating} />
        {!!review.comment && (
          <Text style={styles.comment}>{review.comment}</Text>
        )}
        {!!review.submittedAt && (
          <Text style={styles.time}>
            {review.submittedAt.replace("T", " ").slice(0, 16)}
          </Text>
        )}
      </View>
    );
  };

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
          {renderReviewCard("buyer", buyerReview)}
          {renderReviewCard("seller", sellerReview)}

          {!myReview && order ? (
            <Pressable
              style={styles.primaryBtn}
              onPress={() =>
                navigation.navigate("TradeReview", {
                  orderId: order.id,
                  productId: order.productId,
                })
              }
            >
              <Text style={styles.primaryBtnText}>
                {t("trading.review.writeReview")}
              </Text>
            </Pressable>
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
      borderRadius: 12,
      padding: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
      gap: 10,
    },
    reviewRole: {
      fontSize: 15,
      fontWeight: "600",
      color: t.colors.text,
    },
    hiddenBadge: {
      fontSize: 11,
      color: t.colors.gray400,
      flexShrink: 1,
      textAlign: "right",
      marginLeft: 12,
    },
    comment: {
      fontSize: 14,
      color: t.colors.text,
      lineHeight: 20,
    },
    time: {
      fontSize: 11,
      color: t.colors.gray400,
    },
    emptyText: {
      fontSize: 13,
      color: t.colors.gray400,
    },
    primaryBtn: {
      marginTop: 8,
      backgroundColor: t.colors.text,
      borderRadius: 8,
      paddingVertical: 12,
      alignItems: "center",
    },
    primaryBtnText: {
      color: t.colors.textInverted,
      fontSize: 14,
      fontWeight: "600",
    },
  });
