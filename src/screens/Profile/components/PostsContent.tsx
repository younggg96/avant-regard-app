import React from "react";
import { View, Text as RNText, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../../theme";
import {
  Box,
  Text,
  Pressable,
  VStack,
  HStack,
  Image,
} from "../../../components/ui";
import PostCard, { Post as DisplayPost } from "../../../components/PostCard";
import ForumPostCard from "../../../components/ForumPostCard";
import { TabType, TabData, ContribSubTab, StoreActivitySubTab } from "../types";
import { Show } from "../../../services/showService";
import { BrandSubmission } from "../../../services/brandService";
import {
  UserSubmittedStore,
  UserStoreActivity,
  UserFavoritedStore,
  UserStoreCommentItem,
  UserStoreRatingItem,
} from "../../../services/buyerStoreService";
import { contribStyles, storeActivityStyles, styles } from "../styles";

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
  user: { userId?: number; username?: string; avatar?: string } | null;
  onPostPress: (post: DisplayPost) => void;
  onDeletePost: (post: DisplayPost) => void;
  onShowPress: (show: Show) => void;
  onBrandSubmissionPress: (sub: BrandSubmission) => void;
  onStoreCardPress: (store: UserSubmittedStore) => void;
  onStoreActivityPress: (storeId: string) => void;
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
  const subTabs: { id: ContribSubTab; label: string; count: number }[] = [
    { id: "show", label: "秀场", count: myShows.length },
    { id: "brand", label: "品牌", count: myBrands.length },
    { id: "store", label: "买手店", count: myStores.length },
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
    show: "暂无秀场贡献",
    brand: "暂无品牌贡献",
    store: "暂无买手店贡献",
  };

  const renderCard = (item: any, type: ContribSubTab) => {
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

    return (
      <Box key={key} width="48%" mb="$md">
        <PostCard post={post} onPress={() => onPress()} />
      </Box>
    );
  };

  return (
    <VStack>
      <HStack px="$md" py="$sm" style={{ gap: 8 }}>
        {subTabs.map((st) => {
          const isActive = contribSubTab === st.id;
          return (
            <Pressable
              key={st.id}
              style={[contribStyles.filterChip, isActive && contribStyles.filterChipActive]}
              onPress={() => setContribSubTab(st.id)}
            >
              <RNText style={[contribStyles.filterChipText, isActive && contribStyles.filterChipTextActive]}>
                {st.label}
              </RNText>
              <RNText style={[contribStyles.filterChipCount, isActive && contribStyles.filterChipCountActive]}>
                {st.count}
              </RNText>
            </Pressable>
          );
        })}
      </HStack>

      {contribLoading ? (
        <VStack alignItems="center" justifyContent="center" py="$xl" style={{ minHeight: 200 }}>
          <ActivityIndicator color={theme.colors.gray400} />
          <Text fontSize="$sm" color="$gray400" mt="$sm">加载中...</Text>
        </VStack>
      ) : data.length === 0 ? (
        <VStack alignItems="center" justifyContent="center" py="$xl" style={{ minHeight: 200 }}>
          <Ionicons name={emptyIcons[contribSubTab] as any} size={24} color={theme.colors.gray300} />
          <Text color="$gray400" mt="$md">{emptyTexts[contribSubTab]}</Text>
        </VStack>
      ) : (
        <HStack flexWrap="wrap" px="$md" pt="$sm" justifyContent="space-between">
          {data.map((item) => renderCard(item, contribSubTab))}
        </HStack>
      )}
    </VStack>
  );
};

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const StoreImageOrPlaceholder = ({ uri }: { uri?: string }) => {
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
}: {
  storeActivitySubTab: StoreActivitySubTab;
  setStoreActivitySubTab: (tab: StoreActivitySubTab) => void;
  storeActivity: UserStoreActivity | null;
  storeActivityLoading: boolean;
  onStoreActivityPress: (storeId: string) => void;
}) => {
  const subTabs: { id: StoreActivitySubTab; label: string; count: number }[] = [
    { id: "favorites", label: "收藏", count: storeActivity?.favoritesTotal ?? 0 },
    { id: "comments", label: "评论", count: storeActivity?.commentsTotal ?? 0 },
    { id: "ratings", label: "评分", count: storeActivity?.ratingsTotal ?? 0 },
  ];

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
      case "favorites": return { icon: "heart-outline", text: "还没有收藏的买手店" };
      case "comments": return { icon: "chatbubble-outline", text: "还没有评论买手店" };
      case "ratings": return { icon: "star-outline", text: "还没有评分买手店" };
    }
  };

  const renderList = () => {
    if (!storeActivity) return null;
    switch (storeActivitySubTab) {
      case "favorites": return storeActivity.favorites.map(renderFavorite);
      case "comments": return storeActivity.comments.map(renderComment);
      case "ratings": return storeActivity.ratings.map(renderRating);
    }
  };

  const getDataLength = () => {
    if (!storeActivity) return 0;
    switch (storeActivitySubTab) {
      case "favorites": return storeActivity.favorites.length;
      case "comments": return storeActivity.comments.length;
      case "ratings": return storeActivity.ratings.length;
    }
  };

  const empty = getEmptyInfo();

  return (
    <VStack>
      <HStack px="$md" py="$sm" style={{ gap: 8 }}>
        {subTabs.map((st) => {
          const isActive = storeActivitySubTab === st.id;
          return (
            <Pressable
              key={st.id}
              style={[contribStyles.filterChip, isActive && contribStyles.filterChipActive]}
              onPress={() => setStoreActivitySubTab(st.id)}
            >
              <RNText style={[contribStyles.filterChipText, isActive && contribStyles.filterChipTextActive]}>
                {st.label}
              </RNText>
              <RNText style={[contribStyles.filterChipCount, isActive && contribStyles.filterChipCountActive]}>
                {st.count}
              </RNText>
            </Pressable>
          );
        })}
      </HStack>

      {storeActivityLoading ? (
        <VStack alignItems="center" justifyContent="center" py="$xl" style={{ minHeight: 200 }}>
          <Image
            source={require("../../../../assets/gif/profile-loading.gif")}
            style={styles.profileLoadingGif}
            resizeMode="contain"
          />
        </VStack>
      ) : getDataLength() === 0 ? (
        <VStack alignItems="center" justifyContent="center" py="$sm" style={{ minHeight: 200 }}>
          <Ionicons name={empty.icon as any} size={24} color={theme.colors.gray300} />
          <Text color="$gray400" mt="$md">{empty.text}</Text>
        </VStack>
      ) : (
        <VStack py="$sm">{renderList()}</VStack>
      )}
    </VStack>
  );
};

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
  user,
  onPostPress,
  onDeletePost,
  onShowPress,
  onBrandSubmissionPress,
  onStoreCardPress,
  onStoreActivityPress,
}: PostsContentProps) => {
  if (activeTab === "storeActivity") {
    return (
      <StoreActivityContent
        storeActivitySubTab={storeActivitySubTab}
        setStoreActivitySubTab={setStoreActivitySubTab}
        storeActivity={storeActivity}
        storeActivityLoading={storeActivityLoading}
        onStoreActivityPress={onStoreActivityPress}
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
    return (
      <VStack alignItems="center" justifyContent="center" py="$xl" style={{ minHeight: 200 }}>
        <Image
          source={require("../../../../assets/gif/profile-loading.gif")}
          style={styles.profileLoadingGif}
          resizeMode="contain"
        />
      </VStack>
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

    return (
      <HStack flexWrap="wrap" px="$md" pt="$sm" justifyContent="space-between">
        {currentTabData.posts.map((post) => (
          <Box key={post.id} width="48%" mb="$md">
            <Pressable
              onPress={() => onPostPress(post)}
              onLongPress={() => {
                if (activeTab === "published" || activeTab === "draft" || activeTab === "pending") {
                  onDeletePost(post);
                }
              }}
            >
              <PostCard post={post} onPress={() => onPostPress(post)} />
            </Pressable>
          </Box>
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
        <Text color="$gray400" mt="$md">
          {activeTab === "published" && "还没有发布内容"}
          {activeTab === "pending" && "没有待审核的帖子"}
          {activeTab === "draft" && "还没有草稿"}
          {activeTab === "saved" && "还没有收藏帖子"}
          {activeTab === "liked" && "还没有点赞帖子"}
          {activeTab === "forum" && "还没有论坛帖子"}
          {activeTab === "wishlist" && "还没有想要的单品"}
        </Text>
      </VStack>
    );
  }

  return null;
};
