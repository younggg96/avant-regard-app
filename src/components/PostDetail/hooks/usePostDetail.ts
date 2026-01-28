import { useState, useCallback, useEffect } from "react";
import { Post } from "../../PostCard";
import { postService, Post as ApiPost } from "../../../services/postService";
import { showService, Show } from "../../../services/showService";
import { userInfoService } from "../../../services/userInfoService";
import { PostDetailRouteParams, PostStatus } from "../types";

/**
 * 将 API 返回的 Post 转换为 UI 使用的 Post 格式
 */
export const convertApiPostToUiPost = async (
  apiPost: ApiPost,
  userInfo?: { username?: string; avatarUrl?: string }
): Promise<Post> => {
  // 获取关联秀场的完整信息
  let shows: Show[] = [];
  if (apiPost.showIds && apiPost.showIds.length > 0) {
    try {
      const showPromises = apiPost.showIds.map((id) =>
        showService.getShowById(id).catch(() => null)
      );
      const showResults = await Promise.all(showPromises);
      shows = showResults.filter((show): show is Show => show !== null);
    } catch (error) {
      console.error("Error fetching show details:", error);
    }
  }

  return {
    id: String(apiPost.id),
    type: apiPost.postType,
    auditStatus: apiPost.auditStatus,
    title: apiPost.title,
    image: apiPost.imageUrls?.[0],
    author: {
      id: String(apiPost.userId),
      name: userInfo?.username || apiPost.username || "用户",
      avatar:
        userInfo?.avatarUrl ||
        `https://api.dicebear.com/7.x/avataaars/png?seed=${apiPost.userId}`,
    },
    content: {
      title: apiPost.title,
      description: apiPost.contentText,
      images: apiPost.imageUrls || [],
      tags: [],
    },
    engagement: {
      likes: apiPost.likeCount || 0,
      saves: apiPost.favoriteCount || 0,
      comments: apiPost.commentCount || 0,
      isLiked: apiPost.likedByMe || false,
      isSaved: apiPost.favoritedByMe || false,
    },
    timestamp: apiPost.createdAt,
    rating: apiPost.rating,
    brandName: apiPost.brandName,
    productName: apiPost.productName,
    shows: shows.length > 0 ? shows : undefined,
  };
};

interface UsePostDetailOptions {
  params: PostDetailRouteParams;
}

interface UsePostDetailReturn {
  post: Post | null;
  postStatus: PostStatus;
  isLoading: boolean;
  error: string | null;
  setPost: React.Dispatch<React.SetStateAction<Post | null>>;
  reload: () => Promise<void>;
}

/**
 * 管理帖子详情加载和状态
 */
export const usePostDetail = ({
  params,
}: UsePostDetailOptions): UsePostDetailReturn => {
  const [post, setPost] = useState<Post | null>(params.post || null);
  const [isLoading, setIsLoading] = useState(!params.post);
  const [error, setError] = useState<string | null>(null);
  const [postStatus, setPostStatus] = useState<PostStatus>('DRAFT');
  const loadPostDetail = useCallback(async () => {
    // 如果已经有 post 数据（从路由参数传入），不需要再加载
    if (params.post) {
      setPost(params.post);
      // 从路由参数传入的帖子，根据 auditStatus 判断状态
      // 如果有 auditStatus，说明是已发布的帖子
      if (params.post.auditStatus) {
        setPostStatus("PUBLISHED");
      }
      setIsLoading(false);
      return;
    }

    // 需要 postId 才能加载
    if (!params.postId) {
      setError("缺少帖子 ID");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const postId = parseInt(params.postId, 10);
      if (isNaN(postId)) {
        throw new Error("无效的帖子 ID");
      }

      // 从 API 获取帖子详情
      const apiPost = await postService.getPostById(postId);
      setPostStatus(apiPost.status);
      if (!apiPost) {
        throw new Error("帖子不存在");
      }

      // 获取作者信息
      let userInfo: { username?: string; avatarUrl?: string } | undefined;
      try {
        const authorInfo = await userInfoService.getUserInfo(apiPost.userId);
        if (authorInfo) {
          userInfo = {
            username: authorInfo.username,
            avatarUrl: authorInfo.avatarUrl,
          };
        }
      } catch {
        // 忽略获取用户信息失败
      }

      // 转换为 UI Post 格式
      const uiPost = await convertApiPostToUiPost(apiPost, userInfo);
      setPost(uiPost);
    } catch (err) {
      console.error("Error loading post detail:", err);
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setIsLoading(false);
    }
  }, [params.post, params.postId]);

  // 初始化加载帖子详情
  useEffect(() => {
    loadPostDetail();
  }, [loadPostDetail]);

  return {
    post,
    isLoading,
    error,
    postStatus,
    setPost,
    reload: loadPostDetail,
  };
};
