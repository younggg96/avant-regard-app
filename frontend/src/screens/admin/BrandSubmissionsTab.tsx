import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  RefreshControl,
  Alert,
  Modal,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../theme";
import { adminService, AdminBrandSubmission } from "../../services/adminService";
import { sharedStyles } from "./adminStyles";
import { Box, HStack, VStack, Text, Input, Button, ButtonText, ScrollView, OptimizedImage } from "../../components/ui";
import { ImageSize } from "../../utils/imageUtils";

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
    <Box style={{ flex: 1 }}>
      <ScrollView
        style={sharedStyles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading ? (
          <Box style={sharedStyles.loadingContainer}>
            <ActivityIndicator color={theme.colors.black} size="small" />
            <Text style={sharedStyles.loadingText}>加载中...</Text>
          </Box>
        ) : submissions.length === 0 ? (
          <Box style={sharedStyles.emptyContainer}>
            <Ionicons name="checkmark-done-outline" size={48} color={theme.colors.gray200} />
            <Text style={sharedStyles.emptyText}>暂无待审核的品牌提交</Text>
          </Box>
        ) : (
          submissions.map((submission) => (
            <Box key={submission.id} style={sharedStyles.postCard}>
              <HStack style={sharedStyles.postHeader}>
                <Text style={sharedStyles.username}>@{submission.username}</Text>
                <Text style={sharedStyles.postDate}>
                  {new Date(submission.createdAt || "").toLocaleDateString("zh-CN")}
                </Text>
              </HStack>

              <Text style={[sharedStyles.postTitle, { marginBottom: 8 }]}>{submission.name}</Text>

              {submission.coverImage && (
                <OptimizedImage
                  uri={submission.coverImage}
                  size={ImageSize.MEDIUM}
                  style={styles.coverImage}
                  contentFit="cover"
                  lazy={true}
                />
              )}

              <VStack style={styles.metaList}>
                {submission.category && <Text style={sharedStyles.postMeta as any}>分类: {submission.category}</Text>}
                {submission.founder && <Text style={sharedStyles.postMeta as any}>创始人: {submission.founder}</Text>}
                {submission.foundedYear && <Text style={sharedStyles.postMeta as any}>创立年份: {submission.foundedYear}</Text>}
                {submission.country && <Text style={sharedStyles.postMeta as any}>国家: {submission.country}</Text>}
                {submission.website && (
                  <Text style={[sharedStyles.postContent, { color: theme.colors.gray500 }]} numberOfLines={1}>
                    官网: {submission.website}
                  </Text>
                )}
              </VStack>

              <HStack style={sharedStyles.actionButtons}>
                <Button
                  size="sm"
                  colorScheme="success"
                  onPress={() => handleApprove(submission.id)}
                  disabled={actionLoading}
                  leftIcon={<Ionicons name="checkmark-circle-outline" size={16} color={theme.colors.white} />}
                >
                  <ButtonText style={{ fontSize: 12 }}>通过</ButtonText>
                </Button>
                <Button
                  size="sm"
                  colorScheme="error"
                  onPress={() => handleReject(submission.id)}
                  disabled={actionLoading}
                  leftIcon={<Ionicons name="close-circle" size={16} color={theme.colors.white} />}
                >
                  <ButtonText style={{ fontSize: 12 }}>拒绝</ButtonText>
                </Button>
              </HStack>
            </Box>
          ))
        )}
        <Box style={{ height: 40 }} />
      </ScrollView>

      <Modal visible={rejectModalVisible} transparent animationType="fade" onRequestClose={() => setRejectModalVisible(false)}>
        <Box style={sharedStyles.modalOverlay}>
          <Box style={sharedStyles.modalContent}>
            <Text style={sharedStyles.modalTitle}>拒绝原因</Text>
            <Input
              variant="outline"
              size="md"
              placeholder="请输入拒绝原因（可选）"
              placeholderTextColor={theme.colors.gray300}
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
              numberOfLines={3}
            />
            <HStack style={sharedStyles.modalButtons}>
              <Button variant="outline" size="sm" onPress={() => setRejectModalVisible(false)}>
                <ButtonText style={{ color: theme.colors.gray400 }}>取消</ButtonText>
              </Button>
              <Button size="sm" colorScheme="error" onPress={handleConfirmReject} disabled={actionLoading} isLoading={actionLoading}>
                <ButtonText>确认拒绝</ButtonText>
              </Button>
            </HStack>
          </Box>
        </Box>
      </Modal>
    </Box>
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
