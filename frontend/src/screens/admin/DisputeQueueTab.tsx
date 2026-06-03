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
} from "react-native";
import { useTranslation } from "react-i18next";

import { useAppTheme, useThemedStyles, type AppTheme } from "../../theme";
import { useSharedStyles } from "./adminStyles";
import { Box, Text } from "../../components/ui";
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
  const [items, setItems] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

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
          <Box style={sharedStyles.postHeader}>
            <Text style={sharedStyles.postTitle}>
              {t("admin.disputeTitle", { id: item.id })}
            </Text>
            <Text style={styles.status}>{formatStatus(item.status)}</Text>
          </Box>

          <Text style={styles.row}>
            {t("admin.disputeOrder", { orderId: item.orderId })}
          </Text>
          <Text style={styles.row}>
            {t("admin.disputeOpener", {
              userId: item.openerUserId,
              role: formatRole(item.openerRole),
              reason: formatReason(item.reason),
            })}
          </Text>

          {item.description ? (
            <Text style={styles.desc}>{item.description}</Text>
          ) : null}

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
  );
}

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
  });
