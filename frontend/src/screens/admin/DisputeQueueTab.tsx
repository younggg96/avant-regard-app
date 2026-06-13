/**
 * DisputeQueueTab —— Admin · 售后仲裁队列（PRD 模块 5）。
 *
 * 列表来源：GET /api/admin/disputes/queue（open + investigating）
 * 操作：受理（take）/ 判退款（resolved_refund）/ 判放款（resolved_release）
 */
import React, { useEffect, useState, useCallback } from "react";
import {
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
  RefreshControl,
  TouchableOpacity,
  Modal,
  ScrollView,
  View,
  Pressable,
} from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAppTheme, useThemedStyles, type AppTheme } from "../../theme";
import { useSharedStyles } from "./adminStyles";
import { Box, Text } from "../../components/ui";
import { OptimizedImage } from "../../components/ui/OptimizedImage";
import { ImageSize } from "../../utils/imageUtils";
import { FullscreenImageViewer } from "../../components/PostDetail/FullscreenImageViewer";
import { useFormatPrice } from "../../utils/currency";
import {
  adminListDisputes,
  adminTakeDispute,
  adminResolveDispute,
  Dispute,
  DisputeReason,
  DisputeStatus,
} from "../../services/aftersalesService";

export default function DisputeQueueTab() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const sharedStyles = useSharedStyles();
  const formatPrice = useFormatPrice();
  const [items, setItems] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [detail, setDetail] = useState<Dispute | null>(null);

  const formatStatus = (status: DisputeStatus) =>
    t(`admin.disputeStatus.${status}`, { defaultValue: status });

  const formatReason = (reason: DisputeReason) =>
    t(`admin.disputeReason.${reason}`, { defaultValue: reason });

  const formatRole = (role: "buyer" | "seller") =>
    t(`admin.disputeRole.${role}`, { defaultValue: role });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminListDisputes();
      setItems(res.items);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const onTake = async (id: number) => {
    try {
      await adminTakeDispute(id);
      load();
    } catch (e: unknown) {
      Alert.alert(
        t("common.failed"),
        e instanceof Error ? e.message : t("admin.operationFailed"),
      );
    }
  };

  const onResolve = async (
    id: number,
    decision: "resolved_refund" | "resolved_release",
  ) => {
    const title =
      decision === "resolved_refund"
        ? t("admin.disputeResolveRefundTitle")
        : t("admin.disputeResolveReleaseTitle");

    Alert.alert(title, t("admin.disputeResolveConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.confirm"),
        style: "destructive",
        onPress: async () => {
          try {
            await adminResolveDispute(id, { decision });
            load();
          } catch (e: unknown) {
            Alert.alert(
              t("common.failed"),
              e instanceof Error ? e.message : t("admin.operationFailed"),
            );
          }
        },
      },
    ]);
  };

  if (loading && items.length === 0) {
    return (
      <Box style={sharedStyles.loadingContainer}>
        <ActivityIndicator color={theme.colors.text} size="small" />
        <Text style={sharedStyles.loadingText}>{t("common.loading")}</Text>
      </Box>
    );
  }

  return (
    <>
    <FlatList
      data={items}
      keyExtractor={(d) => String(d.id)}
      style={sharedStyles.content}
      contentContainerStyle={
        items.length === 0 ? sharedStyles.emptyContainer : undefined
      }
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      renderItem={({ item }) => (
        <Box style={sharedStyles.postCard}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setDetail(item)}
          >
            <Box style={sharedStyles.postHeader}>
              <Text style={sharedStyles.postTitle}>
                {t("admin.disputeTitle", { id: item.id })}
              </Text>
              <Text style={styles.status}>{formatStatus(item.status)}</Text>
            </Box>

            <Text style={styles.row}>
              {t("admin.disputeOrder", { orderId: item.orderId })}
              {item.productTitle ? ` · ${item.productTitle}` : ""}
            </Text>
            <Text style={styles.row}>
              {t("admin.disputeOpener", {
                userId: item.openerUserId,
                role: formatRole(item.openerRole),
                reason: formatReason(item.reason),
              })}
            </Text>

            {item.description ? (
              <Text style={styles.desc} numberOfLines={2}>
                {item.description}
              </Text>
            ) : null}

            <Text style={styles.detailHint}>
              {t("admin.disputeDetail.viewMore")}
            </Text>
          </TouchableOpacity>

          <Box style={styles.actions}>
            {item.status === "open" ? (
              <TouchableOpacity
                style={[styles.compactBtn, styles.ghostBtn]}
                onPress={() => onTake(item.id)}
              >
                <Text style={styles.ghostBtnText}>{t("admin.disputeTake")}</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={[styles.compactBtn, styles.refundBtn]}
              onPress={() => onResolve(item.id, "resolved_refund")}
            >
              <Text style={styles.btnText}>
                {t("admin.disputeResolveRefund")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.compactBtn, styles.releaseBtn]}
              onPress={() => onResolve(item.id, "resolved_release")}
            >
              <Text style={styles.btnText}>
                {t("admin.disputeResolveRelease")}
              </Text>
            </TouchableOpacity>
          </Box>
        </Box>
      )}
      ListEmptyComponent={
        <Text style={sharedStyles.emptyText}>
          {t("admin.noPendingDisputes")}
        </Text>
      }
    />
    <DisputeDetailModal
      dispute={detail}
      onClose={() => setDetail(null)}
      formatStatus={formatStatus}
      formatReason={formatReason}
      formatRole={formatRole}
      formatPrice={formatPrice}
      onTake={(id) => {
        setDetail(null);
        onTake(id);
      }}
      onResolve={(id, decision) => {
        setDetail(null);
        onResolve(id, decision);
      }}
    />
    </>
  );
}

interface DisputeDetailModalProps {
  dispute: Dispute | null;
  onClose: () => void;
  formatStatus: (s: DisputeStatus) => string;
  formatReason: (r: DisputeReason) => string;
  formatRole: (role: "buyer" | "seller") => string;
  formatPrice: (cents: number, currency: string) => string;
  onTake: (id: number) => void;
  onResolve: (id: number, decision: "resolved_refund" | "resolved_release") => void;
}

const DisputeDetailModal: React.FC<DisputeDetailModalProps> = ({
  dispute,
  onClose,
  formatStatus,
  formatReason,
  formatRole,
  formatPrice,
  onTake,
  onResolve,
}) => {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const [viewer, setViewer] = useState<{ images: string[]; index: number } | null>(
    null,
  );

  if (!dispute) return null;
  const d = dispute;

  const renderPhotos = (label: string, photos: string[] | null | undefined) => (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {photos && photos.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.evidenceRow}>
            {photos.map((uri, idx) => (
              <TouchableOpacity
                key={`${uri}-${idx}`}
                style={styles.evidenceTile}
                activeOpacity={0.8}
                onPress={() => setViewer({ images: photos, index: idx })}
              >
                <OptimizedImage
                  uri={uri}
                  size={ImageSize.THUMBNAIL}
                  style={{ width: "100%", height: "100%" }}
                  contentFit="cover"
                />
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      ) : (
        <Text style={styles.fieldEmpty}>{t("admin.disputeDetail.noEvidence")}</Text>
      )}
    </View>
  );

  return (
    <Modal
      visible={!!dispute}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.modalContainer} edges={["top"]}>
        <View style={styles.modalHeader}>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </Pressable>
          <Text style={styles.modalTitle} numberOfLines={1}>
            {t("admin.disputeTitle", { id: d.id })}
          </Text>
          <Text style={styles.modalStatus}>{formatStatus(d.status)}</Text>
        </View>

        <ScrollView contentContainerStyle={styles.modalBody}>
          {/* 订单信息 */}
          <Text style={styles.sectionTitle}>
            {t("admin.disputeDetail.orderSection")}
          </Text>
          <View style={styles.productRow}>
            {d.productImage ? (
              <OptimizedImage
                uri={d.productImage}
                size={ImageSize.THUMBNAIL}
                style={styles.thumb}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.thumb, styles.thumbPlaceholder]}>
                <Ionicons
                  name="image-outline"
                  size={22}
                  color={theme.colors.gray300}
                />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.productTitle} numberOfLines={2}>
                {d.productTitle || t("admin.disputeDetail.noProduct")}
              </Text>
              {d.paidPriceCents != null ? (
                <Text style={styles.productPrice}>
                  {formatPrice(d.paidPriceCents, d.currency ?? "CNY")}
                </Text>
              ) : null}
            </View>
          </View>
          <FieldRow
            label={t("admin.disputeDetail.orderNo")}
            value={d.orderNo || `#${d.orderId}`}
          />
          <FieldRow
            label={t("admin.disputeDetail.buyer")}
            value={d.buyerUserId != null ? `#${d.buyerUserId}` : "—"}
          />
          <FieldRow
            label={t("admin.disputeDetail.seller")}
            value={d.sellerUserId != null ? `#${d.sellerUserId}` : "—"}
          />

          {/* 争议信息 */}
          <Text style={[styles.sectionTitle, { marginTop: 16 }]}>
            {t("admin.disputeDetail.disputeSection")}
          </Text>
          <FieldRow
            label={t("admin.disputeDetail.reason")}
            value={formatReason(d.reason)}
          />
          <FieldRow
            label={t("admin.disputeDetail.openerLabel", {
              userId: d.openerUserId,
              role: formatRole(d.openerRole),
            })}
            value=""
          />
          {d.createdAt ? (
            <FieldRow
              label={t("admin.disputeDetail.createdAt")}
              value={d.createdAt.replace("T", " ").slice(0, 16)}
            />
          ) : null}

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>
              {t("admin.disputeDetail.description")}
            </Text>
            <Text style={d.description ? styles.fieldValue : styles.fieldEmpty}>
              {d.description || t("admin.disputeDetail.noDescription")}
            </Text>
          </View>

          {renderPhotos(t("admin.disputeDetail.evidence"), d.evidencePhotos)}

          {/* 卖家响应 */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>
              {t("admin.disputeDetail.sellerResponse")}
            </Text>
            {d.sellerResponseAction ? (
              <>
                <Text style={styles.fieldValue}>
                  {d.sellerResponseAction === "agree_refund"
                    ? t("admin.disputeDetail.sellerResponseAgree")
                    : t("admin.disputeDetail.sellerResponseReject")}
                </Text>
                {d.sellerResponse ? (
                  <Text style={styles.fieldValue}>{d.sellerResponse}</Text>
                ) : null}
              </>
            ) : (
              <Text style={styles.fieldEmpty}>
                {t("admin.disputeDetail.sellerResponseNone")}
              </Text>
            )}
          </View>
          {d.sellerEvidencePhotos && d.sellerEvidencePhotos.length > 0
            ? renderPhotos(
                t("admin.disputeDetail.sellerEvidence"),
                d.sellerEvidencePhotos,
              )
            : null}
        </ScrollView>

        <View style={styles.modalActions}>
          {d.status === "open" ? (
            <TouchableOpacity
              style={[styles.compactBtn, styles.ghostBtn]}
              onPress={() => onTake(d.id)}
            >
              <Text style={styles.ghostBtnText}>{t("admin.disputeTake")}</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={[styles.compactBtn, styles.refundBtn]}
            onPress={() => onResolve(d.id, "resolved_refund")}
          >
            <Text style={styles.btnText}>{t("admin.disputeResolveRefund")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.compactBtn, styles.releaseBtn]}
            onPress={() => onResolve(d.id, "resolved_release")}
          >
            <Text style={styles.btnText}>{t("admin.disputeResolveRelease")}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <FullscreenImageViewer
        visible={!!viewer}
        images={viewer?.images ?? []}
        currentIndex={viewer?.index ?? 0}
        onClose={() => setViewer(null)}
        onIndexChange={(index) =>
          setViewer((prev) => (prev ? { ...prev, index } : prev))
        }
      />
    </Modal>
  );
};

const FieldRow: React.FC<{ label: string; value: string }> = ({
  label,
  value,
}) => {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldRowLabel}>{label}</Text>
      {value ? <Text style={styles.fieldRowValue}>{value}</Text> : null}
    </View>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    status: {
      fontSize: 11,
      lineHeight: 14,
      color: t.colors.gray300,
    },
    row: {
      fontSize: 12,
      lineHeight: 16,
      color: t.colors.gray400,
      marginBottom: 3,
    },
    desc: {
      fontSize: 12,
      lineHeight: 16,
      color: t.colors.text,
      backgroundColor: t.colors.surface,
      padding: 6,
      borderRadius: 4,
      marginVertical: 6,
    },
    detailHint: {
      fontSize: 11,
      lineHeight: 14,
      color: t.colors.accent,
      marginTop: 2,
    },
    actions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: 6,
      marginTop: 6,
      paddingTop: 6,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border,
    },
    compactBtn: {
      paddingVertical: 5,
      paddingHorizontal: 10,
      borderRadius: 4,
    },
    ghostBtn: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.gray300,
      backgroundColor: t.colors.surface,
    },
    ghostBtnText: {
      fontSize: 11,
      fontWeight: "600",
      color: t.colors.text,
    },
    refundBtn: {
      backgroundColor: t.colors.error,
    },
    releaseBtn: {
      backgroundColor: t.colors.success,
    },
    btnText: {
      fontSize: 11,
      fontWeight: "600",
      color: t.colors.textInverted,
    },
    // ===== Detail Modal =====
    modalContainer: {
      flex: 1,
      backgroundColor: t.colors.background,
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
      backgroundColor: t.colors.card,
    },
    modalTitle: {
      fontSize: 15,
      fontWeight: "600",
      color: t.colors.text,
      flex: 1,
      textAlign: "center",
      marginHorizontal: 8,
    },
    modalStatus: {
      fontSize: 12,
      color: t.colors.gray400,
      minWidth: 48,
      textAlign: "right",
    },
    modalBody: {
      padding: 12,
      paddingBottom: 24,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: t.colors.text,
      marginBottom: 8,
    },
    productRow: {
      flexDirection: "row",
      gap: 10,
      marginBottom: 10,
    },
    thumb: {
      width: 56,
      height: 56,
      borderRadius: 4,
      backgroundColor: t.colors.surface,
    },
    thumbPlaceholder: {
      alignItems: "center",
      justifyContent: "center",
    },
    productTitle: {
      fontSize: 13,
      lineHeight: 17,
      color: t.colors.text,
      fontWeight: "600",
    },
    productPrice: {
      fontSize: 13,
      color: t.colors.text,
      marginTop: 4,
      fontWeight: "600",
    },
    fieldRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 10,
      paddingVertical: 4,
    },
    fieldRowLabel: {
      fontSize: 12,
      color: t.colors.gray400,
      flexShrink: 1,
    },
    fieldRowValue: {
      fontSize: 12,
      color: t.colors.text,
      flexShrink: 1,
      textAlign: "right",
    },
    field: {
      marginTop: 10,
    },
    fieldLabel: {
      fontSize: 12,
      color: t.colors.gray400,
      marginBottom: 4,
    },
    fieldValue: {
      fontSize: 13,
      lineHeight: 18,
      color: t.colors.text,
      marginBottom: 2,
    },
    fieldEmpty: {
      fontSize: 13,
      color: t.colors.gray300,
      fontStyle: "italic",
    },
    evidenceRow: {
      flexDirection: "row",
      gap: 8,
      paddingVertical: 2,
    },
    evidenceTile: {
      width: 72,
      height: 72,
      borderRadius: 4,
      overflow: "hidden",
      backgroundColor: t.colors.surface,
    },
    modalActions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: 8,
      padding: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border,
      backgroundColor: t.colors.card,
    },
  });
