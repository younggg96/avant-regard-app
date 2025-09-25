import React, { useState, useCallback } from "react";
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

const { width: screenWidth } = Dimensions.get("window");

interface Designer {
  id: string;
  name: string;
  brand: string;
  avatar: string;
  coverImage: string;
  bio: string;
  nationality: string;
  founded: string;
  isFollowing: boolean;
  followers: number;
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
}

interface Look {
  id: string;
  image: string;
  title: string;
  description: string;
  likes: number;
  isLiked: boolean;
}

const DesignerDetailScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { showAlert } = useAlert();
  const designerId = (route.params as any)?.id || "designer-1";

  // Mock designer data
  const [designer, setDesigner] = useState<Designer>({
    id: designerId,
    name: "Virginie Viard",
    brand: "CHANEL",
    avatar: "https://via.placeholder.com/120x120",
    coverImage: "https://via.placeholder.com/400x200",
    bio: "Virginie Viard是CHANEL的艺术总监，她延续了Gabrielle Chanel和Karl Lagerfeld的创意传统，为这个传奇品牌注入现代活力。她的设计既保持了CHANEL的经典元素，又融入了当代女性的需求。",
    nationality: "法国",
    founded: "2019年接任艺术总监",
    isFollowing: false,
    followers: 2840000,
    collections: 24,
    website: "chanel.com",
  });

  // Mock collections data
  const [collections] = useState<Collection[]>([
    {
      id: "collection-1",
      title: "2024春夏高级定制",
      season: "Spring/Summer",
      year: "2024",
      coverImage: "https://via.placeholder.com/300x400",
      imageCount: 45,
    },
    {
      id: "collection-2",
      title: "2024早春度假系列",
      season: "Cruise",
      year: "2024",
      coverImage: "https://via.placeholder.com/300x400",
      imageCount: 38,
    },
    {
      id: "collection-3",
      title: "2023秋冬高级定制",
      season: "Fall/Winter",
      year: "2023",
      coverImage: "https://via.placeholder.com/300x400",
      imageCount: 52,
    },
    {
      id: "collection-4",
      title: "2023春夏成衣系列",
      season: "Spring/Summer RTW",
      year: "2023",
      coverImage: "https://via.placeholder.com/300x400",
      imageCount: 41,
    },
  ]);

  // Mock looks data
  const [looks] = useState<Look[]>([
    {
      id: "look-1",
      image: "https://via.placeholder.com/200x300",
      title: "经典斜纹软呢套装",
      description: "黑白配色的经典斜纹软呢套装，体现CHANEL永恒优雅",
      likes: 1247,
      isLiked: false,
    },
    {
      id: "look-2",
      image: "https://via.placeholder.com/200x300",
      title: "珍珠装饰晚礼服",
      description: "缀满珍珠的黑色晚礼服，展现奢华与精致",
      likes: 2156,
      isLiked: true,
    },
    {
      id: "look-3",
      image: "https://via.placeholder.com/200x300",
      title: "现代剪裁外套",
      description: "融入现代元素的经典外套设计",
      likes: 892,
      isLiked: false,
    },
    {
      id: "look-4",
      image: "https://via.placeholder.com/200x300",
      title: "山茶花印花连衣裙",
      description: "以山茶花为灵感的印花连衣裙",
      likes: 1543,
      isLiked: false,
    },
  ]);

  const [activeTab, setActiveTab] = useState<"collections" | "looks">(
    "collections"
  );

  // Handle follow/unfollow
  const handleFollow = useCallback(() => {
    setDesigner((prev) => ({
      ...prev,
      isFollowing: !prev.isFollowing,
      followers: prev.isFollowing ? prev.followers - 1 : prev.followers + 1,
    }));
  }, []);

  // Handle collection press
  const handleCollectionPress = useCallback(
    (collection: Collection) => {
      showAlert("系列详情", `查看${collection.title}的详细内容`);
    },
    [showAlert]
  );

  // Handle look press
  const handleLookPress = useCallback(
    (look: Look) => {
      showAlert("造型详情", `查看${look.title}的详细信息`);
    },
    [showAlert]
  );

  // Render header
  const renderHeader = () => (
    <View style={styles.header}>
      <Image source={{ uri: designer.coverImage }} style={styles.coverImage} />
      <View style={styles.headerOverlay}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.white} />
        </TouchableOpacity>
      </View>

      <View style={styles.designerInfo}>
        <Image source={{ uri: designer.avatar }} style={styles.avatar} />
        <View style={styles.designerText}>
          <Text style={styles.brandName}>{designer.brand}</Text>
          <Text style={styles.designerName}>{designer.name}</Text>
          <Text style={styles.designerMeta}>
            {designer.nationality} • {designer.founded}
          </Text>
        </View>
        <TouchableOpacity
          style={[
            styles.followButton,
            designer.isFollowing && styles.followingButton,
          ]}
          onPress={handleFollow}
        >
          <Text
            style={[
              styles.followButtonText,
              designer.isFollowing && styles.followingButtonText,
            ]}
          >
            {designer.isFollowing ? "已关注" : "关注"}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.stats}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>
            {(designer.followers / 1000000).toFixed(1)}M
          </Text>
          <Text style={styles.statLabel}>关注者</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{designer.collections}</Text>
          <Text style={styles.statLabel}>系列</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{looks.length}</Text>
          <Text style={styles.statLabel}>造型</Text>
        </View>
      </View>

      <Text style={styles.bio}>{designer.bio}</Text>
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
          系列
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
          造型
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
          {item.season} {item.year}
        </Text>
        <Text style={styles.collectionCount}>{item.imageCount} 张图片</Text>
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
  header: {
    paddingBottom: theme.spacing.lg,
  },
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
    marginTop: -30,
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
  bio: {
    ...theme.typography.body,
    color: theme.colors.gray600,
    lineHeight: 24,
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.lg,
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
