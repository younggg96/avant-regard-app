import { useCallback } from "react";
import { Post } from "../../PostCard";
import { Show } from "../../../services/showService";
import { Brand } from "../../../services/brandService";

interface UseNavigationHandlersOptions {
  post: Post | null;
  navigation: { navigate: (...args: any[]) => void };
}

interface UseNavigationHandlersReturn {
  handleAuthorPress: () => void;
  handleUserPress: (userId: number, userName: string, userAvatar: string) => void;
  handleShowPress: (show: Show) => void;
  handleBrandPress: (brand: Brand) => void;
}

/**
 * 管理导航相关操作
 */
export const useNavigationHandlers = ({
  post,
  navigation,
}: UseNavigationHandlersOptions): UseNavigationHandlersReturn => {
  // 处理点击作者头像
  const handleAuthorPress = useCallback(() => {
    if (!post?.author?.id) return;
    navigation.navigate("UserProfile", {
      userId: parseInt(post.author.id, 10),
      username: post.author.name,
      avatar: post.author.avatar,
    });
  }, [navigation, post]);

  // 处理用户点击（评论区）
  const handleUserPress = useCallback(
    (userId: number, userName: string, userAvatar: string) => {
      navigation.navigate("UserProfile", {
        userId,
        username: userName,
        avatar: userAvatar,
      });
    },
    [navigation]
  );

  const handleShowPress = useCallback(
    (show: Show) => {
      // Navigate to CollectionDetail
      (navigation.navigate as any)("CollectionDetail", {
        collection: {
          id: show.id.toString(),
          title: show.brand,
          season: show.season,
          year: show.year?.toString() || "",
          coverImage: show.coverImage,
          showUrl: show.showUrl,
        },
        brandName: show.brand,
      });
    },
    [navigation]
  );

  const handleBrandPress = useCallback(
    (brand: Brand) => {
      // Navigate to BrandDetail
      (navigation.navigate as any)("BrandDetail", {
        brandId: brand.id,
        brandName: brand.name,
      });
    },
    [navigation]
  );

  return {
    handleAuthorPress,
    handleUserPress,
    handleShowPress,
    handleBrandPress,
  };
};
