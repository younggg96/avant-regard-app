import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRoute, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme";
import { useAlert } from "../components/AlertProvider";
import designersData from "../data/data.json";

const { width: screenWidth } = Dimensions.get("window");

interface DesignerData {
  designer: string;
  designer_url: string;
  collections_summary: Array<{
    season: string;
    category: string;
    city: string | null;
    collection_date: string;
    review_title: string;
    review_author: string | null;
    looks_count: number;
  }>;
  shows: Array<{
    show_url: string;
    season: string;
    category: string;
    city: string | null;
    collection_date: string;
    review_title: string;
    review_author: string | null;
    review_text: string | null;
    looks_count: number;
    images: Array<{
      image_url: string;
      image_type: string;
    }>;
  }>;
  show_count: number;
  image_count: number;
}

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
}

const DesignerDetailScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { showAlert } = useAlert();
  const designerId = (route.params as any)?.id || "designer-1";
  const designerName = (route.params as any)?.name;

  const [designer, setDesigner] = useState<Designer | null>(null);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [looks, setLooks] = useState<Look[]>([]);

  // Find designer data by name or ID
  useEffect(() => {
    const findDesignerData = (): DesignerData | null => {
      const dataArray = designersData as DesignerData[];

      if (designerName) {
        // Try exact match first
        let found = dataArray.find(
          (d: DesignerData) =>
            d.designer.toLowerCase() === designerName.toLowerCase()
        );

        // If not found, try partial match
        if (!found) {
          found = dataArray.find(
            (d: DesignerData) =>
              d.designer.toLowerCase().includes(designerName.toLowerCase()) ||
              designerName.toLowerCase().includes(d.designer.toLowerCase())
          );
        }

        // If still not found, try matching just the brand name (part before parentheses)
        if (!found) {
          found = dataArray.find((d: DesignerData) => {
            const brandMatch = d.designer.match(/^([^(]+?)(?:\s*\(|$)/);
            const brandName = brandMatch?.[1]?.trim();
            return (
              brandName &&
              (brandName.toLowerCase().includes(designerName.toLowerCase()) ||
                designerName.toLowerCase().includes(brandName.toLowerCase()))
            );
          });
        }

        return found || null;
      }

      // Fallback to first designer if no name provided
      return dataArray[0] || null;
    };

    const designerData = findDesignerData();

    if (designerData) {
      // Extract brand name from designer string (handle parentheses)
      const brandMatch = designerData.designer.match(/^([^(]+?)(?:\s*\(|$)/);
      const designerMatch = designerData.designer.match(/\(([^)]+)\)$/);

      const brand = designerMatch
        ? designerMatch[1]
        : brandMatch?.[1]?.trim() || designerData.designer;
      const name = brandMatch?.[1]?.trim() || designerData.designer;

      // Get hero image from the latest show if available
      const heroImage =
        designerData.shows && designerData.shows.length > 0
          ? designerData.shows[0]?.images?.find(
              (img) => img.image_type === "hero"
            )?.image_url
          : null;
      const avatarImage =
        designerData.shows && designerData.shows.length > 0
          ? designerData.shows[0]?.images?.find(
              (img) => img.image_type === "look"
            )?.image_url
          : null;

      setDesigner({
        id: designerId,
        name: name,
        brand: brand,
        avatar: avatarImage || "https://via.placeholder.com/120x120",
        coverImage: heroImage || "https://via.placeholder.com/400x200",
        isFollowing: false,
        collections: designerData.collections_summary?.length || 0,
        website: designerData.designer_url,
      });

      // Convert shows to collections
      const convertedCollections = (designerData.shows || []).map(
        (show, index) => {
          const year = show.collection_date
            ? new Date(show.collection_date).getFullYear().toString()
            : "2023";
          const coverImage =
            show.images?.find((img) => img.image_type === "hero")?.image_url ||
            show.images?.[0]?.image_url ||
            "https://via.placeholder.com/300x400";
          return {
            id: `collection-${index}`,
            title: show.review_title || show.season,
            season: show.season,
            year: year,
            coverImage: coverImage,
            imageCount: show.looks_count || 0,
            city: show.city,
            author: show.review_author,
            reviewText: show.review_text,
            showUrl: show.show_url,
          };
        }
      );

      // Convert images to looks
      const convertedLooks: Look[] = [];
      (designerData.shows || []).forEach((show, showIndex) => {
        (show.images || []).forEach((image, imageIndex) => {
          convertedLooks.push({
            id: `look-${showIndex}-${imageIndex}`,
            image: image.image_url,
            title: `${show.season || "Unknown Season"} Look ${imageIndex + 1}`,
            description:
              show.review_text?.substring(0, 100) + "..." ||
              `${show.season || "Collection"} collection piece`,
            likes: Math.floor(Math.random() * 2000) + 100,
            isLiked: Math.random() > 0.7,
            imageType: image.image_type,
          });
        });
      });

      setCollections(convertedCollections);
      setLooks(convertedLooks);
    } else {
      // If no designer data found, create a fallback
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
    }
  }, [designerId, designerName]);

  const [activeTab, setActiveTab] = useState<"collections" | "looks">(
    "collections"
  );

  // Handle follow/unfollow
  const handleFollow = useCallback(() => {
    if (designer) {
      setDesigner((prev) =>
        prev
          ? {
              ...prev,
              isFollowing: !prev.isFollowing,
            }
          : null
      );
    }
  }, [designer]);

  // Handle collection press
  const handleCollectionPress = useCallback(
    (collection: Collection) => {
      // Find the corresponding show data to get images
      const designerData = (designersData as DesignerData[]).find(
        (d: DesignerData) =>
          d.designer.toLowerCase().includes(designer?.name.toLowerCase() || "")
      );

      let images: any[] = [];
      if (designerData && designerData.shows) {
        const show = designerData.shows.find(
          (s: any) =>
            s.review_title === collection.title ||
            s.season === collection.season
        );
        if (show && show.images) {
          images = show.images;
        }
      }

      (navigation as any).navigate("CollectionDetail", {
        collection,
        designerName: designer?.name,
        images,
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
          ]}
          onPress={handleFollow}
        >
          <Text
            style={[
              styles.followButtonText,
              designer?.isFollowing && styles.followingButtonText,
            ]}
          >
            {designer?.isFollowing ? "已关注" : "关注"}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.stats}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{designer?.collections || 0}</Text>
          <Text style={styles.statLabel}>系列</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{looks.length}</Text>
          <Text style={styles.statLabel}>造型</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>
            {(designersData as any).find((d: any) =>
              d.designer.includes(designer?.name || "")
            )?.show_count || 0}
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
          系列 ({collections.length})
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
      <View style={styles.lookOverlay}>
        <TouchableOpacity style={styles.likeButton}>
          <Ionicons
            name={item.isLiked ? "heart" : "heart-outline"}
            size={20}
            color={item.isLiked ? "#FF3040" : theme.colors.white}
          />
          <Text style={styles.likeCount}>{item.likes}</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  if (!designer) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>加载设计师信息中...</Text>
        </View>
      </SafeAreaView>
    );
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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: theme.spacing.xxl,
  },
  loadingText: {
    ...theme.typography.body,
    color: theme.colors.gray400,
    marginTop: theme.spacing.sm,
  },
});

export default DesignerDetailScreen;
