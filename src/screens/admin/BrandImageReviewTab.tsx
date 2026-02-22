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
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../theme";
import { adminService, AdminBrandImage } from "../../services/adminService";
import { sharedStyles } from "./adminStyles";

const BrandImageReviewTab = () => {
  const [images, setImages] = useState<AdminBrandImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchPendingImages = useCallback(async () => {
    try {
      setLoading(true);
      const result = await adminService.getPendingBrandImages();
      setImages(result.images);
    } catch (error) {
      console.error("获取待审核图片失败:", error);
      Alert.alert("错误", error instanceof Error ? error.message : "获取待审核图片失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPendingImages();
  }, [fetchPendingImages]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPendingImages();
    setRefreshing(false);
  }, [fetchPendingImages]);

  const handleApprove = async (id: number) => {
    Alert.alert("确认审核", "确定要通过这张图片吗？", [
      { text: "取消", style: "cancel" },
      {
        text: "确认通过",
        onPress: async () => {
          try {
            setActionLoading(true);
            await adminService.approveBrandImage(id);
            Alert.alert("成功", "图片已审核通过");
            setImages((prev) => prev.filter((img) => img.id !== id));
          } catch (error) {
            Alert.alert("错误", error instanceof Error ? error.message : "操作失败");
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const handleReject = async (id: number) => {
    Alert.alert("确认拒绝", "确定要拒绝这张图片吗？", [
      { text: "取消", style: "cancel" },
      {
        text: "拒绝",
        style: "destructive",
        onPress: async () => {
          try {
            setActionLoading(true);
            await adminService.rejectBrandImage(id);
            Alert.alert("已拒绝", "图片已被拒绝");
            setImages((prev) => prev.filter((img) => img.id !== id));
          } catch (error) {
            Alert.alert("错误", error instanceof Error ? error.message : "操作失败");
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const handleDelete = async (id: number) => {
    Alert.alert("确认删除", "确定要删除这张图片吗？", [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
        style: "destructive",
        onPress: async () => {
          try {
            setActionLoading(true);
            await adminService.deleteBrandImage(id);
            Alert.alert("已删除", "图片已删除");
            setImages((prev) => prev.filter((img) => img.id !== id));
          } catch (error) {
            Alert.alert("错误", error instanceof Error ? error.message : "操作失败");
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  return (
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
      ) : images.length === 0 ? (
        <View style={sharedStyles.emptyContainer}>
          <Ionicons name="checkmark-done-outline" size={48} color={theme.colors.gray200} />
          <Text style={sharedStyles.emptyText}>暂无待审核的品牌图片</Text>
        </View>
      ) : (
        images.map((img) => (
          <View key={img.id} style={sharedStyles.postCard}>
            <View style={sharedStyles.postHeader}>
              <Text style={sharedStyles.postTitle} numberOfLines={1}>
                {img.brandName || `品牌 #${img.brandId}`}
              </Text>
              <Text style={sharedStyles.postDate}>
                {img.createdAt ? new Date(img.createdAt).toLocaleDateString("zh-CN") : ""}
              </Text>
            </View>

            <Image source={{ uri: img.imageUrl }} style={styles.previewImage} resizeMode="cover" />

            <View style={sharedStyles.actionButtons}>
              <TouchableOpacity
                style={[sharedStyles.actionButton, sharedStyles.approveButton]}
                onPress={() => handleApprove(img.id)}
                disabled={actionLoading}
              >
                <Ionicons name="checkmark-circle" size={18} color={theme.colors.white} />
                <Text style={sharedStyles.actionButtonText}>通过</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[sharedStyles.actionButton, sharedStyles.rejectButton]}
                onPress={() => handleReject(img.id)}
                disabled={actionLoading}
              >
                <Ionicons name="close-circle" size={18} color={theme.colors.white} />
                <Text style={sharedStyles.actionButtonText}>拒绝</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[sharedStyles.actionButton, sharedStyles.deletePostButton]}
                onPress={() => handleDelete(img.id)}
                disabled={actionLoading}
              >
                <Ionicons name="trash-outline" size={18} color={theme.colors.white} />
                <Text style={sharedStyles.actionButtonText}>删除</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  previewImage: {
    width: "100%",
    height: 200,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: theme.colors.gray100,
  },
});

export default BrandImageReviewTab;
