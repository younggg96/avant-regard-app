/**
 * 后台 · 单品审核 Tab（PRD Phase 1）。
 *
 * 列出 status='reviewing' 的所有 listing；admin 可逐条 approve/reject。
 * 顶部一键 toggle `listingAutoApprove` feature flag，开启后所有新提交自动通过。
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  RefreshControl,
  StyleSheet,
  Switch,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { Box, HStack, Pressable, ScrollView, Text, VStack } from "../../components/ui";
import { OptimizedImage } from "../../components/ui/OptimizedImage";
import { FullscreenImageViewer } from "../../components/PostDetail";
import { useAppTheme, useThemedStyles, type AppTheme } from "../../theme";
import { Alert } from "../../utils/Alert";
import {
  adminListReviewingListings,
  adminReviewListing,
  type StoreProduct,
} from "../../services/storeProductService";
import { useFormatPrice } from "../../utils/currency";
import { request } from "../../services/http";

interface FeatureFlagsPayload {
  lotteryEnabled: boolean;
  listingAutoApprove: boolean;
}

/** iOS Switch 默认偏大，统一缩小以匹配 admin 列表行高 */
const COMPACT_SWITCH_PROPS = Platform.select({
  ios: { style: { transform: [{ scaleX: 0.82 }, { scaleY: 0.82 }] } as const },
  default: {},
});

const ProductReviewTab: React.FC = () => {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const formatPrice = useFormatPrice();
  const styles = useThemedStyles(makeStyles);
  const [items, setItems] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [autoApprove, setAutoApprove] = useState(false);

  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [fullscreenVisible, setFullscreenVisible] = useState(false);
  const [fullscreenImages, setFullscreenImages] = useState<string[]>([]);
  const [fullscreenIndex, setFullscreenIndex] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, flags] = await Promise.all([
        adminListReviewingListings(1, 100),
        request<FeatureFlagsPayload>(`/api/feature-flags`, { method: "GET" }),
      ]);
      setItems(list.products || []);
      setAutoApprove(!!flags?.listingAutoApprove);
    } catch (e) {
      Alert.show(
        e instanceof Error ? e.message : t("admin.operationFailed"),
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleApprove = async (productId: number) => {
    setActionLoading(true);
    try {
      await adminReviewListing(productId, "approved");
      setItems((prev) => prev.filter((p) => p.id !== productId));
    } catch (e) {
      Alert.show(
        e instanceof Error ? e.message : t("admin.operationFailed"),
      );
    } finally {
      setActionLoading(false);
    }
  };

  const openReject = (productId: number) => {
    setRejectingId(productId);
    setRejectReason("");
    setRejectModalVisible(true);
  };

  const confirmReject = async () => {
    if (!rejectingId) return;
    setActionLoading(true);
    try {
      await adminReviewListing(rejectingId, "rejected", rejectReason);
      setItems((prev) => prev.filter((p) => p.id !== rejectingId));
      setRejectModalVisible(false);
    } catch (e) {
      Alert.show(
        e instanceof Error ? e.message : t("admin.operationFailed"),
      );
    } finally {
      setActionLoading(false);
    }
  };

  const toggleAutoApprove = async (next: boolean) => {
    setAutoApprove(next);
    try {
      await request(`/api/admin/feature-flags`, {
        method: "PUT",
        body: JSON.stringify({ listingAutoApprove: next }),
      });
    } catch {
      // admin feature flag 写接口可能尚未实现
    }
  };

  const openImage = (images: string[]) => {
    if (!images.length) return;
    setFullscreenImages(images);
    setFullscreenIndex(0);
    setFullscreenVisible(true);
  };

  return (
    <Box style={styles.container}>
      <Box style={styles.flagRow}>
        <VStack style={{ flex: 1, paddingRight: 8 }}>
          <Text style={styles.flagTitle}>
            {t("admin.listingAutoApproveTitle")}
          </Text>
          <Text style={styles.flagDescription}>
            {t("admin.listingAutoApproveHint")}
          </Text>
        </VStack>
        <Switch
          {...COMPACT_SWITCH_PROPS}
          value={autoApprove}
          onValueChange={toggleAutoApprove}
          trackColor={{ false: theme.colors.gray200, true: theme.colors.accent }}
          thumbColor={theme.colors.card}
        />
      </Box>

      {loading ? (
        <Box style={styles.center}>
          <ActivityIndicator color={theme.colors.text} />
        </Box>
      ) : items.length === 0 ? (
        <Box style={styles.center}>
          <Text style={styles.empty}>{t("admin.noPendingListings")}</Text>
        </Box>
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={{ paddingVertical: 8 }}
        >
          {items.map((p) => (
            <Box key={p.id} style={styles.card}>
              <HStack space="md">
                <Pressable
                  style={styles.thumb}
                  onPress={() => openImage(p.images || [])}
                  disabled={!p.images?.[0]}
                >
                  {p.images?.[0] ? (
                    <OptimizedImage uri={p.images[0]} style={styles.thumbImg} />
                  ) : (
                    <Box style={[styles.thumbImg, styles.thumbEmpty]} />
                  )}
                </Pressable>
                <VStack style={{ flex: 1 }} space="xs">
                  <Text style={styles.title} numberOfLines={1}>
                    {p.title}
                  </Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    {[p.brand, p.size, p.color, p.condition]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                  <Text style={styles.price}>
                    {formatPrice(p.priceCents, p.currency)}
                  </Text>
                  {p.conditionNote ? (
                    <Text style={styles.note} numberOfLines={2}>
                      {t("admin.listingConditionNote", {
                        note: p.conditionNote,
                      })}
                    </Text>
                  ) : null}
                </VStack>
              </HStack>
              <HStack space="sm" style={styles.actions}>
                <TouchableOpacity
                  style={[styles.btn, styles.btnReject]}
                  disabled={actionLoading}
                  onPress={() => openReject(p.id)}
                >
                  <Ionicons name="close" size={14} color={theme.colors.error} />
                  <Text style={[styles.btnText, { color: theme.colors.error }]}>
                    {t("admin.reject")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, styles.btnApprove]}
                  disabled={actionLoading}
                  onPress={() => handleApprove(p.id)}
                >
                  <Ionicons
                    name="checkmark"
                    size={14}
                    color={theme.colors.textInverted}
                  />
                  <Text
                    style={[styles.btnText, { color: theme.colors.textInverted }]}
                  >
                    {t("admin.approve")}
                  </Text>
                </TouchableOpacity>
              </HStack>
            </Box>
          ))}
        </ScrollView>
      )}

      <Modal
        animationType="fade"
        transparent
        visible={rejectModalVisible}
        onRequestClose={() => setRejectModalVisible(false)}
      >
        <Box style={styles.modalBackdrop}>
          <Box style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {t("admin.listingRejectTitle")}
            </Text>
            <TextInput
              style={styles.modalInput}
              multiline
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder={t("admin.listingRejectPlaceholder") as string}
              placeholderTextColor={theme.colors.placeholder}
            />
            <HStack space="sm" style={{ marginTop: 12 }}>
              <TouchableOpacity
                style={[styles.btn, styles.btnReject, { flex: 1 }]}
                onPress={() => setRejectModalVisible(false)}
              >
                <Text style={[styles.btnText, { color: theme.colors.error }]}>
                  {t("common.cancel")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnApprove, { flex: 1 }]}
                onPress={confirmReject}
                disabled={actionLoading}
              >
                <Text
                  style={[styles.btnText, { color: theme.colors.textInverted }]}
                >
                  {t("common.submit")}
                </Text>
              </TouchableOpacity>
            </HStack>
          </Box>
        </Box>
      </Modal>

      <FullscreenImageViewer
        visible={fullscreenVisible}
        images={fullscreenImages}
        currentIndex={fullscreenIndex}
        onClose={() => setFullscreenVisible(false)}
        onIndexChange={setFullscreenIndex}
      />
    </Box>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.colors.background },
    flagRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: t.colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    flagTitle: { fontSize: 14, color: t.colors.text, fontWeight: "600" },
    flagDescription: {
      fontSize: 11,
      color: t.colors.textSecondary,
      marginTop: 2,
      lineHeight: 15,
    },
    center: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 32,
    },
    empty: { fontSize: 13, color: t.colors.textSecondary },
    card: {
      backgroundColor: t.colors.surface,
      padding: 12,
      marginHorizontal: 12,
      marginVertical: 6,
      borderRadius: 8,
    },
    thumb: {
      width: 72,
      height: 88,
      backgroundColor: t.colors.border,
      borderRadius: 6,
      overflow: "hidden",
    },
    thumbImg: { width: "100%", height: "100%" },
    thumbEmpty: {},
    title: { fontSize: 14, fontWeight: "600", color: t.colors.text },
    meta: { fontSize: 11, color: t.colors.textSecondary },
    price: { fontSize: 14, fontWeight: "600", color: t.colors.text },
    note: { fontSize: 11, color: t.colors.textSecondary, lineHeight: 15 },
    actions: { marginTop: 10, justifyContent: "flex-end" },
    btn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
      borderWidth: StyleSheet.hairlineWidth,
    },
    btnReject: {
      borderColor: t.colors.error,
      backgroundColor: t.colors.surface,
    },
    btnApprove: {
      borderColor: t.colors.accent,
      backgroundColor: t.colors.accent,
    },
    btnText: { fontSize: 12, fontWeight: "600" },
    modalBackdrop: {
      flex: 1,
      backgroundColor: t.colors.overlay,
      justifyContent: "center",
      padding: 24,
    },
    modalCard: {
      backgroundColor: t.colors.background,
      borderRadius: 10,
      padding: 16,
    },
    modalTitle: {
      fontSize: 15,
      fontWeight: "600",
      color: t.colors.text,
      marginBottom: 10,
    },
    modalInput: {
      minHeight: 80,
      textAlignVertical: "top",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
      borderRadius: 6,
      padding: 10,
      color: t.colors.text,
      fontSize: 13,
    },
  });

export default ProductReviewTab;
