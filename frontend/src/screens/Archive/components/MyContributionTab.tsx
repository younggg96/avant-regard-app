import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Box, Text, HStack, ScrollView } from "../../../components/ui";
import { theme, useThemedStyles, type AppTheme } from "../../../theme";
import {
  showService,
  Show,
  deleteMyShow,
} from "../../../services/showService";
import {
  brandService,
  BrandSubmission,
  deleteMyBrandSubmission,
} from "../../../services/brandService";
import {
  buyerStoreService,
  UserSubmittedStore,
  deleteMyStoreSubmission,
  CONTRIBUTION_PAGE_SIZE,
} from "../../../services/buyerStoreService";
import { useAuthStore } from "../../../store/authStore";
import ContributionCard, { CARD_PADDING } from "./ContributionCard";
import { ContributionSubTab, CONTRIBUTION_SUB_TAB_IDS, CONTRIBUTION_SUB_TAB_KEYS } from "../types";

const MyContributionTab: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const styles = useThemedStyles(makeStyles);

  const [subTab, setSubTab] = useState<ContributionSubTab>("show");
  const [myShows, setMyShows] = useState<Show[]>([]);
  const [myBrands, setMyBrands] = useState<BrandSubmission[]>([]);
  const [myStores, setMyStores] = useState<UserSubmittedStore[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadContributions = useCallback(async () => {
    if (!user?.userId) return;
    const [showsResult, brandsResult, storesResult] = await Promise.all([
      showService.getMyShows(),
      brandService.getMySubmissions(),
      buyerStoreService.getMySubmissions(1, CONTRIBUTION_PAGE_SIZE),
    ]);
    setMyShows(showsResult);
    setMyBrands(brandsResult);
    setMyStores(storesResult.stores);
  }, [user]);

  useEffect(() => {
    if (!loaded && user?.userId) {
      setLoading(true);
      loadContributions()
        .catch(console.error)
        .finally(() => {
          setLoading(false);
          setLoaded(true);
        });
    }
  }, [loaded, user, loadContributions]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadContributions().catch(console.error);
    setRefreshing(false);
  }, [loadContributions]);

  const subTabs = useMemo(
    () => CONTRIBUTION_SUB_TAB_IDS.map((id) => ({ id, label: t(CONTRIBUTION_SUB_TAB_KEYS[id]) })),
    [t]
  );

  if (!user?.userId) {
    return (
      <Box style={styles.emptyState}>
        <Ionicons
          name="person-outline"
          size={48}
          color={theme.colors.gray200}
        />
        <Text style={styles.emptyTitle}>{t("archive.loginRequired")}</Text>
        <Text style={styles.emptyText}>{t("archive.loginToView")}</Text>
      </Box>
    );
  }

  const handleShowPress = (show: Show) => {
    (navigation as any).navigate("CollectionDetail", {
      collection: {
        id: String(show.id),
        title: `${show.brand} ${show.season}`,
        season: show.season,
        year: String(show.year || ""),
        coverImage: show.coverImage || "",
        imageCount: 0,
        designer: show.designer,
        description: show.description,
        category: show.category,
        showUrl: show.showUrl,
        contributorName: show.contributorName,
      },
      brandName: show.brand,
    });
  };

  const handleBrandPress = (b: BrandSubmission) => {
    if (b.status === "APPROVED") {
      (navigation as any).navigate("BrandDetail", { name: b.name });
    }
  };

  const handleStorePress = (s: UserSubmittedStore) => {
    if (s.status === "APPROVED" && s.approvedStoreId) {
      (navigation as any).navigate("StoreDetail", {
        storeId: s.approvedStoreId,
      });
    }
  };

  const handleDeleteShow = async (show: Show) => {
    try {
      await deleteMyShow(Number(show.id));
      setMyShows((prev) => prev.filter((s) => s.id !== show.id));
    } catch (e: any) {
      Alert.alert(t("archive.deleteFailed"), e.message || t("archive.deleteFailedRetry"));
    }
  };

  const handleDeleteBrand = async (brand: BrandSubmission) => {
    try {
      await deleteMyBrandSubmission(brand.id);
      setMyBrands((prev) => prev.filter((b) => b.id !== brand.id));
    } catch (e: any) {
      Alert.alert(t("archive.deleteFailed"), e.message || t("archive.deleteFailedRetry"));
    }
  };

  const handleDeleteStore = async (store: UserSubmittedStore) => {
    try {
      await deleteMyStoreSubmission(store.id);
      setMyStores((prev) => prev.filter((s) => s.id !== store.id));
    } catch (e: any) {
      Alert.alert(t("archive.deleteFailed"), e.message || t("archive.deleteFailedRetry"));
    }
  };

  const dataMap: Record<ContributionSubTab, any[]> = {
    show: myShows,
    brand: myBrands,
    store: myStores,
  };
  const data = dataMap[subTab];

  const emptyConfig: Record<
    ContributionSubTab,
    { icon: keyof typeof Ionicons.glyphMap; text: string }
  > = {
    show: { icon: "film-outline", text: t("archive.noShowContrib") },
    brand: { icon: "pricetag-outline", text: t("archive.noBrandContrib") },
    store: { icon: "storefront-outline", text: t("archive.noStoreContrib") },
  };

  const renderCards = () => {
    if (subTab === "show") {
      return (myShows as Show[]).map((s) => {
        const canDelete = s.status === "REJECTED" || s.status === "PENDING";
        return (
          <ContributionCard
            key={`show-${s.id}`}
            title={`${s.brand} ${s.season}`}
            subtitle={s.category || s.year?.toString()}
            imageUri={s.coverImage}
            placeholderIcon="film-outline"
            status={s.status || "APPROVED"}
            date={s.createdAt}
            onPress={() => handleShowPress(s)}
            onDelete={canDelete ? () => handleDeleteShow(s) : undefined}
          />
        );
      });
    }
    if (subTab === "brand") {
      return (myBrands as BrandSubmission[]).map((b) => {
        const canDelete = b.status === "REJECTED" || b.status === "PENDING";
        return (
          <ContributionCard
            key={`brand-${b.id}`}
            title={b.name}
            subtitle={b.category}
            imageUri={b.coverImage}
            placeholderIcon="pricetag-outline"
            status={b.status}
            rejectReason={b.rejectReason}
            date={b.createdAt}
            onPress={() => handleBrandPress(b)}
            onDelete={canDelete ? () => handleDeleteBrand(b) : undefined}
          />
        );
      });
    }
    return (myStores as UserSubmittedStore[]).map((s) => {
      const canDelete = s.status === "REJECTED" || s.status === "PENDING";
      return (
        <ContributionCard
          key={`store-${s.id}`}
          title={s.name}
          subtitle={`${s.city}, ${s.country}`}
          imageUri={s.images?.[0]}
          placeholderIcon="storefront-outline"
          status={s.status}
          rejectReason={s.rejectReason}
          date={s.createdAt}
          onPress={() => handleStorePress(s)}
          onDelete={canDelete ? () => handleDeleteStore(s) : undefined}
        />
      );
    });
  };

  return (
    <Box flex={1}>
      {/* Sub-tab chips */}
      <HStack style={styles.subFilterRow}>
        {subTabs.map((tab) => {
          const count =
            tab.id === "show"
              ? myShows.length
              : tab.id === "brand"
                ? myBrands.length
                : myStores.length;
          const isActive = subTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.chip, isActive && styles.chipActive]}
              onPress={() => setSubTab(tab.id)}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                {tab.label}
              </Text>
              <Text
                style={[
                  styles.chipCount,
                  isActive && styles.chipCountActive,
                ]}
              >
                {count}
              </Text>
            </TouchableOpacity>
          );
        })}
      </HStack>

      {/* Content */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {loading ? (
          <Box style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.gray400} />
          </Box>
        ) : data.length === 0 ? (
          <Box style={styles.emptyState}>
            <Ionicons
              name={emptyConfig[subTab].icon}
              size={48}
              color={theme.colors.gray200}
            />
            <Text style={styles.emptyTitle}>{emptyConfig[subTab].text}</Text>
            <Text style={styles.emptyText}>
              {t("archive.submissionHint")}
            </Text>
          </Box>
        ) : (
          <Box style={styles.cardGrid}>{renderCards()}</Box>
        )}
      </ScrollView>
    </Box>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    subFilterRow: {
      flexDirection: "row",
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 4,
      gap: 8,
    },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 12,
      height: 32,
      borderRadius: 16,
      backgroundColor: t.colors.card,
      borderWidth: 1,
      borderColor: t.colors.gray200,
    },
    chipActive: {
      backgroundColor: t.colors.text,
      borderColor: t.colors.text,
    },
    chipText: {
      fontSize: 13,
      fontWeight: "500",
      color: t.colors.gray600,
    },
    chipTextActive: {
      color: t.colors.textInverted,
    },
    chipCount: {
      fontSize: 11,
      fontWeight: "600",
      color: t.colors.gray400,
    },
    chipCountActive: {
      color: "rgba(255,255,255,0.7)",
    },
    scrollContainer: {
      paddingBottom: 32,
    },
    loadingContainer: {
      paddingVertical: 80,
      alignItems: "center",
    },
    cardGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      paddingHorizontal: CARD_PADDING,
      paddingTop: 4,
      justifyContent: "space-between",
    },
    emptyState: {
      justifyContent: "center",
      alignItems: "center",
      paddingVertical: 80,
      paddingHorizontal: 32,
    },
    emptyTitle: {
      fontSize: 17,
      fontWeight: "600",
      color: t.colors.text,
      marginTop: t.spacing.md,
      marginBottom: t.spacing.sm,
    },
    emptyText: {
      fontSize: 14,
      color: t.colors.gray400,
      textAlign: "center",
      lineHeight: 20,
    },
  });

export default MyContributionTab;
