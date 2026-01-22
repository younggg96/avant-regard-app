import AsyncStorage from "@react-native-async-storage/async-storage";
import { Post } from "../components/PostCard";

export type PostStatus = "DRAFT" | "PENDING" | "PUBLISHED" | "HIDDEN";

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
  status: PostStatus = "DRAFT"
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
