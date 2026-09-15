/**
 * 数字护照 · 档案审核队列（App 内置后台）。
 *
 * 与 Web 后台 /admin/archive-review 是同一套接口、同一批数据，只是搬到手机上，
 * 让管理员不开电脑也能清队列。
 *
 * 进入这个队列的只有 validity_status = manual_review 的条目，来源有两类：
 *   - AI 对品牌拿不准（置信度低于阈值）
 *   - 用户跳过了 AI 识别直接手填
 * 两种都不能默认放行，所以统一压在这里等人看。
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme, useThemedStyles, type AppTheme } from "../../theme";
import {
  adminService,
  AdminArchiveReviewItem,
} from "../../services/adminService";
import { useSharedStyles } from "./adminStyles";
import {
  Box,
  HStack,
  Text,
  ScrollView,
  OptimizedImage,
  Pressable,
  Input,
  Button,
  ButtonText,
} from "../../components/ui";
import { ImageSize } from "../../utils/imageUtils";

const ArchiveReviewTab = () => {
  const { t, i18n } = useTranslation();
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const sharedStyles = useSharedStyles();

  const [items, setItems] = useState<AdminArchiveReviewItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejecting, setRejecting] = useState<AdminArchiveReviewItem | null>(
    null,
  );
  const [rejectReason, setRejectReason] = useState("");

  const fetchQueue = useCallback(async () => {
    try {
      setLoading(true);
      const result = await adminService.getArchiveReviewQueue(1, 50);
      setItems(result.items);
    } catch (error) {
      console.error("fetch archive review queue failed:", error);
      Alert.alert(
        t("admin.error"),
        error instanceof Error ? error.message : t("admin.operationFailed"),
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchQueue();
    setRefreshing(false);
  }, [fetchQueue]);

  const handleApprove = (item: AdminArchiveReviewItem) => {
    Alert.alert(
      t("admin.confirmReview"),
      t("admin.archiveReviewTab.confirmApprove", {
        title: item.title || `#${item.id}`,
      }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("admin.confirmApprove"),
          onPress: async () => {
            try {
              setActionLoading(true);
              await adminService.reviewArchiveItem(item.id, "approve");
              setItems((prev) => prev.filter((i) => i.id !== item.id));
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
      ],
    );
  };

  // 驳回必须带理由（用户要知道档案为什么没过），所以走弹窗输入而不是
  // Alert.prompt —— 后者只有 iOS 有。
  const handleConfirmReject = async () => {
    if (!rejecting) return;
    try {
      setActionLoading(true);
      await adminService.reviewArchiveItem(
        rejecting.id,
        "reject",
        rejectReason,
      );
      setItems((prev) => prev.filter((i) => i.id !== rejecting.id));
      setRejecting(null);
      setRejectReason("");
    } catch (error) {
      Alert.alert(
        t("admin.error"),
        error instanceof Error ? error.message : t("admin.operationFailed"),
      );
    } finally {
      setActionLoading(false);
    }
  };

  const locale = i18n.language?.startsWith("zh") ? "zh-CN" : "en-US";

  return (
    <Box style={{ flex: 1 }}>
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
        ) : items.length === 0 ? (
          <Box style={sharedStyles.emptyContainer}>
            <Ionicons
              name="checkmark-done-outline"
              size={40}
              color={theme.colors.gray200}
            />
            <Text style={sharedStyles.emptyText}>
              {t("admin.archiveReviewTab.empty")}
            </Text>
          </Box>
        ) : (
          items.map((item) => {
            const aiPhotos = item.aiPhotos || [];
            return (
              <Box key={item.id} style={sharedStyles.postCard}>
                <HStack style={sharedStyles.postHeader}>
                  <Text style={sharedStyles.postTitle} numberOfLines={1}>
                    {item.title || `#${item.id}`}
                  </Text>
                  <Text style={sharedStyles.postDate}>
                    {item.createdAt
                      ? new Date(item.createdAt).toLocaleDateString(locale)
                      : ""}
                  </Text>
                </HStack>

                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <HStack style={styles.photoRow}>
                    {item.photos.map((url, idx) => (
                      <Box key={`${url}-${idx}`} style={styles.photoWrap}>
                        <OptimizedImage
                          uri={url}
                          size={ImageSize.THUMBNAIL}
                          style={styles.photo}
                          contentFit="cover"
                          lazy
                        />
                        {/* AI 生成的三视图必须标出来：审核的人得知道
                          自己看的是实物还是模型推测的侧背面。 */}
                        {aiPhotos.includes(url) && (
                          <Box style={styles.aiBadge}>
                            <Text style={styles.aiBadgeText}>
                              {t("admin.archiveReviewTab.aiBadge")}
                            </Text>
                          </Box>
                        )}
                      </Box>
                    ))}
                  </HStack>
                </ScrollView>

                <Text style={sharedStyles.username}>@{item.username}</Text>
                <Text style={sharedStyles.postContent}>
                  {item.brandName || t("admin.archiveReviewTab.noBrand")}
                  {item.releaseYear ? ` · ${item.releaseYear}` : ""}
                </Text>

                {item.reasons?.length > 0 && (
                  <Box style={styles.reasonBox}>
                    {item.reasons.map((r, i) => (
                      <Text key={i} style={styles.reasonText}>
                        · {r}
                      </Text>
                    ))}
                  </Box>
                )}

                <HStack style={sharedStyles.actionButtons}>
                  <Pressable
                    style={[
                      sharedStyles.actionButton,
                      sharedStyles.approveButton,
                    ]}
                    onPress={() => handleApprove(item)}
                    disabled={actionLoading}
                  >
                    <Text style={sharedStyles.actionButtonText}>
                      {t("admin.approve")}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[
                      sharedStyles.actionButton,
                      sharedStyles.rejectButton,
                    ]}
                    onPress={() => setRejecting(item)}
                    disabled={actionLoading}
                  >
                    <Text style={sharedStyles.actionButtonText}>
                      {t("admin.reject")}
                    </Text>
                  </Pressable>
                </HStack>
              </Box>
            );
          })
        )}
      </ScrollView>

      <Modal
        visible={rejecting !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setRejecting(null)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <Box style={sharedStyles.modalOverlay}>
            <Box style={sharedStyles.modalContent}>
              <Text style={sharedStyles.modalTitle}>
                {t("admin.archiveReviewTab.rejectReason")}
              </Text>
              <Input
                style={sharedStyles.modalInput}
                placeholder={t("admin.rejectReasonPlaceholder")}
                placeholderTextColor={theme.colors.gray300}
                value={rejectReason}
                onChangeText={setRejectReason}
                multiline
                numberOfLines={3}
                variant="outline"
                size="md"
              />
              <HStack style={sharedStyles.modalButtons}>
                <Button
                  variant="outline"
                  size="sm"
                  onPress={() => setRejecting(null)}
                >
                  <ButtonText style={{ color: theme.colors.gray400 }}>
                    {t("common.cancel")}
                  </ButtonText>
                </Button>
                <Button
                  size="sm"
                  onPress={handleConfirmReject}
                  disabled={actionLoading}
                  isLoading={actionLoading}
                >
                  <ButtonText>{t("admin.confirmReject")}</ButtonText>
                </Button>
              </HStack>
            </Box>
          </Box>
        </KeyboardAvoidingView>
      </Modal>
    </Box>
  );
};

const makeStyles = (theme: AppTheme) =>
  StyleSheet.create({
    photoRow: {
      gap: 8,
      marginVertical: 10,
    },
    photoWrap: {
      position: "relative",
    },
    photo: {
      width: 88,
      height: 88,
      borderRadius: 6,
      backgroundColor: theme.colors.gray100,
    },
    aiBadge: {
      position: "absolute",
      left: 4,
      bottom: 4,
      paddingHorizontal: 5,
      paddingVertical: 2,
      borderRadius: 3,
      backgroundColor: "rgba(0,0,0,0.7)",
    },
    aiBadgeText: {
      fontSize: 9,
      color: "#fff",
      letterSpacing: 0.5,
    },
    reasonBox: {
      marginTop: 6,
      paddingLeft: 2,
    },
    reasonText: {
      fontSize: 12,
      lineHeight: 18,
      color: theme.colors.textSecondary,
    },
  });

export default ArchiveReviewTab;
