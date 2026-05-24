/**
 * OrderDetailScreen —— PRD 模块四单订单详情与状态推进。
 */
import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  TextInput,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import * as Clipboard from "expo-clipboard";

import {
  getOrder,
  shipOrder,
  getOrderShipment,
  signOrderReceipt,
  getOrderTrackingEvents,
  Order,
  OrderStatus,
  Shipment,
  TrackingEvent,
  formatOrderStatus,
} from "../../services/orderService";
import {
  formatPrice,
  getStoreProductDetail,
  StoreProduct,
} from "../../services/storeProductService";
import { OptimizedImage } from "../../components/ui/OptimizedImage";
import { ImageSize } from "../../utils/imageUtils";
import { useAuthStore } from "../../store/authStore";
import {
  contactSupportForOrder,
  contactSupportForOrderWithIssue,
  AftersalesIssue,
} from "../../services/aftersalesService";
import { ActionSheet, ActionSheetAction } from "../../components/ui/ActionSheet";
import { useAppTheme, useThemedStyles, type AppTheme } from "../../theme";

type RouteParams = { OrderDetail: { orderId: number } };

function formatOrderDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = iso.replace("T", " ").slice(0, 16);
  return d;
}

function trackingIcon(
  statusCode: string,
): { icon: keyof typeof Ionicons.glyphMap; tone: "success" | "warn" | "muted" | "info" } {
  switch (statusCode) {
    case "delivered":
      return { icon: "checkmark-circle", tone: "success" };
    case "out_for_delivery":
      return { icon: "bicycle-outline", tone: "info" };
    case "in_transit":
      return { icon: "airplane-outline", tone: "info" };
    case "picked_up":
      return { icon: "archive-outline", tone: "muted" };
    case "exception":
    case "returned":
      return { icon: "alert-circle-outline", tone: "warn" };
    default:
      return { icon: "ellipse-outline", tone: "muted" };
  }
}

function statusVisual(
  status: OrderStatus,
  t: AppTheme,
): { icon: keyof typeof Ionicons.glyphMap; bg: string; fg: string } {
  switch (status) {
    case "pending_payment":
      return {
        icon: "wallet-outline",
        bg: t.mode === "dark" ? "#2A2410" : "#FFF8E6",
        fg: t.colors.plusGold,
      };
    case "paid":
      return {
        icon: "cube-outline",
        bg: t.mode === "dark" ? "#1A1A1A" : "#F5F5F5",
        fg: t.colors.text,
      };
    case "shipped":
      return {
        icon: "airplane-outline",
        bg: t.mode === "dark" ? "#101A24" : "#EEF4FF",
        fg: t.mode === "dark" ? "#7EB8FF" : "#2563EB",
      };
    case "delivered":
      return {
        icon: "checkmark-circle-outline",
        bg: t.mode === "dark" ? "#0F1F14" : "#EEFBF2",
        fg: t.colors.success,
      };
    case "completed":
    case "settled":
      return {
        icon: "ribbon-outline",
        bg: t.mode === "dark" ? "#0F1F14" : "#EEFBF2",
        fg: t.colors.success,
      };
    case "refunded":
    case "refunded_auto":
      return {
        icon: "return-down-back-outline",
        bg: t.mode === "dark" ? "#2A1414" : "#FFF5F5",
        fg: t.colors.error,
      };
    default:
      return {
        icon: "document-text-outline",
        bg: t.colors.cardElevated,
        fg: t.colors.text,
      };
  }
}

export default function OrderDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, "OrderDetail">>();
  const { orderId } = route.params;
  const me = useAuthStore((s) => s.user);
  const { t } = useTranslation();
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);

  const [order, setOrder] = useState<Order | null>(null);
  const [product, setProduct] = useState<StoreProduct | null>(null);
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [trackingEvents, setTrackingEvents] = useState<TrackingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showShipModal, setShowShipModal] = useState(false);
  const [showAftersalesSheet, setShowAftersalesSheet] = useState(false);

  /** shipped 及之后的状态都需要拉取物流凭证 + 轨迹时间轴. */
  const fetchShipmentIfNeeded = useCallback(async (o: Order) => {
    const needs = ["shipped", "delivered", "completed", "settled"].includes(
      o.status,
    );
    if (!needs) {
      setShipment(null);
      setTrackingEvents([]);
      return;
    }
    try {
      const s = await getOrderShipment(o.id);
      setShipment(s);
    } catch {
      setShipment(null);
    }
    try {
      setTrackingLoading(true);
      const feed = await getOrderTrackingEvents(o.id);
      setTrackingEvents(feed.items || []);
    } catch {
      setTrackingEvents([]);
    } finally {
      setTrackingLoading(false);
    }
  }, []);

  const refreshTracking = useCallback(async () => {
    if (!order) return;
    try {
      setTrackingLoading(true);
      const feed = await getOrderTrackingEvents(order.id);
      setTrackingEvents(feed.items || []);
    } catch {
      // 静默：刷新按钮失败不打扰用户
    } finally {
      setTrackingLoading(false);
    }
  }, [order]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const o = await getOrder(orderId);
      setOrder(o);
      const tasks: Promise<unknown>[] = [
        getStoreProductDetail(o.productId)
          .then(setProduct)
          .catch(() => setProduct(null)),
        fetchShipmentIfNeeded(o),
      ];
      await Promise.all(tasks);
    } catch {
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }, [orderId, fetchShipmentIfNeeded]);

  useEffect(() => {
    load();
  }, [load]);

  const isBuyer = me?.id === order?.buyerUserId;
  const isSeller = me?.id === order?.sellerUserId;

  const statusHint = useMemo(() => {
    if (!order) return "";
    if (order.status === "paid" && order.shippingDueAt) {
      return t("trading.orderDetail.hintShipBy", {
        date: formatOrderDate(order.shippingDueAt),
      });
    }
    if (order.status === "shipped") {
      return t("trading.orderDetail.hintShipped");
    }
    if (order.status === "delivered" && order.autoConfirmDueAt) {
      return t("trading.orderDetail.hintAutoConfirm", {
        date: formatOrderDate(order.autoConfirmDueAt),
      });
    }
    if (order.status === "completed" && order.settlementDueAt) {
      return t("trading.orderDetail.hintSettlement", {
        date: formatOrderDate(order.settlementDueAt),
      });
    }
    if (order.status === "pending_payment") {
      return t("trading.orderDetail.hintPendingPayment");
    }
    return "";
  }, [order, t]);

  const timeline = useMemo(() => {
    if (!order) return [];
    const items: { key: string; label: string; time?: string | null; done: boolean }[] = [
      {
        key: "created",
        label: t("trading.orderDetail.timelineCreated"),
        time: order.createdAt,
        done: true,
      },
      {
        key: "paid",
        label: t("trading.orderDetail.timelinePaid"),
        time: order.paidAt,
        done: !!order.paidAt,
      },
      {
        key: "shipped",
        label: t("trading.orderDetail.timelineShipped"),
        time: order.shippedAt,
        done: !!order.shippedAt,
      },
      {
        key: "delivered",
        label: t("trading.orderDetail.timelineDelivered"),
        time: order.deliveredAt,
        done: !!order.deliveredAt,
      },
      {
        key: "completed",
        label: t("trading.orderDetail.timelineCompleted"),
        time: order.completedAt,
        done: !!order.completedAt,
      },
    ];
    if (order.settledAt) {
      items.push({
        key: "settled",
        label: t("trading.orderDetail.timelineSettled"),
        time: order.settledAt,
        done: true,
      });
    }
    return items;
  }, [order, t]);

  const copyOrderNo = async () => {
    if (!order) return;
    await Clipboard.setStringAsync(order.orderNo);
    Alert.alert(t("trading.orderDetail.copiedTitle"), t("trading.orderDetail.copiedMessage"));
  };

  const doConfirm = () => {
    if (!order) return;
    // 跳转到「确认收货」核对页：用户在那里看到 1% 手续费明细 + 3 天解冻提示
    // 后再二次确认，并由该页负责调用 confirmOrder + 跳结算回执 + 评价。
    navigation.navigate("ConfirmReceipt", { orderId: order.id });
  };

  const doSignReceipt = async () => {
    if (!order) return;
    setActionLoading(true);
    try {
      const updated = await signOrderReceipt(order.id);
      setOrder(updated);
      await fetchShipmentIfNeeded(updated);
    } catch (e: any) {
      Alert.alert(
        t("common.failed"),
        e?.message ?? t("trading.orderDetail.signFailed"),
      );
    } finally {
      setActionLoading(false);
    }
  };

  const copyTrackingNo = async () => {
    if (!shipment?.trackingNo) return;
    await Clipboard.setStringAsync(shipment.trackingNo);
    Alert.alert(
      t("trading.orderDetail.copiedTitle"),
      t("trading.orderDetail.trackingCopied"),
    );
  };

  /**
   * 售后入口的统一跳转：建立/复用客服会话 → 跳到 Chat。
   * - 传入 `issue` 时调用 `/contact-order/{id}/aftersales`，会自动追加问题模板文本。
   * - 不传时退化为既有的「联系客服」入口，仅推一张订单卡片。
   */
  const handleAftersalesIssue = useCallback(
    async (issue?: AftersalesIssue) => {
      if (!order) return;
      try {
        setActionLoading(true);
        const res = issue
          ? await contactSupportForOrderWithIssue(order.id, issue)
          : await contactSupportForOrder(order.id);
        navigation.navigate("Chat", {
          conversationId: res.conversationId,
          otherUserId: res.csUserId,
        });
      } catch (e: any) {
        Alert.alert(
          t("common.failed"),
          e?.message ?? t("trading.aftersales.openFailed"),
        );
      } finally {
        setActionLoading(false);
      }
    },
    [order, navigation, t],
  );

  const aftersalesActions = useMemo<ActionSheetAction[]>(() => {
    return [
      {
        label: t("trading.aftersales.issueNoLogistics"),
        icon: (
          <Ionicons
            name="time-outline"
            size={20}
            color={theme.colors.text}
          />
        ),
        onPress: () => handleAftersalesIssue("no_logistics_update"),
      },
      {
        label: t("trading.aftersales.issueDeliveredNotReceived"),
        icon: (
          <Ionicons
            name="alert-circle-outline"
            size={20}
            color={theme.colors.text}
          />
        ),
        onPress: () => handleAftersalesIssue("delivered_not_received"),
      },
      {
        label: t("trading.aftersales.issueQuality"),
        icon: (
          <Ionicons
            name="cube-outline"
            size={20}
            color={theme.colors.text}
          />
        ),
        onPress: () => handleAftersalesIssue("quality_issue"),
      },
      {
        label: t("trading.aftersales.issueListingDelisted"),
        icon: (
          <Ionicons
            name="storefront-outline"
            size={20}
            color={theme.colors.text}
          />
        ),
        onPress: () => handleAftersalesIssue("listing_delisted"),
      },
      {
        label: t("trading.aftersales.issueOther"),
        icon: (
          <Ionicons
            name="chatbubbles-outline"
            size={20}
            color={theme.colors.text}
          />
        ),
        onPress: () => handleAftersalesIssue(undefined),
      },
    ];
  }, [t, theme, handleAftersalesIssue]);

  // 售后入口仅在「有真实交易上下文」的状态下可用：
  //   - pending_payment / refunded* 没有可申诉的内容
  //   - settled 已结算（>3 天），按规则也不再走 v1 退款流，但可以联系客服
  const canRequestAftersales =
    !!order &&
    order.status !== "pending_payment" &&
    order.status !== "refunded" &&
    order.status !== "refunded_auto";

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator style={{ marginTop: 48 }} color={theme.colors.gray300} />
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.empty}>{t("trading.orderDetail.notFound")}</Text>
      </SafeAreaView>
    );
  }

  const visual = statusVisual(order.status as OrderStatus, theme);
  const coverImage = product?.images?.[0];
  const currency = order.currency ?? product?.currency ?? "CNY";

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="chevron-back" size={26} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {t("trading.orderDetail.headerTitle")}
        </Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.statusHero, { backgroundColor: visual.bg }]}>
          <View style={[styles.statusIconWrap, { backgroundColor: visual.fg + "18" }]}>
            <Ionicons name={visual.icon} size={28} color={visual.fg} />
          </View>
          <View style={styles.statusTextWrap}>
            <Text style={[styles.statusBig, { color: visual.fg }]}>
              {formatOrderStatus(order.status as OrderStatus)}
            </Text>
            {statusHint ? (
              <Text style={styles.statusHint}>{statusHint}</Text>
            ) : null}
          </View>
        </View>

        <SectionCard title={t("trading.orderDetail.productSection")}>
          <Pressable
            style={styles.productRow}
            onPress={() =>
              navigation.navigate("StoreProductDetail", {
                productId: order.productId,
              })
            }
          >
            {coverImage ? (
              <OptimizedImage
                uri={coverImage}
                size={ImageSize.THUMBNAIL}
                style={styles.productThumb}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.productThumb, styles.productThumbPlaceholder]}>
                <Ionicons
                  name="image-outline"
                  size={24}
                  color={theme.colors.gray300}
                />
              </View>
            )}
            <View style={styles.productInfo}>
              {product?.brand ? (
                <Text style={styles.productBrand} numberOfLines={1}>
                  {product.brand}
                </Text>
              ) : null}
              <Text style={styles.productTitle} numberOfLines={2}>
                {product?.title ??
                  t("trading.orders.productLabel", { id: order.productId })}
              </Text>
              <View style={styles.priceRow}>
                <Text style={styles.productPrice}>
                  {formatPrice(order.paidPriceCents, currency)}
                </Text>
                {order.listingPriceCents !== order.paidPriceCents ? (
                  <Text style={styles.listingPrice}>
                    {t("trading.orderDetail.listingPrice")}{" "}
                    {formatPrice(order.listingPriceCents, currency)}
                  </Text>
                ) : null}
              </View>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={theme.colors.gray300}
            />
          </Pressable>
        </SectionCard>

        <SectionCard title={t("trading.orderDetail.amountSection")}>
          <InfoRow
            label={t("trading.orderDetail.buyerPaid")}
            value={formatPrice(order.paidPriceCents, currency)}
          />
          <InfoRow
            label={t("trading.orderDetail.commission", {
              rate: (order.commissionRateBps / 100).toFixed(1),
            })}
            value={formatPrice(order.commissionCents, currency)}
            muted
          />
          <View style={styles.divider} />
          <InfoRow
            label={t("trading.orderDetail.sellerPayout")}
            value={formatPrice(order.sellerPayoutCents, currency)}
            bold
          />
        </SectionCard>

        {order.shippingAddress ? (
          <SectionCard title={t("trading.orderDetail.shippingSection")}>
            <View style={styles.shippingRow}>
              <Ionicons
                name="location-outline"
                size={18}
                color={theme.colors.gray300}
                style={{ marginTop: 2 }}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.shippingName}>
                  {(order.shippingAddress as any).receiverName}{" "}
                  <Text style={styles.shippingPhone}>
                    {(order.shippingAddress as any).phone}
                  </Text>
                </Text>
                <Text style={styles.shippingAddress}>
                  {(order.shippingAddress as any).address}
                </Text>
              </View>
            </View>
          </SectionCard>
        ) : null}

        {shipment && (shipment.carrier || shipment.trackingNo) ? (
          <SectionCard title={t("trading.orderDetail.shipmentSection")}>
            <View style={styles.shipmentHeader}>
              <View style={styles.shipmentIconWrap}>
                <Ionicons
                  name="cube-outline"
                  size={18}
                  color={theme.colors.text}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.shipmentCarrier}>
                  {shipment.carrier ||
                    t("trading.orderDetail.carrierUnknown")}
                </Text>
                {shipment.signedAt ? (
                  <Text style={styles.shipmentSubMuted}>
                    {t("trading.orderDetail.signedAt", {
                      date: formatOrderDate(shipment.signedAt),
                    })}
                  </Text>
                ) : order.shippedAt ? (
                  <Text style={styles.shipmentSubMuted}>
                    {t("trading.orderDetail.shippedAtLabel", {
                      date: formatOrderDate(order.shippedAt),
                    })}
                  </Text>
                ) : null}
              </View>
            </View>
            {shipment.trackingNo ? (
              <Pressable
                style={styles.trackingRow}
                onPress={copyTrackingNo}
                hitSlop={8}
              >
                <Text style={styles.trackingLabel}>
                  {t("trading.orderDetail.trackingNoLabel")}
                </Text>
                <View style={styles.trackingValueWrap}>
                  <Text style={styles.trackingValue} numberOfLines={1}>
                    {shipment.trackingNo}
                  </Text>
                  <Ionicons
                    name="copy-outline"
                    size={16}
                    color={theme.colors.gray300}
                  />
                </View>
              </Pressable>
            ) : null}
          </SectionCard>
        ) : null}

        {shipment && (shipment.carrier || shipment.trackingNo) ? (
          <View style={styles.section}>
            <View style={styles.trackingHeaderRow}>
              <Text style={styles.sectionTitle}>
                {t("trading.tracking.title")}
              </Text>
              <Pressable
                onPress={refreshTracking}
                hitSlop={8}
                disabled={trackingLoading}
              >
                {trackingLoading ? (
                  <ActivityIndicator
                    size="small"
                    color={theme.colors.gray300}
                  />
                ) : (
                  <Ionicons
                    name="refresh"
                    size={16}
                    color={theme.colors.gray300}
                  />
                )}
              </Pressable>
            </View>

            {trackingEvents.length === 0 ? (
              <Text style={styles.trackingEmpty}>
                {t("trading.tracking.empty")}
              </Text>
            ) : (
              <View style={styles.timeline}>
                {trackingEvents.map((ev, idx) => {
                  const meta = trackingIcon(ev.statusCode);
                  const tint =
                    meta.tone === "success"
                      ? theme.colors.success
                      : meta.tone === "warn"
                      ? theme.colors.error
                      : meta.tone === "info"
                      ? theme.colors.text
                      : theme.colors.gray300;
                  const localizedStatus = t(
                    `trading.tracking.status.${ev.statusCode}`,
                    { defaultValue: "" },
                  );
                  return (
                    <View key={ev.id} style={styles.timelineItem}>
                      <View style={styles.timelineLeft}>
                        <View
                          style={[
                            styles.trackingIconWrap,
                            { backgroundColor: tint + "1A" },
                          ]}
                        >
                          <Ionicons
                            name={meta.icon}
                            size={12}
                            color={tint}
                          />
                        </View>
                        {idx < trackingEvents.length - 1 ? (
                          <View
                            style={[
                              styles.timelineLine,
                              idx === 0 ? styles.timelineLineDone : null,
                            ]}
                          />
                        ) : null}
                      </View>
                      <View style={styles.timelineContent}>
                        <View style={styles.trackingEventTopRow}>
                          {localizedStatus ? (
                            <Text
                              style={[
                                styles.trackingStatusTag,
                                { color: tint, borderColor: tint + "55" },
                              ]}
                            >
                              {localizedStatus}
                            </Text>
                          ) : null}
                          <Text style={styles.timelineTime}>
                            {formatOrderDate(ev.occurredAt)}
                          </Text>
                        </View>
                        {ev.description ? (
                          <Text
                            style={[
                              styles.timelineLabel,
                              idx > 0 && styles.timelineLabelPending,
                            ]}
                          >
                            {ev.description}
                          </Text>
                        ) : null}
                        {ev.location ? (
                          <Text style={styles.trackingLocation}>
                            <Ionicons
                              name="location-outline"
                              size={10}
                              color={theme.colors.gray300}
                            />{" "}
                            {ev.location}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        ) : null}

        <SectionCard title={t("trading.orderDetail.orderInfoSection")}>
          <Pressable style={styles.orderNoRow} onPress={copyOrderNo}>
            <Text style={styles.orderNoLabel}>
              {t("trading.orderDetail.orderNo")}
            </Text>
            <View style={styles.orderNoValueWrap}>
              <Text style={styles.orderNoValue} numberOfLines={1}>
                {order.orderNo}
              </Text>
              <Ionicons
                name="copy-outline"
                size={16}
                color={theme.colors.gray300}
              />
            </View>
          </Pressable>
          <View style={styles.timeline}>
            {timeline.map((item, idx) => (
              <View key={item.key} style={styles.timelineItem}>
                <View style={styles.timelineLeft}>
                  <View
                    style={[
                      styles.timelineDot,
                      item.done && styles.timelineDotDone,
                    ]}
                  />
                  {idx < timeline.length - 1 ? (
                    <View
                      style={[
                        styles.timelineLine,
                        item.done && timeline[idx + 1]?.done
                          ? styles.timelineLineDone
                          : null,
                      ]}
                    />
                  ) : null}
                </View>
                <View style={styles.timelineContent}>
                  <Text
                    style={[
                      styles.timelineLabel,
                      !item.done && styles.timelineLabelPending,
                    ]}
                  >
                    {item.label}
                  </Text>
                  {item.time ? (
                    <Text style={styles.timelineTime}>
                      {formatOrderDate(item.time)}
                    </Text>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        </SectionCard>
      </ScrollView>

      <View style={styles.footer}>
        {isBuyer && order.status === "pending_payment" ? (
          <Pressable
            style={styles.primaryBtn}
            onPress={() =>
              navigation.navigate("Payment", { orderId: order.id })
            }
          >
            <Text style={styles.primaryBtnText}>
              {t("trading.payment.payNow")}
            </Text>
          </Pressable>
        ) : null}
        {isSeller && order.status === "paid" ? (
          <Pressable
            style={styles.primaryBtn}
            onPress={() => setShowShipModal(true)}
          >
            <Ionicons
              name="airplane-outline"
              size={18}
              color={theme.colors.textInverted}
              style={{ marginRight: 6 }}
            />
            <Text style={styles.primaryBtnText}>
              {t("trading.orderDetail.shipNow")}
            </Text>
          </Pressable>
        ) : null}
        {isBuyer && order.status === "shipped" ? (
          <Pressable
            style={[styles.primaryBtn, actionLoading && { opacity: 0.5 }]}
            onPress={doSignReceipt}
            disabled={actionLoading}
          >
            {actionLoading ? (
              <ActivityIndicator color={theme.colors.textInverted} />
            ) : (
              <>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={18}
                  color={theme.colors.textInverted}
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.primaryBtnText}>
                  {t("trading.orderDetail.signReceipt")}
                </Text>
              </>
            )}
          </Pressable>
        ) : null}
        {isBuyer && order.status === "delivered" ? (
          <Pressable
            style={[styles.primaryBtn, actionLoading && { opacity: 0.5 }]}
            onPress={doConfirm}
            disabled={actionLoading}
          >
            {actionLoading ? (
              <ActivityIndicator color={theme.colors.textInverted} />
            ) : (
              <Text style={styles.primaryBtnText}>
                {t("trading.orderDetail.confirmReceipt")}
              </Text>
            )}
          </Pressable>
        ) : null}
        {(isBuyer || isSeller) && canRequestAftersales ? (
          <Pressable
            style={styles.secondaryBtn}
            onPress={() => setShowAftersalesSheet(true)}
            disabled={actionLoading}
          >
            <Ionicons
              name="help-buoy-outline"
              size={16}
              color={theme.colors.text}
              style={{ marginRight: 6 }}
            />
            <Text style={styles.secondaryBtnText}>
              {t("trading.aftersales.entryButton")}
            </Text>
          </Pressable>
        ) : null}
        {(isBuyer || isSeller) &&
        (order.status === "completed" || order.status === "settled") ? (
          <Pressable
            style={styles.linkBtn}
            onPress={() =>
              navigation.navigate("OrderReviews", { orderId: order.id })
            }
          >
            <Text style={styles.linkBtnText}>
              {t("trading.tradingTab.viewReview")}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <ShipModal
        visible={showShipModal}
        orderId={order.id}
        onClose={() => setShowShipModal(false)}
        onDone={(updated) => {
          setOrder(updated);
          setShowShipModal(false);
          fetchShipmentIfNeeded(updated);
        }}
      />

      <ActionSheet
        visible={showAftersalesSheet}
        onClose={() => setShowAftersalesSheet(false)}
        title={t("trading.aftersales.sheetTitle")}
        actions={aftersalesActions}
      />
    </SafeAreaView>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function InfoRow({
  label,
  value,
  bold,
  muted,
}: {
  label: string;
  value: string;
  bold?: boolean;
  muted?: boolean;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.infoRow}>
      <Text style={[styles.infoLabel, muted && styles.infoLabelMuted]}>
        {label}
      </Text>
      <Text
        style={[
          styles.infoValue,
          bold && styles.infoValueBold,
          muted && styles.infoValueMuted,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

function ShipModal({
  visible,
  orderId,
  onClose,
  onDone,
}: {
  visible: boolean;
  orderId: number;
  onClose: () => void;
  onDone: (o: Order) => void;
}) {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const { t } = useTranslation();
  const [carrier, setCarrier] = useState("");
  const [trackingNo, setTrackingNo] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const submit = async () => {
    if (!carrier.trim() || !trackingNo.trim()) {
      setErrorMsg(t("trading.orderDetail.shipFillRequired"));
      return;
    }
    setLoading(true);
    try {
      const updated = await shipOrder(orderId, {
        carrier: carrier.trim(),
        trackingNo: trackingNo.trim(),
        images: [],
      });
      onDone(updated);
    } catch (e: any) {
      setErrorMsg(e?.message ?? t("trading.orderDetail.shipFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView
        style={styles.modalBackdrop}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>
            {t("trading.orderDetail.shipModalTitle")}
          </Text>
          <TextInput
            style={styles.input}
            placeholder={t("trading.orderDetail.carrierPlaceholder")}
            placeholderTextColor={theme.colors.placeholder}
            value={carrier}
            onChangeText={setCarrier}
          />
          <TextInput
            style={styles.input}
            placeholder={t("trading.orderDetail.trackingPlaceholder")}
            placeholderTextColor={theme.colors.placeholder}
            value={trackingNo}
            onChangeText={setTrackingNo}
          />
          {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}
          <View style={styles.modalActions}>
            <Pressable style={styles.modalBtnGhost} onPress={onClose}>
              <Text style={styles.modalBtnGhostText}>
                {t("common.cancel")}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.modalBtnPrimary, loading && { opacity: 0.5 }]}
              onPress={submit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={theme.colors.textInverted} />
              ) : (
                <Text style={styles.modalBtnPrimaryText}>
                  {t("trading.orderDetail.shipConfirm")}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
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
    scroll: { padding: 16, paddingBottom: 140 },
    statusHero: {
      flexDirection: "row",
      alignItems: "center",
      padding: 16,
      borderRadius: 12,
      marginBottom: 16,
      gap: 14,
    },
    statusIconWrap: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: "center",
      justifyContent: "center",
    },
    statusTextWrap: { flex: 1 },
    statusBig: { fontSize: 18, fontWeight: "700" },
    statusHint: {
      fontSize: 12,
      color: t.colors.gray300,
      marginTop: 4,
      lineHeight: 18,
    },
    section: {
      backgroundColor: t.colors.cardElevated,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: "600",
      color: t.colors.text,
      marginBottom: 12,
    },
    productRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    productThumb: {
      width: 72,
      height: 72,
      borderRadius: 8,
    },
    productThumbPlaceholder: {
      backgroundColor: t.colors.skeleton,
      alignItems: "center",
      justifyContent: "center",
    },
    productInfo: { flex: 1 },
    productBrand: {
      fontSize: 11,
      color: t.colors.gray300,
      marginBottom: 4,
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    productTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: t.colors.text,
      lineHeight: 20,
      marginBottom: 6,
    },
    priceRow: { flexDirection: "row", alignItems: "baseline", gap: 8, flexWrap: "wrap" },
    productPrice: { fontSize: 16, fontWeight: "700", color: t.colors.text },
    listingPrice: {
      fontSize: 12,
      color: t.colors.gray300,
      textDecorationLine: "line-through",
    },
    infoRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 6,
    },
    infoLabel: { fontSize: 13, color: t.colors.text, flex: 1 },
    infoLabelMuted: { color: t.colors.gray300 },
    infoValue: { fontSize: 13, color: t.colors.text },
    infoValueBold: { fontWeight: "700", fontSize: 15 },
    infoValueMuted: { color: t.colors.gray300 },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: t.colors.border,
      marginVertical: 8,
    },
    shippingRow: { flexDirection: "row", gap: 10 },
    shippingName: { fontSize: 14, fontWeight: "600", color: t.colors.text },
    shippingPhone: { fontWeight: "400", color: t.colors.gray400 },
    shippingAddress: {
      fontSize: 13,
      color: t.colors.gray400,
      marginTop: 6,
      lineHeight: 20,
    },
    shipmentHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginBottom: 12,
    },
    shipmentIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: t.colors.skeleton,
      alignItems: "center",
      justifyContent: "center",
    },
    shipmentCarrier: { fontSize: 14, fontWeight: "600", color: t.colors.text },
    shipmentSubMuted: {
      fontSize: 12,
      color: t.colors.gray300,
      marginTop: 2,
    },
    trackingRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingTop: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border,
    },
    trackingLabel: { fontSize: 13, color: t.colors.gray300 },
    trackingValueWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      maxWidth: "65%",
    },
    trackingValue: { fontSize: 13, color: t.colors.text, fontWeight: "500" },
    trackingHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    trackingEmpty: {
      fontSize: 13,
      color: t.colors.gray300,
      paddingVertical: 12,
      textAlign: "center",
    },
    trackingIconWrap: {
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 1,
    },
    trackingEventTopRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: 2,
    },
    trackingStatusTag: {
      fontSize: 11,
      fontWeight: "600",
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      borderWidth: 1,
    },
    trackingLocation: {
      fontSize: 11,
      color: t.colors.gray300,
      marginTop: 4,
    },
    orderNoRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingBottom: 12,
      marginBottom: 4,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    orderNoLabel: { fontSize: 13, color: t.colors.gray300 },
    orderNoValueWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      maxWidth: "65%",
    },
    orderNoValue: { fontSize: 12, color: t.colors.text, fontWeight: "500" },
    timeline: { marginTop: 8 },
    timelineItem: { flexDirection: "row", minHeight: 44 },
    timelineLeft: { width: 26, alignItems: "center" },
    timelineDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      borderWidth: 2,
      borderColor: t.colors.gray200,
      backgroundColor: t.colors.background,
      marginTop: 4,
    },
    timelineDotDone: {
      borderColor: t.colors.text,
      backgroundColor: t.colors.text,
    },
    timelineLine: {
      flex: 1,
      width: 2,
      backgroundColor: t.colors.gray200,
      marginVertical: 2,
    },
    timelineLineDone: { backgroundColor: t.colors.text },
    timelineContent: { flex: 1, paddingBottom: 12, paddingLeft: 8 },
    timelineLabel: { fontSize: 13, color: t.colors.text, fontWeight: "500" },
    timelineLabelPending: { color: t.colors.gray300, fontWeight: "400" },
    timelineTime: { fontSize: 11, color: t.colors.gray300, marginTop: 2 },
    empty: { textAlign: "center", marginTop: 48, color: t.colors.gray300 },
    footer: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 24,
      backgroundColor: t.colors.card,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border,
      gap: 8,
    },
    primaryBtn: {
      backgroundColor: t.colors.accent,
      paddingVertical: 14,
      borderRadius: 4,
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "center",
    },
    primaryBtnText: {
      color: t.colors.textInverted,
      fontSize: 15,
      fontWeight: "600",
    },
    secondaryBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 12,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    secondaryBtnText: { color: t.colors.text, fontSize: 14, fontWeight: "500" },
    linkBtn: { paddingVertical: 8, alignItems: "center" },
    linkBtnText: { color: t.colors.gray300, fontSize: 13 },
    modalBackdrop: {
      flex: 1,
      backgroundColor: t.colors.overlay,
      justifyContent: "flex-end",
    },
    modalSheet: {
      backgroundColor: t.colors.card,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      padding: 20,
      paddingBottom: 32,
    },
    modalHandle: {
      alignSelf: "center",
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: t.colors.border,
      marginBottom: 16,
    },
    modalTitle: {
      fontSize: 16,
      fontWeight: "600",
      marginBottom: 16,
      color: t.colors.text,
    },
    input: {
      borderWidth: 1,
      borderColor: t.colors.inputBorder,
      borderRadius: 8,
      padding: 12,
      marginBottom: 12,
      fontSize: 14,
      color: t.colors.text,
      backgroundColor: t.colors.inputBackground,
    },
    error: { color: t.colors.error, marginBottom: 12, fontSize: 13 },
    modalActions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: 12,
      marginTop: 4,
    },
    modalBtnGhost: { paddingVertical: 12, paddingHorizontal: 16 },
    modalBtnGhostText: { color: t.colors.gray300, fontSize: 14 },
    modalBtnPrimary: {
      backgroundColor: t.colors.accent,
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: 4,
      minWidth: 120,
      alignItems: "center",
    },
    modalBtnPrimaryText: { color: t.colors.textInverted, fontWeight: "600" },
  });
