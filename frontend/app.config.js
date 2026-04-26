/* eslint-disable */
/**
 * Expo 动态配置
 * 基于 app.json 的静态配置，额外注入依赖 .env 的动态字段：
 *   - 微信 AppID（作为 iOS URL Scheme）
 *   - 微信 Universal Link
 *   - expo-native-wechat 插件
 *
 * 用法：只需在 .env 中填写：
 *   EXPO_PUBLIC_WECHAT_APP_ID=wxXXXXXXXXXXXXXX
 *   EXPO_PUBLIC_WECHAT_UNIVERSAL_LINK=https://app.avantregard.com/wechat/
 *
 * Expo CLI 会在读取本文件前自动加载 .env。
 */

const toApplink = (url) => {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const hostAndPath = `${parsed.host}${parsed.pathname.replace(/\/$/, "")}`;
    return `applinks:${hostAndPath}`;
  } catch {
    return null;
  }
};

module.exports = ({ config }) => {
  const base = config; // 来自 app.json

  const wechatAppId = process.env.EXPO_PUBLIC_WECHAT_APP_ID || "";
  const wechatUniversalLink = process.env.EXPO_PUBLIC_WECHAT_UNIVERSAL_LINK || "";

  const baseScheme = base.scheme;
  const schemesFromBase = Array.isArray(baseScheme)
    ? baseScheme
    : baseScheme
    ? [baseScheme]
    : [];
  const allSchemes = [...schemesFromBase];
  if (wechatAppId && !allSchemes.includes(wechatAppId)) {
    allSchemes.push(wechatAppId);
  }

  const basePlugins = Array.isArray(base.plugins) ? base.plugins : [];
  const plugins = basePlugins.includes("expo-native-wechat")
    ? basePlugins
    : [...basePlugins, "expo-native-wechat"];

  const baseAssociatedDomains = base.ios?.associatedDomains || [];
  const applink = toApplink(wechatUniversalLink);
  const associatedDomains = [...baseAssociatedDomains];
  if (applink && !associatedDomains.includes(applink)) {
    associatedDomains.push(applink);
  }

  return {
    ...base,
    scheme: allSchemes.length > 1 ? allSchemes : base.scheme,
    plugins,
    ios: {
      ...base.ios,
      associatedDomains,
    },
  };
};
