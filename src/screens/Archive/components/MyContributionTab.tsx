import React, { useState, useCallback, useEffect } from "react";
import {
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  TouchableOpacity,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Box, Text, HStack, ScrollView } from "../../../components/ui";
import { theme } from "../../../theme";
import { showService, Show } from "../../../services/showService";
import { brandService, BrandSubmission } from "../../../services/brandService";
import {
  buyerStoreService,
  UserSubmittedStore,
} from "../../../services/buyerStoreService";
import { useAuthStore } from "../../../store/authStore";
import ContributionCard, { CARD_PADDING } from "./ContributionCard";
import { ContributionSubTab, CONTRIBUTION_SUB_TABS } from "../types";

const MyContributionTab: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuthStore();

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
      buyerStoreService.getMySubmissions(1, 100),
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

  if (!user?.userId) {
    return (
      <Box style={styles.emptyState}>
        <Ionicons
          name="person-outline"
          size={48}
          color={theme.colors.gray200}
        />
        <Text style={styles.emptyTitle}>请先登录</Text>
        <Text style={styles.emptyText}>登录后查看你的贡献记录</Text>
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
    show: { icon: "film-outline", text: "暂无秀场贡献" },
    brand: { icon: "pricetag-outline", text: "暂无品牌贡献" },
    store: { icon: "storefront-outline", text: "暂无买手店贡献" },
  };

  const renderCards = () => {
    if (subTab === "show") {
      return (myShows as Show[]).map((s) => (
        <ContributionCard
          key={`show-${s.id}`}
          title={`${s.brand} ${s.season}`}
          subtitle={s.category || s.year?.toString()}
          imageUri={s.coverImage}
          placeholderIcon="film-outline"
          status={s.status || "APPROVED"}
          date={s.createdAt}
          onPress={() => handleShowPress(s)}
        />
      ));
    }
    if (subTab === "brand") {
      return (myBrands as BrandSubmission[]).map((b) => (
        <ContributionCard
          key={`brand-${b.id}`}
          title={b.name}
          subtitle={b.category}
          imageUri={b.coverImage}
          placeholderIcon="pricetag-outline"
          status={b.status}
          date={b.createdAt}
          onPress={() => handleBrandPress(b)}
        />
      ));
    }
    return (myStores as UserSubmittedStore[]).map((s) => (
      <ContributionCard
        key={`store-${s.id}`}
        title={s.name}
        subtitle={`${s.city}, ${s.country}`}
        imageUri={s.images?.[0]}
        placeholderIcon="storefront-outline"
        status={s.status}
        date={s.createdAt}
        onPress={() => handleStorePress(s)}
      />
    ));
  };

  return (
    <Box flex={1}>
      {/* Sub-tab chips */}
      <HStack style={styles.subFilterRow}>
        {CONTRIBUTION_SUB_TABS.map((tab) => {
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
              你提交的内容通过审核后会显示在这里
            </Text>
          </Box>
        ) : (
          <Box style={styles.cardGrid}>{renderCards()}</Box>
        )}
      </ScrollView>
    </Box>
  );
};

const styles = StyleSheet.create({
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
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
  },
  chipActive: {
    backgroundColor: theme.colors.black,
    borderColor: theme.colors.black,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "500",
    color: theme.colors.gray600,
  },
  chipTextActive: {
    color: theme.colors.white,
  },
  chipCount: {
    fontSize: 11,
    fontWeight: "600",
    color: theme.colors.gray400,
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
    color: theme.colors.black,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  emptyText: {
    fontSize: 14,
    color: theme.colors.gray400,
    textAlign: "center",
    lineHeight: 20,
  },
});

export default MyContributionTab;
