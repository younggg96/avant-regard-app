/**
 * 分享服务
 * 处理内容分享至微信等外部平台，生成默认跳转链接卡片
 */

import { Share, Platform, Linking } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Post } from "../components/PostCard";
import { config } from "../config/env";
import { Alert } from "../utils/Alert";

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

// 分享配置
const SHARE_CONFIG = {
  // 应用 URL Scheme，用于深度链接
  APP_SCHEME: "avantregard",
  // 通用链接域名（需要后端支持）
  UNIVERSAL_LINK_DOMAIN: "app.avantregard.com",
  // 网页分享页面基础 URL
  WEB_SHARE_BASE_URL: "https://app.avantregard.com/share",
  // 应用名称
  APP_NAME: "AVANT REGARD",
  // 默认分享描述
  DEFAULT_DESCRIPTION: "发现时尚，分享穿搭灵感",
  // 默认分享图片
  DEFAULT_IMAGE: "https://app.avantregard.com/share/default-card.png",
};

/**
 * 生成帖子的深度链接
 * @param postId 帖子ID
 * @returns 深度链接 URL
 */
export const generateDeepLink = (postId: string): string => {
  return `${SHARE_CONFIG.APP_SCHEME}://post/${postId}`;
};

/**
 * 生成帖子的网页分享链接
 * @param postId 帖子ID
 * @returns 网页链接 URL
 */
export const generateWebShareUrl = (postId: string): string => {
  return `${SHARE_CONFIG.WEB_SHARE_BASE_URL}/post/${postId}`;
};

/**
 * 生成通用链接（iOS Universal Links / Android App Links）
 * @param postId 帖子ID
 * @returns 通用链接 URL
 */
export const generateUniversalLink = (postId: string): string => {
  return `https://${SHARE_CONFIG.UNIVERSAL_LINK_DOMAIN}/post/${postId}`;
};

/**
 * 从 Post 对象构建分享内容
 * @param post 帖子对象
 * @returns 分享内容
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

/**
 * 生成分享消息文本
 * @param content 分享内容
 * @returns 格式化的分享消息
 */
const formatShareMessage = (content: ShareContent): string => {
  return `【${content.title}】\n${content.description}\n\n点击查看详情：${content.webUrl}\n\n来自 ${SHARE_CONFIG.APP_NAME}`;
};

/**
 * 复制链接到剪贴板
 * @param post 帖子对象
 */
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
 * @returns 是否安装了微信
 */
export const isWeChatInstalled = async (): Promise<boolean> => {
  try {
    // 微信的 URL Scheme
    const wechatUrl = Platform.OS === "ios" ? "weixin://" : "weixin://";
    return await Linking.canOpenURL(wechatUrl);
  } catch (error) {
    console.error("检查微信安装状态失败:", error);
    return false;
  }
};

/**
 * 检查微博是否已安装
 * @returns 是否安装了微博
 */
export const isWeiboInstalled = async (): Promise<boolean> => {
  try {
    const weiboUrl = "sinaweibo://";
    return await Linking.canOpenURL(weiboUrl);
  } catch (error) {
    console.error("检查微博安装状态失败:", error);
    return false;
  }
};

/**
 * 分享到微信好友
 * 注意：完整的微信分享功能需要集成微信 SDK
 * 这里使用系统分享作为降级方案
 * @param post 帖子对象
 */
export const shareToWeChat = async (post: Post): Promise<boolean> => {
  try {
    const isInstalled = await isWeChatInstalled();
    if (!isInstalled) {
      Alert.show("未安装微信", "请先安装微信客户端");
      return false;
    }

    const content = buildShareContent(post);
    const message = formatShareMessage(content);

    // 使用系统分享（会显示微信选项）
    const result = await Share.share(
      {
        message,
        title: content.title,
        url: Platform.OS === "ios" ? content.webUrl : undefined,
      },
      {
        dialogTitle: "分享到微信",
        subject: content.title,
      }
    );

    return result.action === Share.sharedAction;
  } catch (error) {
    console.error("分享到微信失败:", error);
    Alert.show("分享失败", "请稍后重试");
    return false;
  }
};

/**
 * 分享到微信朋友圈
 * @param post 帖子对象
 */
export const shareToWeChatMoments = async (post: Post): Promise<boolean> => {
  try {
    const isInstalled = await isWeChatInstalled();
    if (!isInstalled) {
      Alert.show("未安装微信", "请先安装微信客户端");
      return false;
    }

    // 朋友圈分享同样使用系统分享作为降级方案
    // 完整功能需要微信 SDK
    return await shareToWeChat(post);
  } catch (error) {
    console.error("分享到朋友圈失败:", error);
    Alert.show("分享失败", "请稍后重试");
    return false;
  }
};

/**
 * 分享到微博
 * @param post 帖子对象
 */
export const shareToWeibo = async (post: Post): Promise<boolean> => {
  try {
    const isInstalled = await isWeiboInstalled();
    if (!isInstalled) {
      Alert.show("未安装微博", "请先安装微博客户端");
      return false;
    }

    const content = buildShareContent(post);
    const message = formatShareMessage(content);

    // 使用系统分享
    const result = await Share.share(
      {
        message,
        title: content.title,
        url: Platform.OS === "ios" ? content.webUrl : undefined,
      },
      {
        dialogTitle: "分享到微博",
        subject: content.title,
      }
    );

    return result.action === Share.sharedAction;
  } catch (error) {
    console.error("分享到微博失败:", error);
    Alert.show("分享失败", "请稍后重试");
    return false;
  }
};

/**
 * 使用系统原生分享
 * @param post 帖子对象
 */
export const shareWithSystem = async (post: Post): Promise<boolean> => {
  try {
    const content = buildShareContent(post);
    const message = formatShareMessage(content);

    const result = await Share.share(
      {
        message,
        title: content.title,
        url: Platform.OS === "ios" ? content.webUrl : undefined,
      },
      {
        dialogTitle: "分享",
        subject: content.title,
      }
    );

    return result.action === Share.sharedAction;
  } catch (error) {
    console.error("系统分享失败:", error);
    Alert.show("分享失败", "请稍后重试");
    return false;
  }
};

/**
 * 统一分享入口
 * @param platform 分享平台
 * @param post 帖子对象
 */
export const shareToplatform = async (
  platform: SharePlatform,
  post: Post
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
 * @returns 可用平台列表
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
  generateDeepLink,
  generateWebShareUrl,
  generateUniversalLink,
  buildShareContent,
  copyLink,
  isWeChatInstalled,
  isWeiboInstalled,
  shareToWeChat,
  shareToWeChatMoments,
  shareToWeibo,
  shareWithSystem,
  shareToplatform,
  getAvailablePlatforms,
};
