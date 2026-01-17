import { useCallback } from "react";
import { Post, ShowImageInfo } from "../../PostCard";

interface UseNavigationHandlersOptions {
  post: Post | null;
  navigation: { navigate: (...args: any[]) => void };
}

interface UseNavigationHandlersReturn {
  handleAuthorPress: () => void;
  handleUserPress: (userId: number, userName: string, userAvatar: string) => void;
  handleLookPress: (showImage: ShowImageInfo) => void;
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

  // 处理关联造型点击
  const handleLookPress = useCallback(
    (showImage: ShowImageInfo) => {
      navigation.navigate("LookDetail", {
        imageId: showImage.id,
        imageUrl: showImage.imageUrl,
        brandName: showImage.brandName,
        season: showImage.season,
      });
    },
    [navigation]
  );

  return {
    handleAuthorPress,
    handleUserPress,
    handleLookPress,
  };
};
