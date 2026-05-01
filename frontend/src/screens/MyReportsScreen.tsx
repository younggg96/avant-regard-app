import React, { useState, useCallback } from "react";
import {
  View,
  FlatList,
  RefreshControl,
  StyleSheet,
  Dimensions,
  Image as RNImage,
} from "react-native";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import {
  Box,
  Text,
  Pressable,
  VStack,
  HStack,
  OptimizedImage,
} from "../components/ui";
import { ImageSize } from "../utils/imageUtils";
import { theme } from "../theme";
import ScreenHeader from "../components/ScreenHeader";
import {
  ReportRecord,
  getMyReports,
} from "../services/moderationService";

const REASON_LABEL_KEYS: Record<string, string> = {
  SPAM: "reportBlock.spam",
  INAPPROPRIATE: "reportBlock.inappropriate",
  HARASSMENT: "reportBlock.harassment",
  MISINFORMATION: "reportBlock.misinformation",
  COPYRIGHT: "reportBlock.copyright",
  PORNOGRAPHY: "myReports.reasonPornography",
  VIOLENCE: "myReports.reasonViolence",
  OTHER: "reportBlock.other",
};

const STATUS_CONFIG: Record<string, { labelKey: string; color: string; bg: string }> = {
  PENDING: { labelKey: "myReports.pending", color: "#F59E0B", bg: "#FEF3C7" },
  REVIEWED: { labelKey: "myReports.reviewed", color: "#3B82F6", bg: "#DBEAFE" },
  RESOLVED: { labelKey: "myReports.resolved", color: "#10B981", bg: "#D1FAE5" },
  DISMISSED: { labelKey: "myReports.rejected", color: "#6B7280", bg: "#F3F4F6" },
};

const MyReportsScreen = () => {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadReports = useCallback(async (pageNum: number = 1, append = false) => {
    try {
      const result = await getMyReports(pageNum, 20);
      if (append) {
        setReports((prev) => [...prev, ...result.reports]);
      } else {
        setReports(result.reports);
      }
      setHasMore(result.reports.length >= 20);
      setPage(pageNum);
    } catch (error) {
      console.error("Error loading reports:", error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      loadReports(1);
    }, [loadReports])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadReports(1);
  };

  const onEndReached = () => {
    if (!hasMore || loadingMore || isLoading) return;
    setLoadingMore(true);
    loadReports(page + 1, true);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return t('time.justNow');
    if (minutes < 60) return t('time.minutesAgo', { count: minutes });
    if (hours < 24) return t('time.hoursAgo', { count: hours });
    if (days < 30) return t('time.daysAgo', { count: days });
    return date.toLocaleDateString();
  };

  const handleReportPress = (report: ReportRecord) => {
    if (report.targetType === "POST") {
      (navigation as any).navigate("PostDetail", { postId: report.targetId });
    } else if (report.targetType === "COMMENT" && report.targetInfo?.postId) {
      (navigation as any).navigate("PostDetail", { postId: report.targetInfo.postId });
    } else if (report.targetType === "USER") {
      (navigation as any).navigate("UserProfile", { userId: report.targetId });
    }
  };

  const getTypeLabel = (type: string) => {
    const key = `admin.targetType_${type}`;
    return t(key as any, { defaultValue: type });
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "POST": return "document-text-outline";
      case "COMMENT": return "chatbubble-outline";
      case "MESSAGE": return "mail-outline";
      case "USER": return "person-outline";
      default: return "flag-outline";
    }
  };

  const renderReport = ({ item }: { item: ReportRecord }) => {
    const status = STATUS_CONFIG[item.status] || STATUS_CONFIG.PENDING;
    const isPost = item.targetType === "POST";

    return (
      <Pressable onPress={() => handleReportPress(item)}>
        <VStack
          p="$md"
          borderBottomWidth={1}
          borderBottomColor="$gray100"
        >
          <HStack justifyContent="space-between" alignItems="center" mb="$sm">
            <HStack alignItems="center" gap="$xs">
              <Ionicons
                name={getTypeIcon(item.targetType) as any}
                size={14}
                color={theme.colors.gray300}
              />
              <Text fontSize="$xs" color="$gray300">
                {getTypeLabel(item.targetType)}
              </Text>
            </HStack>
            <HStack alignItems="center" gap="$sm">
              <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                <Text style={[styles.statusText, { color: status.color }]}>
                  {t(status.labelKey)}
                </Text>
              </View>
              <Text fontSize="$xs" color="$gray200">
                {formatTime(item.createdAt)}
              </Text>
            </HStack>
          </HStack>

          <HStack alignItems="flex-start" gap="$sm">
            {isPost && item.targetInfo?.coverImage ? (
              <OptimizedImage
                uri={item.targetInfo.coverImage}
                size={ImageSize.THUMBNAIL}
                style={styles.coverImage}
                contentFit="cover"
                lazy
              />
            ) : null}

            <VStack flex={1}>
              {isPost && item.targetInfo?.title ? (
                <Text
                  fontSize="$sm"
                  fontWeight="$medium"
                  color="$black"
                  numberOfLines={2}
                >
                  {item.targetInfo.title}
                </Text>
              ) : item.targetType === "USER" && item.targetInfo?.username ? (
                <Text
                  fontSize="$sm"
                  fontWeight="$medium"
                  color="$black"
                  numberOfLines={1}
                >
                  @{item.targetInfo.username}
                </Text>
              ) : item.targetInfo?.content ? (
                <Text
                  fontSize="$sm"
                  color="$gray600"
                  numberOfLines={2}
                >
                  {item.targetInfo.content}
                </Text>
              ) : (
                <Text fontSize="$sm" color="$gray300" fontStyle="italic">
                  {t('myReports.contentDeleted')}
                </Text>
              )}

              <HStack mt="$sm" alignItems="center" gap="$xs">
                <Ionicons
                  name="flag-outline"
                  size={13}
                  color={theme.colors.error}
                />
                <Text fontSize="$xs" color="$gray400">
                  {REASON_LABEL_KEYS[item.reason] ? t(REASON_LABEL_KEYS[item.reason]) : item.reason}
                </Text>
              </HStack>

              {item.description ? (
                <Text
                  fontSize="$xs"
                  color="$gray300"
                  mt="$xs"
                  numberOfLines={2}
                >
                  {t('myReports.additionalInfo', { text: item.description })}
                </Text>
              ) : null}
            </VStack>
          </HStack>
        </VStack>
      </Pressable>
    );
  };

  const renderEmptyState = () => (
    <VStack alignItems="center" justifyContent="center" py="$xl" flex={1}>
      <Ionicons name="flag-outline" size={48} color={theme.colors.gray200} />
      <Text color="$gray400" mt="$md" fontSize="$md">
        {t("myReports.noReports")}
      </Text>
      <Text color="$gray300" mt="$xs" fontSize="$sm">
        {t("myReports.emptyHint")}
      </Text>
    </VStack>
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <Box py="$md" alignItems="center">
        <Text fontSize="$xs" color="$gray300">{t('common.loadMore')}</Text>
      </Box>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader title={t("myReports.title")} showBack />

      {isLoading ? (
        <VStack alignItems="center" justifyContent="center" flex={1}>
          <RNImage
            source={require("../../assets/gif/profile-loading.gif")}
            style={styles.loadingGif}
            resizeMode="contain"
          />
        </VStack>
      ) : (
        <FlatList
          data={reports}
          renderItem={renderReport}
          keyExtractor={(item) => String(item.id)}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={renderEmptyState}
          ListFooterComponent={renderFooter}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.3}
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  coverImage: {
    width: 56,
    height: 56,
    borderRadius: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
  },
  loadingGif: {
    width: Dimensions.get("window").width * 0.5,
    height: Dimensions.get("window").width * 0.5,
  },
});

export default MyReportsScreen;
