import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
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
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { theme, useThemedStyles, type AppTheme } from "../theme";
import { brandService, Brand } from "../services/brandService";
import { showService, Show } from "../services/showService";
import { postService, Post } from "../services/postService";
import {
  followBrand,
  unfollowBrand,
  isFollowingBrand,
  getBrandFollowersCount,
} from "../services/followService";
import { useAuthStore } from "../store/authStore";
import CreateShowModal from "../components/CreateShowModal";
import ImagePreviewModal from "../components/ImagePreviewModal";
import { ShareToChatModal } from "../components/ShareToChatModal";
import { pickAndUploadImage } from "./admin/adminUtils";
import { OptimizedImage } from "../components/ui/OptimizedImage";
import { PostCoverMedia } from "../components/PostCoverMedia";
import { ImageSize } from "../utils/imageUtils";
import {
  searchMarketplace,
  type StoreProduct,
  type MarketplaceFilter,
} from "../services/storeProductService";
import { useFormatPrice } from "../utils/currency";
import MarketplaceFilterSheet from "./Marketplace/MarketplaceFilterSheet";

type TabType = "shows" | "posts" | "onsale";

const { width: screenWidth } = Dimensions.get("window");
const SHOWS_PADDING = 20;
const SHOWS_GAP = 12;
const SHOW_CARD_WIDTH = (screenWidth - SHOWS_PADDING * 2 - SHOWS_GAP) / 2;

interface RouteParams {
  id?: string;
  name?: string;
  brandId?: string;
  brandName?: string;
  initialTab?: "shows" | "posts" | "onsale";
}

const BrandDetailScreen = () => {
  const { t, i18n } = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const route = useRoute();
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const params = route.params as RouteParams;
  const formatPrice = useFormatPrice();

  // Handle different param formats
  const brandId = params.id || params.brandId;
  const brandName = params.name || params.brandName;

  const [brand, setBrand] = useState<Brand | null>(null);
  const [brandShows, setBrandShows] = useState<Show[]>([]);
  const [brandPosts, setBrandPosts] = useState<Post[]>([]);
  const [brandListings, setBrandListings] = useState<StoreProduct[]>([]);
  const [isLoadingListings, setIsLoadingListings] = useState(false);
  // 进入此屏视为「已选中该品牌」；此 filter 用于 on-sale tab 的精细化筛选，
  // 不含品牌字段（品牌锁在 brand.name 上，由 loadBrandListings 强制注入）。
  const [listingFilter, setListingFilter] = useState<MarketplaceFilter>({
    sort: "newest",
  });
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>(params.initialTab || "posts");
  const [createShowVisible, setCreateShowVisible] = useState(false);
  const [heroImageIndex, setHeroImageIndex] = useState(0);
  const [imagePreviewVisible, setImagePreviewVisible] = useState(false);
  const [imagePreviewIndex, setImagePreviewIndex] = useState(0);
  const [uploadingBrandImage, setUploadingBrandImage] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followLoading, setFollowLoading] = useState(false);
  const [showShareToChat, setShowShareToChat] = useState(false);

  // 加载该品牌当前在售单品（PRD 模块二，与 Marketplace 接口一致）。
  // brand 字段强制注入；其他维度由 listingFilter 控制，方便用户在品牌详情
  // 页直接做二次筛选（PRD「进入 archive 视为直接选中了品牌」）。
  const loadBrandListings = useCallback(
    async (brandName: string, extra?: MarketplaceFilter) => {
      if (!brandName) {
        setBrandListings([]);
        return;
      }
      setIsLoadingListings(true);
      try {
        const merged: MarketplaceFilter = {
          ...(extra ?? listingFilter),
          brand: brandName,
          page: 1,
          pageSize: 40,
        };
        const res = await searchMarketplace(merged);
        setBrandListings(res.products || []);
      } catch (e) {
        setBrandListings([]);
      } finally {
        setIsLoadingListings(false);
      }
    },
    [listingFilter],
  );

  /** 计算 on-sale tab 已激活的筛选维度数量（不含品牌本身）。 */
  const listingActiveCount = useMemo(() => {
    let n = 0;
    if (listingFilter.categoryKinds?.length) n += listingFilter.categoryKinds.length;
    if (listingFilter.sizes?.length) n += listingFilter.sizes.length;
    if (listingFilter.colors?.length) n += listingFilter.colors.length;
    if (listingFilter.conditions?.length) n += listingFilter.conditions.length;
    if (listingFilter.priceMinCents != null || listingFilter.priceMaxCents != null) {
      n += 1;
    }
    return n;
  }, [listingFilter]);

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
        setError(t("brand.notFound"));
        return;
      }

      setBrand(loadedBrand);

      // 获取关注状态和关注人数
      if (user?.userId) {
        const [following, count] = await Promise.all([
          isFollowingBrand(user.userId, loadedBrand.id).catch(() => false),
          getBrandFollowersCount(loadedBrand.id).catch(() => 0),
        ]);
        setIsFollowing(following);
        setFollowersCount(count);
      } else {
        const count = await getBrandFollowersCount(loadedBrand.id).catch(() => 0);
        setFollowersCount(count);
      }

      // 获取该品牌的秀场
      const shows = await showService.getShowsByBrand(loadedBrand.name);
      setBrandShows(shows);

      // 获取该品牌关联的帖子（通过品牌 ID）
      loadBrandPosts(loadedBrand.id);
      // PRD 模块二：拉取该品牌当前在售单品
      loadBrandListings(loadedBrand.name);
    } catch (err) {
      console.error("Failed to load brand data:", err);
      setError(t("common.networkError"));
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
      (navigation.navigate as any)("CollectionDetail", {
        collection: {
          id: show.id.toString(),
          title: show.brand,
          season: show.season,
          year: show.year?.toString() || "",
          coverImage: show.coverImage || "",
          imageCount: 0,
          showUrl: show.showUrl,
          designer: show.designer,
          description: show.description,
          category: show.category,
          contributorName: show.contributorName,
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
        Alert.alert(t("brand.imageSubmitSuccess"), t("brand.imageSubmitPending"));
      }
    } catch (error) {
      Alert.alert(t("common.failed"), error instanceof Error ? error.message : t("brand.uploadFailed"));
    } finally {
      setUploadingBrandImage(false);
    }
  }, [brand]);

  const handleToggleFollow = useCallback(async () => {
    if (!user?.userId || !brand) return;
    setFollowLoading(true);
    const wasFollowing = isFollowing;
    setIsFollowing(!wasFollowing);
    setFollowersCount((prev) => prev + (wasFollowing ? -1 : 1));
    try {
      if (wasFollowing) {
        await unfollowBrand({ userId: user.userId, brandId: brand.id });
      } else {
        await followBrand({ userId: user.userId, brandId: brand.id });
      }
    } catch (error) {
      console.error("Toggle follow failed:", error);
      setIsFollowing(wasFollowing);
      setFollowersCount((prev) => prev + (wasFollowing ? 1 : -1));
    } finally {
      setFollowLoading(false);
    }
  }, [user?.userId, brand, isFollowing]);

  const formatFollowerCount = (count: number): string => {
    if (count >= 10000 && i18n.language?.startsWith('zh'))
      return `${(count / 10000).toFixed(1)}${t('common.wan')}`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
    return String(count);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={theme.colors.black} />
          <Text style={styles.loadingText}>{t("common.loading")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !brand) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <Ionicons
            name="alert-circle-outline"
            size={24}
            color={theme.colors.gray400}
          />
          <Text style={styles.errorText}>{error || t("brand.notFound")}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadData}>
            <Text style={styles.retryButtonText}>{t("common.retry")}</Text>
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
                  <OptimizedImage
                    uri={item}
                    size={ImageSize.LARGE}
                    style={{ width: screenWidth, height: 320 }}
                    contentFit="cover"
                    lazy={true}
                  />
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
            <View style={styles.heroTopBar}>
              <TouchableOpacity
                style={styles.backButtonHero}
                onPress={handleBack}
              >
                <View style={styles.backButtonCircle}>
                  <Ionicons
                    name="arrow-back"
                    size={22}
                    color={theme.colors.text}
                  />
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.backButtonHero}
                onPress={() => setShowShareToChat(true)}
              >
                <View style={styles.backButtonCircle}>
                  <Ionicons
                    name="share-outline"
                    size={20}
                    color={theme.colors.text}
                  />
                </View>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
          <View style={styles.heroInfo}>
            <Text style={styles.brandName}>{brand.name}</Text>
            {brand.latestSeason && (
              <Text style={styles.latestSeason}>{brand.latestSeason}</Text>
            )}
          </View>
        </View>

        {/* Contributor Info */}
        {brand.contributorName && (
          <View style={styles.contributorContainer}>
            <Ionicons name="person-outline" size={13} color={theme.colors.gray500} />
            <Text style={styles.contributorText}>
              {t("brand.contributedBy", { name: brand.contributorName })}
            </Text>
          </View>
        )}

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
                <Text style={styles.infoText}>{t("brand.foundedIn", { year: brand.foundedYear })}</Text>
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

          {/* Follow Section */}
          <View style={styles.followSection}>
            <TouchableOpacity
              style={styles.followInfo}
              onPress={() => {
                if (brand) {
                  (navigation as any).navigate("BrandFollowers", {
                    brandId: brand.id,
                    brandName: brand.name,
                  });
                }
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.followersCount}>
                {formatFollowerCount(followersCount)}
              </Text>
              <Text style={styles.followersLabel}>{t("brand.followers")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.followButton,
                isFollowing && styles.followButtonFollowing,
              ]}
              onPress={handleToggleFollow}
              disabled={followLoading}
              activeOpacity={0.7}
            >
              {followLoading ? (
                <ActivityIndicator
                  size="small"
                  color={isFollowing ? theme.colors.gray400 : theme.colors.textInverted}
                />
              ) : (
                <>
                  <Ionicons
                    name={isFollowing ? "checkmark" : "add"}
                    size={16}
                    color={isFollowing ? theme.colors.gray400 : theme.colors.textInverted}
                  />
                  <Text
                    style={[
                      styles.followButtonText,
                      isFollowing && styles.followButtonTextFollowing,
                    ]}
                  >
                    {isFollowing ? t("brand.following") : t("brand.follow")}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Founder */}
          {brand.founder && (
            <View style={styles.founderSection}>
              <Text style={styles.sectionLabel}>{t("brand.founder")}</Text>
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
                <Text style={styles.linkText}>{t("brand.website")}</Text>
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
                <Text style={styles.linkText}>{t("brand.voguePage")}</Text>
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
                <Text style={styles.uploadBrandImageText}>{t("brand.uploadImage")}</Text>
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
              {t("brand.posts")}
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
              {t("brand.shows")}
            </Text>
            <Text style={styles.tabCount}>{brandShows.length}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === "onsale" && styles.tabActive]}
            onPress={() => setActiveTab("onsale")}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "onsale" && styles.tabTextActive,
              ]}
            >
              {t("brand.onSale")}
            </Text>
            <Text style={styles.tabCount}>{brandListings.length}</Text>
          </TouchableOpacity>
        </View>

        {/* Posts Section */}
        {activeTab === "posts" && (
          <>
            {isLoadingPosts ? (
              <View style={styles.loadingPosts}>
                <ActivityIndicator size="small" color={theme.colors.black} />
                <Text style={styles.loadingText}>{t("common.loading")}</Text>
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
                      <PostCoverMedia
                        uri={post.imageUrls[0]}
                        style={styles.postImage}
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
                              <OptimizedImage
                                uri={post.avatarUrl}
                                size={ImageSize.THUMBNAIL}
                                style={styles.postAvatar}
                                contentFit="cover"
                                lazy={true}
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
                <Text style={styles.emptyText}>{t("brand.noPosts")}</Text>
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
              <Text style={styles.uploadShowButtonText}>{t("brand.uploadShow")}</Text>
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
                      <OptimizedImage
                        uri={show.coverImage ?? ""}
                        size={ImageSize.MEDIUM}
                        style={styles.showImage}
                        contentFit="cover"
                        lazy={true}
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
                <Text style={styles.emptyText}>{t("brand.noShows")}</Text>
              </View>
            )}
          </>
        )}

        {/* PRD 模块二 · 该品牌当前在售单品 */}
        {activeTab === "onsale" && (
          <View style={styles.postsSection}>
            {/* 筛选入口 —— 进入此屏视为已选中此品牌 */}
            <View style={styles.onsaleFilterRow}>
              <TouchableOpacity
                style={[
                  styles.onsaleFilterBtn,
                  listingActiveCount > 0 && styles.onsaleFilterBtnActive,
                ]}
                onPress={() => setFilterSheetVisible(true)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="options-outline"
                  size={16}
                  color={
                    listingActiveCount > 0
                      ? theme.colors.textInverted
                      : theme.colors.text
                  }
                />
                <Text
                  style={[
                    styles.onsaleFilterText,
                    listingActiveCount > 0 && styles.onsaleFilterTextActive,
                  ]}
                >
                  {t("trading.filter.title")}
                </Text>
                {listingActiveCount > 0 ? (
                  <View style={styles.onsaleFilterBadge}>
                    <Text style={styles.onsaleFilterBadgeText}>
                      {listingActiveCount}
                    </Text>
                  </View>
                ) : null}
              </TouchableOpacity>
              {listingActiveCount > 0 ? (
                <TouchableOpacity
                  onPress={() => {
                    setListingFilter({ sort: "newest" });
                    if (brand) loadBrandListings(brand.name, { sort: "newest" });
                  }}
                  hitSlop={8}
                  activeOpacity={0.6}
                >
                  <Text style={styles.onsaleFilterReset}>
                    {t("trading.filter.reset")}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
            {isLoadingListings ? (
              <View style={styles.loadingPosts}>
                <ActivityIndicator size="small" color={theme.colors.black} />
              </View>
            ) : brandListings.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons
                  name="pricetag-outline"
                  size={48}
                  color={theme.colors.gray200}
                />
                <Text style={styles.emptyText}>{t("brand.noOnSaleListings")}</Text>
              </View>
            ) : (
              <View style={styles.postsGrid}>
                {brandListings.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={styles.postCard}
                    activeOpacity={0.85}
                    onPress={() =>
                      (navigation as any).navigate("StoreProductDetail", {
                        productId: p.id,
                      })
                    }
                  >
                    {p.images?.[0] ? (
                      <OptimizedImage
                        uri={p.images[0]}
                        style={styles.postImage}
                      />
                    ) : (
                      <View
                        style={[
                          styles.postImage,
                          { backgroundColor: theme.colors.gray100 },
                        ]}
                      />
                    )}
                    <View style={styles.postContent}>
                      <Text style={styles.postTitle} numberOfLines={2}>
                        {p.title}
                      </Text>
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "700",
                          color: theme.colors.text,
                          marginTop: 4,
                        }}
                      >
                        {formatPrice(p.priceCents, p.currency)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
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

      <ShareToChatModal
        visible={showShareToChat}
        brand={brand}
        onClose={() => setShowShareToChat(false)}
      />

      {/* On-sale 筛选 Sheet —— 品牌已锁定，UI 不可编辑品牌区 */}
      <MarketplaceFilterSheet
        visible={filterSheetVisible}
        initial={{ ...listingFilter, brand: brand?.name }}
        brandLocked
        onClose={() => setFilterSheetVisible(false)}
        onApply={(next) => {
          setFilterSheetVisible(false);
          // brand 永远是当前页品牌；其他维度从用户输入合并
          const cleaned: MarketplaceFilter = { ...next };
          delete cleaned.brand;
          delete cleaned.brands;
          setListingFilter(cleaned);
          if (brand) loadBrandListings(brand.name, cleaned);
        }}
      />
    </View>
  );
};

const makeStyles = (t: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: t.colors.background,
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
    marginTop: t.spacing.md,
    fontSize: 14,
    color: t.colors.gray400,
    fontFamily: "PlayfairDisplay-Regular",
  },
  errorText: {
    marginTop: t.spacing.md,
    fontSize: 14,
    color: t.colors.gray500,
    fontFamily: "PlayfairDisplay-Regular",
  },
  retryButton: {
    marginTop: t.spacing.md,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: t.colors.text,
    borderRadius: t.borderRadius.lg,
  },
  retryButtonText: {
    color: t.colors.textInverted,
    fontSize: 14,
    fontFamily: "PlayfairDisplay-Medium",
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
    backgroundColor: t.colors.gray100,
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderInitial: {
    fontFamily: "PlayfairDisplay-Bold",
    fontSize: 80,
    color: t.colors.gray300,
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
  heroTopBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  backButtonHero: {
    margin: 16,
    alignSelf: "flex-start",
  },
  backButtonCircle: {
    width: 40,
    height: 40,
    borderRadius: t.borderRadius.sm,
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
    color: "#FFFFFF",
    textShadowColor: "rgba(0,0,0,0.3)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  latestSeason: {
    fontFamily: "PlayfairDisplay-Regular",
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
    marginTop: 4,
  },
  contributorContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F0FF",
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 6,
  },
  contributorText: {
    fontSize: 12,
    color: t.colors.gray500,
    fontFamily: "PlayfairDisplay-Regular",
  },
  // Info Section
  infoSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.border,
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
    fontFamily: "PlayfairDisplay-Regular",
    fontSize: 14,
    color: t.colors.gray500,
  },
  founderSection: {
    marginBottom: 20,
  },
  // Follow Section
  followSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: t.colors.gray50,
    borderRadius: t.borderRadius.lg,
  },
  followInfo: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
  },
  followersCount: {
    fontFamily: "PlayfairDisplay-Bold",
    fontSize: 20,
    color: t.colors.text,
  },
  followersLabel: {
    fontFamily: "PlayfairDisplay-Regular",
    fontSize: 13,
    color: t.colors.gray400,
  },
  followButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: t.colors.text,
    borderRadius: t.borderRadius.md,
    minWidth: 90,
  },
  followButtonFollowing: {
    // 之前硬编码 "#F0F0F0" 在 dark mode 下还是浅灰，叠上同样浅的文字会几乎不可见。
    // 用 gray100 跟随主题：light=#F5F5F5、dark=#1F1F1F，两边都是"muted card"质感。
    backgroundColor: t.colors.gray100,
  },
  followButtonText: {
    fontFamily: "PlayfairDisplay-Medium",
    fontSize: 14,
    color: t.colors.textInverted,
  },
  followButtonTextFollowing: {
    // gray500 在 dark mode 下被反转为 #E5E5E5（接近白），落在浅 bg 上完全看不见。
    // 改成 gray400：light=#444（深灰）、dark=#CFCFCF（浅灰），两边都跟 gray100 底有
    // 足够对比。
    color: t.colors.gray400,
  },
  sectionLabel: {
    fontFamily: "PlayfairDisplay-Regular",
    fontSize: 12,
    color: t.colors.gray400,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  founderName: {
    fontFamily: "PlayfairDisplay-Medium",
    fontSize: 16,
    color: t.colors.text,
  },
  linksSection: {
    gap: 12,
  },
  linkButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: t.colors.gray50,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: t.borderRadius.sm,
    gap: 10,
  },
  linkText: {
    flex: 1,
    fontFamily: "PlayfairDisplay-Medium",
    fontSize: 15,
    color: t.colors.text,
  },
  // Tab Navigation
  tabContainer: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 16,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.border,
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
    borderBottomColor: t.colors.text,
  },
  tabText: {
    fontFamily: "PlayfairDisplay-Medium",
    fontSize: 15,
    color: t.colors.gray400,
  },
  tabTextActive: {
    color: t.colors.text,
  },
  tabCount: {
    fontFamily: "PlayfairDisplay-Regular",
    fontSize: 13,
    color: t.colors.gray400,
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
    backgroundColor: "#FFFFFF",
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
    borderColor: t.colors.gray200,
    borderStyle: "dashed",
  },
  uploadBrandImageText: {
    fontSize: 13,
    color: t.colors.text,
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
    borderColor: t.colors.gray200,
    borderStyle: "dashed",
  },
  uploadShowButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: t.colors.text,
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
    fontFamily: "PlayfairDisplay-Bold",
    fontSize: 13,
    color: "#FFFFFF",
  },
  showCategory: {
    fontFamily: "PlayfairDisplay-Regular",
    fontSize: 11,
    color: "rgba(255,255,255,0.8)",
    marginTop: 2,
  },
  showDescription: {
    fontFamily: "PlayfairDisplay-Regular",
    fontSize: 11,
    color: "rgba(255,255,255,0.8)",
    marginTop: 3,
    lineHeight: 15,
  },
  // On-sale tab 筛选 button
  onsaleFilterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    gap: 12,
  },
  onsaleFilterBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
  },
  onsaleFilterBtnActive: {
    backgroundColor: t.colors.text,
    borderColor: t.colors.text,
  },
  onsaleFilterText: {
    fontSize: 13,
    color: t.colors.text,
    fontWeight: "500",
  },
  onsaleFilterTextActive: {
    color: t.colors.textInverted,
  },
  onsaleFilterBadge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: t.colors.error,
    alignItems: "center",
    justifyContent: "center",
  },
  onsaleFilterBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
    lineHeight: 12,
  },
  onsaleFilterReset: {
    fontSize: 13,
    color: t.colors.textSecondary,
    textDecorationLine: "underline",
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
    backgroundColor: t.colors.card,
    borderRadius: 12,
    overflow: "hidden",
    ...t.shadows.sm,
  },
  postImage: {
    width: "100%",
    aspectRatio: 3 / 4,
    backgroundColor: t.colors.gray100,
  },
  postContent: {
    padding: 10,
  },
  postTitle: {
    fontFamily: "PlayfairDisplay-Medium",
    fontSize: 13,
    color: t.colors.text,
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
    backgroundColor: t.colors.gray100,
    marginRight: 6,
  },
  postAvatarPlaceholder: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: t.colors.gray200,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 6,
  },
  postAvatarText: {
    fontFamily: "PlayfairDisplay-Medium",
    fontSize: 10,
    color: t.colors.gray500,
  },
  postUsername: {
    fontFamily: "PlayfairDisplay-Regular",
    fontSize: 11,
    color: t.colors.gray500,
    flex: 1,
  },
  postStats: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  postLikes: {
    fontFamily: "PlayfairDisplay-Regular",
    fontSize: 11,
    color: t.colors.gray400,
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
    fontFamily: "PlayfairDisplay-Regular",
    fontSize: 15,
    color: t.colors.gray400,
    marginTop: 12,
  },
});

export default BrandDetailScreen;
