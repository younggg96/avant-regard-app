import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
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
import BrandImageReviewTab from "./BrandImageReviewTab";

type TabType =
  | "pending"
  | "comments"
  | "users"
  | "stores"
  | "merchants"
  | "banners"
  | "communities"
  | "broadcast"
  | "brandSubmissions"
  | "brandManagement"
  | "showReview"
  | "brandImageReview";

interface TabConfig {
  key: TabType;
  label: string;
  navigateTo?: string;
}

const TABS: TabConfig[] = [
  { key: "pending", label: "待审核帖子" },
  { key: "comments", label: "评论管理" },
  { key: "users", label: "用户管理" },
  { key: "stores", label: "店铺审核", navigateTo: "StoreReview" },
  { key: "merchants", label: "商家入驻", navigateTo: "MerchantReview" },
  { key: "banners", label: "Banner" },
  { key: "communities", label: "社区管理" },
  { key: "broadcast", label: "广播通知" },
  { key: "brandSubmissions", label: "品牌审核" },
  { key: "brandManagement", label: "品牌管理" },
  { key: "showReview", label: "秀场审核" },
  { key: "brandImageReview", label: "图片审核" },
];

const AdminScreen = () => {
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState<TabType>("pending");

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
      case "comments":
        return <CommentsTab />;
      case "users":
        return <UsersTab />;
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
      case "brandImageReview":
        return <BrandImageReviewTab />;
      default:
        return <UsersTab />;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader title="管理员后台" showBack={true} />

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
