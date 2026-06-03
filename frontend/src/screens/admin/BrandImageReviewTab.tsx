import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  RefreshControl,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme, useThemedStyles, type AppTheme } from "../../theme";
import { adminService, AdminBrandImage } from "../../services/adminService";
import { useSharedStyles } from "./adminStyles";
import {
  Box,
  HStack,
  Text,
  ScrollView,
  OptimizedImage,
  Pressable,
} from "../../components/ui";
import { ImageSize } from "../../utils/imageUtils";
import { FullscreenImageViewer } from "../../components/PostDetail";

const BrandImageReviewTab = () => {
  const { t, i18n } = useTranslation();
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const sharedStyles = useSharedStyles();
  const [images, setImages] = useState<AdminBrandImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [fullscreenVisible, setFullscreenVisible] = useState(false);
  const [fullscreenIndex, setFullscreenIndex] = useState(0);
  const [fullscreenUri, setFullscreenUri] = useState<string | null>(null);

  const fetchPendingImages = useCallback(async () => {
    try {
      setLoading(true);
      const result = await adminService.getPendingBrandImages();
      setImages(result.images);
    } catch (error) {
      console.error("fetch pending brand images failed:", error);
      Alert.alert(
        t("admin.error"),
        error instanceof Error
          ? error.message
          : t("admin.fetchPendingImagesFailed"),
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

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
            Alert.alert(
              t("admin.error"),
              error instanceof Error
                ? error.message
                : t("admin.operationFailed"),
            );
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
            Alert.alert(
              t("admin.error"),
              error instanceof Error
                ? error.message
                : t("admin.operationFailed"),
            );
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
            Alert.alert(
              t("admin.error"),
              error instanceof Error
                ? error.message
                : t("admin.operationFailed"),
            );
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const openFullscreen = (uri: string) => {
    setFullscreenUri(uri);
    setFullscreenIndex(0);
    setFullscreenVisible(true);
  };

  const locale = i18n.language?.startsWith("zh") ? "zh-CN" : "en-US";

  return (
    <>
      <ScrollView
        style={sharedStyles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {loading ? (
          <Box style={sharedStyles.loadingContainer}>
            <ActivityIndicator color={theme.colors.text} size="small" />
            <Text style={sharedStyles.loadingText}>{t("common.loading")}</Text>
          </Box>
        ) : images.length === 0 ? (
          <Box style={sharedStyles.emptyContainer}>
            <Ionicons
              name="checkmark-done-outline"
              size={40}
              color={theme.colors.gray200}
            />
            <Text style={sharedStyles.emptyText}>
              {t("admin.noPendingBrandImages")}
            </Text>
          </Box>
        ) : (
          images.map((img) => (
            <Box key={img.id} style={sharedStyles.postCard}>
              <HStack style={sharedStyles.postHeader}>
                <Text style={sharedStyles.postTitle} numberOfLines={1}>
                  {img.brandName || `${t("admin.brand")} #${img.brandId}`}
                </Text>
                <Text style={sharedStyles.postDate}>
                  {img.createdAt
                    ? new Date(img.createdAt).toLocaleDateString(locale)
                    : ""}
                </Text>
              </HStack>

              <Pressable onPress={() => openFullscreen(img.imageUrl)}>
                <OptimizedImage
                  uri={img.imageUrl}
                  size={ImageSize.MEDIUM}
                  style={styles.previewImage}
                  contentFit="cover"
                  lazy
                />
              </Pressable>

              <HStack style={styles.compactActions}>
                <TouchableOpacity
                  style={[styles.compactBtn, styles.approveBtn]}
                  onPress={() => handleApprove(img.id)}
                  disabled={actionLoading}
                >
                  <Ionicons
                    name="checkmark"
                    size={14}
                    color={theme.colors.textInverted}
                  />
                  <Text style={styles.approveBtnText}>{t("admin.approve")}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.compactBtn, styles.rejectBtn]}
                  onPress={() => handleReject(img.id)}
                  disabled={actionLoading}
                >
                  <Ionicons name="close" size={14} color={theme.colors.error} />
                  <Text style={styles.rejectBtnText}>{t("admin.reject")}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.compactBtn, styles.deleteBtn]}
                  onPress={() => handleDelete(img.id)}
                  disabled={actionLoading}
                >
                  <Ionicons
                    name="trash-outline"
                    size={14}
                    color={theme.colors.error}
                  />
                  <Text style={styles.rejectBtnText}>
                    {t("common.delete")}
                  </Text>
                </TouchableOpacity>
              </HStack>
            </Box>
          ))
        )}
        <Box style={{ height: 40 }} />
      </ScrollView>

      {fullscreenUri ? (
        <FullscreenImageViewer
          visible={fullscreenVisible}
          images={[fullscreenUri]}
          currentIndex={fullscreenIndex}
          onClose={() => setFullscreenVisible(false)}
          onIndexChange={setFullscreenIndex}
        />
      ) : null}
    </>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    previewImage: {
      width: "100%",
      height: 160,
      borderRadius: 4,
      marginBottom: 8,
      backgroundColor: t.colors.gray100,
    },
    compactActions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: 6,
      marginTop: 4,
      paddingTop: 6,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border,
    },
    compactBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 4,
      borderWidth: StyleSheet.hairlineWidth,
    },
    approveBtn: {
      backgroundColor: t.colors.accent,
      borderColor: t.colors.accent,
    },
    approveBtnText: {
      fontSize: 11,
      lineHeight: 14,
      fontWeight: "600",
      color: t.colors.textInverted,
    },
    rejectBtn: {
      borderColor: t.colors.error,
      backgroundColor: t.colors.surface,
    },
    deleteBtn: {
      borderColor: t.colors.error,
      backgroundColor: t.colors.surface,
    },
    rejectBtnText: {
      fontSize: 11,
      lineHeight: 14,
      fontWeight: "600",
      color: t.colors.error,
    },
  });

export default BrandImageReviewTab;
