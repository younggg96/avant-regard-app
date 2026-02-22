import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Image,
  Alert,
  TextInput,
  Modal,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../theme";
import { showService, Show } from "../../services/showService";
import { sharedStyles } from "./adminStyles";

const ShowReviewTab = () => {
  const [shows, setShows] = useState<Show[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [selectedShowId, setSelectedShowId] = useState<string | null>(null);

  const fetchPendingShows = useCallback(async () => {
    try {
      setLoading(true);
      const result = await showService.getPendingShows();
      setShows(result.shows);
    } catch (error) {
      console.error("获取待审核秀场失败:", error);
      Alert.alert("错误", error instanceof Error ? error.message : "获取待审核秀场失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPendingShows();
  }, [fetchPendingShows]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPendingShows();
    setRefreshing(false);
  }, [fetchPendingShows]);

  const handleApprove = async (showId: string) => {
    Alert.alert("确认审核", "确定要通过这个秀场吗？", [
      { text: "取消", style: "cancel" },
      {
        text: "确认通过",
        onPress: async () => {
          try {
            setActionLoading(true);
            await showService.approveShow(showId);
            Alert.alert("成功", "秀场已审核通过");
            setShows((prev) => prev.filter((s) => s.id !== showId));
          } catch (error) {
            Alert.alert("错误", error instanceof Error ? error.message : "操作失败");
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const handleOpenRejectModal = (showId: string) => {
    setSelectedShowId(showId);
    setRejectReason("");
    setRejectModalVisible(true);
  };

  const handleConfirmReject = async () => {
    if (!selectedShowId) return;
    try {
      setActionLoading(true);
      await showService.rejectShow(selectedShowId, rejectReason || undefined);
      Alert.alert("已拒绝", "秀场已被拒绝");
      setRejectModalVisible(false);
      setShows((prev) => prev.filter((s) => s.id !== selectedShowId));
    } catch (error) {
      Alert.alert("错误", error instanceof Error ? error.message : "操作失败");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={sharedStyles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading ? (
          <View style={sharedStyles.loadingContainer}>
            <ActivityIndicator color={theme.colors.black} size="small" />
            <Text style={sharedStyles.loadingText}>加载中...</Text>
          </View>
        ) : shows.length === 0 ? (
          <View style={sharedStyles.emptyContainer}>
            <Ionicons name="checkmark-done-outline" size={48} color={theme.colors.gray200} />
            <Text style={sharedStyles.emptyText}>暂无待审核的秀场</Text>
          </View>
        ) : (
          shows.map((show) => (
            <View key={show.id} style={sharedStyles.postCard}>
              <View style={sharedStyles.postHeader}>
                <Text style={sharedStyles.postTitle} numberOfLines={1}>{show.title || show.season}</Text>
                <Text style={sharedStyles.postDate}>
                  {show.createdAt ? new Date(show.createdAt).toLocaleDateString("zh-CN") : ""}
                </Text>
              </View>

              {show.coverImage && (
                <Image
                  source={{ uri: show.coverImage }}
                  style={styles.coverImage}
                  resizeMode="cover"
                />
              )}

              <View style={styles.metaSection}>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>品牌</Text>
                  <Text style={styles.metaValue}>{show.brand}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>年份</Text>
                  <Text style={styles.metaValue}>{show.year}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>季度</Text>
                  <Text style={styles.metaValue}>{show.season}</Text>
                </View>
                {show.category && (
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>类别</Text>
                    <Text style={styles.metaValue}>{show.category}</Text>
                  </View>
                )}
                {show.designer && (
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>设计师</Text>
                    <Text style={styles.metaValue}>{show.designer}</Text>
                  </View>
                )}
              </View>

              {show.description && (
                <Text style={styles.description} numberOfLines={4}>{show.description}</Text>
              )}

              <View style={sharedStyles.actionButtons}>
                <TouchableOpacity
                  style={[sharedStyles.actionButton, sharedStyles.approveButton]}
                  onPress={() => handleApprove(String(show.id))}
                  disabled={actionLoading}
                >
                  <Ionicons name="checkmark-circle" size={18} color={theme.colors.white} />
                  <Text style={sharedStyles.actionButtonText}>通过</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[sharedStyles.actionButton, sharedStyles.rejectButton]}
                  onPress={() => handleOpenRejectModal(String(show.id))}
                  disabled={actionLoading}
                >
                  <Ionicons name="close-circle" size={18} color={theme.colors.white} />
                  <Text style={sharedStyles.actionButtonText}>拒绝</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Reject Modal */}
      <Modal visible={rejectModalVisible} transparent animationType="fade" onRequestClose={() => setRejectModalVisible(false)}>
        <View style={sharedStyles.modalOverlay}>
          <View style={sharedStyles.modalContent}>
            <Text style={sharedStyles.modalTitle}>拒绝原因</Text>
            <TextInput
              style={sharedStyles.modalInput}
              placeholder="请输入拒绝原因（可选）"
              placeholderTextColor={theme.colors.gray300}
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
              numberOfLines={3}
            />
            <View style={sharedStyles.modalButtons}>
              <TouchableOpacity style={[sharedStyles.modalButton, sharedStyles.modalCancelButton]} onPress={() => setRejectModalVisible(false)}>
                <Text style={sharedStyles.modalCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[sharedStyles.modalButton, sharedStyles.modalConfirmButton]} onPress={handleConfirmReject} disabled={actionLoading}>
                {actionLoading ? (
                  <ActivityIndicator color={theme.colors.white} size="small" />
                ) : (
                  <Text style={sharedStyles.modalConfirmText}>确认拒绝</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  coverImage: {
    width: "100%",
    height: 160,
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: theme.colors.gray100,
  },
  metaSection: {
    gap: 6,
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  metaLabel: {
    fontSize: 13,
    color: theme.colors.gray300,
    width: 52,
  },
  metaValue: {
    fontSize: 13,
    color: theme.colors.black,
    flex: 1,
  },
  description: {
    fontSize: 13,
    color: theme.colors.gray400,
    lineHeight: 20,
    marginBottom: 8,
    backgroundColor: theme.colors.gray50,
    padding: 10,
    borderRadius: 8,
  },
});

export default ShowReviewTab;
