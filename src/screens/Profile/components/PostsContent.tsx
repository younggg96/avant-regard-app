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
import { TabType, TabData, ContribSubTab } from "../types";
import { Show } from "../../../services/showService";
import { BrandSubmission } from "../../../services/brandService";
import { UserSubmittedStore } from "../../../services/buyerStoreService";
import { contribStyles, styles } from "../styles";

interface PostsContentProps {
  activeTab: TabType;
  tabsData: Record<TabType, TabData>;
  contribSubTab: ContribSubTab;
  setContribSubTab: (tab: ContribSubTab) => void;
  contribLoading: boolean;
  myShows: Show[];
  myBrands: BrandSubmission[];
  myStores: UserSubmittedStore[];
  user: { userId?: number; username?: string; avatar?: string } | null;
  onPostPress: (post: DisplayPost) => void;
  onDeletePost: (post: DisplayPost) => void;
  onShowPress: (show: Show) => void;
  onBrandSubmissionPress: (sub: BrandSubmission) => void;
  onStoreCardPress: (store: UserSubmittedStore) => void;
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

export const PostsContent = ({
  activeTab,
  tabsData,
  contribSubTab,
  setContribSubTab,
  contribLoading,
  myShows,
  myBrands,
  myStores,
  user,
  onPostPress,
  onDeletePost,
  onShowPress,
  onBrandSubmissionPress,
  onStoreCardPress,
}: PostsContentProps) => {
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
