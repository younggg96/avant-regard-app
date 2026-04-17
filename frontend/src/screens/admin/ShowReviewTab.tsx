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
import { showService, Show } from "../../services/showService";
import { sharedStyles } from "./adminStyles";
import { Box, HStack, VStack, Text, Input, Button, ButtonText, ScrollView, OptimizedImage } from "../../components/ui";
import { ImageSize } from "../../utils/imageUtils";

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
        ) : shows.length === 0 ? (
          <Box style={sharedStyles.emptyContainer}>
            <Ionicons name="checkmark-done-outline" size={48} color={theme.colors.gray200} />
            <Text style={sharedStyles.emptyText}>暂无待审核的秀场</Text>
          </Box>
        ) : (
          shows.map((show) => (
            <Box key={show.id} style={sharedStyles.postCard}>
              <HStack style={sharedStyles.postHeader}>
                <Text style={sharedStyles.postTitle} numberOfLines={1}>{show.title || show.season}</Text>
                <Text style={sharedStyles.postDate}>
                  {show.createdAt ? new Date(show.createdAt).toLocaleDateString("zh-CN") : ""}
                </Text>
              </HStack>

              {show.coverImage && (
                <OptimizedImage
                  uri={show.coverImage}
                  size={ImageSize.MEDIUM}
                  style={styles.coverImage}
                  contentFit="cover"
                  lazy={true}
                />
              )}

              <VStack style={styles.metaSection}>
                <HStack style={styles.metaRow}>
                  <Text style={styles.metaLabel}>品牌</Text>
                  <Text style={styles.metaValue}>{show.brand}</Text>
                </HStack>
                <HStack style={styles.metaRow}>
                  <Text style={styles.metaLabel}>年份</Text>
                  <Text style={styles.metaValue}>{show.year}</Text>
                </HStack>
                <HStack style={styles.metaRow}>
                  <Text style={styles.metaLabel}>季度</Text>
                  <Text style={styles.metaValue}>{show.season}</Text>
                </HStack>
                {show.category && (
                  <HStack style={styles.metaRow}>
                    <Text style={styles.metaLabel}>类别</Text>
                    <Text style={styles.metaValue}>{show.category}</Text>
                  </HStack>
                )}
                {show.designer && (
                  <HStack style={styles.metaRow}>
                    <Text style={styles.metaLabel}>设计师</Text>
                    <Text style={styles.metaValue}>{show.designer}</Text>
                  </HStack>
                )}
              </VStack>

              {show.description && (
                <Text style={styles.description} numberOfLines={4}>{show.description}</Text>
              )}

              <HStack style={sharedStyles.actionButtons}>
                <Button
                  size="sm"
                  colorScheme="success"
                  onPress={() => handleApprove(String(show.id))}
                  disabled={actionLoading}
                  leftIcon={<Ionicons name="checkmark-circle-outline" size={16} color={theme.colors.white} />}
                >
                  <ButtonText style={{ fontSize: 12 }}>通过</ButtonText>
                </Button>
                <Button
                  size="sm"
                  colorScheme="error"
                  onPress={() => handleOpenRejectModal(String(show.id))}
                  disabled={actionLoading}
                  leftIcon={<Ionicons name="close-circle-outline" size={16} color={theme.colors.white} />}
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
              <Button size="sm" onPress={handleConfirmReject} disabled={actionLoading} isLoading={actionLoading}>
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
