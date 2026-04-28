"use client";

/**
 * /me/merchant — 我的店铺列表.
 *
 * 对齐 `frontend/src/screens/MyMerchantStoresScreen.tsx`:
 *   - 拉 `getMyMerchants()` 得到当前用户所有的商家入驻申请.
 *   - 并行补充每条申请对应的公开店铺基础信息 (name / city / country), 失败
 *     的单条不影响整体渲染 —— 走 Promise.allSettled.
 *   - 已认证 (APPROVED) 的商家可以跳转 `/me/merchant/[merchantId]` 进管理页.
 *   - REJECTED 的显示拒绝原因.
 *
 * 路由设计理由: 管理页走 `/me/merchant/[id]` 放在 `/me` 下, 就能天然继承
 * `AuthRequired` + 侧边栏布局, 不用再包一层 guard.
 */

import Link from "next/link";
import { useMemo } from "react";
import useSWR from "swr";
import { useAuthStore } from "@/lib/auth/store";
import { apiClient } from "@/lib/api-client";
import {
  storeMerchantService,
  MERCHANT_STATUS_LABEL,
  type MerchantStatus,
  type StoreMerchant,
} from "@/lib/services/store-merchant";
import type { BuyerStore } from "@/lib/services/buyer-store";

interface MerchantWithStore extends StoreMerchant {
  store?: BuyerStore | null;
}

export default function MyMerchantListPage() {
  const user = useAuthStore((s) => s.user);
  const userId = user?.userId;

  const {
    data,
    isLoading,
    error,
  } = useSWR(
    userId ? ["my-merchants", userId] : null,
    async () => {
      const res = await storeMerchantService.getMyMerchants(1, 50);
      // 并行补充店铺基础信息; 单条失败不挡整体
      const merged = await Promise.all(
        res.merchants.map(async (m) => {
          try {
            const store = await apiClient.get<BuyerStore>(
              `/api/buyer-stores/${encodeURIComponent(m.storeId)}`,
            );
            return { ...m, store };
          } catch {
            return { ...m, store: null };
          }
        }),
      );
      return { merchants: merged, total: res.total };
    },
  );

  const merchants: MerchantWithStore[] = useMemo(
    () => data?.merchants ?? [],
    [data],
  );

  return (
    <section className="min-w-0">
      <header className="mb-8 border-b border-[var(--border)] pb-5">
        <h1 className="font-serif text-3xl text-black dark:text-white md:text-4xl">
          我的店铺
        </h1>
        <p className="mt-2 font-serif text-[14px] text-[color:var(--ink-muted)]">
          管理你的商家入驻申请; 认证通过后即可发布 Banner / 公告 / 活动 / 折扣.
        </p>
      </header>

      {isLoading && (
        <div className="flex h-40 items-center justify-center font-label text-[12px] uppercase tracking-widest text-[color:var(--ink-muted)]">
          加载中…
        </div>
      )}

      {!isLoading && error && (
        <div className="rounded border border-[var(--border)] bg-[var(--canvas-soft)] p-6 font-label text-[13px] text-[color:var(--ink-muted)]">
          加载失败: {error instanceof Error ? error.message : "请稍后重试"}
        </div>
      )}

      {!isLoading && !error && merchants.length === 0 && (
        <div className="rounded border border-[var(--border)] bg-[var(--canvas-soft)] p-10 text-center">
          <div className="font-serif text-[17px] text-[var(--ink)]">
            你还没有申请入驻任何店铺
          </div>
          <div className="mt-2 font-label text-[13px] text-[color:var(--ink-muted)]">
            在 App 的店铺详情页点击「我是商家」发起申请; 认证通过后即可在这里管理店铺.
          </div>
          <Link
            href="/stores"
            className="mt-5 inline-flex rounded bg-[var(--ink)] px-5 py-2 font-label text-[13px] text-[var(--canvas)] transition-opacity hover:opacity-80"
          >
            浏览买手店
          </Link>
        </div>
      )}

      {!isLoading && merchants.length > 0 && (
        <ul className="grid gap-4">
          {merchants.map((m) => (
            <MerchantCard key={m.id} merchant={m} />
          ))}
        </ul>
      )}
    </section>
  );
}

// ───────────────────────────── 子组件 ─────────────────────────────

function MerchantCard({ merchant }: { merchant: MerchantWithStore }) {
  const approved = merchant.status === "APPROVED";
  const storeName = merchant.store?.name || merchant.storeId;
  const storeLocation = merchant.store
    ? `${merchant.store.city}${merchant.store.country ? ", " + merchant.store.country : ""}`
    : "";

  return (
    <li className="rounded border border-[var(--border)] bg-[var(--canvas-soft)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Link
            href={`/stores/${encodeURIComponent(merchant.storeId)}`}
            className="font-serif text-[18px] text-[var(--ink)] hover:underline"
          >
            {storeName}
          </Link>
          {storeLocation && (
            <div className="mt-0.5 font-label text-[12px] text-[color:var(--ink-muted)]">
              {storeLocation}
            </div>
          )}
        </div>
        <StatusPill status={merchant.status} />
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-3">
        <Info label="联系人" value={merchant.contactName} />
        <Info label="联系电话" value={merchant.contactPhone} />
        <Info label="联系邮箱" value={merchant.contactEmail} />
      </dl>

      {merchant.status === "REJECTED" && merchant.rejectReason && (
        <div className="mt-4 rounded border border-[var(--border)] bg-[var(--canvas-raised)] p-3">
          <div className="font-label text-[11px] uppercase tracking-widest text-[color:var(--ink-muted)]">
            拒绝原因
          </div>
          <div className="mt-1 font-serif text-[13px] text-[var(--ink)]">
            {merchant.rejectReason}
          </div>
        </div>
      )}

      {approved && (
        <div className="mt-4 flex flex-wrap gap-1.5 font-label text-[11px]">
          {merchant.canPostBanner && <Pill>Banner</Pill>}
          {merchant.canPostAnnouncement && <Pill>公告</Pill>}
          {merchant.canPostActivity && <Pill>活动</Pill>}
          {merchant.canPostDiscount && <Pill>折扣</Pill>}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-3">
        <div className="font-label text-[11px] text-[color:var(--ink-muted)]">
          申请时间: {new Date(merchant.createdAt).toLocaleDateString("zh-CN")}
        </div>
        {approved ? (
          <Link
            href={`/me/merchant/${merchant.id}`}
            className="rounded bg-[var(--ink)] px-4 py-1.5 font-label text-[12px] text-[var(--canvas)] transition-opacity hover:opacity-80"
          >
            管理店铺 →
          </Link>
        ) : (
          <span className="font-label text-[12px] text-[color:var(--ink-muted)]">
            {merchant.status === "PENDING" && "等待管理员审核"}
            {merchant.status === "SUSPENDED" && "账号已暂停, 请联系管理员"}
          </span>
        )}
      </div>
    </li>
  );
}

function StatusPill({ status }: { status: MerchantStatus }) {
  const active = status === "APPROVED";
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-0.5 font-label text-[11px] ${
        active
          ? "bg-[var(--ink)] text-[var(--canvas)]"
          : "bg-[var(--canvas-raised)] text-[color:var(--ink-muted)]"
      }`}
    >
      {MERCHANT_STATUS_LABEL[status]}
    </span>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="font-label text-[11px] uppercase tracking-widest text-[color:var(--ink-muted)]">
        {label}
      </dt>
      <dd className="mt-0.5 font-serif text-[13px] text-[var(--ink)]">
        {value || "—"}
      </dd>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[var(--border)] px-2.5 py-0.5 text-[color:var(--ink-muted)]">
      {children}
    </span>
  );
}
