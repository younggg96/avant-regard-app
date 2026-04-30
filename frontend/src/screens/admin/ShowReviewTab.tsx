import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  RefreshControl,
  Alert,
  Modal,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { theme } from "../../theme";
import { showService, Show } from "../../services/showService";
import { sharedStyles } from "./adminStyles";
import { Box, HStack, VStack, Text, Input, Button, ButtonText, ScrollView, OptimizedImage } from "../../components/ui";
import { ImageSize } from "../../utils/imageUtils";

const ShowReviewTab = () => {
  const { t } = useTranslation();
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
      console.error("fetchPendingShows error:", error);
      Alert.alert(t("admin.error"), error instanceof Error ? error.message : t("admin.fetchPendingShowsFailed"));
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
    Alert.alert(t("admin.confirmReview"), t("admin.confirmApproveShow"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("admin.confirmApprove"),
        onPress: async () => {
          try {
            setActionLoading(true);
            await showService.approveShow(showId);
            Alert.alert(t("common.success"), t("admin.showApproved"));
            setShows((prev) => prev.filter((s) => s.id !== showId));
          } catch (error) {
            Alert.alert(t("admin.error"), error instanceof Error ? error.message : t("admin.operationFailed"));
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
      Alert.alert(t("admin.rejected"), t("admin.showRejected"));
      setRejectModalVisible(false);
      setShows((prev) => prev.filter((s) => s.id !== selectedShowId));
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
        ) : shows.length === 0 ? (
          <Box style={sharedStyles.emptyContainer}>
            <Ionicons name="checkmark-done-outline" size={48} color={theme.colors.gray200} />
            <Text style={sharedStyles.emptyText}>{t("admin.noPendingShows")}</Text>
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
                  <Text style={styles.metaLabel}>{t("admin.brand")}</Text>
                  <Text style={styles.metaValue}>{show.brand}</Text>
                </HStack>
                <HStack style={styles.metaRow}>
                  <Text style={styles.metaLabel}>{t("admin.year")}</Text>
                  <Text style={styles.metaValue}>{show.year}</Text>
                </HStack>
                <HStack style={styles.metaRow}>
                  <Text style={styles.metaLabel}>{t("admin.season")}</Text>
                  <Text style={styles.metaValue}>{show.season}</Text>
                </HStack>
                {show.category && (
                  <HStack style={styles.metaRow}>
                    <Text style={styles.metaLabel}>{t("admin.category")}</Text>
                    <Text style={styles.metaValue}>{show.category}</Text>
                  </HStack>
                )}
                {show.designer && (
                  <HStack style={styles.metaRow}>
                    <Text style={styles.metaLabel}>{t("admin.designer")}</Text>
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
                  <ButtonText style={{ fontSize: 12 }}>{t("admin.approve")}</ButtonText>
                </Button>
                <Button
                  size="sm"
                  colorScheme="error"
                  onPress={() => handleOpenRejectModal(String(show.id))}
                  disabled={actionLoading}
                  leftIcon={<Ionicons name="close-circle-outline" size={16} color={theme.colors.white} />}
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
              <Button size="sm" onPress={handleConfirmReject} disabled={actionLoading} isLoading={actionLoading}>
                <ButtonText>{t("admin.confirmReject")}</ButtonText>
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
