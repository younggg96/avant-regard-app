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
import { Ionicons } from "@expo/vector-icons";
import { useThemedStyles, type AppTheme } from "../../theme";
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
import ProductReviewTab from "./ProductReviewTab";
import ProductManagementTab from "./ProductManagementTab";
import DisputeQueueTab from "./DisputeQueueTab";

type MenuItemKey =
  | "pending"
  | "postsManagement"
  | "comments"
  | "users"
  | "customerService"
  | "storeManagement"
  | "productReview"
  | "productManagement"
  | "disputeQueue"
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

interface MenuItem {
  key: MenuItemKey | "stores" | "merchants";
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  navigateTo?: string;
}

interface MenuSection {
  id: string;
  title: string;
  items: MenuItem[];
}

const COMPONENT_MAP: Record<MenuItemKey, React.FC> = {
  pending: PendingTab,
  postsManagement: PostsManagementTab,
  comments: CommentsTab,
  users: UsersTab,
  customerService: CustomerServiceTab,
  storeManagement: StoreManagementTab,
  productReview: ProductReviewTab,
  productManagement: ProductManagementTab,
  disputeQueue: DisputeQueueTab,
  banners: BannersTab,
  communities: CommunitiesTab,
  broadcast: BroadcastTab,
  brandSubmissions: BrandSubmissionsTab,
  brandManagement: BrandManagementTab,
  showReview: ShowReviewTab,
  showManagement: ShowManagementTab,
  brandImageReview: BrandImageReviewTab,
  recommendConfig: RecommendConfigTab,
  maintenance: MaintenanceTab,
  levelReview: LevelReviewTab,
  lottery: LotteryAdminTab,
};

const AdminScreen = () => {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const [activeItem, setActiveItem] = useState<{
    key: MenuItemKey;
    label: string;
  } | null>(null);
  const styles = useThemedStyles(makeStyles);

  const SECTIONS: MenuSection[] = useMemo(
    () => [
      {
        id: "review",
        title: t("admin.sections.review"),
        items: [
          { key: "pending", label: t("admin.pendingPosts"), icon: "document-text-outline" },
          { key: "productReview", label: t("admin.productReview"), icon: "pricetag-outline" },
          { key: "stores", label: t("admin.storeReview"), icon: "storefront-outline", navigateTo: "StoreReview" },
          { key: "merchants", label: t("admin.merchantEntry"), icon: "business-outline", navigateTo: "MerchantReview" },
          { key: "brandSubmissions", label: t("admin.brandReview"), icon: "ribbon-outline" },
          { key: "brandImageReview", label: t("admin.brandImages"), icon: "images-outline" },
          { key: "showReview", label: t("admin.showReview"), icon: "eye-outline" },
          { key: "levelReview", label: t("admin.levelReview"), icon: "medal-outline" },
          { key: "disputeQueue", label: t("admin.disputeQueue"), icon: "shield-checkmark-outline" },
        ],
      },
      {
        id: "productsTrading",
        title: t("admin.sections.productsTrading"),
        items: [
          { key: "productManagement", label: t("admin.productManagement"), icon: "cube-outline" },
          { key: "storeManagement", label: t("admin.storeManagement"), icon: "storefront-outline" },
        ],
      },
      {
        id: "content",
        title: t("admin.sections.content"),
        items: [
          { key: "postsManagement", label: t("admin.postsManagement"), icon: "newspaper-outline" },
          { key: "comments", label: t("admin.commentsManagement"), icon: "chatbubbles-outline" },
          { key: "banners", label: t("admin.banners"), icon: "megaphone-outline" },
          { key: "communities", label: t("admin.communityManagement"), icon: "people-outline" },
          { key: "broadcast", label: t("admin.broadcast"), icon: "notifications-outline" },
        ],
      },
      {
        id: "usersSupport",
        title: t("admin.sections.usersSupport"),
        items: [
          { key: "users", label: t("admin.usersManagement"), icon: "person-outline" },
          { key: "customerService", label: t("admin.customerService"), icon: "headset-outline" },
        ],
      },
      {
        id: "brandsShows",
        title: t("admin.sections.brandsShows"),
        items: [
          { key: "brandManagement", label: t("admin.brandManagement"), icon: "diamond-outline" },
          { key: "showManagement", label: t("admin.showManagement"), icon: "calendar-outline" },
        ],
      },
      {
        id: "system",
        title: t("admin.sections.system"),
        items: [
          { key: "recommendConfig", label: t("admin.recommend"), icon: "sparkles-outline" },
          { key: "lottery", label: t("admin.lottery"), icon: "gift-outline" },
          { key: "maintenance", label: t("admin.maintenance"), icon: "construct-outline" },
        ],
      },
    ],
    [t]
  );

  const handleItemPress = (item: MenuItem) => {
    if (item.navigateTo) {
      (navigation.navigate as any)(item.navigateTo);
    } else {
      setActiveItem({ key: item.key as MenuItemKey, label: item.label });
    }
  };

  if (activeItem) {
    const ActiveComponent = COMPONENT_MAP[activeItem.key];
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <ScreenHeader
          title={activeItem.label}
          showBack={true}
          onBackPress={() => setActiveItem(null)}
        />
        <View style={styles.detailContent}>
          <ActiveComponent />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader title={t("admin.title")} showBack={true} />
      <ScrollView
        style={styles.menuScroll}
        contentContainerStyle={styles.menuContent}
        showsVerticalScrollIndicator={false}
      >
        {SECTIONS.map((section) => (
          <View key={section.id} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.sectionCard}>
              {section.items.map((item, idx) => (
                <TouchableOpacity
                  key={item.key}
                  style={[
                    styles.menuItem,
                    idx < section.items.length - 1 && styles.menuItemBorder,
                  ]}
                  onPress={() => handleItemPress(item)}
                  activeOpacity={0.6}
                >
                  <View style={styles.menuItemLeft}>
                    <Ionicons
                      name={item.icon}
                      size={20}
                      color={styles.menuItemIcon.color}
                      style={styles.menuItemIcon}
                    />
                    <Text style={styles.menuItemLabel}>{item.label}</Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={styles.menuItemChevron.color}
                  />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.colors.background,
    },
    menuScroll: {
      flex: 1,
    },
    menuContent: {
      paddingHorizontal: t.spacing.md,
      paddingTop: t.spacing.sm,
    },
    section: {
      marginBottom: t.spacing.lg,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: "600",
      color: t.colors.gray300,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: t.spacing.sm,
      paddingHorizontal: 4,
    },
    sectionCard: {
      backgroundColor: t.colors.card,
      borderRadius: t.borderRadius.lg,
      overflow: "hidden",
    },
    menuItem: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 14,
      paddingHorizontal: t.spacing.md,
    },
    menuItemBorder: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    menuItemLeft: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
    },
    menuItemIcon: {
      color: t.colors.text,
      marginRight: 12,
    },
    menuItemLabel: {
      ...t.typography.body,
      color: t.colors.text,
      fontSize: 15,
    },
    menuItemChevron: {
      color: t.colors.gray300,
    },
    detailContent: {
      flex: 1,
    },
  });

export default AdminScreen;
