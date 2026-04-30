"use client";

/**
 * 批量取多个店铺 profile-config 的 hook.
 *
 * 设计取舍：
 *   - 后端没有批量端点（Phase 1 只铺了单店 upsert / 单店 GET），所以这里只能
 *     按 storeId 并发请求.
 *   - 用 SWR per-key 缓存：不同页面 / 不同组件若拉相同 storeId 的 config，
 *     会自动共享结果；切换 Tab 不用重复请求；
 *   - 没拉到 / 未配置时返回 `null`，调用方自己兜底（例如回退 store.images[0]
 *     作为 logo）.
 */

import useSWR from "swr";
import { useMemo } from "react";
import {
  storeProductService,
  type StoreProfileConfig,
} from "@/lib/services/store-product";

/**
 * 返回 storeId → StoreProfileConfig | null 的映射；未拉到的 key 不会出现.
 *
 * 注意 SWR 约束：hook 内部只能 hook-call 一个 useSWR. 要批量就得自己拼
 * 合并 fetcher，把所有 id 作为依赖串接起来，SWR 自然会 cache 这个"批"的结果.
 */
export function useStoreProfileConfigMap(
  storeIds: string[],
): Record<string, StoreProfileConfig | null> {
  // 稳定化 key：按字典序排序 + join，避免同批次顺序变化导致重复请求.
  const keyPart = useMemo(
    () => [...storeIds].filter(Boolean).sort().join("|"),
    [storeIds],
  );

  const { data } = useSWR(
    storeIds.length > 0 ? ["store-profile-config-batch", keyPart] : null,
    async () => {
      const pairs = await Promise.all(
        storeIds.map(async (id) => {
          try {
            const cfg = await storeProductService.getProfileConfig(id);
            return [id, cfg] as const;
          } catch {
            return [id, null] as const;
          }
        }),
      );
      return Object.fromEntries(pairs) as Record<
        string,
        StoreProfileConfig | null
      >;
    },
    { revalidateOnFocus: false, dedupingInterval: 60_000 },
  );

  return data ?? {};
}
