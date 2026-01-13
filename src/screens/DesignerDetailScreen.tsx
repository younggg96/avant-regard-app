import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Dimensions,
  Linking,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRoute, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme";
import { getPosts, Post as ApiPost } from "../services/postService";

// Import local data
import brandsData from "../data/brands.json";
import showsData from "../data/shows.json";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Types
interface Brand {
  id: number;
  name: string;
  category: string | null;
  foundedYear: string | null;
  founder: string | null;
  country: string | null;
  website: string | null;
  coverImage: string | null;
  latestSeason: string | null;
  vogueSlug: string | null;
  vogueUrl: string | null;
}

interface Show {
  designer: string;
  season: string;
  title: string;
  cover_image: string;
  show_url: string;
  year: number;
  category: string | null;
}

interface Collection {
  id: string;
  title: string;
  season: string;
  year: number;
  coverImage: string;
  category: string | null;
  showUrl: string;
}

type TabType = "shows" | "posts";

const DesignerDetailScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const brandId = (route.params as any)?.id;
  const brandName = (route.params as any)?.name;

  const [activeTab, setActiveTab] = useState<TabType>("shows");
  const [posts, setPosts] = useState<ApiPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);

  // Find brand from local data
  const brand = useMemo(() => {
    const brands = brandsData as Brand[];
    if (brandId) {
      const found = brands.find((b) => b.id === Number(brandId));
      if (found) return found;
    }
    if (brandName) {
      const found = brands.find(
        (b) =>
          b.name.toLowerCase() === brandName.toLowerCase() ||
          b.name.toLowerCase().includes(brandName.toLowerCase())
      );
      if (found) return found;
    }
    return null;
  }, [brandId, brandName]);

  // Find shows for this brand from local data
  const collections = useMemo(() => {
    if (!brand) return [];
    const shows = showsData as Show[];
    const brandShows = shows.filter(
      (show) =>
        show.designer.toLowerCase() === brand.name.toLowerCase() ||
        show.designer.toLowerCase().includes(brand.name.toLowerCase()) ||
        brand.name.toLowerCase().includes(show.designer.toLowerCase())
    );
    brandShows.sort((a, b) => b.year - a.year);
    return brandShows.map((show, index) => ({
      id: `collection-${index}`,
      title: show.title,
      season: show.season,
      year: show.year,
      coverImage: show.cover_image,
      category: show.category,
      showUrl: show.show_url,
    }));
  }, [brand]);

  // Load posts related to this brand
  useEffect(() => {
    const loadPosts = async () => {
      if (!brand) return;
      setLoadingPosts(true);
      try {
        const allPosts = await getPosts();
        // Filter posts that mention this brand
        const brandPosts = allPosts.filter((post) => {
          const searchText = `${post.title || ""} ${
            post.contentText || ""
          }`.toLowerCase();
          return searchText.includes(brand.name.toLowerCase());
        });
        setPosts(brandPosts);
      } catch (error) {
        console.error("Failed to load posts:", error);
        setPosts([]);
      } finally {
        setLoadingPosts(false);
      }
    };
    loadPosts();
  }, [brand]);

  // Handle collection press
  const handleCollectionPress = useCallback((collection: Collection) => {
    if (collection.showUrl) {
      Linking.openURL(collection.showUrl);
    }
  }, []);

  // Handle post press
  const handlePostPress = useCallback(
    (post: ApiPost) => {
      (navigation as any).navigate("PostDetail", { post });
    },
    [navigation]
  );

  // Handle website press
  const handleWebsitePress = useCallback(() => {
    if (brand?.website) {
      Linking.openURL(brand.website);
    }
  }, [brand]);

  // Handle Vogue press
  const handleVoguePress = useCallback(() => {
    if (brand?.vogueUrl) {
      Linking.openURL(brand.vogueUrl);
    }
  }, [brand]);

  // Render show card
  const renderShowCard = (collection: Collection, index: number) => (
    <TouchableOpacity
      key={collection.id}
      style={styles.showCard}
      onPress={() => handleCollectionPress(collection)}
      activeOpacity={0.9}
    >
      <Image source={{ uri: collection.coverImage }} style={styles.showImage} />
      <View style={styles.showOverlay}>
        <Text style={styles.showSeason}>{collection.season}</Text>
        {collection.category && (
          <Text style={styles.showCategory}>{collection.category}</Text>
        )}
      </View>
    </TouchableOpacity>
  );

  // Render post card
  const renderPostCard = (post: ApiPost) => (
    <TouchableOpacity
      key={post.id}
      style={styles.postCard}
      onPress={() => handlePostPress(post)}
      activeOpacity={0.9}
    >
      {post.imageUrls && post.imageUrls[0] && (
        <Image source={{ uri: post.imageUrls[0] }} style={styles.postImage} />
      )}
      <View style={styles.postInfo}>
        <Text style={styles.postTitle} numberOfLines={2}>
          {post.title}
        </Text>
        <View style={styles.postMeta}>
          <Text style={styles.postAuthor}>{post.username || "用户"}</Text>
          <View style={styles.postStats}>
            <Ionicons
              name="heart-outline"
              size={14}
              color={theme.colors.gray400}
            />
            <Text style={styles.postStatText}>{post.likeCount || 0}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  // Empty state
  if (!brand) {
    return (
      <SafeAreaView style={styles.container}>
        <TouchableOpacity
          style={styles.backButtonFloat}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.black} />
        </TouchableOpacity>
        <View style={styles.emptyState}>
          <Ionicons
            name="storefront-outline"
            size={48}
            color={theme.colors.gray300}
          />
          <Text style={styles.emptyTitle}>未找到品牌</Text>
          <Text style={styles.emptyText}>该品牌信息暂未收录</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[1]}
      >
        {/* Hero Section */}
        <View style={styles.heroSection}>
          {/* Back Button */}
          <TouchableOpacity
            style={styles.backButtonFloat}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={22} color={theme.colors.black} />
          </TouchableOpacity>

          {/* Brand Name */}
          <Text style={styles.heroTitle}>{brand.name}</Text>

          {/* Brand Info */}
          <View style={styles.heroMeta}>
            {brand.category && (
              <View style={styles.categoryTag}>
                <Text style={styles.categoryTagText}>
                  {brand.category.split("/")[0]}
                </Text>
              </View>
            )}
            {brand.country && (
              <Text style={styles.heroMetaText}>{brand.country}</Text>
            )}
            {brand.foundedYear && (
              <Text style={styles.heroMetaText}>Est. {brand.foundedYear}</Text>
            )}
          </View>

          {/* Founder */}
          {brand.founder && (
            <Text style={styles.founderText}>by {brand.founder}</Text>
          )}

          {/* Action Buttons */}
          <View style={styles.actionRow}>
            {brand.website && (
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={handleWebsitePress}
              >
                <Ionicons
                  name="globe-outline"
                  size={18}
                  color={theme.colors.black}
                />
                <Text style={styles.actionBtnText}>官网</Text>
              </TouchableOpacity>
            )}
            {brand.vogueUrl && (
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={handleVoguePress}
              >
                <Text style={styles.actionBtnTextBold}>VOGUE</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Tab Bar */}
        <View style={styles.tabBarContainer}>
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tab, activeTab === "shows" && styles.tabActive]}
              onPress={() => setActiveTab("shows")}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === "shows" && styles.tabTextActive,
                ]}
              >
                秀场
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === "posts" && styles.tabActive]}
              onPress={() => setActiveTab("posts")}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === "posts" && styles.tabTextActive,
                ]}
              >
                帖子
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {activeTab === "shows" ? (
            collections.length > 0 ? (
              <View style={styles.showsGrid}>
                {collections.map((collection, index) =>
                  renderShowCard(collection, index)
                )}
              </View>
            ) : (
              <View style={styles.noContentState}>
                <Ionicons
                  name="images-outline"
                  size={40}
                  color={theme.colors.gray300}
                />
                <Text style={styles.noContentText}>暂无秀场数据</Text>
              </View>
            )
          ) : loadingPosts ? (
            <View style={styles.noContentState}>
              <Text style={styles.noContentText}>加载中...</Text>
            </View>
          ) : posts.length > 0 ? (
            <View style={styles.postsGrid}>
              {posts.map((post) => renderPostCard(post))}
            </View>
          ) : (
            <View style={styles.noContentState}>
              <Ionicons
                name="document-text-outline"
                size={40}
                color={theme.colors.gray300}
              />
              <Text style={styles.noContentText}>暂无相关帖子</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const CARD_WIDTH = (SCREEN_WIDTH - 48) / 2;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  scrollView: {
    flex: 1,
  },
  // Hero Section
  heroSection: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  backButtonFloat: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  heroTitle: {
    fontSize: 36,
    fontWeight: "300",
    color: theme.colors.black,
    letterSpacing: -1,
    marginBottom: 12,
    fontFamily: __DEV__ ? "System" : "PlayfairDisplay-Regular",
  },
  heroMeta: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  categoryTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: theme.colors.black,
    borderRadius: 4,
  },
  categoryTagText: {
    fontSize: 11,
    fontWeight: "600",
    color: theme.colors.white,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  heroMetaText: {
    fontSize: 14,
    color: theme.colors.gray500,
    fontFamily: __DEV__ ? "System" : "Inter-Regular",
  },
  founderText: {
    fontSize: 14,
    color: theme.colors.gray400,
    fontStyle: "italic",
    marginBottom: 20,
    fontFamily: __DEV__ ? "System" : "Inter-Regular",
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    borderRadius: 24,
    gap: 6,
  },
  actionBtnText: {
    fontSize: 13,
    color: theme.colors.black,
    fontWeight: "500",
    fontFamily: __DEV__ ? "System" : "Inter-Medium",
  },
  actionBtnTextBold: {
    fontSize: 12,
    color: theme.colors.black,
    fontWeight: "700",
    letterSpacing: 1,
    fontFamily: __DEV__ ? "System" : "Inter-Bold",
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.gray200,
  },
  statBox: {
    alignItems: "center",
    paddingHorizontal: 32,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: theme.colors.gray200,
  },
  statNum: {
    fontSize: 28,
    fontWeight: "300",
    color: theme.colors.black,
    fontFamily: __DEV__ ? "System" : "Inter-Regular",
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.gray400,
    marginTop: 4,
    fontFamily: __DEV__ ? "System" : "Inter-Regular",
  },
  // Tab Bar
  tabBarContainer: {
    backgroundColor: theme.colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.gray200,
  },
  tabBar: {
    flexDirection: "row",
    paddingHorizontal: 20,
  },
  tab: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginRight: 8,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.black,
  },
  tabText: {
    fontSize: 15,
    color: theme.colors.gray400,
    fontWeight: "500",
    fontFamily: __DEV__ ? "System" : "Inter-Medium",
  },
  tabTextActive: {
    color: theme.colors.black,
  },
  // Content
  content: {
    flex: 1,
    minHeight: 300,
  },
  showsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 16,
    gap: 16,
  },
  showCard: {
    width: CARD_WIDTH,
    height: CARD_WIDTH * 1.4,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: theme.colors.gray100,
  },
  showImage: {
    width: "100%",
    height: "100%",
  },
  showOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  showSeason: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.colors.white,
    fontFamily: __DEV__ ? "System" : "Inter-Medium",
  },
  showCategory: {
    fontSize: 11,
    color: "rgba(255,255,255,0.7)",
    marginTop: 2,
    fontFamily: __DEV__ ? "System" : "Inter-Regular",
  },
  postsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 16,
    gap: 16,
  },
  postCard: {
    width: CARD_WIDTH,
    backgroundColor: theme.colors.white,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.gray200,
  },
  postImage: {
    width: "100%",
    height: CARD_WIDTH,
    backgroundColor: theme.colors.gray100,
  },
  postInfo: {
    padding: 12,
  },
  postTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: theme.colors.black,
    marginBottom: 8,
    lineHeight: 20,
    fontFamily: __DEV__ ? "System" : "Inter-Medium",
  },
  postMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  postAuthor: {
    fontSize: 12,
    color: theme.colors.gray400,
    fontFamily: __DEV__ ? "System" : "Inter-Regular",
  },
  postStats: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  postStatText: {
    fontSize: 12,
    color: theme.colors.gray400,
    fontFamily: __DEV__ ? "System" : "Inter-Regular",
  },
  noContentState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  noContentText: {
    fontSize: 14,
    color: theme.colors.gray400,
    marginTop: 12,
    fontFamily: __DEV__ ? "System" : "Inter-Regular",
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "500",
    color: theme.colors.black,
    marginTop: 16,
    marginBottom: 8,
    fontFamily: __DEV__ ? "System" : "Inter-Medium",
  },
  emptyText: {
    fontSize: 14,
    color: theme.colors.gray400,
    textAlign: "center",
    fontFamily: __DEV__ ? "System" : "Inter-Regular",
  },
});

export default DesignerDetailScreen;
