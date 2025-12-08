import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Dimensions,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRoute, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme";
import {
  designerService,
  DesignerShowAndImageDetailDto,
} from "../services/designerService";
import { followService } from "../services/followService";
import { useAuthStore } from "../store/authStore";
import { Alert } from "../utils/Alert";

const { width: screenWidth } = Dimensions.get("window");

interface Designer {
  id: string;
  name: string;
  brand: string;
  avatar: string;
  coverImage: string;
  isFollowing: boolean;
  collections: number;
  website?: string;
}

interface Collection {
  id: string;
  title: string;
  season: string;
  year: string;
  coverImage: string;
  imageCount: number;
  city?: string | null;
  author?: string | null;
  reviewText?: string | null;
  showUrl?: string;
}

interface Look {
  id: string;
  image: string;
  title: string;
  description: string;
  likes: number;
  isLiked: boolean;
  imageType?: string;
  imageId?: number; // API 图片 ID
}

const DesignerDetailScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const designerId = (route.params as any)?.id || "1";
  const designerName = (route.params as any)?.name;

  const [designer, setDesigner] = useState<Designer | null>(null);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [looks, setLooks] = useState<Look[]>([]);
  const [designerApiData, setDesignerApiData] =
    useState<DesignerShowAndImageDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);

  // Find designer data by name or ID from API
  useEffect(() => {
    const loadDesignerData = async () => {
      setLoading(true);
      try {
        // 1. 先获取所有设计师列表
        const allDesigners = await designerService.getAllDesignerDetails();
        let targetDesignerId: number | null = null;

        // 2. 根据名称或 ID 找到目标设计师
        if (designerName) {
          const found = allDesigners.find(
            (d) =>
              d.name.toLowerCase() === designerName.toLowerCase() ||
              d.name.toLowerCase().includes(designerName.toLowerCase())
          );
          if (found) targetDesignerId = found.id;
        }

        if (!targetDesignerId && designerId) {
          targetDesignerId = Number(designerId);
        }

        if (!targetDesignerId && allDesigners.length > 0) {
          targetDesignerId = allDesigners[0].id;
        }

        if (!targetDesignerId) {
          throw new Error("未找到设计师");
        }

        // 3. 获取设计师详情（包含 shows 和 images）
        const designerData = await designerService.getDesignerShowAndImages(
          targetDesignerId
        );

        setDesignerApiData(designerData);

        // Extract brand name from designer string (handle parentheses)
        const brandMatch = designerData.name.match(/^([^(]+?)(?:\s*\(|$)/);
        const designerMatch = designerData.name.match(/\(([^)]+)\)$/);

        const brand = designerMatch
          ? designerMatch[1]
          : brandMatch?.[1]?.trim() || designerData.name;
        const name = brandMatch?.[1]?.trim() || designerData.name;

        // Get first image as avatar/cover
        const firstImage =
          designerData.images.length > 0
            ? designerData.images[0].imageUrl
            : null;

        // 使用 API 返回的 following 状态
        const isFollowing = designerData.following;
        setFollowersCount(designerData.followerCount);

        setDesigner({
          id: String(designerData.id),
          name: name,
          brand: brand,
          avatar: firstImage || "https://via.placeholder.com/120x120",
          coverImage: firstImage || "https://via.placeholder.com/400x200",
          isFollowing: isFollowing,
          collections: designerData.showCount,
          website: designerData.designerUrl,
        });

        // Convert shows to collections
        // 根据 imageCount 从 images 数组中分配封面图片
        let imageOffset = 0;
        const convertedCollections = (designerData.shows || []).map(
          (show, index) => {
            // 取当前 show 对应的第一张图片作为封面
            const coverImage =
              designerData.images[imageOffset]?.imageUrl ||
              "https://via.placeholder.com/300x400";
            // 移动偏移量到下一个 show 的图片起始位置
            imageOffset += show.imageCount;

            return {
              id: `collection-${show.id}`,
              title: show.season,
              season: show.season,
              year: "",
              coverImage: coverImage,
              imageCount: show.imageCount,
              city: null,
              author: show.reviewAuthor,
              reviewText: show.reviewText,
              showUrl: "",
            };
          }
        );

        // Convert images to looks
        const convertedLooks: Look[] = (designerData.images || []).map(
          (image, index) => ({
            id: `look-${image.id}`,
            image: image.imageUrl,
            title: `Look ${index + 1}`,
            description: "",
            likes: image.likeCount,
            isLiked: image.likedByMe,
            imageType: "look",
            imageId: image.id,
          })
        );

        setCollections(convertedCollections);
        setLooks(convertedLooks);
      } catch (error) {
        console.error("Failed to load designer data:", error);
        // 出错时设置默认值
        setDesigner({
          id: designerId,
          name: designerName || "Unknown Designer",
          brand: designerName || "Unknown Brand",
          avatar: "https://via.placeholder.com/120x120",
          coverImage: "https://via.placeholder.com/400x200",
          isFollowing: false,
          collections: 0,
          website: "",
        });
        setCollections([]);
        setLooks([]);
      } finally {
        setLoading(false);
      }
    };

    loadDesignerData();
  }, [designerId, designerName]);

  const [activeTab, setActiveTab] = useState<"collections" | "looks">(
    "collections"
  );

  // Handle follow/unfollow
  const handleFollow = useCallback(async () => {
    if (!user?.userId) {
      Alert.show("请先登录");
      return;
    }

    if (!designer || !designerApiData) {
      return;
    }

    if (isFollowLoading) {
      return;
    }

    setIsFollowLoading(true);

    try {
      if (designer.isFollowing) {
        // 取消关注
        await followService.followDesigner({
          method: "DELETE",
          designerId: designerApiData.id,
        });
        setDesigner((prev) => (prev ? { ...prev, isFollowing: false } : null));
        setFollowersCount((prev) => Math.max(0, prev - 1));
        Alert.show("已取消关注", "", 1500);
      } else {
        // 关注
        await followService.followDesigner({
          method: "POST",
          designerId: designerApiData.id,
        });
        setDesigner((prev) => (prev ? { ...prev, isFollowing: true } : null));
        setFollowersCount((prev) => prev + 1);
        Alert.show("关注成功", "", 1500);
      }
    } catch (error) {
      console.error("Follow/unfollow error:", error);
      Alert.show(error instanceof Error ? error.message : "操作失败，请重试");
    } finally {
      setIsFollowLoading(false);
    }
  }, [designer, designerApiData, user, isFollowLoading]);

  // Handle collection press
  const handleCollectionPress = useCallback(
    (collection: Collection) => {
      // 从 collection id 中提取 showId
      const showIdMatch = collection.id.match(/collection-(\d+)/);
      const showId = showIdMatch ? Number(showIdMatch[1]) : null;

      (navigation as any).navigate("CollectionDetail", {
        collection,
        designerName: designer?.name,
        showId, // 传递 showId，让 CollectionDetail 自己获取图片
      });
    },
    [navigation, designer]
  );

  // Handle look press
  const handleLookPress = useCallback(
    (look: Look) => {
      // Find the collection title for this look
      let collectionTitle = "";
      const lookIndex = looks.findIndex((l) => l.id === look.id);
      if (lookIndex >= 0 && collections.length > 0) {
        // Try to match look to collection based on season or title
        const lookTitle = look.title.toLowerCase();
        const matchingCollection = collections.find(
          (c) =>
            lookTitle.includes(c.season.toLowerCase()) ||
            lookTitle.includes(c.title.toLowerCase())
        );
        collectionTitle = matchingCollection?.title || "";
      }

      (navigation as any).navigate("LookDetail", {
        look,
        designerName: designer?.name,
        collectionTitle,
        imageId: look.imageId,
      });
    },
    [navigation, designer, collections, looks]
  );

  // Render header
  const renderHeader = () => (
    <View style={styles.header}>
      <Image source={{ uri: designer?.coverImage }} style={styles.coverImage} />
      <View style={styles.headerOverlay}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.white} />
        </TouchableOpacity>
      </View>

      <View style={styles.designerInfo}>
        <Image source={{ uri: designer?.avatar }} style={styles.avatar} />
        <View style={styles.designerText}>
          <Text style={styles.brandName}>{designer?.brand}</Text>
          <Text style={styles.designerName}>{designer?.name}</Text>
        </View>
        <TouchableOpacity
          style={[
            styles.followButton,
            designer?.isFollowing && styles.followingButton,
            isFollowLoading && styles.followButtonLoading,
          ]}
          onPress={handleFollow}
          disabled={isFollowLoading}
        >
          <Text
            style={[
              styles.followButtonText,
              designer?.isFollowing && styles.followingButtonText,
            ]}
          >
            {isFollowLoading
              ? "..."
              : designer?.isFollowing
              ? "已关注"
              : "关注"}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.stats}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{followersCount}</Text>
          <Text style={styles.statLabel}>关注</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{looks.length}</Text>
          <Text style={styles.statLabel}>造型</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>
            {designerApiData?.showCount || 0}
          </Text>
          <Text style={styles.statLabel}>场秀</Text>
        </View>
      </View>
    </View>
  );

  // Render tabs
  const renderTabs = () => (
    <View style={styles.tabContainer}>
      <TouchableOpacity
        style={[styles.tab, activeTab === "collections" && styles.activeTab]}
        onPress={() => setActiveTab("collections")}
      >
        <Text
          style={[
            styles.tabText,
            activeTab === "collections" && styles.activeTabText,
          ]}
        >
          秀场 ({collections.length})
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tab, activeTab === "looks" && styles.activeTab]}
        onPress={() => setActiveTab("looks")}
      >
        <Text
          style={[
            styles.tabText,
            activeTab === "looks" && styles.activeTabText,
          ]}
        >
          造型 ({looks.length})
        </Text>
      </TouchableOpacity>
    </View>
  );

  // Render collection item
  const renderCollectionItem = ({ item }: { item: Collection }) => (
    <TouchableOpacity
      style={styles.collectionItem}
      onPress={() => handleCollectionPress(item)}
    >
      <Image source={{ uri: item.coverImage }} style={styles.collectionImage} />
      <View style={styles.collectionInfo}>
        <Text style={styles.collectionTitle}>{item.title}</Text>
        <Text style={styles.collectionMeta}>
          {item.season} {item.year} {item.city && `• ${item.city}`}
        </Text>
        <Text style={styles.collectionCount}>{item.imageCount} 张图片</Text>
        {item.author && (
          <Text style={styles.collectionAuthor}>评论者: {item.author}</Text>
        )}
        {item.reviewText && (
          <Text style={styles.collectionPreview} numberOfLines={2}>
            {item.reviewText.length > 80
              ? item.reviewText.substring(0, 80) + "..."
              : item.reviewText}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  // Render look item
  const renderLookItem = ({ item }: { item: Look }) => (
    <TouchableOpacity
      style={styles.lookItem}
      onPress={() => handleLookPress(item)}
    >
      <Image source={{ uri: item.image }} style={styles.lookImage} />
    </TouchableOpacity>
  );

  // 骨架屏动画
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (loading) {
      const shimmerAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(shimmerAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(shimmerAnim, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      shimmerAnimation.start();
      return () => shimmerAnimation.stop();
    }
  }, [loading, shimmerAnim]);

  const skeletonOpacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  // 骨架屏组件
  const SkeletonBox = ({
    width,
    height,
    style,
  }: {
    width: number | string;
    height: number;
    style?: any;
  }) => (
    <Animated.View
      style={[
        {
          width,
          height,
          backgroundColor: theme.colors.gray200,
          borderRadius: 4,
          opacity: skeletonOpacity,
        },
        style,
      ]}
    />
  );

  // 渲染骨架屏
  const renderSkeleton = () => (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {/* 封面骨架 */}
        <View style={styles.header}>
          <Animated.View
            style={[
              styles.coverImage,
              {
                backgroundColor: theme.colors.gray200,
                opacity: skeletonOpacity,
              },
            ]}
          />
          <View style={styles.headerOverlay}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons
                name="arrow-back"
                size={24}
                color={theme.colors.white}
              />
            </TouchableOpacity>
          </View>

          {/* 设计师信息骨架 */}
          <View style={styles.designerInfo}>
            <Animated.View
              style={[
                styles.avatar,
                {
                  backgroundColor: theme.colors.gray200,
                  opacity: skeletonOpacity,
                },
              ]}
            />
            <View style={styles.designerText}>
              <SkeletonBox
                width={120}
                height={24}
                style={{ marginBottom: 8 }}
              />
              <SkeletonBox width={80} height={16} />
            </View>
            <SkeletonBox width={70} height={36} style={{ borderRadius: 8 }} />
          </View>

          {/* 统计骨架 */}
          <View style={styles.stats}>
            {[1, 2, 3].map((i) => (
              <View key={i} style={styles.statItem}>
                <SkeletonBox
                  width={40}
                  height={28}
                  style={{ marginBottom: 4 }}
                />
                <SkeletonBox width={30} height={14} />
              </View>
            ))}
          </View>
        </View>

        {/* 标签骨架 */}
        <View style={styles.tabContainer}>
          <View style={[styles.tab, { alignItems: "center" }]}>
            <SkeletonBox width={80} height={20} />
          </View>
          <View style={[styles.tab, { alignItems: "center" }]}>
            <SkeletonBox width={80} height={20} />
          </View>
        </View>

        {/* 列表骨架 */}
        <View style={styles.content}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={styles.collectionItem}>
              <Animated.View
                style={[
                  styles.collectionImage,
                  {
                    backgroundColor: theme.colors.gray200,
                    opacity: skeletonOpacity,
                  },
                ]}
              />
              <View style={styles.collectionInfo}>
                <SkeletonBox
                  width="80%"
                  height={20}
                  style={{ marginBottom: 8 }}
                />
                <SkeletonBox
                  width="60%"
                  height={14}
                  style={{ marginBottom: 6 }}
                />
                <SkeletonBox width="40%" height={12} />
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );

  if (loading || !designer) {
    return renderSkeleton();
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {renderHeader()}
        {renderTabs()}

        <View style={styles.content}>
          {activeTab === "collections" ? (
            <View>
              {collections.map((item) => (
                <View key={item.id}>{renderCollectionItem({ item })}</View>
              ))}
            </View>
          ) : (
            <View style={styles.looksContainer}>
              {looks.map((item, index) => (
                <View
                  key={item.id}
                  style={[
                    styles.lookItemWrapper,
                    index % 2 === 1 && styles.lookItemRight,
                  ]}
                >
                  {renderLookItem({ item })}
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  scrollView: {
    flex: 1,
  },
  header: {},
  coverImage: {
    width: screenWidth,
    height: 200,
    backgroundColor: theme.colors.gray100,
  },
  headerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 200,
    justifyContent: "flex-start",
    alignItems: "flex-start",
    paddingTop: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  designerInfo: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.gray100,
    borderWidth: 3,
    borderColor: theme.colors.white,
  },
  designerText: {
    flex: 1,
    marginLeft: theme.spacing.md,
  },
  brandName: {
    ...theme.typography.h2,
    color: theme.colors.black,
    marginBottom: 2,
  },
  designerName: {
    ...theme.typography.body,
    color: theme.colors.gray600,
    marginBottom: 4,
  },
  designerMeta: {
    ...theme.typography.caption,
    color: theme.colors.gray400,
  },
  followButton: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.black,
    borderRadius: theme.borderRadius.md,
  },
  followingButton: {
    backgroundColor: theme.colors.gray200,
  },
  followButtonLoading: {
    opacity: 0.6,
  },
  followButtonText: {
    ...theme.typography.bodySmall,
    color: theme.colors.white,
    fontWeight: "600",
  },
  followingButtonText: {
    color: theme.colors.gray600,
  },
  stats: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray100,
  },
  statItem: {
    alignItems: "center",
  },
  statNumber: {
    ...theme.typography.h2,
    color: theme.colors.black,
    marginBottom: 4,
  },
  statLabel: {
    ...theme.typography.caption,
    color: theme.colors.gray400,
  },
  tabContainer: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray100,
  },
  tab: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    alignItems: "center",
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.black,
  },
  tabText: {
    ...theme.typography.body,
    color: theme.colors.gray400,
  },
  activeTabText: {
    color: theme.colors.black,
    fontWeight: "600",
  },
  content: {
    flex: 1,
    paddingTop: theme.spacing.md,
  },
  collectionItem: {
    flexDirection: "row",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray100,
  },
  collectionImage: {
    width: 80,
    height: 100,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.gray100,
    marginRight: theme.spacing.md,
  },
  collectionInfo: {
    flex: 1,
    justifyContent: "center",
  },
  collectionTitle: {
    ...theme.typography.h3,
    color: theme.colors.black,
    marginBottom: 4,
  },
  collectionMeta: {
    ...theme.typography.bodySmall,
    color: theme.colors.gray400,
    marginBottom: 4,
  },
  collectionCount: {
    ...theme.typography.caption,
    color: theme.colors.gray400,
    marginBottom: 2,
  },
  collectionAuthor: {
    ...theme.typography.caption,
    fontSize: 11,
    color: theme.colors.gray500,
    fontStyle: "italic",
  },
  collectionPreview: {
    ...theme.typography.caption,
    fontSize: 11,
    color: theme.colors.gray400,
    marginTop: 4,
    lineHeight: 16,
  },
  websiteButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    backgroundColor: theme.colors.gray100,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
  },
  websiteText: {
    ...theme.typography.caption,
    color: theme.colors.accent,
    marginLeft: 4,
    fontSize: 12,
    fontWeight: "500",
  },
  looksContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: theme.spacing.md,
  },
  lookItemWrapper: {
    width: (screenWidth - theme.spacing.md * 3) / 2,
    marginBottom: theme.spacing.md,
  },
  lookItemRight: {
    marginLeft: theme.spacing.md,
  },
  lookItem: {
    position: "relative",
    width: "100%",
  },
  lookImage: {
    width: "100%",
    height: 240,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.gray100,
  },
  lookOverlay: {
    position: "absolute",
    bottom: theme.spacing.sm,
    right: theme.spacing.sm,
  },
  likeButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
  },
  likeCount: {
    ...theme.typography.caption,
    color: theme.colors.white,
    marginLeft: 4,
    fontWeight: "600",
  },
});

export default DesignerDetailScreen;
