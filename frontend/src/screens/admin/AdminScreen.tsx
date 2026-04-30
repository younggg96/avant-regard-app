import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { theme } from "../../theme";
import ScreenHeader from "../../components/ScreenHeader";
import PendingTab from "./PendingTab";
import CommentsTab from "./CommentsTab";
import UsersTab from "./UsersTab";
import BannersTab from "./BannersTab";
import CommunitiesTab from "./CommunitiesTab";
import BroadcastTab from "./BroadcastTab";
import BrandSubmissionsTab from "./BrandSubmissionsTab";
import BrandManagementTab from "./BrandManagementTab";
import ShowReviewTab from "./ShowReviewTab";
import ShowManagementTab from "./ShowManagementTab";
import BrandImageReviewTab from "./BrandImageReviewTab";
import StoreManagementTab from "./StoreManagementTab";
import PostsManagementTab from "./PostsManagementTab";
import CustomerServiceTab from "./CustomerServiceTab";
import RecommendConfigTab from "./RecommendConfigTab";
import MaintenanceTab from "./MaintenanceTab";
import LevelReviewTab from "./LevelReviewTab";
import LotteryAdminTab from "./LotteryAdminTab";

type TabType =
  | "pending"
  | "postsManagement"
  | "comments"
  | "users"
  | "customerService"
  | "stores"
  | "merchants"
  | "storeManagement"
  | "banners"
  | "communities"
  | "broadcast"
  | "brandSubmissions"
  | "brandManagement"
  | "showReview"
  | "showManagement"
  | "brandImageReview"
  | "recommendConfig"
  | "maintenance"
  | "levelReview"
  | "lottery";

interface TabConfig {
  key: TabType;
  label: string;
  navigateTo?: string;
}

const AdminScreen = () => {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState<TabType>("pending");

  const TABS: TabConfig[] = useMemo(() => [
    { key: "pending", label: t("admin.pendingPosts") },
    { key: "postsManagement", label: t("admin.postsManagement") },
    { key: "comments", label: t("admin.commentsManagement") },
    { key: "users", label: t("admin.usersManagement") },
    { key: "customerService", label: t("admin.customerService") },
    { key: "stores", label: t("admin.storeReview"), navigateTo: "StoreReview" },
    { key: "merchants", label: t("admin.merchantEntry"), navigateTo: "MerchantReview" },
    { key: "storeManagement", label: t("admin.storeManagement") },
    { key: "banners", label: "Banner" },
    { key: "communities", label: t("admin.communityManagement") },
    { key: "broadcast", label: t("admin.broadcast") },
    { key: "brandSubmissions", label: t("admin.brandReview") },
    { key: "brandManagement", label: t("admin.brandManagement") },
    { key: "showReview", label: t("admin.showReview") },
    { key: "showManagement", label: t("admin.showManagement") },
    { key: "brandImageReview", label: t("admin.brandImages") },
    { key: "recommendConfig", label: t("admin.recommend") },
    { key: "levelReview", label: t("admin.levelReview") },
    { key: "lottery", label: t("admin.lottery") },
    { key: "maintenance", label: t("admin.maintenance") },
  ], [t]);

  const handleTabPress = (tab: TabConfig) => {
    if (tab.navigateTo) {
      (navigation.navigate as any)(tab.navigateTo);
    } else {
      setActiveTab(tab.key);
    }
  };

  const renderActiveTab = () => {
    switch (activeTab) {
      case "pending":
        return <PendingTab />;
      case "postsManagement":
        return <PostsManagementTab />;
      case "comments":
        return <CommentsTab />;
      case "users":
        return <UsersTab />;
      case "customerService":
        return <CustomerServiceTab />;
      case "banners":
        return <BannersTab />;
      case "communities":
        return <CommunitiesTab />;
      case "broadcast":
        return <BroadcastTab />;
      case "brandSubmissions":
        return <BrandSubmissionsTab />;
      case "brandManagement":
        return <BrandManagementTab />;
      case "showReview":
        return <ShowReviewTab />;
      case "showManagement":
        return <ShowManagementTab />;
      case "brandImageReview":
        return <BrandImageReviewTab />;
      case "storeManagement":
        return <StoreManagementTab />;
      case "recommendConfig":
        return <RecommendConfigTab />;
      case "levelReview":
        return <LevelReviewTab />;
      case "lottery":
        return <LotteryAdminTab />;
      case "maintenance":
        return <MaintenanceTab />;
      default:
        return <UsersTab />;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader title={t("admin.title")} showBack={true} />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabScrollContainer}
        contentContainerStyle={styles.tabContentContainer}
      >
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && !tab.navigateTo && styles.tabActive]}
            onPress={() => handleTabPress(tab)}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === tab.key && !tab.navigateTo && styles.tabTextActive,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.tabContent}>{renderActiveTab()}</View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  tabScrollContainer: {
    backgroundColor: theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray100,
    flexGrow: 0,
    flexShrink: 0,
  },
  tabContentContainer: {
    flexDirection: "row",
    paddingHorizontal: theme.spacing.xs,
    alignItems: "center",
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: theme.spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: {
    borderBottomColor: theme.colors.black,
  },
  tabText: {
    ...theme.typography.body,
    color: theme.colors.gray300,
  },
  tabTextActive: {
    color: theme.colors.black,
    fontWeight: "600",
  },
  tabContent: {
    flex: 1,
  },
});

export default AdminScreen;
