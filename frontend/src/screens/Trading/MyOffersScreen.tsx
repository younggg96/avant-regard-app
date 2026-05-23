/**
 * MyOffersScreen —— 出价中心。
 *
 * 角色 Tab：
 *   - 我的出价   GET /api/offers/me
 *   - 待我处理   GET /api/offers/me/incoming
 *
 * 状态 Tab：全部 / 待响应（pending）/ 已处理（accepted+rejected+countered+expired+withdrawn）
 *
 * 双向议价：根据后端返回的 `allowedActions` 显示按钮（accept/reject/counter/withdraw）。
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import {
  listMyOffers,
  listIncomingOffers,
  OfferWithDetail,
  OfferStatus,
  formatOfferStatus,
  acceptOffer,
  rejectOffer,
  withdrawOffer,
} from "../../services/orderService";
import { formatPrice } from "../../services/storeProductService";
import { useAppTheme, useThemedStyles, type AppTheme } from "../../theme";
import { UserAvatar } from "../../components/ui/UserAvatar";
import OfferModal from "./OfferModal";

type RoleMode = "outgoing" | "incoming";
type StatusFilter = "all" | "pending" | "processed";

const PROCESSED_STATUSES: OfferStatus[] = [
  "accepted",
  "rejected",
  "countered",
  "expired",
  "withdrawn",
];

export default function MyOffersScreen() {
  const navigation = useNavigation<any>();
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const { t } = useTranslation();

  const [mode, setMode] = useState<RoleMode>("outgoing");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [offers, setOffers] = useState<OfferWithDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [counterTarget, setCounterTarget] = useState<OfferWithDetail | null>(
    null,
  );

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const res =
          mode === "outgoing"
            ? await listMyOffers({ pageSize: 50 })
            : await listIncomingOffers({ pageSize: 50 });
        setOffers(res.items);
      } catch (e) {
        setOffers([]);
      } finally {
        if (!silent) setLoading(false);
        setRefreshing(false);
      }
    },
    [mode],
  );

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (statusFilter === "all") return offers;
    if (statusFilter === "pending")
      return offers.filter((o) => o.status === "pending");
    return offers.filter((o) =>
      PROCESSED_STATUSES.includes(o.status),
    );
  }, [offers, statusFilter]);

  const handleAction = async (
    action: "accept" | "reject" | "withdraw",
    offerId: number,
  ) => {
    try {
      if (action === "accept") {
        const res = await acceptOffer(offerId);
        Alert.alert(
          t("trading.offers.acceptedTitle"),
          t("trading.offers.acceptedMessage"),
          [
            {
              text: t("trading.offers.viewOrder"),
              onPress: () =>
                navigation.navigate("OrderDetail", { orderId: res.order.id }),
            },
            { text: t("common.confirm") },
          ],
        );
      } else if (action === "reject") {
        await rejectOffer(offerId);
      } else {
        await withdrawOffer(offerId);
      }
      load(true);
    } catch (e: any) {
      Alert.alert(
        t("trading.offers.failedTitle"),
        e?.message ?? t("trading.offers.actionFailed"),
      );
    }
  };

  const openProduct = (productId: number) => {
    navigation.navigate("StoreProductDetail", { productId });
  };

  const renderItem = ({ item }: { item: OfferWithDetail }) => {
    const counterpart = mode === "outgoing" ? item.seller : item.buyer;
    const allowed = item.allowedActions ?? [];
    const canAccept = allowed.includes("accept");
    const canReject = allowed.includes("reject");
    const canCounter = allowed.includes("counter");
    const canWithdraw = allowed.includes("withdraw");
    const isPending = item.status === "pending";
    const isCounter = (item.parentOfferId ?? null) !== null;

    return (
      <View style={styles.card}>
        <Pressable
          style={styles.productRow}
          onPress={() => openProduct(item.productId)}
        >
          {item.product?.coverImage ? (
            <Image
              source={{ uri: item.product.coverImage }}
              style={styles.thumb}
            />
          ) : (
            <View style={[styles.thumb, styles.thumbPlaceholder]}>
              <Ionicons name="image" size={22} color={theme.colors.gray300} />
            </View>
          )}
          <View style={styles.productInfo}>
            <Text style={styles.brand} numberOfLines={1}>
              {item.product?.brand ?? ""}
            </Text>
            <Text style={styles.productTitle} numberOfLines={2}>
              {item.product?.title ??
                t("trading.offers.productLabel", { id: item.productId })}
            </Text>
            {item.product?.priceCents != null ? (
              <Text style={styles.listingPrice}>
                {t("trading.offers.listingPriceLabel")}：
                {formatPrice(item.product.priceCents)}
              </Text>
            ) : null}
          </View>
          <View style={styles.statusWrap}>
            <Text
              style={[
                styles.statusPill,
                isPending && styles.statusPillPending,
              ]}
            >
              {formatOfferStatus(item.status)}
            </Text>
            {isCounter ? (
              <Text style={styles.counterBadge}>
                {t("trading.offers.counterBadge")}
              </Text>
            ) : null}
          </View>
        </Pressable>

        <View style={styles.divider} />

        <View style={styles.bodyRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.priceLabel}>
              {t("trading.offers.offerPriceLabel")}
            </Text>
            <Text style={styles.price}>{formatPrice(item.priceCents)}</Text>
            {item.message ? (
              <Text style={styles.message} numberOfLines={2}>
                “{item.message}”
              </Text>
            ) : null}
            {item.expiresAt && isPending ? (
              <Text style={styles.meta}>
                {t("trading.offers.expiresAt", {
                  date: item.expiresAt.slice(0, 16),
                })}
              </Text>
            ) : null}
          </View>

          {counterpart ? (
            <Pressable
              style={styles.counterpart}
              onPress={() =>
                counterpart.userId &&
                navigation.navigate("UserProfile", {
                  userId: counterpart.userId,
                })
              }
            >
              <UserAvatar
                uri={counterpart.avatarUrl ?? undefined}
                name={counterpart.username ?? undefined}
                size={32}
              />
              <Text style={styles.counterpartName} numberOfLines={1}>
                {counterpart.username}
              </Text>
            </Pressable>
          ) : null}
        </View>

        {isPending && allowed.length > 0 ? (
          <View style={styles.actions}>
            {canWithdraw ? (
              <Pressable
                style={styles.ghostBtn}
                onPress={() => handleAction("withdraw", item.id)}
              >
                <Text style={styles.ghostBtnText}>
                  {t("trading.offers.withdraw")}
                </Text>
              </Pressable>
            ) : null}
            {canReject ? (
              <Pressable
                style={styles.ghostBtn}
                onPress={() => handleAction("reject", item.id)}
              >
                <Text style={styles.ghostBtnText}>
                  {t("trading.offers.reject")}
                </Text>
              </Pressable>
            ) : null}
            {canCounter ? (
              <Pressable
                style={styles.secondaryBtn}
                onPress={() => setCounterTarget(item)}
              >
                <Text style={styles.secondaryBtnText}>
                  {t("trading.offers.counter")}
                </Text>
              </Pressable>
            ) : null}
            {canAccept ? (
              <Pressable
                style={styles.primaryBtn}
                onPress={() => handleAction("accept", item.id)}
              >
                <Text style={styles.primaryBtnText}>
                  {t("trading.offers.accept")}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={26} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{t("trading.offers.headerTitle")}</Text>
        <View style={{ width: 26 }} />
      </View>

      <View style={styles.tabBar}>
        <Pressable
          style={[styles.tab, mode === "outgoing" && styles.tabActive]}
          onPress={() => setMode("outgoing")}
        >
          <Text
            style={[
              styles.tabText,
              mode === "outgoing" && styles.tabTextActive,
            ]}
          >
            {t("trading.offers.tabOutgoing")}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, mode === "incoming" && styles.tabActive]}
          onPress={() => setMode("incoming")}
        >
          <Text
            style={[
              styles.tabText,
              mode === "incoming" && styles.tabTextActive,
            ]}
          >
            {t("trading.offers.tabIncoming")}
          </Text>
        </Pressable>
      </View>

      <View style={styles.filterBar}>
        {(["all", "pending", "processed"] as StatusFilter[]).map((s) => (
          <Pressable
            key={s}
            style={[
              styles.filterChip,
              statusFilter === s && styles.filterChipActive,
            ]}
            onPress={() => setStatusFilter(s)}
          >
            <Text
              style={[
                styles.filterChipText,
                statusFilter === s && styles.filterChipTextActive,
              ]}
            >
              {t(`trading.offers.filter.${s}`)}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading && offers.length === 0 ? (
        <ActivityIndicator style={{ marginTop: 32 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(o) => String(o.id)}
          contentContainerStyle={{ padding: 12 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load(true);
              }}
              tintColor={theme.colors.gray300}
            />
          }
          renderItem={renderItem}
          ListEmptyComponent={
            <Text style={styles.empty}>{t("trading.offers.empty")}</Text>
          }
        />
      )}

      {counterTarget ? (
        <OfferModal
          visible={!!counterTarget}
          mode="counter"
          productId={counterTarget.productId}
          offerId={counterTarget.id}
          listingPriceCents={
            counterTarget.product?.priceCents ?? counterTarget.priceCents
          }
          referencePriceCents={counterTarget.priceCents}
          onClose={() => setCounterTarget(null)}
          onSuccess={() => {
            setCounterTarget(null);
            load(true);
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.colors.background },
    header: {
      height: 48,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      backgroundColor: t.colors.card,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    headerTitle: { fontSize: 16, fontWeight: "600", color: t.colors.text },
    tabBar: {
      flexDirection: "row",
      backgroundColor: t.colors.card,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    tab: {
      flex: 1,
      paddingVertical: 8,
      alignItems: "center",
      borderRadius: 14,
      marginHorizontal: 4,
      backgroundColor: t.colors.gray100,
    },
    tabActive: { backgroundColor: t.colors.accent },
    tabText: { fontSize: 13, color: t.colors.gray300 },
    tabTextActive: { color: t.colors.textInverted, fontWeight: "600" },
    filterBar: {
      flexDirection: "row",
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 8,
      backgroundColor: t.colors.background,
    },
    filterChip: {
      paddingVertical: 6,
      paddingHorizontal: 14,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.card,
    },
    filterChipActive: {
      borderColor: t.colors.text,
      backgroundColor: t.colors.text,
    },
    filterChipText: { fontSize: 12, color: t.colors.gray400 },
    filterChipTextActive: { color: t.colors.textInverted, fontWeight: "600" },
    card: {
      backgroundColor: t.colors.cardElevated,
      borderRadius: 12,
      padding: 12,
      marginBottom: 12,
    },
    productRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
    thumb: { width: 60, height: 60, borderRadius: 8 },
    thumbPlaceholder: {
      backgroundColor: t.colors.skeleton,
      alignItems: "center",
      justifyContent: "center",
    },
    productInfo: { flex: 1 },
    brand: { fontSize: 11, color: t.colors.gray300, marginBottom: 2 },
    productTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: t.colors.text,
      marginBottom: 4,
    },
    listingPrice: { fontSize: 11, color: t.colors.gray300 },
    statusWrap: { alignItems: "flex-end", gap: 4 },
    statusPill: {
      fontSize: 11,
      color: t.colors.gray300,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 4,
      backgroundColor: t.colors.gray100,
      overflow: "hidden",
    },
    statusPillPending: {
      color: t.colors.plusGold,
      backgroundColor: t.mode === "dark" ? "#3A2E14" : "#FFF6E0",
    },
    counterBadge: {
      fontSize: 10,
      color: t.colors.accent,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: t.colors.accent,
      overflow: "hidden",
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: t.colors.border,
      marginVertical: 10,
    },
    bodyRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    priceLabel: { fontSize: 11, color: t.colors.gray300, marginBottom: 2 },
    price: { fontSize: 22, fontWeight: "700", color: t.colors.text },
    message: { fontSize: 13, color: t.colors.gray400, marginTop: 4 },
    meta: { fontSize: 11, color: t.colors.gray300, marginTop: 4 },
    counterpart: {
      alignItems: "center",
      maxWidth: 80,
      gap: 4,
    },
    counterpartName: {
      fontSize: 11,
      color: t.colors.gray400,
      maxWidth: 80,
    },
    actions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      marginTop: 12,
      gap: 8,
      flexWrap: "wrap",
    },
    ghostBtn: {
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    ghostBtnText: { color: t.colors.gray400, fontSize: 13 },
    secondaryBtn: {
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: t.colors.text,
    },
    secondaryBtnText: { color: t.colors.text, fontSize: 13, fontWeight: "600" },
    primaryBtn: {
      paddingVertical: 8,
      paddingHorizontal: 18,
      borderRadius: 4,
      backgroundColor: t.colors.accent,
    },
    primaryBtnText: {
      color: t.colors.textInverted,
      fontSize: 13,
      fontWeight: "600",
    },
    empty: { textAlign: "center", color: t.colors.gray300, marginTop: 32 },
  });
