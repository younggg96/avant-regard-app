import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { theme, useThemedStyles, type AppTheme } from "../../theme";
import { adminService, AdminBrandImage } from "../../services/adminService";
import { useSharedStyles } from "./adminStyles";
import { Box, HStack, Text, Button, ButtonText, ScrollView, OptimizedImage } from "../../components/ui";
import { ImageSize } from "../../utils/imageUtils";

const BrandImageReviewTab = () => {
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const sharedStyles = useSharedStyles();
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
      Alert.alert(t("admin.error"), error instanceof Error ? error.message : t("admin.fetchPendingImagesFailed"));
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
    Alert.alert(t("admin.confirmReview"), t("admin.confirmApproveImage"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("admin.confirmApprove"),
        onPress: async () => {
          try {
            setActionLoading(true);
            await adminService.approveBrandImage(id);
            Alert.alert(t("common.success"), t("admin.imageApproved"));
            setImages((prev) => prev.filter((img) => img.id !== id));
          } catch (error) {
            Alert.alert(t("admin.error"), error instanceof Error ? error.message : t("admin.operationFailed"));
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const handleReject = async (id: number) => {
    Alert.alert(t("admin.confirmReject"), t("admin.confirmRejectImage"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("admin.reject"),
        style: "destructive",
        onPress: async () => {
          try {
            setActionLoading(true);
            await adminService.rejectBrandImage(id);
            Alert.alert(t("admin.rejected"), t("admin.imageRejected"));
            setImages((prev) => prev.filter((img) => img.id !== id));
          } catch (error) {
            Alert.alert(t("admin.error"), error instanceof Error ? error.message : t("admin.operationFailed"));
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const handleDelete = async (id: number) => {
    Alert.alert(t("admin.confirmDelete"), t("admin.confirmDeleteImage"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: async () => {
          try {
            setActionLoading(true);
            await adminService.deleteBrandImage(id);
            Alert.alert(t("admin.deleted"), t("admin.imageDeleted"));
            setImages((prev) => prev.filter((img) => img.id !== id));
          } catch (error) {
            Alert.alert(t("admin.error"), error instanceof Error ? error.message : t("admin.operationFailed"));
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
        <Box style={sharedStyles.loadingContainer}>
          <ActivityIndicator color={theme.colors.black} size="small" />
          <Text style={sharedStyles.loadingText}>{t("common.loading")}</Text>
        </Box>
      ) : images.length === 0 ? (
        <Box style={sharedStyles.emptyContainer}>
          <Ionicons name="checkmark-done-outline" size={48} color={theme.colors.gray200} />
          <Text style={sharedStyles.emptyText}>{t("admin.noPendingBrandImages")}</Text>
        </Box>
      ) : (
        images.map((img) => (
          <Box key={img.id} style={sharedStyles.postCard}>
            <HStack style={sharedStyles.postHeader}>
              <Text style={sharedStyles.postTitle} numberOfLines={1}>
                {img.brandName || `${t("admin.brand")} #${img.brandId}`}
              </Text>
              <Text style={sharedStyles.postDate}>
                {img.createdAt ? new Date(img.createdAt).toLocaleDateString("zh-CN") : ""}
              </Text>
            </HStack>

            <OptimizedImage
              uri={img.imageUrl}
              size={ImageSize.MEDIUM}
              style={styles.previewImage}
              contentFit="cover"
              lazy={true}
            />

            <HStack style={sharedStyles.actionButtons}>
              <Button
                size="sm"
                colorScheme="success"
                onPress={() => handleApprove(img.id)}
                disabled={actionLoading}
                leftIcon={<Ionicons name="checkmark-circle-outline" size={16} color={theme.colors.white} />}
              >
                <ButtonText style={{ fontSize: 12 }}>{t("admin.approve")}</ButtonText>
              </Button>
              <Button
                size="sm"
                colorScheme="error"
                onPress={() => handleReject(img.id)}
                disabled={actionLoading}
                leftIcon={<Ionicons name="close-circle-outline" size={16} color={theme.colors.white} />}
              >
                <ButtonText style={{ fontSize: 12 }}>{t("admin.reject")}</ButtonText>
              </Button>
              <Button
                size="sm"
                colorScheme="error"
                onPress={() => handleDelete(img.id)}
                disabled={actionLoading}
                leftIcon={<Ionicons name="trash-outline" size={16} color={theme.colors.white} />}
              >
                <ButtonText style={{ fontSize: 12 }}>{t("common.delete")}</ButtonText>
              </Button>
            </HStack>
          </Box>
        ))
      )}
      <Box style={{ height: 40 }} />
    </ScrollView>
  );
};

const makeStyles = (t: AppTheme) => StyleSheet.create({
  previewImage: {
    width: "100%",
    height: 200,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: t.colors.gray100,
  },
});

export default BrandImageReviewTab;
