/**
 * 环境变量配置
 * 从 .env 文件读取环境变量
 */

import { EXPO_PUBLIC_API_BASE_URL } from "@env";

export const config = {
  EXPO_PUBLIC_API_BASE_URL: EXPO_PUBLIC_API_BASE_URL || "http://localhost:8080",
} as const;

// 调试：在控制台显示当前使用的 API URL
console.log("🔗 API Base URL:", config.EXPO_PUBLIC_API_BASE_URL);
console.log("🔗 ENV Value:", EXPO_PUBLIC_API_BASE_URL);

export default config;
