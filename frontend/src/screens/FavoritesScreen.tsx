import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { playfairFonts, theme, useThemedStyles, type AppTheme } from "../theme";
import ScreenHeader from "../components/ScreenHeader";
import { useAuthStore } from "../store/authStore";
import { postService, Post as ApiPost } from "../services/postService";
import PostCard, { Post as DisplayPost } from "../components/PostCard";
import { Alert } from "../utils/Alert";
import { OptimizedImage } from "../components/ui/OptimizedImage";
import { ImageSize } from "../utils/imageUtils";
import { resolveAvatarUrlOrEmpty } from "../utils/avatarUtils";

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
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const styles = useThemedStyles(makeStyles);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "all" | "looks" | "designers" | "collections"
  >("all");
  const [favoritePosts, setFavoritePosts] = useState<DisplayPost[]>([]);

  // 将 API 帖子转换为展示格式
  const convertToDisplayPost = (apiPost: ApiPost): DisplayPost => {
    return {
      id: String(apiPost.id),
      title: apiPost.title || t("chat.noTitle"),
      image: apiPost.imageUrls?.[0] || "",
      author: {
        id: String(apiPost.userId),
        name: apiPost.username || t("profile.user"),
        avatar: resolveAvatarUrlOrEmpty(apiPost.avatarUrl),
      },
      content: {
        title: apiPost.title || t("chat.noTitle"),
        description: apiPost.contentText || "",
        images: apiPost.imageUrls || [],
        coverAspectRatio:
          apiPost.coverWidth && apiPost.coverHeight && apiPost.coverHeight > 0
            ? apiPost.coverWidth / apiPost.coverHeight
            : undefined,
      },
      engagement: {
        likes: apiPost.likeCount || 0,
        saves: apiPost.favoriteCount || 0,
        comments: apiPost.commentCount || 0,
      },
      likes: apiPost.likeCount || 0,
    } as DisplayPost;
  };

  // 加载收藏的帖子
  const loadFavoritePosts = async () => {
    if (!user?.userId) return;

    try {
      const apiPosts = await postService.getFavoritePostsByUserId(user.userId);
      const displayPosts = apiPosts.map(convertToDisplayPost);
      setFavoritePosts(displayPosts);
    } catch (error) {
      console.error("Error loading favorite posts:", error);
      Alert.show(t("common.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  // 初始加载
  useEffect(() => {
    loadFavoritePosts();
  }, [user?.userId]);

  // 页面获得焦点时刷新
  useFocusEffect(
    useCallback(() => {
      loadFavoritePosts();
    }, [user?.userId])
  );

  // Mock favorites data for designers and collections (暂时保留)
  const [favorites] = useState<FavoriteItem[]>([
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
    {
      key: "all",
      label: t("common.all"),
      count: favoritePosts.length + favorites.length,
    },
    { key: "looks", label: t("favorites.looks"), count: favoritePosts.length },
    {
      key: "designers",
      label: t("favorites.designers"),
      count: favorites.filter((f) => f.type === "designer").length,
    },
    {
      key: "collections",
      label: t("favorites.collections"),
      count: favorites.filter((f) => f.type === "collection").length,
    },
  ];

  const filteredFavorites =
    activeTab === "all"
      ? favorites
      : favorites.filter((f) => f.type === activeTab.slice(0, -1)); // Remove 's' from plural

  const onRefresh = async () => {
    setRefreshing(true);
    await loadFavoritePosts();
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
        (navigation as any).navigate("BrandDetail", {
          brandId: item.id,
          brandName: item.title,
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

  const handlePostPress = (post: DisplayPost) => {
    (navigation as any).navigate("PostDetail", { postId: post.id });
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
      <OptimizedImage
        uri={item.image}
        size={ImageSize.MEDIUM}
        style={styles.itemImage}
        contentFit="cover"
        lazy={true}
      />
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
                color="#FFFFFF"
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
      <Text style={styles.emptyTitle}>{t("favorites.noFavorites")}</Text>
      <Text style={styles.emptySubtitle}>
        {t("favorites.startCollecting")}
      </Text>
      <TouchableOpacity
        style={styles.exploreButton}
        onPress={() => (navigation as any).navigate("Home")}
      >
        <Text style={styles.exploreButtonText}>{t("favorites.explore")}</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader title={t("favorites.title")} showBack={true} />

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
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh}  />
        }
      >
        {loading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator  color={theme.colors.gray400} />
            <Text style={styles.loadingText}>{t("common.loading")}</Text>
          </View>
        ) : activeTab === "looks" ? (
          // 显示帖子列表
          favoritePosts.length > 0 ? (
            <View style={styles.postsGrid}>
              {favoritePosts.map((post) => (
                <View key={post.id} style={styles.postItem}>
                  <PostCard
                    post={post}
                    onPress={() => handlePostPress(post)}
                  />
                </View>
              ))}
            </View>
          ) : (
            renderEmptyState()
          )
        ) : activeTab === "all" ? (
          // 显示所有收藏（帖子 + 其他类型）
          favoritePosts.length + filteredFavorites.length > 0 ? (
            <>
              {favoritePosts.length > 0 && (
                <View style={styles.postsGrid}>
                  {favoritePosts.map((post) => (
                    <View key={post.id} style={styles.postItem}>
                      <PostCard
                        post={post}
                        onPress={() => handlePostPress(post)}
                      />
                    </View>
                  ))}
                </View>
              )}
              {filteredFavorites.length > 0 && (
                <View style={styles.favoritesList}>
                  {filteredFavorites.map(renderFavoriteItem)}
                </View>
              )}
            </>
          ) : (
            renderEmptyState()
          )
        ) : filteredFavorites.length > 0 ? (
          // 显示设计师或系列
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

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.colors.background,
    },
    loadingState: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 80,
    },
    loadingText: {
      fontSize: 14,
      fontFamily: playfairFonts.regular,
      color: t.colors.gray400,
      marginTop: 12,
    },
    postsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      paddingHorizontal: t.spacing.md,
      paddingTop: t.spacing.md,
      justifyContent: "space-between",
    },
    postItem: {
      width: "48%",
      marginBottom: t.spacing.md,
    },
    tabBar: {
      borderBottomWidth: 1,
      borderBottomColor: t.colors.border,
      backgroundColor: t.colors.card,
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
      borderRadius: t.borderRadius.sm,
      backgroundColor: t.colors.gray50,
    },
    activeTab: {
      backgroundColor: t.colors.text,
    },
    tabText: {
      fontSize: 14,
      fontFamily: playfairFonts.medium,
      color: t.colors.gray600,
    },
    activeTabText: {
      color: t.colors.textInverted,
    },
    tabBadge: {
      backgroundColor: t.colors.card,
      borderRadius: t.borderRadius.sm,
      paddingHorizontal: 6,
      paddingVertical: 2,
      marginLeft: 6,
      minWidth: 20,
      alignItems: "center",
    },
    tabBadgeText: {
      fontSize: 12,
      fontFamily: playfairFonts.medium,
      color: t.colors.text,
    },
    content: {
      flex: 1,
    },
    favoritesList: {
      padding: 20,
    },
    favoriteItem: {
      flexDirection: "row",
      backgroundColor: t.colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: t.colors.border,
      shadowColor: t.colors.text,
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
      backgroundColor: t.colors.skeleton,
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
      fontFamily: playfairFonts.medium,
      color: t.colors.text,
      flex: 1,
      marginRight: 8,
    },
    itemSubtitle: {
      fontSize: 14,
      fontFamily: playfairFonts.regular,
      color: t.colors.gray500,
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
      fontFamily: playfairFonts.regular,
      color: t.colors.gray400,
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
      fontFamily: playfairFonts.bold,
      color: t.colors.text,
      marginTop: 16,
      marginBottom: 8,
    },
    emptySubtitle: {
      fontSize: 16,
      fontFamily: playfairFonts.regular,
      color: t.colors.gray500,
      textAlign: "center",
      lineHeight: 24,
      marginBottom: 24,
    },
    exploreButton: {
      backgroundColor: t.colors.text,
      paddingHorizontal: 32,
      paddingVertical: 12,
      borderRadius: 8,
    },
    exploreButtonText: {
      fontSize: 16,
      fontFamily: playfairFonts.medium,
      color: t.colors.textInverted,
    },
  });

export default FavoritesScreen;
