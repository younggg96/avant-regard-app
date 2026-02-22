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
import { adminService, AdminBrandSubmission } from "../../services/adminService";
import { sharedStyles } from "./adminStyles";

const BrandSubmissionsTab = () => {
  const [submissions, setSubmissions] = useState<AdminBrandSubmission[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const fetchSubmissions = useCallback(async () => {
    try {
      setLoading(true);
      const result = await adminService.getPendingBrandSubmissions();
      setSubmissions(result);
    } catch (error) {
      console.error("获取品牌提交列表失败:", error);
      Alert.alert("错误", error instanceof Error ? error.message : "获取品牌提交列表失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchSubmissions();
    setRefreshing(false);
  }, [fetchSubmissions]);

  const handleApprove = async (id: number) => {
    Alert.alert("确认审核", "确定要通过这个品牌提交吗？通过后将添加到品牌列表。", [
      { text: "取消", style: "cancel" },
      {
        text: "确认通过",
        onPress: async () => {
          try {
            setActionLoading(true);
            await adminService.approveBrandSubmission(id);
            Alert.alert("成功", "品牌已审核通过并添加到品牌列表");
            fetchSubmissions();
          } catch (error) {
            Alert.alert("错误", error instanceof Error ? error.message : "操作失败");
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const handleReject = (id: number) => {
    setSelectedId(id);
    setRejectReason("");
    setRejectModalVisible(true);
  };

  const handleConfirmReject = async () => {
    if (!selectedId) return;
    try {
      setActionLoading(true);
      await adminService.rejectBrandSubmission(selectedId, rejectReason || undefined);
      Alert.alert("已拒绝", "品牌提交已被拒绝");
      setRejectModalVisible(false);
      fetchSubmissions();
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
        ) : submissions.length === 0 ? (
          <View style={sharedStyles.emptyContainer}>
            <Ionicons name="checkmark-done-outline" size={48} color={theme.colors.gray200} />
            <Text style={sharedStyles.emptyText}>暂无待审核的品牌提交</Text>
          </View>
        ) : (
          submissions.map((submission) => (
            <View key={submission.id} style={sharedStyles.postCard}>
              <View style={sharedStyles.postHeader}>
                <Text style={sharedStyles.username}>@{submission.username}</Text>
                <Text style={sharedStyles.postDate}>
                  {new Date(submission.createdAt || "").toLocaleDateString("zh-CN")}
                </Text>
              </View>

              <Text style={[sharedStyles.postTitle, { marginBottom: 8 }]}>{submission.name}</Text>

              {submission.coverImage && (
                <Image
                  source={{ uri: submission.coverImage }}
                  style={styles.coverImage}
                  resizeMode="cover"
                />
              )}

              <View style={styles.metaList}>
                {submission.category && <Text style={sharedStyles.postMeta as any}>分类: {submission.category}</Text>}
                {submission.founder && <Text style={sharedStyles.postMeta as any}>创始人: {submission.founder}</Text>}
                {submission.foundedYear && <Text style={sharedStyles.postMeta as any}>创立年份: {submission.foundedYear}</Text>}
                {submission.country && <Text style={sharedStyles.postMeta as any}>国家: {submission.country}</Text>}
                {submission.website && (
                  <Text style={[sharedStyles.postContent, { color: theme.colors.gray500 }]} numberOfLines={1}>
                    官网: {submission.website}
                  </Text>
                )}
              </View>

              <View style={sharedStyles.actionButtons}>
                <TouchableOpacity
                  style={[sharedStyles.actionButton, sharedStyles.approveButton]}
                  onPress={() => handleApprove(submission.id)}
                  disabled={actionLoading}
                >
                  <Ionicons name="checkmark-circle" size={18} color={theme.colors.white} />
                  <Text style={sharedStyles.actionButtonText}>通过</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[sharedStyles.actionButton, sharedStyles.rejectButton]}
                  onPress={() => handleReject(submission.id)}
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
    marginBottom: 10,
  },
  metaList: {
    gap: 4,
    marginBottom: 12,
  },
});

export default BrandSubmissionsTab;
