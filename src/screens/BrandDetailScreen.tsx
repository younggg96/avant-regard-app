import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  Image,
  TouchableOpacity,
  Dimensions,
  Linking,
  ActivityIndicator,
  Alert,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRoute, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { theme } from "../theme";
import { brandService, Brand } from "../services/brandService";
import { showService, Show } from "../services/showService";
import { postService, Post } from "../services/postService";
import CreateShowModal from "../components/CreateShowModal";
import ImagePreviewModal from "../components/ImagePreviewModal";
import { pickAndUploadImage } from "./admin/adminUtils";

type TabType = "shows" | "posts";

const { width: screenWidth } = Dimensions.get("window");
const SHOWS_PADDING = 20;
const SHOWS_GAP = 12;
const SHOW_CARD_WIDTH = (screenWidth - SHOWS_PADDING * 2 - SHOWS_GAP) / 2;

interface RouteParams {
  id?: string;
  name?: string;
  brandId?: string;
  brandName?: string;
}

const BrandDetailScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const params = route.params as RouteParams;

  // Handle different param formats
  const brandId = params.id || params.brandId;
  const brandName = params.name || params.brandName;

  const [brand, setBrand] = useState<Brand | null>(null);
  const [brandShows, setBrandShows] = useState<Show[]>([]);
  const [brandPosts, setBrandPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("posts");
  const [createShowVisible, setCreateShowVisible] = useState(false);
  const [heroImageIndex, setHeroImageIndex] = useState(0);
  const [imagePreviewVisible, setImagePreviewVisible] = useState(false);
  const [imagePreviewIndex, setImagePreviewIndex] = useState(0);
  const [uploadingBrandImage, setUploadingBrandImage] = useState(false);

  // 加载品牌相关的帖子（通过品牌 ID 查询关联该品牌的帖子）
  const loadBrandPosts = useCallback(async (brandIdToLoad: number) => {
    if (!brandIdToLoad) {
      setBrandPosts([]);
      return;
    }

    setIsLoadingPosts(true);
    try {
      // 使用新的 API 通过品牌 ID 获取关联的帖子
      const posts = await postService.getPostsByBrandId(brandIdToLoad);
      setBrandPosts(posts);
    } catch (err) {
      console.error("Failed to load brand posts:", err);
      setBrandPosts([]);
    } finally {
      setIsLoadingPosts(false);
    }
  }, []);

  // 加载品牌和秀场数据
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      let loadedBrand: Brand | null = null;

      // 通过 ID 或名称获取品牌
      if (brandId) {
        loadedBrand = await brandService.getBrandById(parseInt(brandId));
      } else if (brandName) {
        loadedBrand = await brandService.getBrandByName(brandName);
      }

      if (!loadedBrand) {
        setError("未找到品牌信息");
        return;
      }

      setBrand(loadedBrand);

      // 获取该品牌的秀场
      const shows = await showService.getShowsByBrand(loadedBrand.name);
      setBrandShows(shows);

      // 获取该品牌关联的帖子（通过品牌 ID）
      loadBrandPosts(loadedBrand.id);
    } catch (err) {
      console.error("Failed to load brand data:", err);
      setError("加载数据失败");
    } finally {
      setIsLoading(false);
    }
  }, [brandId, brandName, loadBrandPosts]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const refreshShows = useCallback(async () => {
    if (brand) {
      const shows = await showService.getShowsByBrand(brand.name);
      setBrandShows(shows);
    }
  }, [brand]);

  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleWebsitePress = useCallback(async () => {
    if (brand?.website) {
      try {
        await Linking.openURL(brand.website);
      } catch (error) {
        console.log("Failed to open website:", error);
      }
    }
  }, [brand]);

  const handleVoguePress = useCallback(async () => {
    if (brand?.vogueUrl) {
      try {
        await Linking.openURL(brand.vogueUrl);
      } catch (error) {
        console.log("Failed to open Vogue URL:", error);
      }
    }
  }, [brand]);

  const handleShowPress = useCallback(
    (show: Show) => {
      // Navigate to CollectionDetail
      (navigation.navigate as any)("CollectionDetail", {
        collection: {
          id: show.id.toString(),
          title: show.brand,
          season: show.season,
          year: show.year?.toString() || "",
          coverImage: show.coverImage || "",
          imageCount: 0,
          showUrl: show.showUrl,
        },
        brandName: show.brand,
      });
    },
    [navigation]
  );

  const handlePostPress = useCallback(
    (post: Post) => {
      (navigation.navigate as any)("PostDetail", { postId: post.id });
    },
    [navigation]
  );

  const handleAuthorPress = useCallback(
    (userId: number) => {
      (navigation.navigate as any)("UserProfile", { userId });
    },
    [navigation]
  );

  const handleHeroScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
    setHeroImageIndex(idx);
  }, []);

  const handleImagePress = useCallback((index: number) => {
    setImagePreviewIndex(index);
    setImagePreviewVisible(true);
  }, []);

  const handleUploadBrandImage = useCallback(async () => {
    if (!brand) return;
    try {
      setUploadingBrandImage(true);
      const url = await pickAndUploadImage([3, 4]);
      if (url) {
        await brandService.uploadBrandImage(brand.id, url);
        Alert.alert("提交成功", "图片已提交，等待管理员审核通过后展示。");
      }
    } catch (error) {
      Alert.alert("错误", error instanceof Error ? error.message : "上传失败");
    } finally {
      setUploadingBrandImage(false);
    }
  }, [brand]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.black} />
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={theme.colors.black} />
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !brand) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.black} />
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <Ionicons
            name="alert-circle-outline"
            size={24}
            color={theme.colors.gray400}
          />
          <Text style={styles.errorText}>{error || "未找到设计师信息"}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadData}>
            <Text style={styles.retryButtonText}>重试</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const heroImages = brand?.coverImages || [];

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Hero Section */}
        <View style={styles.heroSection}>
          {heroImages.length > 0 ? (
            <FlatList
              data={heroImages}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={handleHeroScroll}
              keyExtractor={(_, i) => String(i)}
              renderItem={({ item, index }) => (
                <TouchableOpacity activeOpacity={0.9} onPress={() => handleImagePress(index)}>
                  <Image source={{ uri: item }} style={{ width: screenWidth, height: 320 }} resizeMode="cover" />
                </TouchableOpacity>
              )}
            />
          ) : (
            <View style={[styles.coverImage, styles.placeholderCover]}>
              <Text style={styles.placeholderInitial}>
                {brand.name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}

          {/* Pagination dots */}
          {heroImages.length > 1 && (
            <View style={styles.heroDots}>
              {heroImages.map((_, i) => (
                <View key={i} style={[styles.heroDot, i === heroImageIndex && styles.heroDotActive]} />
              ))}
            </View>
          )}

          <SafeAreaView style={styles.heroContent} edges={["top"]}>
            <TouchableOpacity
              style={styles.backButtonHero}
              onPress={handleBack}
            >
              <View style={styles.backButtonCircle}>
                <Ionicons
                  name="arrow-back"
                  size={22}
                  color={theme.colors.white}
                />
              </View>
            </TouchableOpacity>
          </SafeAreaView>
          <View style={styles.heroInfo}>
            <Text style={styles.brandName}>{brand.name}</Text>
            {brand.latestSeason && (
              <Text style={styles.latestSeason}>{brand.latestSeason}</Text>
            )}
          </View>
        </View>

        {/* Info Section */}
        <View style={styles.infoSection}>
          {/* Quick Info */}
          <View style={styles.quickInfo}>
            {brand.country && (
              <View style={styles.infoItem}>
                <Ionicons
                  name="location-outline"
                  size={16}
                  color={theme.colors.gray400}
                />
                <Text style={styles.infoText}>{brand.country}</Text>
              </View>
            )}
            {brand.foundedYear && (
              <View style={styles.infoItem}>
                <Ionicons
                  name="calendar-outline"
                  size={16}
                  color={theme.colors.gray400}
                />
                <Text style={styles.infoText}>创立于 {brand.foundedYear}</Text>
              </View>
            )}
            {brand.category && (
              <View style={styles.infoItem}>
                <Ionicons
                  name="pricetag-outline"
                  size={16}
                  color={theme.colors.gray400}
                />
                <Text style={styles.infoText}>{brand.category}</Text>
              </View>
            )}
          </View>

          {/* Founder */}
          {brand.founder && (
            <View style={styles.founderSection}>
              <Text style={styles.sectionLabel}>创始人/设计师</Text>
              <Text style={styles.founderName}>{brand.founder}</Text>
            </View>
          )}

          {/* Links */}
          <View style={styles.linksSection}>
            {brand.website && (
              <TouchableOpacity
                style={styles.linkButton}
                onPress={handleWebsitePress}
              >
                <Ionicons
                  name="globe-outline"
                  size={18}
                  color={theme.colors.black}
                />
                <Text style={styles.linkText}>官方网站</Text>
                <Ionicons
                  name="open-outline"
                  size={16}
                  color={theme.colors.gray400}
                />
              </TouchableOpacity>
            )}
            {brand.vogueUrl && (
              <TouchableOpacity
                style={styles.linkButton}
                onPress={handleVoguePress}
              >
                <Ionicons
                  name="newspaper-outline"
                  size={18}
                  color={theme.colors.black}
                />
                <Text style={styles.linkText}>Vogue 专页</Text>
                <Ionicons
                  name="open-outline"
                  size={16}
                  color={theme.colors.gray400}
                />
              </TouchableOpacity>
            )}
          </View>

          {/* Upload brand image button */}
          <TouchableOpacity
            style={styles.uploadBrandImageBtn}
            onPress={handleUploadBrandImage}
            disabled={uploadingBrandImage}
            activeOpacity={0.7}
          >
            {uploadingBrandImage ? (
              <ActivityIndicator size="small" color={theme.colors.black} />
            ) : (
              <>
                <Ionicons name="camera-outline" size={18} color={theme.colors.black} />
                <Text style={styles.uploadBrandImageText}>上传品牌图片</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
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
            <Text style={styles.tabCount}>{brandPosts.length}</Text>
          </TouchableOpacity>
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
            <Text style={styles.tabCount}>{brandShows.length}</Text>
          </TouchableOpacity>
        </View>

        {/* Posts Section */}
        {activeTab === "posts" && (
          <>
            {isLoadingPosts ? (
              <View style={styles.loadingPosts}>
                <ActivityIndicator size="small" color={theme.colors.black} />
                <Text style={styles.loadingText}>加载中...</Text>
              </View>
            ) : brandPosts.length > 0 ? (
              <View style={styles.postsSection}>
                <View style={styles.postsGrid}>
                  {brandPosts.map((post) => (
                    <TouchableOpacity
                      key={post.id}
                      style={styles.postCard}
                      onPress={() => handlePostPress(post)}
                      activeOpacity={0.9}
                    >
                      <Image
                        source={{ uri: post.imageUrls[0] }}
                        style={styles.postImage}
                        resizeMode="cover"
                      />
                      <View style={styles.postContent}>
                        <Text style={styles.postTitle} numberOfLines={2}>
                          {post.title}
                        </Text>
                        <View style={styles.postFooter}>
                          <TouchableOpacity
                            style={styles.postAuthor}
                            onPress={() => handleAuthorPress(post.userId)}
                          >
                            {post.avatarUrl ? (
                              <Image
                                source={{ uri: post.avatarUrl }}
                                style={styles.postAvatar}
                              />
                            ) : (
                              <View style={styles.postAvatarPlaceholder}>
                                <Text style={styles.postAvatarText}>
                                  {post.username?.charAt(0).toUpperCase()}
                                </Text>
                              </View>
                            )}
                            <Text style={styles.postUsername} numberOfLines={1}>
                              {post.username}
                            </Text>
                          </TouchableOpacity>
                          <View style={styles.postStats}>
                            <Ionicons
                              name="heart"
                              size={12}
                              color={theme.colors.gray400}
                            />
                            <Text style={styles.postLikes}>
                              {post.likeCount}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Ionicons
                  name="document-text-outline"
                  size={48}
                  color={theme.colors.gray200}
                />
                <Text style={styles.emptyText}>暂无相关帖子</Text>
              </View>
            )}
          </>
        )}

        {/* Shows Section */}
        {activeTab === "shows" && (
          <>
            {/* Upload show button */}
            <TouchableOpacity
              style={styles.uploadShowButton}
              onPress={() => setCreateShowVisible(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="add-circle-outline" size={20} color={theme.colors.black} />
              <Text style={styles.uploadShowButtonText}>上传秀场</Text>
            </TouchableOpacity>
            {brandShows.length > 0 ? (
              <View style={styles.showsSection}>
                <View style={styles.showsGrid}>
                  {brandShows.map((show, index) => (
                    <TouchableOpacity
                      key={`${show.id}-${index}`}
                      style={styles.showCard}
                      onPress={() => handleShowPress(show)}
                      activeOpacity={0.8}
                    >
                      <Image
                        source={{ uri: show.coverImage }}
                        style={styles.showImage}
                        resizeMode="cover"
                      />
                      <LinearGradient
                        colors={["transparent", "rgba(0,0,0,0.6)"]}
                        style={styles.showGradient}
                      />
                      <View style={styles.showInfo}>
                        <Text style={styles.showSeason} numberOfLines={1}>
                          {show.year
                            ? `${show.year} ${show.season}`
                            : show.season}
                        </Text>
                        {show.description && (
                          <Text
                            style={styles.showDescription}
                            numberOfLines={2}
                          >
                            {show.description}
                          </Text>
                        )}
                        {show.category && (
                          <Text style={styles.showCategory}>
                            {show.category}
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Ionicons
                  name="images-outline"
                  size={48}
                  color={theme.colors.gray200}
                />
                <Text style={styles.emptyText}>暂无时装秀数据</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Create Show Modal */}
      {brand && (
        <CreateShowModal
          visible={createShowVisible}
          brandName={brand.name}
          onClose={() => setCreateShowVisible(false)}
          onSuccess={refreshShows}
        />
      )}

      {/* Image Preview Modal */}
      <ImagePreviewModal
        visible={imagePreviewVisible}
        imageUrls={heroImages}
        initialIndex={imagePreviewIndex}
        title={brand.name}
        onClose={() => setImagePreviewVisible(false)}
      />
    </View>
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
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: theme.spacing.md,
    fontSize: 14,
    color: theme.colors.gray400,
    fontFamily: "Inter-Regular",
  },
  errorText: {
    marginTop: theme.spacing.md,
    fontSize: 14,
    color: theme.colors.gray500,
    fontFamily: "Inter-Regular",
  },
  retryButton: {
    marginTop: theme.spacing.md,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: theme.colors.black,
    borderRadius: theme.borderRadius.lg,
  },
  retryButtonText: {
    color: theme.colors.white,
    fontSize: 14,
    fontFamily: "Inter-Medium",
  },
  // Hero Section
  heroSection: {
    width: screenWidth,
    height: 320,
    position: "relative",
  },
  coverImage: {
    width: "100%",
    height: "100%",
  },
  placeholderCover: {
    backgroundColor: theme.colors.gray100,
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderInitial: {
    fontFamily: "PlayfairDisplay-Bold",
    fontSize: 80,
    color: theme.colors.gray300,
  },
  heroGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 180,
  },
  heroContent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  backButtonHero: {
    margin: 16,
    alignSelf: "flex-start",
  },
  backButtonCircle: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  heroInfo: {
    position: "absolute",
    bottom: 24,
    left: 20,
    right: 20,
  },
  brandName: {
    fontFamily: "PlayfairDisplay-Bold",
    fontSize: 32,
    color: theme.colors.white,
    textShadowColor: "rgba(0,0,0,0.3)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  latestSeason: {
    fontFamily: "Inter-Regular",
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
    marginTop: 4,
  },
  // Info Section
  infoSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray100,
  },
  quickInfo: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    marginBottom: 20,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  infoText: {
    fontFamily: "Inter-Regular",
    fontSize: 14,
    color: theme.colors.gray500,
  },
  founderSection: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontFamily: "Inter-Regular",
    fontSize: 12,
    color: theme.colors.gray400,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  founderName: {
    fontFamily: "Inter-Medium",
    fontSize: 16,
    color: theme.colors.black,
  },
  linksSection: {
    gap: 12,
  },
  linkButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.gray50,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: theme.borderRadius.sm,
    gap: 10,
  },
  linkText: {
    flex: 1,
    fontFamily: "Inter-Medium",
    fontSize: 15,
    color: theme.colors.black,
  },
  // Tab Navigation
  tabContainer: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray100,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 4,
    marginRight: 24,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: {
    borderBottomColor: theme.colors.black,
  },
  tabText: {
    fontFamily: "Inter-Medium",
    fontSize: 15,
    color: theme.colors.gray400,
  },
  tabTextActive: {
    color: theme.colors.black,
  },
  tabCount: {
    fontFamily: "Inter-Regular",
    fontSize: 13,
    color: theme.colors.gray400,
    marginLeft: 6,
  },
  // Hero dots
  heroDots: {
    position: "absolute",
    bottom: 52,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  heroDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.4)",
  },
  heroDotActive: {
    backgroundColor: theme.colors.white,
    width: 18,
  },
  // Upload brand image
  uploadBrandImageBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    borderStyle: "dashed",
  },
  uploadBrandImageText: {
    fontSize: 13,
    color: theme.colors.black,
    fontWeight: "500",
  },
  // Shows Section
  uploadShowButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginHorizontal: 20,
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    borderStyle: "dashed",
  },
  uploadShowButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: theme.colors.black,
  },
  showsSection: {
    padding: 20,
  },
  showsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SHOWS_GAP,
  },
  showCard: {
    width: SHOW_CARD_WIDTH,
    height: SHOW_CARD_WIDTH * 1.4,
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
  },
  showImage: {
    width: "100%",
    height: "100%",
  },
  showGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
  },
  showInfo: {
    position: "absolute",
    bottom: 12,
    left: 12,
    right: 12,
  },
  showSeason: {
    fontFamily: "Inter-Bold",
    fontSize: 13,
    color: theme.colors.white,
  },
  showCategory: {
    fontFamily: "Inter-Regular",
    fontSize: 11,
    color: "rgba(255,255,255,0.8)",
    marginTop: 2,
  },
  showDescription: {
    fontFamily: "Inter-Regular",
    fontSize: 11,
    color: "rgba(255,255,255,0.8)",
    marginTop: 3,
    lineHeight: 15,
  },
  // Posts Section
  postsSection: {
    padding: 20,
  },
  postsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SHOWS_GAP,
  },
  postCard: {
    width: SHOW_CARD_WIDTH,
    backgroundColor: theme.colors.white,
    borderRadius: 12,
    overflow: "hidden",
    ...theme.shadows.sm,
  },
  postImage: {
    width: "100%",
    aspectRatio: 3 / 4,
    backgroundColor: theme.colors.gray100,
  },
  postContent: {
    padding: 10,
  },
  postTitle: {
    fontFamily: "Inter-Medium",
    fontSize: 13,
    color: theme.colors.black,
    lineHeight: 18,
    marginBottom: 8,
  },
  postFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  postAuthor: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 8,
  },
  postAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: theme.colors.gray100,
    marginRight: 6,
  },
  postAvatarPlaceholder: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: theme.colors.gray200,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 6,
  },
  postAvatarText: {
    fontFamily: "Inter-Medium",
    fontSize: 10,
    color: theme.colors.gray500,
  },
  postUsername: {
    fontFamily: "Inter-Regular",
    fontSize: 11,
    color: theme.colors.gray500,
    flex: 1,
  },
  postStats: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  postLikes: {
    fontFamily: "Inter-Regular",
    fontSize: 11,
    color: theme.colors.gray400,
  },
  loadingPosts: {
    alignItems: "center",
    paddingVertical: 48,
  },
  // Empty State
  emptyState: {
    alignItems: "center",
    paddingVertical: 48,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontFamily: "Inter-Regular",
    fontSize: 15,
    color: theme.colors.gray400,
    marginTop: 12,
  },
});

export default BrandDetailScreen;
