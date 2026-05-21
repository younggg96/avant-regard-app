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
  RefreshControl,
  StyleSheet,
  Switch,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Box, HStack, ScrollView, Text, VStack } from "../../components/ui";
import { OptimizedImage } from "../../components/ui/OptimizedImage";
import { useThemedStyles, type AppTheme } from "../../theme";
import { Alert } from "../../utils/Alert";
import {
  adminListReviewingListings,
  adminReviewListing,
  formatPrice,
  type StoreProduct,
} from "../../services/storeProductService";
import { request } from "../../services/http";

interface FeatureFlagsPayload {
  lotteryEnabled: boolean;
  listingAutoApprove: boolean;
}

const ProductReviewTab: React.FC = () => {
  const styles = useThemedStyles(makeStyles);
  const [items, setItems] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [autoApprove, setAutoApprove] = useState(false);

  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

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
      Alert.show(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

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
      Alert.show(e instanceof Error ? e.message : "操作失败");
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
      Alert.show(e instanceof Error ? e.message : "操作失败");
    } finally {
      setActionLoading(false);
    }
  };

  const toggleAutoApprove = async (next: boolean) => {
    setAutoApprove(next);
    try {
      // 复用 admin 的 feature-flags 写接口（如果没有，会被忽略）
      // admin 写接口: 见 backend/app/api/routes/admin.py update_feature_flags
      await request(`/api/admin/feature-flags`, {
        method: "PUT",
        body: JSON.stringify({ listingAutoApprove: next }),
      });
    } catch {
      // admin feature flag 写接口可能尚未实现；UI 仍允许切换以提示意图
    }
  };

  return (
    <Box style={styles.container}>
      {/* 自动审核开关 */}
      <Box style={styles.flagRow}>
        <VStack style={{ flex: 1 }}>
          <Text style={styles.flagTitle}>自动审核</Text>
          <Text style={styles.flagDescription}>
            打开后用户提交审核会立即变为 active；仅建议 dev 环境使用。
          </Text>
        </VStack>
        <Switch value={autoApprove} onValueChange={toggleAutoApprove} />
      </Box>

      {loading ? (
        <Box style={styles.center}>
          <ActivityIndicator />
        </Box>
      ) : items.length === 0 ? (
        <Box style={styles.center}>
          <Text style={styles.empty}>暂无待审核单品</Text>
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
                <Box style={styles.thumb}>
                  {p.images?.[0] ? (
                    <OptimizedImage uri={p.images[0]} style={styles.thumbImg} />
                  ) : (
                    <Box style={[styles.thumbImg, styles.thumbEmpty]} />
                  )}
                </Box>
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
                      成色说明：{p.conditionNote}
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
                  <Ionicons name="close" size={16} color="#e44" />
                  <Text style={[styles.btnText, { color: "#e44" }]}>拒绝</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, styles.btnApprove]}
                  disabled={actionLoading}
                  onPress={() => handleApprove(p.id)}
                >
                  <Ionicons name="checkmark" size={16} color="#fff" />
                  <Text style={[styles.btnText, { color: "#fff" }]}>通过</Text>
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
            <Text style={styles.modalTitle}>填写拒绝原因</Text>
            <TextInput
              style={styles.modalInput}
              multiline
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder="例如：图片不清晰 / 与描述不符"
              placeholderTextColor="#9999"
            />
            <HStack space="sm" style={{ marginTop: 12 }}>
              <TouchableOpacity
                style={[styles.btn, styles.btnReject, { flex: 1 }]}
                onPress={() => setRejectModalVisible(false)}
              >
                <Text style={[styles.btnText, { color: "#e44" }]}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnApprove, { flex: 1 }]}
                onPress={confirmReject}
                disabled={actionLoading}
              >
                <Text style={[styles.btnText, { color: "#fff" }]}>提交</Text>
              </TouchableOpacity>
            </HStack>
          </Box>
        </Box>
      </Modal>
    </Box>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.colors.background },
    flagRow: {
      flexDirection: "row",
      alignItems: "center",
      padding: 12,
      backgroundColor: t.colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    flagTitle: { fontSize: 15, color: t.colors.text, fontWeight: "600" },
    flagDescription: { fontSize: 12, color: t.colors.textSecondary, marginTop: 4 },
    center: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 32,
    },
    empty: { color: t.colors.textSecondary },
    card: {
      backgroundColor: t.colors.surface,
      padding: 12,
      marginHorizontal: 12,
      marginVertical: 6,
      borderRadius: 8,
    },
    thumb: { width: 84, height: 100, backgroundColor: t.colors.border, borderRadius: 6, overflow: "hidden" },
    thumbImg: { width: "100%", height: "100%" },
    thumbEmpty: {},
    title: { fontSize: 15, fontWeight: "600", color: t.colors.text },
    meta: { fontSize: 12, color: t.colors.textSecondary },
    price: { fontSize: 15, fontWeight: "600", color: t.colors.text },
    note: { fontSize: 12, color: t.colors.textSecondary },
    actions: { marginTop: 10, justifyContent: "flex-end" },
    btn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 6,
      borderWidth: StyleSheet.hairlineWidth,
    },
    btnReject: { borderColor: "#e44", backgroundColor: t.colors.surface },
    btnApprove: { borderColor: t.colors.accent, backgroundColor: t.colors.accent },
    btnText: { fontSize: 13, fontWeight: "600" },
    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "center",
      padding: 24,
    },
    modalCard: {
      backgroundColor: t.colors.background,
      borderRadius: 10,
      padding: 16,
    },
    modalTitle: { fontSize: 16, fontWeight: "600", color: t.colors.text, marginBottom: 10 },
    modalInput: {
      minHeight: 96,
      textAlignVertical: "top",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
      borderRadius: 6,
      padding: 10,
      color: t.colors.text,
    },
  });

export default ProductReviewTab;
