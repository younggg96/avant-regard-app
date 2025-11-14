import AsyncStorage from "@react-native-async-storage/async-storage";
import { Post } from "../components/PostCard";

const SAVED_POSTS_STORAGE_KEY = "@avant_regard_saved_posts";
const LIKED_POSTS_STORAGE_KEY = "@avant_regard_liked_posts";

// 获取所有收藏的帖子
export const getSavedPosts = async (): Promise<Post[]> => {
  try {
    const postsJson = await AsyncStorage.getItem(SAVED_POSTS_STORAGE_KEY);
    if (postsJson) {
      return JSON.parse(postsJson);
    }
    return [];
  } catch (error) {
    console.error("Error getting saved posts:", error);
    return [];
  }
};

// 获取所有喜欢的帖子
export const getLikedPosts = async (): Promise<Post[]> => {
  try {
    const postsJson = await AsyncStorage.getItem(LIKED_POSTS_STORAGE_KEY);
    if (postsJson) {
      return JSON.parse(postsJson);
    }
    return [];
  } catch (error) {
    console.error("Error getting liked posts:", error);
    return [];
  }
};

// 收藏帖子
export const savePost = async (post: Post): Promise<void> => {
  try {
    const savedPosts = await getSavedPosts();
    const exists = savedPosts.find((p) => p.id === post.id);
    if (!exists) {
      savedPosts.push(post);
      await AsyncStorage.setItem(
        SAVED_POSTS_STORAGE_KEY,
        JSON.stringify(savedPosts)
      );
    }
  } catch (error) {
    console.error("Error saving post:", error);
    throw error;
  }
};

// 取消收藏帖子
export const unsavePost = async (postId: string): Promise<void> => {
  try {
    const savedPosts = await getSavedPosts();
    const filteredPosts = savedPosts.filter((p) => p.id !== postId);
    await AsyncStorage.setItem(
      SAVED_POSTS_STORAGE_KEY,
      JSON.stringify(filteredPosts)
    );
  } catch (error) {
    console.error("Error unsaving post:", error);
    throw error;
  }
};

// 喜欢帖子
export const likePost = async (post: Post): Promise<void> => {
  try {
    const likedPosts = await getLikedPosts();
    const exists = likedPosts.find((p) => p.id === post.id);
    if (!exists) {
      likedPosts.push(post);
      await AsyncStorage.setItem(
        LIKED_POSTS_STORAGE_KEY,
        JSON.stringify(likedPosts)
      );
    }
  } catch (error) {
    console.error("Error liking post:", error);
    throw error;
  }
};

// 取消喜欢帖子
export const unlikePost = async (postId: string): Promise<void> => {
  try {
    const likedPosts = await getLikedPosts();
    const filteredPosts = likedPosts.filter((p) => p.id !== postId);
    await AsyncStorage.setItem(
      LIKED_POSTS_STORAGE_KEY,
      JSON.stringify(filteredPosts)
    );
  } catch (error) {
    console.error("Error unliking post:", error);
    throw error;
  }
};

// 初始化 mock 数据（用于演示）
export const initializeMockInteractions = async (): Promise<void> => {
  try {
    const existingSaved = await getSavedPosts();
    const existingLiked = await getLikedPosts();

    // 只在没有数据时初始化
    if (existingSaved.length === 0) {
      const mockSavedPosts: Post[] = [
        {
          id: "saved-post-1",
          type: "lookbook",
          author: {
            id: "designer-1",
            name: "Virginie Viard",
            avatar: "https://picsum.photos/id/64/60/60",
          },
          content: {
            title: "CHANEL 2024 春夏系列",
            description: "在经典与创新之间寻找平衡",
            images: ["https://picsum.photos/id/180/600/800"],
            tags: ["chanel", "春夏", "经典"],
          },
          engagement: {
            likes: 1247,
            saves: 328,
            comments: 89,
            isLiked: false,
            isSaved: true,
          },
          timestamp: "2小时前",
          brandName: "CHANEL",
          season: "Spring/Summer 2024",
        },
        {
          id: "saved-post-2",
          type: "outfit",
          author: {
            id: "user-100",
            name: "Emma Chen",
            avatar: "https://picsum.photos/id/91/60/60",
          },
          content: {
            title: "巴黎街头优雅风",
            description: "经典风衣与现代配饰的完美结合",
            images: ["https://picsum.photos/id/203/600/800"],
            tags: ["街头", "优雅", "春日"],
          },
          engagement: {
            likes: 456,
            saves: 123,
            comments: 34,
            isLiked: false,
            isSaved: true,
          },
          timestamp: "5小时前",
        },
        {
          id: "saved-post-3",
          type: "review",
          author: {
            id: "user-101",
            name: "Sophie Liu",
            avatar: "https://picsum.photos/id/65/60/60",
          },
          content: {
            title: "DIOR Saddle Bag 深度评测",
            description: "经典回归的马鞍包，从设计到实用性的全方位评价",
            images: ["https://picsum.photos/id/292/600/800"],
            tags: ["dior", "马鞍包", "评测"],
          },
          engagement: {
            likes: 789,
            saves: 234,
            comments: 67,
            isLiked: false,
            isSaved: true,
          },
          timestamp: "1天前",
          rating: 4,
        },
      ];
      await AsyncStorage.setItem(
        SAVED_POSTS_STORAGE_KEY,
        JSON.stringify(mockSavedPosts)
      );
    }

    if (existingLiked.length === 0) {
      const mockLikedPosts: Post[] = [
        {
          id: "liked-post-1",
          type: "article",
          author: {
            id: "editor-1",
            name: "Alice Wang",
            avatar: "https://picsum.photos/id/77/60/60",
          },
          content: {
            title: "2024春夏时装周趋势解析",
            description: "从巴黎到米兰，解读本季最重要的时尚趋势",
            images: ["https://picsum.photos/id/432/600/800"],
            tags: ["时装周", "趋势", "2024"],
          },
          engagement: {
            likes: 2134,
            saves: 567,
            comments: 189,
            isLiked: true,
            isSaved: false,
          },
          timestamp: "2天前",
          readTime: "5分钟阅读",
        },
        {
          id: "liked-post-2",
          type: "lookbook",
          author: {
            id: "designer-2",
            name: "Anthony Vaccarello",
            avatar: "https://picsum.photos/id/84/60/60",
          },
          content: {
            title: "SAINT LAURENT 2024秋冬系列",
            description: "摇滚精神与巴黎优雅的完美融合",
            images: ["https://picsum.photos/id/453/600/800"],
            tags: ["saint laurent", "秋冬", "摇滚"],
          },
          engagement: {
            likes: 3456,
            saves: 987,
            comments: 234,
            isLiked: true,
            isSaved: false,
          },
          timestamp: "3天前",
          brandName: "SAINT LAURENT",
          season: "Fall/Winter 2024",
        },
        {
          id: "liked-post-3",
          type: "outfit",
          author: {
            id: "user-102",
            name: "Lily Zhang",
            avatar: "https://picsum.photos/id/99/60/60",
          },
          content: {
            title: "现代极简主义通勤装",
            description: "简约线条与高级面料的时尚表达",
            images: ["https://picsum.photos/id/502/600/800"],
            tags: ["极简", "通勤", "现代"],
          },
          engagement: {
            likes: 678,
            saves: 189,
            comments: 45,
            isLiked: true,
            isSaved: false,
          },
          timestamp: "1周前",
        },
        {
          id: "liked-post-4",
          type: "review",
          author: {
            id: "user-103",
            name: "Grace Kim",
            avatar: "https://picsum.photos/id/103/60/60",
          },
          content: {
            title: "Bottega Veneta Cassette包包使用体验",
            description: "经过3个月的日常使用，分享这款网红包包的真实感受",
            images: ["https://picsum.photos/id/513/600/800"],
            tags: ["bottega veneta", "cassette", "使用体验"],
          },
          engagement: {
            likes: 345,
            saves: 89,
            comments: 23,
            isLiked: true,
            isSaved: false,
          },
          timestamp: "1周前",
          rating: 3,
        },
      ];
      await AsyncStorage.setItem(
        LIKED_POSTS_STORAGE_KEY,
        JSON.stringify(mockLikedPosts)
      );
    }
  } catch (error) {
    console.error("Error initializing mock interactions:", error);
  }
};
