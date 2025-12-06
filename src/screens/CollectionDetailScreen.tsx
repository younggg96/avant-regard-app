import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Dimensions,
  Share,
  Linking,
  Animated,
  FlatList,
  Modal,
  StatusBar,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRoute, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme";
import ImageGallery from "../components/ImageGallery";
import { designerService, ApiDesigner } from "../services/designerService";

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
  reviewText?: string | null;
  showUrl?: string;
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
  designerName?: string;
  images?: ShowImage[];
}

const CollectionDetailScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const params = route.params as CollectionDetailParams;
  const { collection, designerName, images } = params;

  const [collectionImages, setCollectionImages] = useState<ShowImage[]>([]);
  const [isReviewExpanded, setIsReviewExpanded] = useState(false);

  useEffect(() => {
    const loadImages = async () => {
      if (images) {
        setCollectionImages(images);
      } else if (designerName) {
        // Try to find images from API
        try {
          const designerData = await designerService.getDesignerByName(
            designerName
          );

          if (designerData && designerData.shows) {
            const show = designerData.shows.find(
              (s) =>
                s.reviewTitle === collection.title ||
                s.season === collection.season
            );
            if (show && show.images) {
              // 转换 API 数据格式
              const convertedImages = show.images.map((img) => ({
                imageUrl: img.imageUrl,
                imageType: img.imageType,
              }));
              setCollectionImages(convertedImages);
            }
          }
        } catch (error) {
          console.error("Failed to load images:", error);
        }
      }
    };

    loadImages();

    // Add mock rating data if not exists
    if (!collection.rating) {
      collection.rating = {
        average: 7.9,
        totalReviews: 1866,
        distribution: {
          5: 650, // 34.7%
          4: 656, // 35.1%
          3: 276, // 14.8%
          2: 86, // 4.6%
          1: 26, // 1.4%
        },
      };
    }

    // Add mock comments data if not exists
    if (!collection.comments) {
      collection.comments = [
        {
          id: "1",
          userName: "时尚达人小美",
          userAvatar: "https://via.placeholder.com/40",
          rating: 5,
          content:
            "这个系列真的太棒了！设计师的创意完全超出了我的想象，每一件作品都展现了对细节的极致追求。",
          date: "2024-01-15",
          likes: 23,
          isLiked: false,
        },
        {
          id: "2",
          userName: "Fashion_Lover_2024",
          userAvatar: "https://via.placeholder.com/40",
          rating: 4,
          content:
            "整体很不错，特别是色彩搭配很有新意。不过有几件单品感觉还可以更大胆一些。",
          date: "2024-01-14",
          likes: 15,
          isLiked: true,
        },
      ];
    }
  }, [collection, designerName, images]);

  const handleShare = async () => {
    try {
      await Share.share({
        message: `查看这个精彩的时装系列：${collection.title} - ${collection.season} ${collection.year}`,
        url: collection.showUrl || "",
      });
    } catch (error) {
      console.log("分享失败:", error);
    }
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
        ? collectionImages.map((img) => img.imageUrl)
        : [collection.coverImage];

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

      <View style={styles.metaInfo}>
        {collection.city && (
          <View style={styles.metaItem}>
            <Ionicons
              name="location-outline"
              size={16}
              color={theme.colors.gray600}
            />
            <Text style={styles.metaText}>{collection.city}</Text>
          </View>
        )}

        {collection.author && (
          <View style={styles.metaItem}>
            <Ionicons
              name="person-outline"
              size={16}
              color={theme.colors.gray600}
            />
            <Text style={styles.metaText}>评论者：{collection.author}</Text>
          </View>
        )}

        <View style={styles.metaItem}>
          <Ionicons
            name="images-outline"
            size={16}
            color={theme.colors.gray600}
          />
          <Text style={styles.metaText}>
            {collectionImages.length || collection.imageCount} 张图片
          </Text>
        </View>
      </View>

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

  const renderRating = () => {
    if (!collection.rating) return null;

    const { average, totalReviews, distribution } = collection.rating;

    const renderStars = (rating: number) => {
      const stars = [];
      const fullStars = Math.floor(rating);
      const hasHalfStar = rating % 1 >= 0.5;

      for (let i = 1; i <= 5; i++) {
        if (i <= fullStars) {
          stars.push(
            <Ionicons
              key={i}
              name="star"
              size={16}
              color={theme.colors.black}
            />
          );
        } else if (i === fullStars + 1 && hasHalfStar) {
          stars.push(
            <Ionicons
              key={i}
              name="star-half"
              size={16}
              color={theme.colors.black}
            />
          );
        } else {
          stars.push(
            <Ionicons
              key={i}
              name="star-outline"
              size={16}
              color={theme.colors.gray400}
            />
          );
        }
      }
      return stars;
    };

    const renderDistributionBar = (starCount: number, percentage: number) => {
      return (
        <View key={starCount} style={styles.distributionRow}>
          <Text style={styles.starLabel}>{starCount}</Text>
          <View style={styles.progressBarContainer}>
            <View style={styles.progressBarBackground}>
              <View
                style={[styles.progressBarFill, { width: `${percentage}%` }]}
              />
            </View>
          </View>
          <Text style={styles.percentageLabel}>{percentage.toFixed(1)}%</Text>
        </View>
      );
    };

    const totalVotes = Object.values(distribution).reduce(
      (sum, count) => sum + count,
      0
    );

    return (
      <View style={styles.ratingContainer}>
        <Text style={styles.ratingTitle}>评分与评价</Text>

        <View style={styles.ratingOverview}>
          <View style={styles.ratingLeft}>
            <Text style={styles.ratingScore}>{average.toFixed(1)}</Text>
            <View style={styles.starsContainer}>{renderStars(average)}</View>
            <Text style={styles.totalReviews}>{totalReviews}人评分</Text>
          </View>

          <View style={styles.distributionContainer}>
            {[5, 4, 3, 2, 1].map((starCount) => {
              const count =
                distribution[starCount as keyof typeof distribution];
              const percentage =
                totalVotes > 0 ? (count / totalVotes) * 100 : 0;
              return renderDistributionBar(starCount, percentage);
            })}
          </View>
        </View>

        <TouchableOpacity
          style={styles.viewCommentsButton}
          onPress={() =>
            (navigation as any).navigate("AllComments", {
              collection,
              designerName,
            })
          }
        >
          <Text style={styles.viewCommentsText}>查看所有评论</Text>
          <Ionicons
            name="chevron-forward"
            size={16}
            color={theme.colors.gray600}
          />
        </TouchableOpacity>
      </View>
    );
  };

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
      </ScrollView>
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
    fontFamily: __DEV__ ? "Georgia" : "PlayfairDisplay-Bold",
    color: theme.colors.black,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: __DEV__ ? "System" : "Inter-Medium",
    color: theme.colors.gray600,
    marginBottom: 16,
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
    fontFamily: __DEV__ ? "Georgia" : "PlayfairDisplay-Bold",
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
    fontFamily: __DEV__ ? "Georgia" : "PlayfairDisplay-Bold",
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
    fontFamily: __DEV__ ? "Georgia" : "PlayfairDisplay-Bold",
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
});

export default CollectionDetailScreen;
