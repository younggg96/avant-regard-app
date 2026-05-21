/**
 * DisputeQueueTab —— Admin · 售后仲裁队列（PRD 模块 5）。
 *
 * 列表来源：GET /api/admin/disputes/queue（open + investigating）
 * 操作：受理（take）/ 判退款（resolved_refund）/ 判放款（resolved_release）
 */
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";

import {
  adminListDisputes,
  adminTakeDispute,
  adminResolveDispute,
  Dispute,
} from "../../services/aftersalesService";

export default function DisputeQueueTab() {
  const [items, setItems] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(false);

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

  const onTake = async (id: number) => {
    try {
      await adminTakeDispute(id);
      load();
    } catch (e: any) {
      Alert.alert("失败", e?.message ?? "操作失败");
    }
  };

  const onResolve = async (
    id: number,
    decision: "resolved_refund" | "resolved_release",
  ) => {
    Alert.alert(
      decision === "resolved_refund" ? "判定退款" : "判定放款",
      "确定吗？该操作不可逆。",
      [
        { text: "取消" },
        {
          text: "确认",
          style: "destructive",
          onPress: async () => {
            try {
              await adminResolveDispute(id, { decision });
              load();
            } catch (e: any) {
              Alert.alert("失败", e?.message ?? "操作失败");
            }
          },
        },
      ],
    );
  };

  if (loading && items.length === 0) {
    return <ActivityIndicator style={{ marginTop: 32 }} />;
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(d) => String(d.id)}
      contentContainerStyle={{ padding: 12 }}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>争议 #{item.id}</Text>
            <Text style={styles.status}>{item.status}</Text>
          </View>
          <Text style={styles.row}>订单 #{item.orderId}</Text>
          <Text style={styles.row}>
            发起人 #{item.openerUserId} ({item.openerRole}) · 原因 {item.reason}
          </Text>
          {item.description ? (
            <Text style={styles.desc}>{item.description}</Text>
          ) : null}
          <View style={styles.actions}>
            {item.status === "open" ? (
              <Pressable
                style={styles.ghostBtn}
                onPress={() => onTake(item.id)}
              >
                <Text style={styles.ghostBtnText}>受理</Text>
              </Pressable>
            ) : null}
            <Pressable
              style={styles.refundBtn}
              onPress={() => onResolve(item.id, "resolved_refund")}
            >
              <Text style={styles.btnText}>判退款</Text>
            </Pressable>
            <Pressable
              style={styles.releaseBtn}
              onPress={() => onResolve(item.id, "resolved_release")}
            >
              <Text style={styles.btnText}>判放款</Text>
            </Pressable>
          </View>
        </View>
      )}
      ListEmptyComponent={
        <Text style={styles.empty}>暂无待处理争议</Text>
      }
    />
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  title: { fontWeight: "600", color: "#111" },
  status: { color: "#888", fontSize: 12 },
  row: { fontSize: 13, color: "#333", marginBottom: 4 },
  desc: {
    fontSize: 13,
    color: "#555",
    backgroundColor: "#F5F5F4",
    padding: 8,
    borderRadius: 6,
    marginVertical: 8,
  },
  actions: { flexDirection: "row", gap: 8, marginTop: 8 },
  ghostBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#888",
  },
  ghostBtnText: { color: "#444" },
  refundBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: "#D14343",
  },
  releaseBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: "#1FB271",
  },
  btnText: { color: "#fff", fontWeight: "600" },
  empty: { textAlign: "center", color: "#888", marginTop: 32 },
});
