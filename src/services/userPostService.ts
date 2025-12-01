import AsyncStorage from "@react-native-async-storage/async-storage";
import { Post } from "../components/PostCard";

export type PostStatus = "draft" | "pending" | "published";

export interface UserPost extends Omit<Post, "author"> {
  status: PostStatus;
  createdAt: string;
  updatedAt: string;
}

const USER_POSTS_STORAGE_KEY = "@avant_regard_user_posts";

// 获取所有用户发布的内容
export const getAllUserPosts = async (): Promise<UserPost[]> => {
  try {
    const postsJson = await AsyncStorage.getItem(USER_POSTS_STORAGE_KEY);
    if (postsJson) {
      return JSON.parse(postsJson);
    }
    return [];
  } catch (error) {
    console.error("Error getting user posts:", error);
    return [];
  }
};

// 根据状态获取用户发布的内容
export const getUserPostsByStatus = async (
  status: PostStatus
): Promise<UserPost[]> => {
  try {
    const posts = await getAllUserPosts();
    return posts.filter((post) => post.status === status);
  } catch (error) {
    console.error("Error getting posts by status:", error);
    return [];
  }
};

// 保存新的 post
export const saveUserPost = async (
  post: Omit<UserPost, "id" | "createdAt" | "updatedAt">,
  status: PostStatus = "draft"
): Promise<string> => {
  try {
    const posts = await getAllUserPosts();
    const now = new Date().toISOString();

    const newPost: UserPost = {
      ...post,
      id: `post_${Date.now()}`,
      status,
      createdAt: now,
      updatedAt: now,
    };

    posts.push(newPost);
    await AsyncStorage.setItem(USER_POSTS_STORAGE_KEY, JSON.stringify(posts));

    return newPost.id;
  } catch (error) {
    console.error("Error saving user post:", error);
    throw error;
  }
};

// 更新 post 状态
export const updatePostStatus = async (
  postId: string,
  status: PostStatus
): Promise<void> => {
  try {
    const posts = await getAllUserPosts();
    const postIndex = posts.findIndex((p) => p.id === postId);

    if (postIndex === -1) {
      throw new Error("Post not found");
    }

    posts[postIndex] = {
      ...posts[postIndex],
      status,
      updatedAt: new Date().toISOString(),
    };

    await AsyncStorage.setItem(USER_POSTS_STORAGE_KEY, JSON.stringify(posts));
  } catch (error) {
    console.error("Error updating post status:", error);
    throw error;
  }
};

// 删除 post
export const deleteUserPost = async (postId: string): Promise<void> => {
  try {
    const posts = await getAllUserPosts();
    const filteredPosts = posts.filter((p) => p.id !== postId);
    await AsyncStorage.setItem(
      USER_POSTS_STORAGE_KEY,
      JSON.stringify(filteredPosts)
    );
  } catch (error) {
    console.error("Error deleting user post:", error);
    throw error;
  }
};

// 获取单个 post
export const getUserPost = async (postId: string): Promise<UserPost | null> => {
  try {
    const posts = await getAllUserPosts();
    return posts.find((p) => p.id === postId) || null;
  } catch (error) {
    console.error("Error getting user post:", error);
    return null;
  }
};

// 初始化一些 mock 数据（用于演示）
export const initializeMockUserPosts = async (): Promise<void> => {
  try {
    const existingPosts = await getAllUserPosts();
    if (existingPosts.length > 0) {
      return; // 已有数据，不需要初始化
    }

    const mockPosts: UserPost[] = [
      {
        id: "user-post-1",
        type: "DAILY_SHARE",
        status: "published",
        content: {
          title: "春日通勤穿搭分享",
          description: "简约又不失时尚感的办公室穿搭",
          images: ["https://picsum.photos/id/600/600/800"],
          tags: ["通勤", "春日", "简约"],
        },
        engagement: {
          likes: 156,
          saves: 42,
          comments: 18,
          isLiked: false,
          isSaved: false,
        },
        timestamp: "3天前",
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: "user-post-2",
        type: "ITEM_REVIEW",
        status: "pending",
        content: {
          title: "GUCCI 新款包包体验",
          description: "使用一周后的真实感受",
          images: ["https://picsum.photos/id/610/600/800"],
          tags: ["GUCCI", "包包", "评测"],
        },
        engagement: {
          likes: 0,
          saves: 0,
          comments: 0,
          isLiked: false,
          isSaved: false,
        },
        timestamp: "1天前",
        rating: 4,
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: "user-post-3",
        type: "ARTICLES",
        status: "draft",
        content: {
          title: "2024秋冬流行趋势预测",
          description: "从时装周看今年秋冬的时尚风向",
          images: ["https://picsum.photos/id/620/600/800"],
          tags: ["流行趋势", "秋冬", "时装周"],
        },
        engagement: {
          likes: 0,
          saves: 0,
          comments: 0,
          isLiked: false,
          isSaved: false,
        },
        timestamp: "2小时前",
        readTime: "5分钟阅读",
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: "user-post-4",
        type: "DAILY_SHARE",
        status: "published",
        content: {
          title: "周末休闲穿搭",
          description: "舒适又时髦的周末造型",
          images: ["https://picsum.photos/id/630/600/800"],
          tags: ["休闲", "周末", "舒适"],
        },
        engagement: {
          likes: 234,
          saves: 67,
          comments: 29,
          isLiked: false,
          isSaved: false,
        },
        timestamp: "1周前",
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: "user-post-5",
        type: "OUTFIT",
        status: "draft",
        content: {
          title: "夏日度假穿搭灵感",
          description: "适合海边度假的时尚穿搭",
          images: ["https://picsum.photos/id/640/600/800"],
          tags: ["度假", "夏日", "海边"],
        },
        engagement: {
          likes: 0,
          saves: 0,
          comments: 0,
          isLiked: false,
          isSaved: false,
        },
        timestamp: "1小时前",
        createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
      },
    ];

    await AsyncStorage.setItem(
      USER_POSTS_STORAGE_KEY,
      JSON.stringify(mockPosts)
    );
  } catch (error) {
    console.error("Error initializing mock user posts:", error);
  }
};
