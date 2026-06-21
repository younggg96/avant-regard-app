/**
 * MyOffersScreen —— 出价中心。
 *
 * 角色 Tab（可点击或横向滑动切换）：
 *   - 我的出价   GET /api/offers/me
 *   - 待我处理   GET /api/offers/me/incoming
 *
 * 状态 Tab：全部 / 待响应（pending）/ 已处理（accepted+rejected+countered+expired+withdrawn）
 *
 * 双向议价：根据后端返回的 `allowedActions` 显示按钮（accept/reject/counter/withdraw）。
 *
 * UI：ScreenHeader / TopTabBar / AnimatedChip / OptimizedImage + Playfair Display + theme tokens。
 */
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  View,
} from "react-native";
import PagerView, {
  type PagerViewOnPageSelectedEvent,
} from "react-native-pager-view";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
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
import { useFormatPrice } from "../../utils/currency";
import { useOrderAddressPromptStore } from "../../store/orderAddressPromptStore";
import {
  playfairFonts,
  useAppTheme,
  useThemedStyles,
  type AppTheme,
} from "../../theme";
import {
  AnimatedChip,
  Box,
  HStack,
  Pressable,
  Text,
  TopTabBar,
  VStack,
  chipRowStyle,
} from "../../components/ui";
import { OptimizedImage } from "../../components/ui/OptimizedImage";
import ScreenHeader from "../../components/ScreenHeader";
import { UserAvatar } from "../../components/ui/UserAvatar";
import { ImageSize } from "../../utils/imageUtils";
import { Alert } from "../../utils/Alert";
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

const STATUS_FILTERS: StatusFilter[] = ["all", "pending", "processed"];

const ROLE_ORDER: RoleMode[] = ["outgoing", "incoming"];

function filterOffers(
  items: OfferWithDetail[],
  statusFilter: StatusFilter,
): OfferWithDetail[] {
  if (statusFilter === "all") return items;
  if (statusFilter === "pending")
    return items.filter((o) => o.status === "pending");
  return items.filter((o) => PROCESSED_STATUSES.includes(o.status));
}

function formatExpiresAt(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 16);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${mm}-${dd} ${hh}:${min}`;
}

export default function MyOffersScreen() {
  const navigation = useNavigation<any>();
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const { t } = useTranslation();
  const formatPrice = useFormatPrice();
  const showAddressPrompt = useOrderAddressPromptStore((s) => s.showPrompt);

  const [mode, setMode] = useState<RoleMode>("outgoing");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [offersByMode, setOffersByMode] = useState<
    Partial<Record<RoleMode, OfferWithDetail[]>>
  >({});
  const [loadingByMode, setLoadingByMode] = useState<
    Partial<Record<RoleMode, boolean>>
  >({});
  const [refreshing, setRefreshing] = useState(false);

  const pagerRef = useRef<PagerView>(null);

  const [counterTarget, setCounterTarget] = useState<OfferWithDetail | null>(
    null,
  );

  const roleTabs = useMemo(
    () => [
      { id: "outgoing" as const, label: t("trading.offers.tabOutgoing") },
      { id: "incoming" as const, label: t("trading.offers.tabIncoming") },
    ],
    [t],
  );

  const load = useCallback(async (targetMode: RoleMode, silent = false) => {
    if (!silent) {
      setLoadingByMode((prev) => ({ ...prev, [targetMode]: true }));
    }
    try {
      const res =
        targetMode === "outgoing"
          ? await listMyOffers({ pageSize: 50 })
          : await listIncomingOffers({ pageSize: 50 });
      setOffersByMode((prev) => ({ ...prev, [targetMode]: res.items }));
    } catch (e) {
      console.warn("[MyOffers] load failed:", e);
      setOffersByMode((prev) => ({ ...prev, [targetMode]: [] }));
    } finally {
      if (!silent) {
        setLoadingByMode((prev) => ({ ...prev, [targetMode]: false }));
      }
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(mode);
    }, [load, mode]),
  );

  /** tab 点击 → 同步 pager；横向滑动 → 只更新 state。 */
  const switchMode = useCallback((next: RoleMode, fromPager = false) => {
    setMode(next);
    setStatusFilter("all");
    if (!fromPager) {
      pagerRef.current?.setPage(ROLE_ORDER.indexOf(next));
    }
  }, []);

  const onPageSelected = useCallback(
    (e: PagerViewOnPageSelectedEvent) => {
      const idx = Math.round(Number(e.nativeEvent.position));
      const next = ROLE_ORDER[idx];
      if (next) switchMode(next, true);
    },
    [switchMode],
  );

  const handleAction = async (
    action: "accept" | "reject" | "withdraw",
    offerId: number,
    offer?: OfferWithDetail,
  ) => {
    try {
      if (action === "accept") {
        const res = await acceptOffer(offerId);
        if (mode === "outgoing") {
          showAddressPrompt({
            orderId: res.order.id,
            sellerUserId: res.order.sellerUserId ?? offer?.seller?.userId ?? null,
            sellerName: offer?.seller?.username ?? null,
            sellerAvatar: offer?.seller?.avatarUrl ?? null,
            productTitle: offer?.product?.title ?? null,
            coverImage: offer?.product?.coverImage ?? null,
          });
        } else {
          Alert.alert(
            t("trading.offers.acceptedTitle"),
            t("trading.offers.acceptedMessage"),
            [
              {
                text: t("trading.offers.viewOrder"),
                onPress: () =>
                  navigation.navigate("OrderDetail", { orderId: res.order.id }),
              },
              { text: t("common.cancel"), style: "cancel" },
            ],
          );
        }
      } else if (action === "reject") {
        await rejectOffer(offerId);
      } else {
        await withdrawOffer(offerId);
      }
      load(mode, true);
    } catch (e: any) {
      Alert.show(
        t("trading.offers.failedTitle"),
        e?.message ?? t("trading.offers.actionFailed"),
      );
    }
  };

  const openProduct = (productId: number) => {
    navigation.navigate("StoreProductDetail", { productId });
  };

  const renderItem = (pageMode: RoleMode) => ({ item }: { item: OfferWithDetail }) => {
    const counterpart = pageMode === "outgoing" ? item.seller : item.buyer;
    const allowed = item.allowedActions ?? [];
    const canAccept = allowed.includes("accept");
    const canReject = allowed.includes("reject");
    const canCounter = allowed.includes("counter");
    const canWithdraw = allowed.includes("withdraw");
    const isPending = item.status === "pending";
    const isCounter = (item.parentOfferId ?? null) !== null;

    return (
      <Box style={styles.card}>
        <Pressable style={styles.productRow} onPress={() => openProduct(item.productId)}>
          {item.product?.coverImage ? (
            <OptimizedImage
              uri={item.product.coverImage}
              size={ImageSize.THUMBNAIL}
              style={styles.thumb}
              contentFit="cover"
            />
          ) : (
            <Box style={[styles.thumb, styles.thumbPlaceholder]}>
              <Ionicons name="image" size={22} color={theme.colors.gray300} />
            </Box>
          )}

          <VStack style={styles.productInfo} space="xs">
            {item.product?.brand ? (
              <Text style={styles.brand} numberOfLines={1}>
                {item.product.brand}
              </Text>
            ) : null}
            <Text style={styles.productTitle} numberOfLines={2}>
              {item.product?.title ??
                t("trading.offers.productLabel", { id: item.productId })}
            </Text>
            {item.product?.priceCents != null ? (
              <Text style={styles.listingPrice}>
                {t("trading.offers.listingPriceLabel")}{" "}
                {formatPrice(item.product.priceCents)}
              </Text>
            ) : null}
          </VStack>

          <VStack style={styles.statusWrap} space="xs">
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
          </VStack>
        </Pressable>

        <Box style={styles.divider} />

        <HStack style={styles.bodyRow} alignItems="center" space="md">
          <VStack style={styles.bodyMain} space="xs">
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
                  date: formatExpiresAt(item.expiresAt),
                })}
              </Text>
            ) : null}
          </VStack>

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
        </HStack>

        {isPending && allowed.length > 0 ? (
          <HStack style={styles.actions} space="sm" flexWrap="wrap">
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
                onPress={() => handleAction("accept", item.id, item)}
              >
                <Text style={styles.primaryBtnText}>
                  {t("trading.offers.accept")}
                </Text>
              </Pressable>
            ) : null}
          </HStack>
        ) : null}
      </Box>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScreenHeader
        title={t("trading.offers.headerTitle")}
        showBack
        borderless
      />

      <Box style={styles.roleTabWrap}>
        <TopTabBar
          tabs={roleTabs}
          activeTab={mode}
          onTabPress={(next) => switchMode(next)}
        />
      </Box>

      <Box style={styles.filterBar}>
        <Box style={chipRowStyle}>
          {STATUS_FILTERS.map((s) => (
            <AnimatedChip
              key={s}
              label={t(`trading.offers.filter.${s}`)}
              isActive={statusFilter === s}
              onPress={() => setStatusFilter(s)}
            />
          ))}
        </Box>
      </Box>

      {/* @ts-expect-error RNC codegen typings omit `children`; runtime supports pages. */}
      <PagerView
        ref={pagerRef}
        style={styles.pager}
        initialPage={0}
        onPageSelected={onPageSelected}
      >
        {ROLE_ORDER.map((pageMode) => {
          const pageOffers = offersByMode[pageMode] ?? [];
          const filtered = filterOffers(pageOffers, statusFilter);
          const isActivePage = pageMode === mode;
          const pageLoading =
            !!loadingByMode[pageMode] && pageOffers.length === 0;

          return (
            <View key={pageMode} style={styles.page} collapsable={false}>
              {pageLoading ? (
                <Box style={styles.center}>
                  <ActivityIndicator color={theme.colors.text} />
                </Box>
              ) : (
                <FlatList
                  data={filtered}
                  keyExtractor={(o) => String(o.id)}
                  contentContainerStyle={styles.listContent}
                  refreshControl={
                    <RefreshControl
                      refreshing={refreshing && isActivePage}
                      onRefresh={() => {
                        setRefreshing(true);
                        load(pageMode, true);
                      }}
                      tintColor={theme.colors.text}
                    />
                  }
                  renderItem={renderItem(pageMode)}
                  ListEmptyComponent={
                    <Text style={styles.empty}>{t("trading.offers.empty")}</Text>
                  }
                />
              )}
            </View>
          );
        })}
      </PagerView>

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
            load(mode, true);
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.colors.background },
    roleTabWrap: {
      backgroundColor: t.colors.card,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    filterBar: {
      paddingHorizontal: t.spacing.md,
      paddingVertical: t.spacing.sm,
      backgroundColor: t.colors.background,
    },
    pager: { flex: 1 },
    page: { flex: 1 },
    listContent: {
      padding: t.spacing.md,
      paddingBottom: t.spacing.xl,
      flexGrow: 1,
    },
    center: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: t.spacing.xl,
    },
    card: {
      backgroundColor: t.colors.cardElevated,
      borderRadius: t.borderRadius.sm,
      padding: t.spacing.md,
      marginBottom: t.spacing.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
    },
    productRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: t.spacing.sm,
    },
    thumb: {
      width: 60,
      height: 60,
      borderRadius: t.borderRadius.sm,
      backgroundColor: t.colors.skeleton,
    },
    thumbPlaceholder: {
      alignItems: "center",
      justifyContent: "center",
    },
    productInfo: { flex: 1 },
    brand: {
      ...t.typography.caption,
      fontFamily: playfairFonts.regular,
      color: t.colors.gray300,
    },
    productTitle: {
      ...t.typography.bodySmall,
      fontFamily: playfairFonts.medium,
      color: t.colors.text,
    },
    listingPrice: {
      ...t.typography.caption,
      fontFamily: playfairFonts.regular,
      color: t.colors.gray300,
    },
    statusWrap: { alignItems: "flex-end" },
    statusPill: {
      ...t.typography.caption,
      fontFamily: playfairFonts.medium,
      color: t.colors.gray300,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: t.borderRadius.sm,
      backgroundColor: t.colors.gray100,
      overflow: "hidden",
      textAlign: "center",
    },
    statusPillPending: {
      color: t.colors.plusGold,
      backgroundColor: `${t.colors.plusGold}22`,
    },
    counterBadge: {
      fontSize: 10,
      fontFamily: playfairFonts.medium,
      color: t.colors.text,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: t.borderRadius.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
      overflow: "hidden",
      textAlign: "center",
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: t.colors.border,
      marginVertical: t.spacing.sm,
    },
    bodyRow: {
      justifyContent: "space-between",
    },
    bodyMain: { flex: 1 },
    priceLabel: {
      ...t.typography.caption,
      fontFamily: playfairFonts.regular,
      color: t.colors.gray300,
    },
    price: {
      fontSize: 22,
      lineHeight: 28,
      fontFamily: playfairFonts.bold,
      color: t.colors.text,
    },
    message: {
      ...t.typography.bodySmall,
      fontFamily: playfairFonts.regular,
      color: t.colors.textSecondary,
    },
    meta: {
      ...t.typography.caption,
      fontFamily: playfairFonts.regular,
      color: t.colors.gray300,
    },
    counterpart: {
      alignItems: "center",
      maxWidth: 80,
      gap: 4,
    },
    counterpartName: {
      ...t.typography.caption,
      fontFamily: playfairFonts.regular,
      color: t.colors.textSecondary,
      maxWidth: 80,
      textAlign: "center",
    },
    actions: {
      justifyContent: "flex-end",
      marginTop: t.spacing.sm,
    },
    ghostBtn: {
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: t.borderRadius.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
    },
    ghostBtnText: {
      ...t.typography.bodySmall,
      fontFamily: playfairFonts.medium,
      color: t.colors.textSecondary,
    },
    secondaryBtn: {
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: t.borderRadius.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.text,
    },
    secondaryBtnText: {
      ...t.typography.bodySmall,
      fontFamily: playfairFonts.medium,
      color: t.colors.text,
    },
    primaryBtn: {
      paddingVertical: 8,
      paddingHorizontal: 18,
      borderRadius: t.borderRadius.sm,
      backgroundColor: t.colors.text,
    },
    primaryBtnText: {
      ...t.typography.bodySmall,
      fontFamily: playfairFonts.medium,
      color: t.colors.textInverted,
    },
    empty: {
      ...t.typography.bodySmall,
      fontFamily: playfairFonts.regular,
      textAlign: "center",
      color: t.colors.gray300,
      marginTop: t.spacing.xl,
    },
  });
