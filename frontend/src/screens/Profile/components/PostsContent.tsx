import React, { useEffect } from "react";
import {
  View,
  Text as RNText,
  ActivityIndicator,
  StyleSheet,
  Image as RNImage,
} from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import {
  theme,
  useAppTheme,
  useThemedStyles,
  type AppTheme,
} from "../../../theme";
import {
  Text,
  Pressable,
  VStack,
  HStack,
  Image,
  AnimatedChip,
  chipRowStyle,
} from "../../../components/ui";
import { OptimizedImage } from "../../../components/ui/OptimizedImage";
import { ImageSize } from "../../../utils/imageUtils";
import PostCard, { Post as DisplayPost } from "../../../components/PostCard";
import ForumPostCard from "../../../components/ForumPostCard";
import { splitIntoMasonryColumns } from "../../../utils/masonryLayout";
import {
  TabType,
  TabData,
  ContribSubTab,
  StoreActivitySubTab,
  ProductActivitySubTab,
  ProductListState,
} from "../types";
import { Show } from "../../../services/showService";
import { BrandSubmission } from "../../../services/brandService";
import {
  UserSubmittedStore,
  UserStoreActivity,
  UserFavoritedStore,
  UserStoreCommentItem,
  UserStoreRatingItem,
} from "../../../services/buyerStoreService";
import {
  StoreProduct,
} from "../../../services/storeProductService";
import { useFormatPrice } from "../../../utils/currency";
import {
  useStoreActivityStyles,
  useProfileStyles,
  PF,
} from "../styles";
import { useProfileLoadingGif } from "../../../utils/loadingGifs";

interface PostsContentProps {
  activeTab: TabType;
  tabsData: Record<TabType, TabData>;
  contribSubTab: ContribSubTab;
  setContribSubTab: (tab: ContribSubTab) => void;
  contribLoading: boolean;
  myShows: Show[];
  myBrands: BrandSubmission[];
  myStores: UserSubmittedStore[];
  storeActivitySubTab: StoreActivitySubTab;
  setStoreActivitySubTab: (tab: StoreActivitySubTab) => void;
  storeActivity: UserStoreActivity | null;
  storeActivityLoading: boolean;
  // 嵌套的商品级活动 (likes/saved/wishlist) —— 仅当 storeActivitySubTab==="products" 时使用
  productActivitySubTab: ProductActivitySubTab;
  setProductActivitySubTab: (tab: ProductActivitySubTab) => void;
  productLikes: ProductListState;
  productSaved: ProductListState;
  productWanted: ProductListState;
  loadProductActivity: (sub: ProductActivitySubTab, force?: boolean) => Promise<void> | void;
  onProductPress: (productId: number) => void;
  user: { userId?: number; username?: string; avatar?: string } | null;
  onPostPress: (post: DisplayPost) => void;
  onDeletePost: (post: DisplayPost) => void;
  onShowPress: (show: Show) => void;
  onBrandSubmissionPress: (sub: BrandSubmission) => void;
  onStoreCardPress: (store: UserSubmittedStore) => void;
  onStoreActivityPress: (storeId: string) => void;
  onLike?: (postId: string) => void;
}

const ContributionContent = ({
  contribSubTab,
  setContribSubTab,
  contribLoading,
  myShows,
  myBrands,
  myStores,
  user,
  onShowPress,
  onBrandSubmissionPress,
  onStoreCardPress,
}: Pick<PostsContentProps, 'contribSubTab' | 'setContribSubTab' | 'contribLoading' | 'myShows' | 'myBrands' | 'myStores' | 'user' | 'onShowPress' | 'onBrandSubmissionPress' | 'onStoreCardPress'>) => {
  const { t } = useTranslation();
  const subTabs: { id: ContribSubTab; label: string; count: number }[] = [
    { id: "show", label: t("profileContrib.show"), count: myShows.length },
    { id: "brand", label: t("profileContrib.brand"), count: myBrands.length },
    { id: "store", label: t("profileContrib.store"), count: myStores.length },
  ];

  const getData = () => {
    switch (contribSubTab) {
      case "show": return myShows;
      case "brand": return myBrands;
      case "store": return myStores;
    }
  };
  const data = getData();

  const emptyIcons: Record<ContribSubTab, string> = {
    show: "film-outline",
    brand: "pricetag-outline",
    store: "storefront-outline",
  };
  const emptyTexts: Record<ContribSubTab, string> = {
    show: t("profileContrib.noShowContrib"),
    brand: t("profileContrib.noBrandContrib"),
    store: t("profileContrib.noStoreContrib"),
  };

  // Build a displayable post + its press handler for a contribution item.
  // Returning a flat shape lets the outer masonry splitter know each item's
  // media URI so it can balance columns by natural height.
  const buildContribCard = (
    item: any,
    type: ContribSubTab
  ): { post: DisplayPost; onPress: () => void } => {
    const key = `${type}-${item.id}`;
    const image = type === "store"
      ? (item.images && item.images.length > 0 ? item.images[0] : null)
      : item.coverImage;
    const title = type === "show" ? `${item.brand} ${item.season}` : item.name;
    const onPress = type === "show"
      ? () => onShowPress(item)
      : type === "brand"
        ? () => onBrandSubmissionPress(item)
        : () => onStoreCardPress(item);

    const post: DisplayPost = {
      id: key,
      title,
      image: image || "",
      author: {
        id: String(user?.userId || ""),
        name: user?.username || "",
        avatar: user?.avatar || "",
      },
      content: { title, images: image ? [image] : [] },
      engagement: { likes: 0 },
    };

    return { post, onPress };
  };

  return (
    <VStack>
      <View
        style={{
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
        }}
      >
        <View style={chipRowStyle}>
          {subTabs.map((st) => (
            <AnimatedChip
              key={st.id}
              label={st.label}
              count={st.count}
              showZeroCount
              isActive={contribSubTab === st.id}
              onPress={() => setContribSubTab(st.id)}
            />
          ))}
        </View>
      </View>

      {contribLoading ? (
        <VStack alignItems="center" justifyContent="center" py="$xl" style={{ minHeight: 200 }}>
          <ActivityIndicator color={theme.colors.gray400} />
          <Text fontSize="$sm" style={[{ fontFamily: PF.regular }, { color: theme.colors.gray400 }]} mt="$sm">
            {t("common.loading")}
          </Text>
        </VStack>
      ) : data.length === 0 ? (
        <VStack alignItems="center" justifyContent="center" py="$xl" style={{ minHeight: 200 }}>
          <Ionicons name={emptyIcons[contribSubTab] as any} size={24} color={theme.colors.gray300} />
          <Text style={[{ fontFamily: PF.regular }, { color: theme.colors.gray400 }]} mt="$md">
            {emptyTexts[contribSubTab]}
          </Text>
        </VStack>
      ) : (
        (() => {
          const cards = data.map((item) => buildContribCard(item, contribSubTab));
          const columns = splitIntoMasonryColumns(
            cards,
            ({ post }) => post.content?.images?.[0] || post.image
          );
          return (
            <HStack px="$md" pt="$sm" alignItems="flex-start" space="sm">
              {columns.map((column, colIndex) => (
                <VStack key={colIndex} flex={1} space="sm">
                  {column.map(({ post, onPress }) => (
                    <PostCard key={post.id} post={post} onPress={onPress} />
                  ))}
                </VStack>
              ))}
            </HStack>
          );
        })()
      )}
    </VStack>
  );
};

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const StoreImageOrPlaceholder = ({ uri }: { uri?: string }) => {
  const theme = useAppTheme();
  const storeActivityStyles = useStoreActivityStyles();
  if (uri) {
    return <Image source={{ uri }} style={storeActivityStyles.storeImage} resizeMode="cover" />;
  }
  return (
    <View style={storeActivityStyles.storeImagePlaceholder}>
      <Ionicons name="storefront-outline" size={24} color={theme.colors.gray300} />
    </View>
  );
};

const StarRating = ({ rating }: { rating: number }) => {
  const storeActivityStyles = useStoreActivityStyles();
  const fullStars = Math.floor(rating);
  const hasHalf = rating % 1 >= 0.5;
  const stars = [];
  for (let i = 0; i < fullStars; i++) stars.push(<Ionicons key={`f${i}`} name="star" size={14} color="#F5A623" />);
  if (hasHalf) stars.push(<Ionicons key="h" name="star-half" size={14} color="#F5A623" />);
  const empty = 5 - fullStars - (hasHalf ? 1 : 0);
  for (let i = 0; i < empty; i++) stars.push(<Ionicons key={`e${i}`} name="star-outline" size={14} color="#F5A623" />);
  return <View style={storeActivityStyles.ratingRow}>{stars}</View>;
};

const StoreActivityContent = ({
  storeActivitySubTab,
  setStoreActivitySubTab,
  storeActivity,
  storeActivityLoading,
  onStoreActivityPress,
  productActivitySubTab,
  setProductActivitySubTab,
  productLikes,
  productSaved,
  productWanted,
  loadProductActivity,
  onProductPress,
}: {
  storeActivitySubTab: StoreActivitySubTab;
  setStoreActivitySubTab: (tab: StoreActivitySubTab) => void;
  storeActivity: UserStoreActivity | null;
  storeActivityLoading: boolean;
  onStoreActivityPress: (storeId: string) => void;
  productActivitySubTab: ProductActivitySubTab;
  setProductActivitySubTab: (tab: ProductActivitySubTab) => void;
  productLikes: ProductListState;
  productSaved: ProductListState;
  productWanted: ProductListState;
  loadProductActivity: (sub: ProductActivitySubTab, force?: boolean) => Promise<void> | void;
  onProductPress: (productId: number) => void;
}) => {
  const { t } = useTranslation();
  const storeActivityStyles = useStoreActivityStyles();
  const styles = useProfileStyles();
  const profileLoadingGif = useProfileLoadingGif();
  // 4 个一级 chip：前 3 个店铺级活动 + 第 4 个"商品"展开 3 个 sub-sub-tab
  const productTotal =
    productLikes.total + productSaved.total + productWanted.total;
  const subTabs: { id: StoreActivitySubTab; label: string; count: number }[] = [
    { id: "favorites", label: t("profileStoreActivity.favorites"), count: storeActivity?.favoritesTotal ?? 0 },
    { id: "comments", label: t("profileStoreActivity.comments"), count: storeActivity?.commentsTotal ?? 0 },
    { id: "ratings", label: t("profileStoreActivity.ratings"), count: storeActivity?.ratingsTotal ?? 0 },
    { id: "products", label: t("profileStoreActivity.products"), count: productTotal },
  ];

  // 切到 products 时按需加载当前选中的 sub-sub-tab
  useEffect(() => {
    if (storeActivitySubTab !== "products") return;
    loadProductActivity(productActivitySubTab);
  }, [storeActivitySubTab, productActivitySubTab, loadProductActivity]);

  const renderFavorite = (item: UserFavoritedStore) => (
    <Pressable key={item.storeId} style={storeActivityStyles.card} onPress={() => onStoreActivityPress(item.storeId)}>
      <StoreImageOrPlaceholder uri={item.storeImage} />
      <View style={storeActivityStyles.cardBody}>
        <RNText style={storeActivityStyles.storeName} numberOfLines={1}>{item.storeName}</RNText>
        <RNText style={storeActivityStyles.storeLocation}>{item.storeCity}, {item.storeCountry}</RNText>
        <View style={storeActivityStyles.metaRow}>
          <Ionicons name="heart" size={12} color={theme.colors.error} />
          <RNText style={storeActivityStyles.metaText}>{formatDate(item.createdAt)}</RNText>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={16} color={theme.colors.gray300} />
    </Pressable>
  );

  const renderComment = (item: UserStoreCommentItem) => (
    <Pressable key={`cmt-${item.commentId}`} style={storeActivityStyles.card} onPress={() => onStoreActivityPress(item.storeId)}>
      <StoreImageOrPlaceholder uri={item.storeImage} />
      <View style={storeActivityStyles.cardBody}>
        <RNText style={storeActivityStyles.storeName} numberOfLines={1}>{item.storeName}</RNText>
        <RNText style={storeActivityStyles.commentContent} numberOfLines={2}>{item.content}</RNText>
        <View style={storeActivityStyles.metaRow}>
          <Ionicons name="heart-outline" size={12} color={theme.colors.gray400} />
          <RNText style={storeActivityStyles.metaText}>{item.likeCount}</RNText>
          <RNText style={storeActivityStyles.metaText}>{formatDate(item.createdAt)}</RNText>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={16} color={theme.colors.gray300} />
    </Pressable>
  );

  const renderRating = (item: UserStoreRatingItem) => (
    <Pressable key={`rat-${item.storeId}`} style={storeActivityStyles.card} onPress={() => onStoreActivityPress(item.storeId)}>
      <StoreImageOrPlaceholder uri={item.storeImage} />
      <View style={storeActivityStyles.cardBody}>
        <RNText style={storeActivityStyles.storeName} numberOfLines={1}>{item.storeName}</RNText>
        <RNText style={storeActivityStyles.storeLocation}>{item.storeCity}, {item.storeCountry}</RNText>
        <View style={storeActivityStyles.metaRow}>
          <StarRating rating={item.rating} />
          <RNText style={storeActivityStyles.ratingText}>{item.rating}</RNText>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={16} color={theme.colors.gray300} />
    </Pressable>
  );

  const getEmptyInfo = (): { icon: string; text: string } => {
    switch (storeActivitySubTab) {
      case "favorites": return { icon: "heart-outline", text: t("profileStoreActivity.noFavorites") };
      case "comments": return { icon: "chatbubble-outline", text: t("profileStoreActivity.noComments") };
      case "ratings": return { icon: "star-outline", text: t("profileStoreActivity.noRatings") };
      case "products": return { icon: "cube-outline", text: "" }; // 走 products 自己的空态
    }
  };

  const renderList = () => {
    if (!storeActivity) return null;
    switch (storeActivitySubTab) {
      case "favorites": return storeActivity.favorites.map(renderFavorite);
      case "comments": return storeActivity.comments.map(renderComment);
      case "ratings": return storeActivity.ratings.map(renderRating);
      case "products": return null; // products 分支由 ProductActivityContent 接管
    }
  };

  const getDataLength = () => {
    if (!storeActivity) return 0;
    switch (storeActivitySubTab) {
      case "favorites": return storeActivity.favorites.length;
      case "comments": return storeActivity.comments.length;
      case "ratings": return storeActivity.ratings.length;
      case "products": return 0; // products 自己处理
    }
  };

  const empty = getEmptyInfo();

  return (
    <VStack>
      <View
        style={{
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
        }}
      >
        <View style={chipRowStyle}>
          {subTabs.map((st) => (
            <AnimatedChip
              key={st.id}
              label={st.label}
              count={st.count}
              showZeroCount
              isActive={storeActivitySubTab === st.id}
              onPress={() => setStoreActivitySubTab(st.id)}
            />
          ))}
        </View>
      </View>

      {storeActivitySubTab === "products" ? (
        <ProductActivityContent
          productActivitySubTab={productActivitySubTab}
          setProductActivitySubTab={setProductActivitySubTab}
          productLikes={productLikes}
          productSaved={productSaved}
          productWanted={productWanted}
          onProductPress={onProductPress}
        />
      ) : storeActivityLoading ? (
        // 用 RNImage（绕过 gluestack Image 默认 width:100%/height:auto），
        // 让 GIF 用 styles.profileLoadingGif 撑满整个 tab 内容区。
        <RNImage
          source={profileLoadingGif}
          style={styles.profileLoadingGif}
          resizeMode="cover"
        />
      ) : getDataLength() === 0 ? (
        <VStack alignItems="center" justifyContent="center" py="$sm" style={{ minHeight: 200 }}>
          <Ionicons name={empty.icon as any} size={24} color={theme.colors.gray300} />
          <Text style={[{ fontFamily: PF.regular }, { color: theme.colors.gray400 }]} mt="$md">
            {empty.text}
          </Text>
        </VStack>
      ) : (
        <VStack py="$sm">{renderList()}</VStack>
      )}
    </VStack>
  );
};

// ============================================================================
// ProductActivityContent —— Stores tab 下「商品」二级 tab 内的三层 sub-sub-tab。
// 与 StoreActivityContent 同行 chip 风格，但渲染商品卡片网格（2 列）。
// ============================================================================

const ProductActivityContent = ({
  productActivitySubTab,
  setProductActivitySubTab,
  productLikes,
  productSaved,
  productWanted,
  onProductPress,
}: {
  productActivitySubTab: ProductActivitySubTab;
  setProductActivitySubTab: (tab: ProductActivitySubTab) => void;
  productLikes: ProductListState;
  productSaved: ProductListState;
  productWanted: ProductListState;
  onProductPress: (productId: number) => void;
}) => {
  const { t } = useTranslation();
  const productGridStyles = useThemedStyles(makeProductGridStyles);
  const subSubTabs: { id: ProductActivitySubTab; label: string; count: number }[] = [
    { id: "likes", label: t("profileProductActivity.likes"), count: productLikes.total },
    { id: "saved", label: t("profileProductActivity.saved"), count: productSaved.total },
    { id: "wishlist", label: t("profileProductActivity.wishlist"), count: productWanted.total },
  ];

  const current =
    productActivitySubTab === "likes"
      ? productLikes
      : productActivitySubTab === "saved"
        ? productSaved
        : productWanted;

  const emptyText =
    productActivitySubTab === "likes"
      ? t("profileProductActivity.noLikes")
      : productActivitySubTab === "saved"
        ? t("profileProductActivity.noSaved")
        : t("profileProductActivity.noWishlist");
  const emptyIcon =
    productActivitySubTab === "likes"
      ? "heart-outline"
      : productActivitySubTab === "saved"
        ? "bookmark-outline"
        : "bag-handle-outline";

  return (
    <VStack>
      {/* 内层 chip 行 —— 视觉上比外层稍轻，背景灰条暗示嵌套关系 */}
      <View
        style={{
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
          backgroundColor: theme.colors.gray50,
        }}
      >
        <View style={chipRowStyle}>
          {subSubTabs.map((st) => (
            <AnimatedChip
              key={st.id}
              label={st.label}
              count={st.count}
              showZeroCount
              isActive={productActivitySubTab === st.id}
              onPress={() => setProductActivitySubTab(st.id)}
            />
          ))}
        </View>
      </View>

      {current.isLoading && !current.hasLoaded ? (
        <VStack alignItems="center" justifyContent="center" py="$xl" style={{ minHeight: 200 }}>
          <ActivityIndicator color={theme.colors.gray400} />
        </VStack>
      ) : current.products.length === 0 ? (
        <VStack alignItems="center" justifyContent="center" py="$xl" style={{ minHeight: 200 }}>
          <Ionicons name={emptyIcon as any} size={24} color={theme.colors.gray300} />
          <Text style={[{ fontFamily: PF.regular }, { color: theme.colors.gray400 }]} mt="$md">
            {emptyText}
          </Text>
        </VStack>
      ) : (
        <View style={productGridStyles.grid}>
          {current.products.map((p) => (
            <ProductGridCard key={p.id} product={p} onPress={() => onProductPress(p.id)} />
          ))}
        </View>
      )}
    </VStack>
  );
};

// 复用 StoreProductListScreen 的 2 列卡片视觉，但本地实现一份 —— 那一屏用的是
// 屏幕宽度计算 CARD_WIDTH，profile 容器宽度可能不同；这里改用 flex:1 自适应。
const ProductGridCard: React.FC<{ product: StoreProduct; onPress: () => void }> = ({
  product,
  onPress,
}) => {
  const productGridStyles = useThemedStyles(makeProductGridStyles);
  const formatPrice = useFormatPrice();
  const cover = product.images?.[0];
  const hasDiscount =
    product.discountPriceCents != null &&
    product.discountPriceCents < product.priceCents;
  return (
    <Pressable onPress={onPress} style={productGridStyles.card}>
      <View style={productGridStyles.cardCover}>
        {cover ? (
          <OptimizedImage
            uri={cover}
            size={ImageSize.MEDIUM}
            style={productGridStyles.cardImage}
            contentFit="cover"
            lazy
          />
        ) : (
          <View style={productGridStyles.cardImagePlaceholder}>
            <Ionicons name="image-outline" size={32} color={theme.colors.gray300} />
          </View>
        )}
        {product.isNew && !hasDiscount && (
          <View style={[productGridStyles.badge, productGridStyles.badgeNew]}>
            <RNText style={productGridStyles.badgeText}>NEW</RNText>
          </View>
        )}
        {hasDiscount && (
          <View style={[productGridStyles.badge, productGridStyles.badgeSale]}>
            <RNText style={[productGridStyles.badgeText, { color: "#FFFFFF" }]}>SALE</RNText>
          </View>
        )}
      </View>
      <VStack px="$sm" py="$sm" gap={3}>
        <Text
          fontSize={13}
          fontWeight="$semibold"
          style={[{ fontFamily: PF.medium }, { color: theme.colors.black }]}
          numberOfLines={2}

        >
          {product.title}
        </Text>
        {!!product.brand && (
          <Text fontSize={10} style={[{ fontFamily: PF.regular }, { color: theme.colors.gray400 }]} numberOfLines={1}>
            {product.brand}
          </Text>
        )}
        <HStack alignItems="baseline" gap={6} mt={2}>
          <Text
            fontSize={13}
            fontWeight="$bold"
            style={[{ fontFamily: PF.bold }, { color: hasDiscount ? theme.colors.error : theme.colors.black }]}

          >
            {formatPrice(
              hasDiscount
                ? (product.discountPriceCents as number)
                : product.priceCents,
              product.currency
            )}
          </Text>
          {hasDiscount && (
            <Text
              fontSize={11}
              style={[{ textDecorationLine: "line-through", fontFamily: PF.regular }, { color: theme.colors.gray300 }]}

            >
              {formatPrice(product.priceCents, product.currency)}
            </Text>
          )}
        </HStack>
      </VStack>
    </Pressable>
  );
};

const makeProductGridStyles = (t: AppTheme) =>
  StyleSheet.create({
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      paddingHorizontal: 12,
      paddingVertical: 12,
      gap: 12,
    },
    card: {
      width: "47.5%",
      backgroundColor: t.colors.card,
      borderRadius: 12,
      overflow: "hidden",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
    },
    cardCover: {
      width: "100%",
      aspectRatio: 1,
      backgroundColor: t.colors.skeleton,
      position: "relative",
    },
    cardImage: {
      width: "100%",
      height: "100%",
    },
    cardImagePlaceholder: {
      width: "100%",
      height: "100%",
      justifyContent: "center",
      alignItems: "center",
    },
    badge: {
      position: "absolute",
      top: 8,
      left: 8,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    badgeNew: {
      backgroundColor: t.colors.text,
    },
    badgeSale: {
      backgroundColor: t.colors.error,
    },
    badgeText: {
      fontSize: 10,
      fontWeight: "700",
      color: t.colors.textInverted,
      fontFamily: PF.bold,
    },
  });

export const PostsContent = ({
  activeTab,
  tabsData,
  contribSubTab,
  setContribSubTab,
  contribLoading,
  myShows,
  myBrands,
  myStores,
  storeActivitySubTab,
  setStoreActivitySubTab,
  storeActivity,
  storeActivityLoading,
  productActivitySubTab,
  setProductActivitySubTab,
  productLikes,
  productSaved,
  productWanted,
  loadProductActivity,
  onProductPress,
  user,
  onPostPress,
  onDeletePost,
  onShowPress,
  onBrandSubmissionPress,
  onStoreCardPress,
  onStoreActivityPress,
  onLike,
}: PostsContentProps) => {
  const { t } = useTranslation();
  const styles = useProfileStyles();
  const theme = useAppTheme();
  // 之前 dark mode 下用 ActivityIndicator 兜底,因为浅色 GIF 砸在暗色页面里
  // 是一大块刺眼白底; 现在用 useProfileLoadingGif 自动按主题切深/浅版本,
  // 两端都保留品牌动画体验。
  const profileLoadingGif = useProfileLoadingGif();
  if (activeTab === "storeActivity") {
    return (
      <StoreActivityContent
        storeActivitySubTab={storeActivitySubTab}
        setStoreActivitySubTab={setStoreActivitySubTab}
        storeActivity={storeActivity}
        storeActivityLoading={storeActivityLoading}
        onStoreActivityPress={onStoreActivityPress}
        productActivitySubTab={productActivitySubTab}
        setProductActivitySubTab={setProductActivitySubTab}
        productLikes={productLikes}
        productSaved={productSaved}
        productWanted={productWanted}
        loadProductActivity={loadProductActivity}
        onProductPress={onProductPress}
      />
    );
  }

  if (activeTab === "archive") {
    return (
      <ContributionContent
        contribSubTab={contribSubTab}
        setContribSubTab={setContribSubTab}
        contribLoading={contribLoading}
        myShows={myShows}
        myBrands={myBrands}
        myStores={myStores}
        user={user}
        onShowPress={onShowPress}
        onBrandSubmissionPress={onBrandSubmissionPress}
        onStoreCardPress={onStoreCardPress}
      />
    );
  }

  const currentTabData = tabsData[activeTab as Exclude<TabType, "archive">];
  const shouldShowLoading = currentTabData.isLoading && !currentTabData.hasLoaded;

  if (shouldShowLoading) {
    // 用 RNImage（绕过 gluestack Image 默认 width:100%/height:auto），
    // 让 GIF 用 styles.profileLoadingGif 撑满整个 tab 内容区。
    return (
      <RNImage
        source={profileLoadingGif}
        style={styles.profileLoadingGif}
        resizeMode="cover"
      />
    );
  }

  if (currentTabData.posts.length > 0) {
    if (activeTab === "forum") {
      return (
        <View style={{ width: '100%' }}>
          {currentTabData.posts.map((post) => (
            <Pressable
              key={post.id}
              onPress={() => onPostPress(post)}
              onLongPress={() => onDeletePost(post)}
              style={{ width: '100%' }}
            >
              <ForumPostCard post={post} onPress={() => onPostPress(post)} />
            </Pressable>
          ))}
        </View>
      );
    }

    // Two-column masonry — each column flows independently so cards with
    // different natural heights don't leave a gap at the top of a row like
    // a flex-wrap grid does. Long-press on editable tabs still triggers
    // delete; the outer Pressable sits inside the column and gets the
    // natural card width via flex.
    const postColumns = splitIntoMasonryColumns(
      currentTabData.posts,
      (post) => post.content?.images?.[0] || post.image
    );
    const isEditableTab =
      activeTab === "published" ||
      activeTab === "draft" ||
      activeTab === "pending";
    return (
      <HStack px="$md" pt="$sm" alignItems="flex-start" space="sm">
        {postColumns.map((column, colIndex) => (
          <VStack key={colIndex} flex={1} space="sm">
            {column.map((post) => (
              <Pressable
                key={post.id}
                onPress={() => onPostPress(post)}
                onLongPress={
                  isEditableTab ? () => onDeletePost(post) : undefined
                }
              >
                <PostCard post={post} onPress={() => onPostPress(post)} onLike={onLike} />
              </Pressable>
            ))}
          </VStack>
        ))}
      </HStack>
    );
  }

  if (currentTabData.hasLoaded) {
    return (
      <VStack alignItems="center" justifyContent="center" py="$xl" style={{ minHeight: 200 }}>
        <Ionicons
          name={
            activeTab === "saved" ? "bookmark-outline" :
              activeTab === "liked" ? "heart-outline" :
                activeTab === "pending" ? "time-outline" :
                  activeTab === "forum" ? "chatbubbles-outline" :
                    activeTab === "wishlist" ? "bag-handle-outline" : "document-text-outline"
          }
          size={24}
          color={theme.colors.gray300}
        />
        <Text style={[{ fontFamily: PF.regular, textAlign: "center" }, { color: theme.colors.gray400 }]} mt="$md">
          {activeTab === "published" && t("profile.noPublishedPosts")}
          {activeTab === "pending" && t("profile.noPendingPosts")}
          {activeTab === "draft" && t("profile.noDrafts")}
          {activeTab === "saved" && t("profile.noSavedPosts")}
          {activeTab === "liked" && t("profile.noLikedPosts")}
          {activeTab === "forum" && t("profile.noForumPosts")}
          {activeTab === "wishlist" && t("profile.noWishlist")}
        </Text>
      </VStack>
    );
  }

  return null;
};
