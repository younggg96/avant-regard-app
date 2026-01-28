/**
 * 深度链接处理工具
 * 处理外部链接跳转到 App 内指定页面
 */

import { Linking, Platform } from "react-native";
import { NavigationContainerRef } from "@react-navigation/native";

// 链接前缀配置
export const LINKING_PREFIXES = [
  "avantregard://",
  "https://app.avantregard.com",
  "http://app.avantregard.com",
];

// 路由映射配置
export const LINKING_CONFIG = {
  prefixes: LINKING_PREFIXES,
  config: {
    screens: {
      // 主 Tab 导航
      MainTabs: {
        screens: {
          Home: "home",
          Discover: "discover",
          Profile: "profile",
        },
      },
      // 帖子详情页
      PostDetail: {
        path: "post/:postId",
        parse: {
          postId: (postId: string) => postId,
        },
      },
      // 分享页面（重定向到帖子详情）
      SharePost: {
        path: "share/post/:postId",
        parse: {
          postId: (postId: string) => postId,
        },
      },
      // 品牌详情页
      BrandDetail: {
        path: "brand/:brandId",
        parse: {
          brandId: (brandId: string) => brandId,
        },
      },
      // 用户主页
      UserProfile: {
        path: "user/:userId",
        parse: {
          userId: (userId: string) => userId,
        },
      },
      // 商店详情页
      StoreDetail: {
        path: "store/:storeId",
        parse: {
          storeId: (storeId: string) => storeId,
        },
      },
    },
  },
};

// 存储导航引用
let navigationRef: NavigationContainerRef<any> | null = null;

/**
 * 设置导航引用
 * @param ref 导航容器引用
 */
export const setNavigationRef = (ref: NavigationContainerRef<any>) => {
  navigationRef = ref;
};

/**
 * 解析深度链接
 * @param url 链接 URL
 * @returns 解析后的路由信息
 */
export const parseDeepLink = (url: string): { route: string; params: Record<string, any> } | null => {
  try {
    // 移除协议前缀
    let path = url;
    for (const prefix of LINKING_PREFIXES) {
      if (url.startsWith(prefix)) {
        path = url.replace(prefix, "");
        break;
      }
    }

    // 移除开头的斜杠
    path = path.replace(/^\/+/, "");

    // 解析路径
    const segments = path.split("/").filter(Boolean);
    
    if (segments.length === 0) {
      return null;
    }

    // 匹配路由
    const firstSegment = segments[0];
    
    switch (firstSegment) {
      case "post":
        if (segments[1]) {
          return {
            route: "PostDetail",
            params: { postId: segments[1] },
          };
        }
        break;
      
      case "share":
        if (segments[1] === "post" && segments[2]) {
          return {
            route: "PostDetail",
            params: { postId: segments[2] },
          };
        }
        break;

      case "brand":
        if (segments[1]) {
          return {
            route: "BrandDetail",
            params: { brandId: segments[1] },
          };
        }
        break;

      case "user":
        if (segments[1]) {
          return {
            route: "UserProfile",
            params: { userId: segments[1] },
          };
        }
        break;

      case "store":
        if (segments[1]) {
          return {
            route: "StoreDetail",
            params: { storeId: segments[1] },
          };
        }
        break;

      case "home":
        return {
          route: "MainTabs",
          params: { screen: "Home" },
        };

      case "discover":
        return {
          route: "MainTabs",
          params: { screen: "Discover" },
        };

      case "profile":
        return {
          route: "MainTabs",
          params: { screen: "Profile" },
        };
    }

    return null;
  } catch (error) {
    console.error("解析深度链接失败:", error);
    return null;
  }
};

/**
 * 处理深度链接导航
 * @param url 链接 URL
 */
export const handleDeepLink = (url: string) => {
  if (!url || !navigationRef) {
    console.warn("无法处理深度链接: URL 或导航引用为空");
    return;
  }

  const parsed = parseDeepLink(url);
  if (parsed) {
    console.log("深度链接导航:", parsed.route, parsed.params);
    navigationRef.navigate(parsed.route as never, parsed.params as never);
  } else {
    console.warn("无法识别的深度链接:", url);
  }
};

/**
 * 获取初始链接 URL
 * @returns 初始链接 URL 或 null
 */
export const getInitialURL = async (): Promise<string | null> => {
  try {
    const url = await Linking.getInitialURL();
    return url;
  } catch (error) {
    console.error("获取初始链接失败:", error);
    return null;
  }
};

/**
 * 订阅链接变化事件
 * @param callback 回调函数
 * @returns 取消订阅函数
 */
export const subscribeToDeepLinks = (callback: (url: string) => void) => {
  const subscription = Linking.addEventListener("url", ({ url }) => {
    callback(url);
  });

  return () => {
    subscription.remove();
  };
};

/**
 * 初始化深度链接处理
 * 应在 App 启动时调用
 */
export const initDeepLinking = async () => {
  // 处理初始链接
  const initialUrl = await getInitialURL();
  if (initialUrl) {
    // 延迟处理，确保导航已准备就绪
    setTimeout(() => {
      handleDeepLink(initialUrl);
    }, 500);
  }

  // 订阅后续链接
  return subscribeToDeepLinks(handleDeepLink);
};

export default {
  LINKING_PREFIXES,
  LINKING_CONFIG,
  setNavigationRef,
  parseDeepLink,
  handleDeepLink,
  getInitialURL,
  subscribeToDeepLinks,
  initDeepLinking,
};
