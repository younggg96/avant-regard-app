"use client";

/**
 * 店铺详情页顶部横向切换条.
 *
 * 设计对照：截图 1 顶部那一行圆形 logo + 店铺名. 点不同圆切换到别的店铺详情页.
 *
 * 数据源：`getAllBuyerStores({ pageSize: 30 })` → 取 `hasMerchant === true` 的
 * 店铺（已入驻商家），前 N 条. 因为后端 `/buyer-stores/all` 默认就把已入驻的
 * 排在前面，这里用第一页基本就能覆盖所有已入驻店铺. 后续如果入驻店变多
 * 可以做服务端 "仅已入驻" filter，现阶段不差.
 *
 * 为什么不用 SSR：顶部条是跨店铺共享的数据，SSR 会每页都重复请求；放在客户端
 * SWR 里可以跨页面共享一份缓存（同一个 key）.
 */

import Link from "next/link";
import useSWR from "swr";
import { getAllBuyerStores, type BuyerStore } from "@/lib/services/buyer-store";
import { useStoreProfileConfigMap } from "@/lib/hooks/useStoreProfileConfigMap";

interface Props {
  /** 当前店铺 ID，用于高亮 chip. */
  currentStoreId: string;
  /** 最多显示几家；默认 12. */
  limit?: number;
}

export function StoreTopSwitcher({ currentStoreId, limit = 12 }: Props) {
  const { data, isLoading } = useSWR(
    ["buyer-stores-top-switcher"],
    () => getAllBuyerStores({ page: 1, pageSize: 30 }),
    { revalidateOnFocus: false },
  );

  const stores = data?.stores ?? [];
  // 只展示已入驻的；如果当前 store 不在这里，也把它塞进去一条避免高亮丢失.
  const merchantStores = stores.filter((s) => s.hasMerchant);
  const visible: BuyerStore[] = merchantStores.slice(0, limit);
  const currentInList = visible.some((s) => s.id === currentStoreId);
  const currentFromAll = stores.find((s) => s.id === currentStoreId);
  const list: BuyerStore[] =
    currentInList || !currentFromAll ? visible : [currentFromAll, ...visible];

  // 并发拉这些店的 profile-config，主要为了顶部 chip 能显示 logoImage 覆盖
  // store.images[0]（官方 logo 视觉更干净）. 未配置时回退 store.images[0].
  const logoMap = useStoreProfileConfigMap(list.map((s) => s.id));

  if (isLoading && list.length === 0) {
    return (
      <div className="mb-6 h-[72px] animate-pulse rounded bg-[var(--canvas-soft)]" />
    );
  }

  if (list.length === 0) return null;

  return (
    <div className="relative mb-8">
      <div className="-mx-6 overflow-x-auto px-6 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex min-w-max items-start gap-5">
          {list.map((s) => {
            const isActive = s.id === currentStoreId;
            const logo = logoMap[s.id]?.logoImage || s.images?.[0] || null;
            return (
              <Link
                key={s.id}
                href={`/stores/${encodeURIComponent(s.id)}`}
                className="group flex w-[76px] shrink-0 flex-col items-center gap-1.5"
              >
                <div
                  className={`relative grid h-14 w-14 place-items-center overflow-hidden rounded-full border transition-colors ${
                    isActive
                      ? "border-[var(--ink)]"
                      : "border-[var(--border)] group-hover:border-[var(--ink-muted)]"
                  }`}
                >
                  {logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={logo}
                      alt={s.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="font-serif text-[11px] text-[var(--ink)]">
                      {s.name.slice(0, 2)}
                    </span>
                  )}
                </div>
                <span
                  className={`line-clamp-2 text-center font-label text-[11px] leading-snug transition-colors ${
                    isActive
                      ? "text-[var(--ink)]"
                      : "text-[color:var(--ink-muted)] group-hover:text-[var(--ink)]"
                  }`}
                >
                  {s.name}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
