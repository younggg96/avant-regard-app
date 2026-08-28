"use client";

/**
 * /me/orders — 我的订单。
 *
 * 对齐移动端 `frontend/src/screens/Profile/components/TradingContent.tsx`：
 * 「我买到的 / 我卖出的」两个 tab，各自带一排状态筛选 chip。
 *
 * 筛选在前端做而不是每次打后端：「已完成」「售后」是把多个后端状态合并成
 * 一个 chip 的（见 ORDER_FILTER_STATUSES），按 chip 请求会变成多次往返。
 */

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import useSWR from "swr";

import { EmptyState, LoadingState, PageHeader } from "@/components/admin/ui";
import { OrderCard } from "@/components/trading/OrderCard";
import { orderService } from "@/lib/services/order";
import {
  ORDER_FILTER_KEYS,
  matchesOrderFilter,
  type OrderFilterKey,
} from "@/lib/trading/order-status";

const FILTER_LABEL_KEY: Record<OrderFilterKey, string> = {
  all: "trading.filterAll",
  pending_payment: "trading.filterPendingPayment",
  paid: "trading.filterPaid",
  shipped: "trading.filterShipped",
  completed: "trading.filterCompleted",
  after_sales: "trading.filterAfterSales",
};

const PAGE_SIZE = 50;

export default function MyOrdersPage() {
  const { t } = useTranslation();
  const [role, setRole] = useState<"buyer" | "seller">("buyer");
  const [filter, setFilter] = useState<OrderFilterKey>("all");

  const { data, isLoading } = useSWR(["my-orders", role], () =>
    role === "buyer"
      ? orderService.listMyOrders({ pageSize: PAGE_SIZE })
      : orderService.listMySales({ pageSize: PAGE_SIZE }),
  );

  const orders = useMemo(
    () => (data?.items ?? []).filter((o) => matchesOrderFilter(o.status, filter)),
    [data, filter],
  );

  return (
    <div>
      <PageHeader title={t("trading.ordersTitle")} />

      <div className="mb-4 flex gap-1 border-b border-[var(--border)]">
        {(["buyer", "seller"] as const).map((key) => (
          <button
            key={key}
            onClick={() => setRole(key)}
            className={`-mb-px border-b-2 px-3 pb-2 font-label text-[13px] transition-colors ${
              role === key
                ? "border-[var(--ink)] text-[var(--ink)]"
                : "border-transparent text-[color:var(--ink-muted)] hover:text-[var(--ink)]"
            }`}
          >
            {key === "buyer" ? t("trading.buying") : t("trading.selling")}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5 font-label text-[12px]">
        {ORDER_FILTER_KEYS.map((key) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`rounded-full border px-3 py-1 transition-colors ${
              filter === key
                ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--canvas)]"
                : "border-[var(--border)] text-[color:var(--ink-muted)] hover:border-[var(--ink-muted)]"
            }`}
          >
            {t(FILTER_LABEL_KEY[key])}
          </button>
        ))}
      </div>

      {isLoading ? (
        <LoadingState />
      ) : orders.length === 0 ? (
        <EmptyState
          message={
            role === "buyer" ? t("trading.emptyOrders") : t("trading.emptySales")
          }
        />
      ) : (
        <ul className="space-y-3">
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </ul>
      )}
    </div>
  );
}
