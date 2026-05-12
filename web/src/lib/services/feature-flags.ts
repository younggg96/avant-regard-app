/**
 * 公开的功能开关 (Web 端).
 *
 * 调用公开的 `/api/feature-flags` 端点, 不需要登录, 用 SWR 做客户端缓存.
 * 默认值与后端 `feature_flags_service._default_config` 对齐, 出错时也以默认
 * 值回退, 避免任何一次失败导致功能消失.
 *
 * 与移动端 `featureFlagsStore` 的语义保持一致: 这里只是 Web 适配层.
 */

import useSWR from "swr";
import { apiClient } from "../api-client";

export interface FeatureFlags {
  lotteryEnabled: boolean;
}

/**
 * 默认 false, 与后端 `feature_flags_service._default_config` 对齐.
 * 数据未就绪 / 拉取失败时按"关闭"渲染, 避免抽奖入口在 SWR 第一次回响前闪现.
 */
const DEFAULT_FLAGS: FeatureFlags = {
  lotteryEnabled: false,
};

export const featureFlagsApiPublic = {
  get: () =>
    apiClient.get<Partial<FeatureFlags>>("/api/feature-flags", undefined, {
      anonymous: true,
    }),
};

/**
 * 客户端任何 React 组件都可以用这个 hook 拿到当前功能开关状态.
 * - 30s 自动刷新, 与移动端轮询节奏一致;
 * - 在数据未就绪时返回默认值 (关闭), 避免抽奖入口先 "闪一下" 才隐藏.
 */
export function useFeatureFlags(): { flags: FeatureFlags; isLoading: boolean } {
  const { data, isLoading } = useSWR(
    ["feature-flags-public"],
    () => featureFlagsApiPublic.get(),
    {
      refreshInterval: 30_000,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    },
  );

  const flags: FeatureFlags = {
    ...DEFAULT_FLAGS,
    ...(data || {}),
  };

  return { flags, isLoading };
}
