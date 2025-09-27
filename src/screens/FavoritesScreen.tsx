import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme";
import ScreenHeader from "../components/ScreenHeader";

interface FavoriteItem {
  id: string;
  type: "look" | "designer" | "collection";
  title: string;
  subtitle?: string;
  image: string;
  timestamp: string;
  isLiked: boolean;
}

const FavoritesScreen = () => {
  const navigation = useNavigation();
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "all" | "looks" | "designers" | "collections"
  >("all");

  // Mock favorites data
  const [favorites] = useState<FavoriteItem[]>([
    {
      id: "1",
      type: "look",
      title: "春日优雅套装",
      subtitle: "CHANEL 2024春夏",
      image: "https://via.placeholder.com/300x400",
      timestamp: "2天前",
      isLiked: true,
    },
    {
      id: "2",
      type: "designer",
      title: "Gabrielle Chanel",
      subtitle: "香奈儿创始人",
      image: "https://via.placeholder.com/300x300",
      timestamp: "1周前",
      isLiked: true,
    },
    {
      id: "3",
      type: "collection",
      title: "2024春夏高级定制",
      subtitle: "Dior",
      image: "https://via.placeholder.com/300x200",
      timestamp: "2周前",
      isLiked: true,
    },
    {
      id: "4",
      type: "look",
      title: "街头休闲风",
      subtitle: "个人搭配分享",
      image: "https://via.placeholder.com/300x400",
      timestamp: "3周前",
      isLiked: true,
    },
    {
      id: "5",
      type: "designer",
      title: "Karl Lagerfeld",
      subtitle: "时尚界传奇",
      image: "https://via.placeholder.com/300x300",
      timestamp: "1个月前",
      isLiked: true,
    },
  ]);

  const tabs = [
    { key: "all", label: "全部", count: favorites.length },
    {
      key: "looks",
      label: "造型",
      count: favorites.filter((f) => f.type === "look").length,
    },
    {
      key: "designers",
      label: "设计师",
      count: favorites.filter((f) => f.type === "designer").length,
    },
    {
      key: "collections",
      label: "系列",
      count: favorites.filter((f) => f.type === "collection").length,
    },
  ];

  const filteredFavorites =
    activeTab === "all"
      ? favorites
      : favorites.filter((f) => f.type === activeTab.slice(0, -1)); // Remove 's' from plural

  const onRefresh = async () => {
    setRefreshing(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  const handleItemPress = (item: FavoriteItem) => {
    switch (item.type) {
      case "look":
        (navigation as any).navigate("LookDetail", {
          look: {
            id: item.id,
            title: item.title,
            image: item.image,
            isLiked: item.isLiked,
          },
        });
        break;
      case "designer":
        (navigation as any).navigate("DesignerDetail", {
          designerId: item.id,
          designerName: item.title,
        });
        break;
      case "collection":
        (navigation as any).navigate("CollectionDetail", {
          collectionId: item.id,
          collectionTitle: item.title,
        });
        break;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "look":
        return "shirt-outline";
      case "designer":
        return "person-outline";
      case "collection":
        return "albums-outline";
      default:
        return "heart-outline";
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "look":
        return "#10b981";
      case "designer":
        return "#3b82f6";
      case "collection":
        return "#f59e0b";
      default:
        return theme.colors.gray500;
    }
  };

  const renderFavoriteItem = (item: FavoriteItem) => (
    <TouchableOpacity
      key={item.id}
      style={styles.favoriteItem}
      onPress={() => handleItemPress(item)}
    >
      <Image source={{ uri: item.image }} style={styles.itemImage} />
      <View style={styles.itemContent}>
        <View style={styles.itemHeader}>
          <View style={styles.itemTitleRow}>
            <Text style={styles.itemTitle} numberOfLines={2}>
              {item.title}
            </Text>
            <View
              style={[
                styles.typeTag,
                { backgroundColor: getTypeColor(item.type) },
              ]}
            >
              <Ionicons
                name={getTypeIcon(item.type)}
                size={12}
                color={theme.colors.white}
              />
            </View>
          </View>
          {item.subtitle && (
            <Text style={styles.itemSubtitle} numberOfLines={1}>
              {item.subtitle}
            </Text>
          )}
        </View>
        <View style={styles.itemFooter}>
          <Text style={styles.itemTimestamp}>{item.timestamp}</Text>
          <TouchableOpacity style={styles.likeButton}>
            <Ionicons name="heart" size={16} color="#ff4757" />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="heart-outline" size={64} color={theme.colors.gray300} />
      <Text style={styles.emptyTitle}>暂无收藏</Text>
      <Text style={styles.emptySubtitle}>
        {activeTab === "all"
          ? "开始收藏您喜欢的内容吧"
          : `暂无收藏的${tabs.find((t) => t.key === activeTab)?.label}`}
      </Text>
      <TouchableOpacity
        style={styles.exploreButton}
        onPress={() => (navigation as any).navigate("Home")}
      >
        <Text style={styles.exploreButtonText}>去探索</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader title="我的收藏" showBack={true} />

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabContainer}
        >
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.activeTab]}
              onPress={() => setActiveTab(tab.key as any)}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === tab.key && styles.activeTabText,
                ]}
              >
                {tab.label}
              </Text>
              {tab.count > 0 && (
                <View style={styles.tabBadge}>
                  <Text style={styles.tabBadgeText}>{tab.count}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {filteredFavorites.length > 0 ? (
          <View style={styles.favoritesList}>
            {filteredFavorites.map(renderFavoriteItem)}
          </View>
        ) : (
          renderEmptyState()
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  tabBar: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray100,
    backgroundColor: theme.colors.white,
  },
  tabContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 12,
    borderRadius: 20,
    backgroundColor: theme.colors.gray50,
  },
  activeTab: {
    backgroundColor: theme.colors.black,
  },
  tabText: {
    fontSize: 14,
    fontFamily: __DEV__ ? "System" : "Inter-Medium",
    color: theme.colors.gray600,
  },
  activeTabText: {
    color: theme.colors.white,
  },
  tabBadge: {
    backgroundColor: theme.colors.white,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 6,
    minWidth: 20,
    alignItems: "center",
  },
  tabBadgeText: {
    fontSize: 12,
    fontFamily: __DEV__ ? "System" : "Inter-Medium",
    color: theme.colors.black,
  },
  content: {
    flex: 1,
  },
  favoritesList: {
    padding: 20,
  },
  favoriteItem: {
    flexDirection: "row",
    backgroundColor: theme.colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.gray100,
    shadowColor: theme.colors.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  itemImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: theme.colors.gray200,
  },
  itemContent: {
    flex: 1,
    marginLeft: 16,
    justifyContent: "space-between",
  },
  itemHeader: {
    flex: 1,
  },
  itemTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  itemTitle: {
    fontSize: 16,
    fontFamily: __DEV__ ? "System" : "Inter-Medium",
    color: theme.colors.black,
    flex: 1,
    marginRight: 8,
  },
  itemSubtitle: {
    fontSize: 14,
    fontFamily: __DEV__ ? "System" : "Inter-Regular",
    color: theme.colors.gray500,
    marginBottom: 8,
  },
  typeTag: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  itemFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  itemTimestamp: {
    fontSize: 12,
    fontFamily: __DEV__ ? "System" : "Inter-Regular",
    color: theme.colors.gray400,
  },
  likeButton: {
    padding: 4,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    paddingVertical: 80,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: __DEV__ ? "Georgia" : "PlayfairDisplay-Bold",
    color: theme.colors.black,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    fontFamily: __DEV__ ? "System" : "Inter-Regular",
    color: theme.colors.gray500,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 24,
  },
  exploreButton: {
    backgroundColor: theme.colors.black,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  exploreButtonText: {
    fontSize: 16,
    fontFamily: __DEV__ ? "System" : "Inter-Medium",
    color: theme.colors.white,
  },
});

export default FavoritesScreen;
