"use client";

/**
 * /stores/[id] —— 客户端 View.
 *
 * 组合 Phase B 的所有组件：
 *   1) StoreTopSwitcher   —— 顶部横向店铺切换条
 *   2) StoreProfileBlock  —— Profile 卡（logo/cover/短长介绍/关注按钮 + 3 列统计）
 *   3) StoreCategoryCards —— 入口卡片
 *   4) Tab 切换（店铺首页 / 全部商品 / 上新）+ 商品网格
 *
 * 状态：
 *   - URL search params 驱动 tab 和商品过滤器：
 *       ?tab=home|all|new  ·  ?categoryId=X  ·  ?discount=1
 *     URL 同步，分享/刷新友好.
 *   - profile 配置走 SWR per storeId，全局共享缓存；本页和 TopSwitcher 里都用到.
 */

import { Suspense, useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import type { BuyerStore } from "@/lib/services/buyer-store";
import { storeProductService } from "@/lib/services/store-product";
import { StoreTopSwitcher } from "@/components/stores/StoreTopSwitcher";
import { StoreProfileBlock } from "@/components/stores/StoreProfileBlock";
import { StoreServiceCards } from "@/components/stores/StoreServiceCards";
import { StoreBrandStoryCard } from "@/components/stores/StoreBrandStoryCard";
import {
  StoreCategoryCards,
  type EntryCardNavigation,
} from "@/components/stores/StoreCategoryCards";
import {
  StoreProductGrid,
  type ProductGridFilters,
} from "@/components/stores/StoreProductGrid";

type TabKey = "home" | "all" | "new";

const TABS: { key: TabKey; label: string }[] = [
  { key: "home", label: "店铺首页" },
  { key: "all", label: "全部商品" },
  { key: "new", label: "上新" },
];

export function StoreDetailView({
  initialStore,
}: {
  initialStore: BuyerStore;
}) {
  return (
    <Suspense fallback={null}>
      <StoreDetailViewInner initialStore={initialStore} />
    </Suspense>
  );
}

function StoreDetailViewInner({ initialStore }: { initialStore: BuyerStore }) {
  const router = useRouter();
  const sp = useSearchParams();

  const storeId = initialStore.id;

  // SWR 拉一份 BuyerStore (可能比 server 最近一点) + profile-config. 失败/未配置
  // 时优雅回退到 initialStore.
  const { data: store = initialStore } = useSWR(
    ["buyer-store-detail", storeId],
    async () => initialStore,
    { fallbackData: initialStore, revalidateOnFocus: false },
  );

  const { data: profile } = useSWR(
    ["store-profile-config", storeId],
    () => storeProductService.getProfileConfig(storeId),
    { revalidateOnFocus: false },
  );

  // ---------- URL state (tab + filter) ----------
  const tab: TabKey = useMemo(() => {
    const t = sp.get("tab");
    return t === "all" || t === "new" ? t : "home";
  }, [sp]);

  const urlCategoryId = useMemo(() => {
    const v = sp.get("categoryId");
    if (!v) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }, [sp]);

  const urlHasDiscount = sp.get("discount") === "1";

  const patchUrl = useCallback(
    (patch: Record<string, string | undefined>) => {
      const qs = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v == null || v === "") qs.delete(k);
        else qs.set(k, v);
      }
      const s = qs.toString();
      router.replace(`/stores/${encodeURIComponent(storeId)}${s ? `?${s}` : ""}`);
    },
    [router, sp, storeId],
  );

  const setTab = useCallback(
    (next: TabKey, options?: { preserveFilter?: boolean }) => {
      patchUrl({
        tab: next === "home" ? "" : next,
        ...(options?.preserveFilter
          ? {}
          : { categoryId: "", discount: "" }),
      });
    },
    [patchUrl],
  );

  // CategoryCards 点击 → 切换 tab + 设置 filter
  const [toast, setToast] = useState<string | null>(null);
  const handleEntryCardNavigate = useCallback(
    (nav: EntryCardNavigation) => {
      switch (nav.type) {
        case "CLASSIFICATION":
          patchUrl({
            tab: "all",
            categoryId:
              nav.targetCategoryId != null ? String(nav.targetCategoryId) : "",
            discount: "",
          });
          break;
        case "DISCOUNT":
          patchUrl({ tab: "all", discount: "1", categoryId: "" });
          break;
        case "NEW_ARRIVAL":
          patchUrl({ tab: "new", categoryId: "", discount: "" });
          break;
        case "EVENT":
          // Phase 5 / B 还没实现活动列表页；给个 toast 告诉用户.
          setToast("活动入口尚未开放，敬请期待");
          setTimeout(() => setToast(null), 2400);
          break;
      }
    },
    [patchUrl],
  );

  const activeFilter: ProductGridFilters = useMemo(() => {
    if (tab === "new") return { isNew: true };
    if (tab === "all") {
      const f: ProductGridFilters = {};
      if (urlCategoryId) f.categoryId = urlCategoryId;
      if (urlHasDiscount) f.hasDiscount = true;
      return f;
    }
    return {};
  }, [tab, urlCategoryId, urlHasDiscount]);

  const activeFilterLabel = useMemo(() => {
    const parts: string[] = [];
    if (urlCategoryId) parts.push(`分类 #${urlCategoryId}`);
    if (urlHasDiscount) parts.push("仅折扣");
    return parts.join(" · ");
  }, [urlCategoryId, urlHasDiscount]);

  return (
    <article className="mx-auto max-w-content px-6 py-8 md:py-10">
      <nav className="mb-6 flex items-center gap-3 font-label text-[12px] text-[color:var(--ink-muted)]">
        <Link href="/stores" className="hover:text-[var(--ink)]">
          ← 买手店
        </Link>
      </nav>

      {/* 1) 顶部店铺切换条 */}
      <StoreTopSwitcher currentStoreId={storeId} />

      {/* 2) Profile 卡 */}
      <StoreProfileBlock store={store} profile={profile} />

      {/* 2.5) 服务承诺 —— 仅已入驻商家店展示 */}
      <StoreServiceCards
        hasMerchant={!!store.hasMerchant}
        profile={profile}
      />

      {/* 2.6) 品牌故事大卡 —— 有描述或 tags 才展示 */}
      <StoreBrandStoryCard store={store} profile={profile} />

      {/* 3) 主 Tab */}
      <div className="mb-6 flex items-center gap-1 border-b border-[var(--border)] font-label text-[13px]">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-4 py-2 transition-colors ${
              tab === t.key
                ? "border-[var(--ink)] text-[var(--ink)]"
                : "border-transparent text-[color:var(--ink-muted)] hover:text-[var(--ink)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 过滤标签（分类 / 折扣）仅在 all tab 有值时展示；提供"清空"按钮 */}
      {tab === "all" && activeFilterLabel && (
        <div className="mb-4 flex items-center gap-2 font-label text-[12px] text-[color:var(--ink-muted)]">
          <span>筛选：{activeFilterLabel}</span>
          <button
            type="button"
            onClick={() => setTab("all")}
            className="text-[var(--ink)] underline-offset-4 hover:underline"
          >
            清除
          </button>
        </div>
      )}

      {/* 4) 主内容区 */}
      {tab === "home" && (
        <div className="space-y-10">
          <StoreCategoryCards
            storeId={storeId}
            onNavigate={handleEntryCardNavigate}
          />
          <StoreProductGrid
            storeId={storeId}
            preview={{
              pageSize: 8,
              title: "近期上新",
              viewAllHref: `/stores/${encodeURIComponent(storeId)}?tab=new`,
            }}
            filters={{ isNew: true }}
            columns="dense"
          />
        </div>
      )}

      {tab === "all" && (
        <StoreProductGrid storeId={storeId} filters={activeFilter} />
      )}

      {tab === "new" && (
        <StoreProductGrid storeId={storeId} filters={{ isNew: true }} />
      )}

      {/* Toast（EVENT 卡片占位提示） */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-full bg-[var(--ink)] px-4 py-2 font-label text-[12px] text-[var(--canvas)] shadow-lg">
          {toast}
        </div>
      )}
    </article>
  );
}
