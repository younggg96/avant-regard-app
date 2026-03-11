import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Dimensions,
  Linking,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRoute, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme";
import ImageGallery from "../components/ImageGallery";
import { ShareModal } from "../components/ShareModal";
import { Post as SharePost } from "../components/PostCard";
import { getPostsByShowId, Post } from "../services/postService";

const { width: screenWidth } = Dimensions.get("window");

interface Collection {
  id: string;
  title: string;
  season: string;
  year: string;
  coverImage: string;
  imageCount: number;
  city?: string | null;
  author?: string | null;
  designer?: string | null;
  description?: string | null;
  category?: string | null;
  reviewText?: string | null;
  showUrl?: string;
  contributorName?: string | null;
  rating?: {
    average: number;
    totalReviews: number;
    distribution: {
      5: number;
      4: number;
      3: number;
      2: number;
      1: number;
    };
  };
  comments?: Comment[];
}

interface ShowImage {
  imageUrl: string;
  imageType: string;
}

interface Comment {
  id: string;
  userName: string;
  userAvatar?: string;
  rating: number;
  content: string;
  date: string;
  likes: number;
  isLiked: boolean;
}

interface CollectionDetailParams {
  collection: Collection;
  brandName?: string;
  images?: ShowImage[];
}

const CollectionDetailScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const params = route.params as CollectionDetailParams;
  const { collection, brandName, images } = params;
  const id = collection.id;

  const [collectionImages, setCollectionImages] = useState<ShowImage[]>([]);
  const [isReviewExpanded, setIsReviewExpanded] = useState(false);
  const [relatedPosts, setRelatedPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [shareModalVisible, setShareModalVisible] = useState(false);

  const sharePost = useMemo<SharePost>(() => ({
    id: collection.id,
    title: `${collection.title} - ${collection.season} ${collection.year}`,
    image: collection.coverImage,
    author: { id: "0", name: brandName || collection.title, avatar: "" },
    content: {
      title: `${collection.title} - ${collection.season} ${collection.year}`,
      description: `${brandName || collection.title} ${collection.season} ${collection.year} 时装秀`,
      images: collection.coverImage ? [collection.coverImage] : [],
    },
  }), [collection, brandName]);

  useEffect(() => {
    const loadImages = async () => {
      if (images && images.length > 0) {
        setCollectionImages(images);
      }
      // 如果没有 images 参数，保持空数组
    };

    loadImages();

    // Load related posts
    const loadRelatedPosts = async () => {
      setPostsLoading(true);
      try {
        let posts: Post[] = [];
        if (id) {
          // 直接使用 id，不进行类型转换，支持字符串和数字ID
          posts = await getPostsByShowId(id);
        }
        setRelatedPosts(posts);
      } catch (error) {
        // 正确处理错误，提取错误消息
        let errorMessage = "加载相关帖子失败";
        if (error instanceof Error) {
          errorMessage = error.message;
        }
        console.error("Failed to load related posts:", errorMessage, error);
      } finally {
        setPostsLoading(false);
      }
    };

    loadRelatedPosts();

  }, [collection, images, id]);

  const handleShare = () => {
    setShareModalVisible(true);
  };

  const handleOpenUrl = async () => {
    if (collection.showUrl) {
      try {
        const supported = await Linking.canOpenURL(collection.showUrl);
        if (supported) {
          await Linking.openURL(collection.showUrl);
        }
      } catch (error) {
        console.log("无法打开链接:", error);
      }
    }
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Ionicons name="arrow-back" size={24} color={theme.colors.black} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
        <Ionicons name="share-outline" size={24} color={theme.colors.black} />
      </TouchableOpacity>
    </View>
  );

  const renderImageGallery = () => {
    const imagesToShow =
      collectionImages.length > 0
        ? collectionImages.map((img) => img.imageUrl).filter(url => url && url.trim() !== "")
        : collection.coverImage ? [collection.coverImage] : [];

    // 如果没有有效图片，显示占位符
    if (imagesToShow.length === 0) {
      imagesToShow.push("https://via.placeholder.com/400x480/f0f0f0/cccccc?text=No+Image");
    }

    return (
      <ImageGallery
        images={imagesToShow}
        imageHeight={screenWidth * 1.2}
        showThumbnails={collectionImages.length > 1}
        showFullscreenOnPress={true}
      />
    );
  };

  const renderCollectionInfo = () => (
    <View style={styles.infoContainer}>
      <Text style={styles.title}>{collection.title}</Text>
      <Text style={styles.subtitle}>
        {collection.season} {collection.year}
      </Text>

      {collection.contributorName && (
        <View style={styles.contributorBadge}>
          <Ionicons name="person-outline" size={13} color={theme.colors.gray500} />
          <Text style={styles.contributorText}>
            由 {collection.contributorName} 用户贡献的秀场
          </Text>
        </View>
      )}

      <View style={styles.metaInfo}>
        {brandName && (
          <View style={styles.metaItem}>
            <Ionicons name="pricetag-outline" size={16} color={theme.colors.gray600} />
            <Text style={styles.metaText}>{brandName}</Text>
          </View>
        )}
        {collection.designer && (
          <View style={styles.metaItem}>
            <Ionicons name="brush-outline" size={16} color={theme.colors.gray600} />
            <Text style={styles.metaText}>{collection.designer}</Text>
          </View>
        )}
        {collection.category && (
          <View style={styles.metaItem}>
            <Ionicons name="grid-outline" size={16} color={theme.colors.gray600} />
            <Text style={styles.metaText}>{collection.category}</Text>
          </View>
        )}
        {collection.city && (
          <View style={styles.metaItem}>
            <Ionicons name="location-outline" size={16} color={theme.colors.gray600} />
            <Text style={styles.metaText}>{collection.city}</Text>
          </View>
        )}
        {collection.imageCount > 0 && (
          <View style={styles.metaItem}>
            <Ionicons name="images-outline" size={16} color={theme.colors.gray600} />
            <Text style={styles.metaText}>{collection.imageCount} 张图片</Text>
          </View>
        )}
      </View>

      {collection.description && (
        <Text style={styles.descriptionText}>{collection.description}</Text>
      )}

      {collection.showUrl && (
        <TouchableOpacity style={styles.urlButton} onPress={handleOpenUrl}>
          <Ionicons
            name="link-outline"
            size={20}
            color={theme.colors.gray600}
          />
          <Text style={styles.urlButtonText}>查看官方链接</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderReview = () => {
    if (!collection.reviewText) return null;

    const toggleReviewExpansion = () => {
      setIsReviewExpanded(!isReviewExpanded);
    };

    // 估算3行文本的高度（行高24 * 3行）
    const collapsedHeight = 24 * 3;

    return (
      <View style={styles.reviewContainer}>
        <Text style={styles.reviewTitle}>评论</Text>
        <View style={styles.reviewTextContainer}>
          <View
            style={[
              styles.reviewTextWrapper,
              !isReviewExpanded && {
                maxHeight: collapsedHeight,
                overflow: "hidden",
              },
            ]}
          >
            <Text style={styles.reviewText}>{collection.reviewText}</Text>
          </View>

          {!isReviewExpanded && (
            <LinearGradient
              colors={[
                "rgba(255, 255, 255, 0)",
                "rgba(255, 255, 255, 0.8)",
                theme.colors.white,
              ]}
              style={styles.gradientOverlay}
              pointerEvents="none"
            />
          )}

          <TouchableOpacity
            style={styles.expandButton}
            onPress={toggleReviewExpansion}
          >
            <Text style={styles.expandButtonText}>
              {isReviewExpanded ? "收起" : "展开全文"}
            </Text>
            <Ionicons
              name={isReviewExpanded ? "chevron-up" : "chevron-down"}
              size={16}
              color={theme.colors.gray700}
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Handle post press
  const handlePostPress = (post: Post) => {
    (navigation as any).navigate("PostDetail", { postId: post.id });
  };

  // Render related posts section
  const renderRelatedPosts = () => {
    if (!id) return null;

    return (
      <View style={styles.relatedPostsContainer}>
        <Text style={styles.relatedPostsTitle}>相关帖子</Text>

        {postsLoading ? (
          <View style={styles.loadingContainer}>
            <Image
              source={require("../../assets/gif/profile-loading.gif")}
              style={styles.loadingGif}
              resizeMode="contain"
            />
          </View>
        ) : relatedPosts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons
              name="document-text-outline"
              size={40}
              color={theme.colors.gray300}
            />
            <Text style={styles.emptyText}>暂无相关帖子</Text>
          </View>
        ) : (
          <View style={styles.postsGrid}>
            {relatedPosts.map((post) => (
              <TouchableOpacity
                key={post.id}
                style={styles.postItem}
                onPress={() => handlePostPress(post)}
              >
                <Image
                  source={{
                    uri:
                      (post.imageUrls?.[0] && post.imageUrls[0].trim() !== "")
                        ? post.imageUrls[0]
                        : "https://via.placeholder.com/150x120/f0f0f0/cccccc?text=No+Image",
                  }}
                  style={styles.postImage}
                />
                <View style={styles.postInfo}>
                  <Text style={styles.postTitle} numberOfLines={2}>
                    {post.title}
                  </Text>
                  <View style={styles.postMeta}>
                    <Text style={styles.postUsername}>@{post.username}</Text>
                    <View style={styles.postStats}>
                      <Ionicons
                        name="heart"
                        size={12}
                        color={theme.colors.gray400}
                      />
                      <Text style={styles.postStatText}>{post.likeCount}</Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {renderHeader()}
        {renderImageGallery()}
        {renderCollectionInfo()}
        {renderReview()}
        {renderRelatedPosts()}
      </ScrollView>

      <ShareModal
        visible={shareModalVisible}
        post={sharePost}
        onClose={() => setShareModalVisible(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray100,
  },
  backButton: {
    padding: 8,
  },
  shareButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  infoContainer: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontFamily: "PlayfairDisplay-Bold",
    color: theme.colors.black,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: __DEV__ ? "System" : "Inter-Medium",
    color: theme.colors.gray600,
    marginBottom: 16,
  },
  contributorBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F0FF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: "flex-start",
    marginBottom: 16,
    gap: 6,
  },
  contributorText: {
    fontSize: 12,
    color: theme.colors.gray500,
    fontFamily: __DEV__ ? "System" : "Inter-Regular",
  },
  metaInfo: {
    marginBottom: 20,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  metaText: {
    fontSize: 14,
    fontFamily: __DEV__ ? "System" : "Inter-Regular",
    color: theme.colors.gray600,
    marginLeft: 8,
  },
  descriptionText: {
    fontSize: 14,
    fontFamily: __DEV__ ? "System" : "Inter-Regular",
    color: theme.colors.gray600,
    lineHeight: 22,
    marginBottom: 16,
  },
  urlButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.gray50,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  urlButtonText: {
    fontSize: 14,
    fontFamily: __DEV__ ? "System" : "Inter-Medium",
    color: theme.colors.gray600,
    marginLeft: 8,
  },
  reviewContainer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray100,
  },
  reviewTitle: {
    fontSize: 18,
    fontFamily: "PlayfairDisplay-Bold",
    color: theme.colors.black,
    marginBottom: 12,
  },
  reviewTextContainer: {
    position: "relative",
  },
  reviewTextWrapper: {
    position: "relative",
  },
  reviewText: {
    fontSize: 16,
    fontFamily: __DEV__ ? "System" : "Inter-Regular",
    color: theme.colors.gray600,
    lineHeight: 24,
  },
  gradientOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 30,
  },
  expandButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    marginTop: 8,
    paddingVertical: 6,
  },
  expandButtonText: {
    fontSize: 14,
    fontFamily: __DEV__ ? "System" : "Inter-Medium",
    color: theme.colors.gray700,
    marginRight: 4,
  },
  ratingContainer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray100,
    backgroundColor: theme.colors.gray50,
  },
  ratingTitle: {
    fontSize: 18,
    fontFamily: "PlayfairDisplay-Bold",
    color: theme.colors.black,
    marginBottom: 16,
  },
  ratingOverview: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  ratingLeft: {
    alignItems: "center",
    marginRight: 32,
    minWidth: 80,
  },
  ratingScore: {
    fontSize: 48,
    fontFamily: "PlayfairDisplay-Bold",
    color: theme.colors.black,
    marginBottom: 8,
  },
  starsContainer: {
    flexDirection: "row",
    marginBottom: 8,
    gap: 2,
  },
  totalReviews: {
    fontSize: 12,
    fontFamily: __DEV__ ? "System" : "Inter-Regular",
    color: theme.colors.gray600,
  },
  distributionContainer: {
    flex: 1,
  },
  distributionRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  starLabel: {
    fontSize: 14,
    fontFamily: __DEV__ ? "System" : "Inter-Medium",
    color: theme.colors.black,
    width: 12,
    textAlign: "center",
  },
  progressBarContainer: {
    flex: 1,
    marginHorizontal: 12,
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: theme.colors.gray200,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: theme.colors.black,
    borderRadius: 4,
  },
  percentageLabel: {
    fontSize: 12,
    fontFamily: __DEV__ ? "System" : "Inter-Regular",
    color: theme.colors.gray600,
    width: 40,
    textAlign: "right",
  },
  viewCommentsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: theme.colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
  },
  viewCommentsText: {
    fontSize: 16,
    fontFamily: __DEV__ ? "System" : "Inter-Medium",
    color: theme.colors.black,
  },
  // Related posts styles
  relatedPostsContainer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray100,
  },
  relatedPostsTitle: {
    fontSize: 18,
    fontFamily: "PlayfairDisplay-Bold",
    color: theme.colors.black,
    marginBottom: 16,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: "center",
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    fontFamily: __DEV__ ? "System" : "Inter-Regular",
    color: theme.colors.gray400,
    marginTop: 12,
  },
  postsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -6,
  },
  postItem: {
    width: (screenWidth - 40 - 12) / 2,
    marginHorizontal: 6,
    marginBottom: 16,
    backgroundColor: theme.colors.white,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: theme.colors.gray100,
  },
  postImage: {
    width: "100%",
    height: 120,
    backgroundColor: theme.colors.gray100,
  },
  postInfo: {
    padding: 10,
  },
  postTitle: {
    fontSize: 13,
    fontFamily: __DEV__ ? "System" : "Inter-Medium",
    color: theme.colors.black,
    marginBottom: 6,
    lineHeight: 18,
  },
  postMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  postUsername: {
    fontSize: 11,
    fontFamily: __DEV__ ? "System" : "Inter-Regular",
    color: theme.colors.gray500,
  },
  postStats: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  postStatText: {
    fontSize: 11,
    fontFamily: __DEV__ ? "System" : "Inter-Regular",
    color: theme.colors.gray400,
  },
  loadingGif: {
    width: screenWidth * 0.5,
    height: screenWidth * 0.5,
  },
});

export default CollectionDetailScreen;
