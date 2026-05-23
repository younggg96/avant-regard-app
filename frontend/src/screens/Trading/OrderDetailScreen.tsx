/**
 * OrderDetailScreen —— PRD 模块四单订单详情与状态推进。
 *
 * 角色判断：
 *   - 当前用户 = buyer  → 可：确认收货 / 提交验货
 *   - 当前用户 = seller → 可：发货
 *   - admin              → 可：标记签收（mock，实际靠快递回调）
 */
import React, { useEffect, useState, useCallback } from "react";
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import {
  getOrder,
  confirmOrder,
  shipOrder,
  Order,
  formatOrderStatus,
} from "../../services/orderService";
import { formatPrice } from "../../services/storeProductService";
import { useAuthStore } from "../../store/authStore";
import { contactSupportForOrder } from "../../services/aftersalesService";
import { useAppTheme, useThemedStyles, type AppTheme } from "../../theme";

type RouteParams = { OrderDetail: { orderId: number } };

export default function OrderDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, "OrderDetail">>();
  const { orderId } = route.params;
  const me = useAuthStore((s) => s.user);
  const { t } = useTranslation();
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showShipModal, setShowShipModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const o = await getOrder(orderId);
      setOrder(o);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load]);

  const isBuyer = me?.id === order?.buyerUserId;
  const isSeller = me?.id === order?.sellerUserId;
  // 注意：买手店卖家身份判断由后端兜底（GET /orders/{id} 403）；这里乐观假定

  const doConfirm = async () => {
    if (!order) return;
    setActionLoading(true);
    try {
      const updated = await confirmOrder(order.id);
      setOrder(updated);
      // PDF p.9 设计要点：确认收货 → 3 步评分 → MY ARCHIVE 召唤页
      navigation.navigate("TradeReview", {
        orderId: order.id,
        productId: order.productId,
      });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator style={{ marginTop: 32 }} />
      </SafeAreaView>
    );
  }
  if (!order) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.empty}>订单不存在</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={26} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>订单详情</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.statusCard}>
          <Text style={styles.statusBig}>
            {formatOrderStatus(order.status)}
          </Text>
          <Text style={styles.statusHint}>
            {order.status === "paid" && order.shippingDueAt
              ? `卖家需在 ${order.shippingDueAt.slice(0, 16)} 前发货`
              : order.status === "delivered" && order.autoConfirmDueAt
              ? `${order.autoConfirmDueAt.slice(0, 16)} 自动确认收货`
              : order.status === "completed" && order.settlementDueAt
              ? `${order.settlementDueAt.slice(0, 16)} 进入卖家可提现余额`
              : ""}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>商品</Text>
          <Text style={styles.row}>单品 #{order.productId}</Text>
          <Text style={styles.row}>
            成交价 <Text style={styles.bold}>{formatPrice(order.paidPriceCents)}</Text>
          </Text>
          <Text style={styles.row}>
            原挂牌价 {formatPrice(order.listingPriceCents)}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>金额明细</Text>
          <Text style={styles.row}>
            买家实付 {formatPrice(order.paidPriceCents)}
          </Text>
          <Text style={styles.row}>
            平台佣金 {formatPrice(order.commissionCents)} ({(order.commissionRateBps / 100).toFixed(1)}%)
          </Text>
          <Text style={styles.row}>
            卖家应收 <Text style={styles.bold}>{formatPrice(order.sellerPayoutCents)}</Text>
          </Text>
        </View>

        {order.shippingAddress ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>收货信息</Text>
            <Text style={styles.row}>
              {(order.shippingAddress as any).receiverName} ·{" "}
              {(order.shippingAddress as any).phone}
            </Text>
            <Text style={styles.row}>
              {(order.shippingAddress as any).address}
            </Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>订单信息</Text>
          <Text style={styles.row}>订单号 {order.orderNo}</Text>
          <Text style={styles.row}>创建 {order.createdAt?.slice(0, 16)}</Text>
          {order.paidAt ? (
            <Text style={styles.row}>支付 {order.paidAt.slice(0, 16)}</Text>
          ) : null}
          {order.shippedAt ? (
            <Text style={styles.row}>发货 {order.shippedAt.slice(0, 16)}</Text>
          ) : null}
          {order.deliveredAt ? (
            <Text style={styles.row}>签收 {order.deliveredAt.slice(0, 16)}</Text>
          ) : null}
          {order.completedAt ? (
            <Text style={styles.row}>完成 {order.completedAt.slice(0, 16)}</Text>
          ) : null}
          {order.settledAt ? (
            <Text style={styles.row}>结算 {order.settledAt.slice(0, 16)}</Text>
          ) : null}
        </View>
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
            <Text style={styles.primaryBtnText}>去发货</Text>
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
              <Text style={styles.primaryBtnText}>确认收货</Text>
            )}
          </Pressable>
        ) : null}
        {/* PDF p.10 设计要点：售后改成直接「联系客服」IM 入口，不再走程序化退款表单 */}
        {(isBuyer || isSeller) &&
        order.status !== "pending_payment" &&
        order.status !== "refunded_auto" &&
        order.status !== "refunded" ? (
          <Pressable
            style={styles.linkBtn}
            onPress={async () => {
              try {
                setActionLoading(true);
                const res = await contactSupportForOrder(order.id);
                navigation.navigate("Chat", {
                  conversationId: res.conversationId,
                  otherUserId: res.csUserId,
                });
              } catch (e: any) {
                Alert.alert(
                  t("common.failed"),
                  e?.message ?? t("trading.support.contactFailed"),
                );
              } finally {
                setActionLoading(false);
              }
            }}
          >
            <Text style={styles.linkBtnText}>
              {t("trading.support.contactSupportOnOrder")}
            </Text>
          </Pressable>
        ) : null}
        {(isBuyer || isSeller) &&
        (order.status === "completed" || order.status === "settled") ? (
          <Pressable
            style={styles.linkBtn}
            onPress={() =>
              navigation.navigate("TradeReview", { orderId: order.id })
            }
          >
            <Text style={styles.linkBtnText}>
              {t("trading.review.headerTitle")}
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
        }}
      />
    </SafeAreaView>
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
  const [carrier, setCarrier] = useState("");
  const [trackingNo, setTrackingNo] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const submit = async () => {
    if (!carrier.trim() || !trackingNo.trim()) {
      setErrorMsg("请填写承运商和单号");
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
      setErrorMsg(e?.message ?? "发货失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalBackdrop}>
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>填写物流信息</Text>
          <TextInput
            style={styles.input}
            placeholder="承运商，如 顺丰、京东"
            placeholderTextColor={theme.colors.placeholder}
            value={carrier}
            onChangeText={setCarrier}
          />
          <TextInput
            style={styles.input}
            placeholder="物流单号"
            placeholderTextColor={theme.colors.placeholder}
            value={trackingNo}
            onChangeText={setTrackingNo}
          />
          {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}
          <View style={styles.modalActions}>
            <Pressable style={styles.modalBtnGhost} onPress={onClose}>
              <Text style={styles.modalBtnGhostText}>取消</Text>
            </Pressable>
            <Pressable
              style={[styles.modalBtnPrimary, loading && { opacity: 0.5 }]}
              onPress={submit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={theme.colors.textInverted} />
              ) : (
                <Text style={styles.modalBtnPrimaryText}>确认发货</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
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
    scroll: { padding: 12, paddingBottom: 100 },
    statusCard: {
      backgroundColor: t.colors.accent,
      padding: 20,
      borderRadius: 12,
      marginBottom: 16,
    },
    statusBig: {
      color: t.colors.textInverted,
      fontSize: 20,
      fontWeight: "700",
    },
    statusHint: {
      color: t.colors.textInverted,
      opacity: 0.7,
      fontSize: 12,
      marginTop: 8,
    },
    section: {
      backgroundColor: t.colors.cardElevated,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: "600",
      color: t.colors.text,
      marginBottom: 8,
    },
    row: { fontSize: 13, color: t.colors.gray400, marginVertical: 4 },
    bold: { fontWeight: "700", color: t.colors.text },
    empty: { textAlign: "center", marginTop: 32, color: t.colors.gray300 },
    footer: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 24,
      backgroundColor: t.colors.card,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border,
    },
    primaryBtn: {
      backgroundColor: t.colors.accent,
      paddingVertical: 14,
      borderRadius: 24,
      alignItems: "center",
    },
    primaryBtnText: {
      color: t.colors.textInverted,
      fontSize: 15,
      fontWeight: "600",
    },
    linkBtn: {
      paddingVertical: 8,
      alignItems: "center",
      marginTop: 8,
    },
    linkBtnText: { color: t.colors.gray300, fontSize: 13 },
    modalBackdrop: {
      flex: 1,
      backgroundColor: t.colors.scrim,
      justifyContent: "flex-end",
    },
    modal: {
      backgroundColor: t.colors.card,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      padding: 16,
      paddingBottom: 32,
    },
    modalTitle: {
      fontSize: 16,
      fontWeight: "600",
      marginBottom: 12,
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
    error: { color: t.colors.error, marginBottom: 12 },
    modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 12 },
    modalBtnGhost: { paddingVertical: 12, paddingHorizontal: 20 },
    modalBtnGhostText: { color: t.colors.gray300 },
    modalBtnPrimary: {
      backgroundColor: t.colors.accent,
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: 20,
    },
    modalBtnPrimaryText: { color: t.colors.textInverted, fontWeight: "600" },
  });
