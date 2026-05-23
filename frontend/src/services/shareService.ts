/**
 * 分享服务
 * - 微信（好友/朋友圈）：通过 expo-native-wechat 调用微信 Open SDK 原生分享（网页卡片）
 * - 微博：由于缺少官方维护的 React Native 原生 SDK，采用"复制内容 + 唤起微博 App"降级方案
 * - 复制链接 / 系统分享：走系统 API
 */

import { Share, Platform, Linking } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Post } from "../components/PostCard";
import { config } from "../config/env";
import { Alert } from "../utils/Alert";

/**
 * 微信 SDK 懒加载
 *
 * expo-native-wechat 在模块顶层就会调用 NativeModule.getConstants()，
 * 如果当前 Dev Client 的原生二进制里没有 ExpoNativeWechat 模块（比如尚未
 * 重新 build），`require` 本身会抛出 "Cannot find native module" 错误。
 *
 * 这里用 try/catch 包一层：
 *   - 原生模块存在 → 正常走 WeChat Open SDK 分享
 *   - 原生模块缺失 → 静默降级为系统分享，避免整个 App crash
 *
 * 开发者只需运行 `npx expo prebuild --clean && npx expo run:ios` 重新构建即可。
 */
type WechatSdk = typeof import("expo-native-wechat");
let wechatSdk: WechatSdk | null = null;
let wechatSdkLoadError: unknown = null;

const loadWechatSdk = (): WechatSdk | null => {
  if (wechatSdk || wechatSdkLoadError) return wechatSdk;
  try {
    // 用 require 确保错误可以被 try/catch 捕获，避免静态 import 在 bundle 启动时就炸
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    wechatSdk = require("expo-native-wechat") as WechatSdk;
    return wechatSdk;
  } catch (error) {
    wechatSdkLoadError = error;
    console.warn(
      "[shareService] expo-native-wechat 原生模块不可用，微信分享将降级为系统分享。" +
        "如需启用原生微信分享，请运行 `npx expo prebuild --clean && npx expo run:ios` 重新构建 Dev Client。",
    );
    return null;
  }
};

// 分享平台类型
export type SharePlatform = "wechat" | "wechat_moments" | "weibo" | "copy" | "more";

// 分享内容结构
export interface ShareContent {
  title: string;
  description: string;
  imageUrl?: string;
  webUrl: string;
  type: "text" | "image" | "webPage";
}

export type ShareContentType = "post" | "store" | "brand" | "show" | "user" | "product";

const SHARE_CONFIG = {
  APP_SCHEME: "avantregard",
  SITE_URL: "https://avantregard.com",
  APP_NAME: "AVANT REGARD",
  DEFAULT_DESCRIPTION: "发现时尚，分享穿搭灵感",
  DEFAULT_IMAGE: "https://avantregard.com/share/default-card.png",
};

const CONTENT_TYPE_PATH: Record<ShareContentType, string> = {
  post: "/posts",
  store: "/stores",
  brand: "/archive/brands",
  show: "/archive/shows",
  user: "/users",
  product: "/products",
};

// 微信 SDK 是否已成功注册，避免重复注册并在未注册时给出更清晰的错误
let wechatRegistered = false;

/**
 * 初始化微信 SDK，推荐在 App 启动时调用一次
 * 未配置 AppID 时会打印警告但不抛错，保证其他分享渠道仍可用
 */
export const initWechat = async (): Promise<boolean> => {
  if (wechatRegistered) return true;
  if (Platform.OS === "web") return false;

  const sdk = loadWechatSdk();
  if (!sdk) return false;

  const appid = config.EXPO_PUBLIC_WECHAT_APP_ID;
  const universalLink = config.EXPO_PUBLIC_WECHAT_UNIVERSAL_LINK;

  if (!appid) {
    if (__DEV__) {
      console.info(
        "[shareService] 未配置 EXPO_PUBLIC_WECHAT_APP_ID，微信分享将降级为系统分享。",
      );
    }
    return false;
  }
  if (Platform.OS === "ios" && !universalLink && __DEV__) {
    console.info(
      "[shareService] iOS 微信 SDK 需要 Universal Link，请配置 EXPO_PUBLIC_WECHAT_UNIVERSAL_LINK。",
    );
  }

  try {
    await sdk.registerApp({
      appid,
      universalLink: universalLink || undefined,
      log: __DEV__,
      logPrefix: "[WeChat]",
    });
    wechatRegistered = true;
    return true;
  } catch (error) {
    console.error("[shareService] 微信 SDK 注册失败:", error);
    return false;
  }
};

export const generateShareUrl = (
  contentType: ShareContentType,
  id: string | number,
): string => {
  return `${SHARE_CONFIG.SITE_URL}${CONTENT_TYPE_PATH[contentType]}/${id}`;
};

export const generateDeepLink = (postId: string): string => {
  return `${SHARE_CONFIG.APP_SCHEME}://post/${postId}`;
};

export const generateWebShareUrl = (postId: string): string => {
  return generateShareUrl("post", postId);
};

export const generateUniversalLink = (postId: string): string => {
  return generateShareUrl("post", postId);
};

/**
 * 从 Post 对象构建分享内容
 */
export const buildShareContent = (post: Post): ShareContent => {
  const title = post.content?.title || post.title || "精彩内容";
  const description = post.content?.description || SHARE_CONFIG.DEFAULT_DESCRIPTION;
  const imageUrl = post.content?.images?.[0] || post.image || SHARE_CONFIG.DEFAULT_IMAGE;
  const webUrl = generateUniversalLink(post.id);

  return {
    title,
    description: description.length > 50 ? `${description.substring(0, 50)}...` : description,
    imageUrl,
    webUrl,
    type: "webPage",
  };
};

export interface GenericShareInput {
  contentType: ShareContentType;
  id: string | number;
  title: string;
  subtitle: string;
}

export const buildGenericShareContent = (input: GenericShareInput): ShareContent => {
  const webUrl = generateShareUrl(input.contentType, input.id);
  return {
    title: input.title,
    description: input.subtitle.length > 50
      ? `${input.subtitle.substring(0, 50)}...`
      : input.subtitle,
    webUrl,
    type: "webPage",
  };
};

const formatShareMessage = (content: ShareContent): string => {
  return `【${content.title}】\n${content.description}\n\n点击查看详情：${content.webUrl}\n\n来自 ${SHARE_CONFIG.APP_NAME}`;
};

export const copyShareUrl = async (url: string): Promise<boolean> => {
  try {
    await Clipboard.setStringAsync(url);
    Alert.show("链接已复制", "可以粘贴分享给好友");
    return true;
  } catch (error) {
    console.error("复制链接失败:", error);
    Alert.show("复制失败", "请稍后重试");
    return false;
  }
};

/**
 * 使用系统原生分享 - 通用版（任意分享内容）
 */
export const shareWithSystemGeneric = async (
  content: ShareContent,
): Promise<boolean> => {
  try {
    const message = formatShareMessage(content);
    const result = await Share.share(
      {
        message,
        title: content.title,
        url: Platform.OS === "ios" ? content.webUrl : undefined,
      },
      { dialogTitle: "分享", subject: content.title },
    );
    return result.action === Share.sharedAction;
  } catch (error) {
    console.error("系统分享失败:", error);
    Alert.show("分享失败", "请稍后重试");
    return false;
  }
};

// 微信 OpenSDK 的 scene 常量，iOS/Android SDK 中都是固定值，直接内联避免依赖原生模块
const WX_SCENE_SESSION = 0; // 微信好友会话
const WX_SCENE_TIMELINE = 1; // 朋友圈
// const WX_SCENE_FAVORITE = 2; // 收藏（暂未使用）

/**
 * 微信分享 - 通用版：以 scene 区分好友/朋友圈
 * 未配置/未注册/未安装时降级为系统分享
 */
const shareToWeChatScene = async (
  content: ShareContent,
  scene: number,
): Promise<boolean> => {
  if (Platform.OS === "web") {
    return shareWithSystemGeneric(content);
  }

  const sdk = loadWechatSdk();
  if (!sdk) {
    // 原生模块未编入 Dev Client → 降级到系统分享
    return shareWithSystemGeneric(content);
  }

  // 若 SDK 还未注册（比如在启动时 initWechat 失败），尝试再注册一次
  if (!wechatRegistered) {
    await initWechat();
  }

  if (!wechatRegistered) {
    // 没配 AppID 或注册失败 → 降级到系统分享
    return shareWithSystemGeneric(content);
  }

  try {
    const installed = await sdk.isWechatInstalled();
    if (!installed) {
      Alert.show("未安装微信", "请先安装微信客户端");
      return false;
    }

    await sdk.shareWebpage({
      scene,
      webpageUrl: content.webUrl,
      title: content.title,
      description: content.description,
      coverUrl: content.imageUrl,
    });
    return true;
  } catch (error: any) {
    // 用户主动取消时不报红，静默处理
    const msg = String(error?.message || error || "");
    if (msg.includes("-2") || msg.toLowerCase().includes("cancel")) {
      return false;
    }
    console.error("微信分享失败:", error);
    Alert.show("分享失败", "请稍后重试");
    return false;
  }
};

export const shareToWeChatGeneric = async (
  content: ShareContent,
): Promise<boolean> => {
  return shareToWeChatScene(content, WX_SCENE_SESSION);
};

export const shareToWeChatMomentsGeneric = async (
  content: ShareContent,
): Promise<boolean> => {
  return shareToWeChatScene(content, WX_SCENE_TIMELINE);
};

/**
 * 微博分享 - 通用版
 * 由于没有维护良好的 Weibo SDK，降级策略：
 * 1. 复制分享文案到剪贴板
 * 2. 调起微博 App
 * 3. 用户在微博内手动粘贴即可发布
 */
export const shareToWeiboGeneric = async (
  content: ShareContent,
): Promise<boolean> => {
  if (Platform.OS === "web") {
    return shareWithSystemGeneric(content);
  }

  const weiboUrl = "sinaweibo://";
  try {
    const canOpen = await Linking.canOpenURL(weiboUrl);
    if (!canOpen) {
      Alert.show("未安装微博", "请先安装微博客户端");
      return false;
    }

    await Clipboard.setStringAsync(formatShareMessage(content));
    await Linking.openURL(weiboUrl);
    Alert.show("已复制分享内容", "请在微博中长按输入框粘贴发布");
    return true;
  } catch (error) {
    console.error("微博分享失败:", error);
    Alert.show("分享失败", "请稍后重试");
    return false;
  }
};

// 兼容原接口的复制链接
export const copyLink = async (post: Post): Promise<boolean> => {
  try {
    const content = buildShareContent(post);
    await Clipboard.setStringAsync(content.webUrl);
    Alert.show("链接已复制", "可以粘贴分享给好友");
    return true;
  } catch (error) {
    console.error("复制链接失败:", error);
    Alert.show("复制失败", "请稍后重试");
    return false;
  }
};

/**
 * 检查微信是否已安装
 * - 优先使用 SDK 的 isWechatInstalled（更可靠）
 * - SDK 未注册时用 URL Scheme 做兜底
 */
export const isWeChatInstalled = async (): Promise<boolean> => {
  if (Platform.OS === "web") return false;
  try {
    const sdk = loadWechatSdk();
    if (wechatRegistered && sdk) {
      return await sdk.isWechatInstalled();
    }
    return await Linking.canOpenURL("weixin://");
  } catch (error) {
    console.error("检查微信安装状态失败:", error);
    return false;
  }
};

/**
 * 检查微博是否已安装
 */
export const isWeiboInstalled = async (): Promise<boolean> => {
  if (Platform.OS === "web") return false;
  try {
    return await Linking.canOpenURL("sinaweibo://");
  } catch (error) {
    console.error("检查微博安装状态失败:", error);
    return false;
  }
};

/**
 * 分享到微信好友
 */
export const shareToWeChat = async (post: Post): Promise<boolean> => {
  return shareToWeChatGeneric(buildShareContent(post));
};

/**
 * 分享到微信朋友圈
 */
export const shareToWeChatMoments = async (post: Post): Promise<boolean> => {
  return shareToWeChatMomentsGeneric(buildShareContent(post));
};

/**
 * 分享到微博
 */
export const shareToWeibo = async (post: Post): Promise<boolean> => {
  return shareToWeiboGeneric(buildShareContent(post));
};

/**
 * 使用系统原生分享
 */
export const shareWithSystem = async (post: Post): Promise<boolean> => {
  return shareWithSystemGeneric(buildShareContent(post));
};

/**
 * 统一分享入口
 */
export const shareToplatform = async (
  platform: SharePlatform,
  post: Post,
): Promise<boolean> => {
  switch (platform) {
    case "wechat":
      return shareToWeChat(post);
    case "wechat_moments":
      return shareToWeChatMoments(post);
    case "weibo":
      return shareToWeibo(post);
    case "copy":
      return copyLink(post);
    case "more":
    default:
      return shareWithSystem(post);
  }
};

/**
 * 获取可用的分享平台列表
 */
export const getAvailablePlatforms = async (): Promise<SharePlatform[]> => {
  const platforms: SharePlatform[] = [];

  const [wechatInstalled, weiboInstalled] = await Promise.all([
    isWeChatInstalled(),
    isWeiboInstalled(),
  ]);

  if (wechatInstalled) {
    platforms.push("wechat", "wechat_moments");
  }

  if (weiboInstalled) {
    platforms.push("weibo");
  }

  // 复制链接和更多选项始终可用
  platforms.push("copy", "more");

  return platforms;
};

export default {
  initWechat,
  generateShareUrl,
  generateDeepLink,
  generateWebShareUrl,
  generateUniversalLink,
  buildShareContent,
  buildGenericShareContent,
  copyLink,
  copyShareUrl,
  isWeChatInstalled,
  isWeiboInstalled,
  shareToWeChat,
  shareToWeChatGeneric,
  shareToWeChatMoments,
  shareToWeChatMomentsGeneric,
  shareToWeibo,
  shareToWeiboGeneric,
  shareWithSystem,
  shareWithSystemGeneric,
  shareToplatform,
  getAvailablePlatforms,
};
