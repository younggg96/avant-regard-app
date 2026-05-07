import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  RefreshControl,
  Alert,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../theme";
import { adminService, AdminBrandSubmission } from "../../services/adminService";
import { sharedStyles } from "./adminStyles";
import { Box, HStack, VStack, Text, Input, Button, ButtonText, ScrollView, OptimizedImage } from "../../components/ui";
import { ImageSize } from "../../utils/imageUtils";

const BrandSubmissionsTab = () => {
  const { t } = useTranslation();
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
      console.error("fetchBrandSubmissions failed:", error);
      Alert.alert(t("admin.error"), error instanceof Error ? error.message : t("admin.fetchBrandSubmissionsFailed"));
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
    Alert.alert(t("admin.confirmReview"), t("admin.confirmApproveBrand"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("admin.confirmApprove"),
        onPress: async () => {
          try {
            setActionLoading(true);
            await adminService.approveBrandSubmission(id);
            Alert.alert(t("common.success"), t("admin.brandApproved"));
            fetchSubmissions();
          } catch (error) {
            Alert.alert(t("admin.error"), error instanceof Error ? error.message : t("admin.operationFailed"));
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
      Alert.alert(t("admin.rejected"), t("admin.brandRejected"));
      setRejectModalVisible(false);
      fetchSubmissions();
    } catch (error) {
      Alert.alert(t("admin.error"), error instanceof Error ? error.message : t("admin.operationFailed"));
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
            <Text style={sharedStyles.loadingText}>{t("common.loading")}</Text>
          </Box>
        ) : submissions.length === 0 ? (
          <Box style={sharedStyles.emptyContainer}>
            <Ionicons name="checkmark-done-outline" size={48} color={theme.colors.gray200} />
            <Text style={sharedStyles.emptyText}>{t("admin.noPendingBrandSubmissions")}</Text>
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
                {submission.category && <Text style={sharedStyles.postMeta as any}>{t("admin.category")} {submission.category}</Text>}
                {submission.founder && <Text style={sharedStyles.postMeta as any}>{t("admin.founder")} {submission.founder}</Text>}
                {submission.foundedYear && <Text style={sharedStyles.postMeta as any}>{t("admin.foundedYear")} {submission.foundedYear}</Text>}
                {submission.country && <Text style={sharedStyles.postMeta as any}>{t("admin.country")} {submission.country}</Text>}
                {submission.website && (
                  <Text style={[sharedStyles.postContent, { color: theme.colors.gray500 }]} numberOfLines={1}>
                    {t("admin.website")} {submission.website}
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
                  <ButtonText style={{ fontSize: 12 }}>{t("admin.approve")}</ButtonText>
                </Button>
                <Button
                  size="sm"
                  colorScheme="error"
                  onPress={() => handleReject(submission.id)}
                  disabled={actionLoading}
                  leftIcon={<Ionicons name="close-circle" size={16} color={theme.colors.white} />}
                >
                  <ButtonText style={{ fontSize: 12 }}>{t("admin.reject")}</ButtonText>
                </Button>
              </HStack>
            </Box>
          ))
        )}
        <Box style={{ height: 40 }} />
      </ScrollView>

      <Modal visible={rejectModalVisible} transparent animationType="fade" onRequestClose={() => setRejectModalVisible(false)}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
        <Box style={sharedStyles.modalOverlay}>
          <Box style={sharedStyles.modalContent}>
            <Text style={sharedStyles.modalTitle}>{t("admin.rejectReason")}</Text>
            <Input
              variant="outline"
              size="md"
              placeholder={t("admin.rejectReasonPlaceholder")}
              placeholderTextColor={theme.colors.gray300}
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
              numberOfLines={3}
            />
            <HStack style={sharedStyles.modalButtons}>
              <Button variant="outline" size="sm" onPress={() => setRejectModalVisible(false)}>
                <ButtonText style={{ color: theme.colors.gray400 }}>{t("common.cancel")}</ButtonText>
              </Button>
              <Button size="sm" colorScheme="error" onPress={handleConfirmReject} disabled={actionLoading} isLoading={actionLoading}>
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
