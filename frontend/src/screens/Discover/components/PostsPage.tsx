/**
 * 「帖子」顶部 Tab —— 内部二级切换：推荐 / 关注。
 *
 * 「推荐 / 关注」原为并列的一级 Tab，信息架构重构后下沉为「帖子」的二级
 * 切换。两个子 Tab 都复用现有的 `TabContent`（瀑布流实现），并同时挂载
 * （用 display 切换可见性）以保留各自的滚动位置与推荐流的无限加载状态。
 */
import React, { useMemo } from "react";
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { Post } from "../../../components/PostCard";
import { Banner } from "../../../services/bannerService";
import { CommunityListResponse } from "../../../services/communityService";
import { TabContent } from "./TabContent";
import { DiscoverSubTabBar } from "./DiscoverSubTabBar";
import { SCREEN_WIDTH } from "../constants";
import type { DisplayPost, PostsSubTab } from "../types";

interface PostsPageProps {
  isActive: boolean;
  subTab: PostsSubTab;
  onSubTabChange: (tab: PostsSubTab) => void;

  recommendPosts: DisplayPost[];
  followingPosts: DisplayPost[];
  banners: Banner[];
  communities: CommunityListResponse | null;
  error: string | null;
  refreshing: boolean;
  tabLoading: { recommend: boolean; following: boolean };
  tabLoaded: { recommend: boolean; following: boolean };

  onRefresh: () => void;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onPostPress: (post: Post) => void;
  onAuthorPress: (authorId: string) => void;
  onLike: (postId: string) => void;
  onBannerPress: (banner: Banner) => void;

  /** 推荐流无限滚动 */
  onEndReached: () => void;
  loadingMore: boolean;
  /** 推荐流回到顶部信号（双击「帖子」Tab / 下拉刷新时递增） */
  scrollToTopSignal: number;
}

const PostsPageImpl: React.FC<PostsPageProps> = ({
  isActive,
  subTab,
  onSubTabChange,
  recommendPosts,
  followingPosts,
  banners,
  communities,
  error,
  refreshing,
  tabLoading,
  tabLoaded,
  onRefresh,
  onScroll,
  onPostPress,
  onAuthorPress,
  onLike,
  onBannerPress,
  onEndReached,
  loadingMore,
  scrollToTopSignal,
}) => {
  const { t } = useTranslation();

  const subTabs = useMemo<{ id: PostsSubTab; label: string }[]>(
    () => [
      { id: "recommend", label: t("discover.recommend") },
      { id: "following", label: t("discover.follow") },
    ],
    [t]
  );

  return (
    <View style={styles.root}>
      <DiscoverSubTabBar<PostsSubTab>
        tabs={subTabs}
        activeTab={subTab}
        onTabPress={onSubTabChange}
      />
      <View style={styles.body}>
        <View
          style={[
            StyleSheet.absoluteFill,
            { display: subTab === "recommend" ? "flex" : "none" },
          ]}
        >
          <TabContent
            tab="recommend"
            tabPosts={recommendPosts}
            banners={banners}
            communities={communities}
            error={error}
            refreshing={refreshing}
            tabLoading={tabLoading.recommend}
            tabLoaded={tabLoaded.recommend}
            isActive={isActive && subTab === "recommend"}
            onRefresh={onRefresh}
            onScroll={onScroll}
            onPostPress={onPostPress}
            onAuthorPress={onAuthorPress}
            onLike={onLike}
            onBannerPress={onBannerPress}
            onEndReached={onEndReached}
            loadingMore={loadingMore}
            scrollToTopSignal={scrollToTopSignal}
          />
        </View>
        <View
          style={[
            StyleSheet.absoluteFill,
            { display: subTab === "following" ? "flex" : "none" },
          ]}
        >
          <TabContent
            tab="following"
            tabPosts={followingPosts}
            banners={banners}
            communities={communities}
            error={error}
            refreshing={refreshing}
            tabLoading={tabLoading.following}
            tabLoaded={tabLoaded.following}
            isActive={isActive && subTab === "following"}
            onRefresh={onRefresh}
            onScroll={onScroll}
            onPostPress={onPostPress}
            onAuthorPress={onAuthorPress}
            onLike={onLike}
            onBannerPress={onBannerPress}
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { width: SCREEN_WIDTH, flex: 1 },
  body: { flex: 1 },
});

export const PostsPage = React.memo(PostsPageImpl);

export default PostsPage;
