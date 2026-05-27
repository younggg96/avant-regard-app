"use client";

/**
 * Admin · 交易订单总览
 *
 * 跨所有用户的订单 / GMV / 平台佣金 / 卖家实收。后端接口见
 * `backend/app/api/routes/orders.py` 内的 admin_orders_router。
 *
 * 设计要点：
 *   - 顶部状态卡 = 统计聚合（默认 30 天，可切 7 / 30 / 90 / 全部）
 *   - 中间过滤区 = 订单号搜索 + 状态 Chips
 *   - 主表 = 跨用户列表 + 行内「详情」按钮
 *   - 详情抽屉 = FormDialog 复用,展示买卖双方、商品、金额拆分、时间轴、物流、待结算
 */

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { useTranslation } from "react-i18next";
import {
  adminOrdersApi,
  type AdminOrder,
  type AdminOrderDetail,
  type AdminOrderStats,
  type AdminOrderStatus,
  type AdminOrderCurrencyAmount,
} from "@/lib/services/admin";
import {
  PageHeader,
  SearchBar,
  FilterChips,
  StatusBadge,
  Pagination,
  EmptyState,
  LoadingState,
  FormDialog,
} from "@/components/admin/ui";

const PAGE_SIZE = 20;

const ORDER_STATUSES: AdminOrderStatus[] = [
  "pending_payment",
  "paid",
  "shipped",
  "delivered",
  "completed",
  "settled",
  "refunded",
  "refunded_auto",
  "disputed",
  "resolved",
];

const STATUS_LABEL_KEY: Record<AdminOrderStatus, string> = {
  pending_payment: "admin.orderStatusPendingPayment",
  paid: "admin.orderStatusPaid",
  shipped: "admin.orderStatusShipped",
  delivered: "admin.orderStatusDelivered",
  completed: "admin.orderStatusCompleted",
  settled: "admin.orderStatusSettled",
  refunded: "admin.orderStatusRefunded",
  refunded_auto: "admin.orderStatusRefundedAuto",
  disputed: "admin.orderStatusDisputed",
  resolved: "admin.orderStatusResolved",
};

/** 按 currency 格式化 cents → 「¥1,234.56」 / 「$12.34」 / 「12.34 EUR」 */
function formatMoney(cents: number | null | undefined, currency = "CNY"): string {
  const v = (cents ?? 0) / 100;
  const symbol =
    currency === "CNY" ? "¥" : currency === "USD" ? "$" : currency === "EUR" ? "€" : "";
  const formatted = v.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return symbol ? `${symbol}${formatted}` : `${formatted} ${currency}`;
}

/** 多币种金额聚合卡片：每种货币一行。空时显示 "—"。 */
function CurrencyTotals({ items }: { items: AdminOrderCurrencyAmount[] }) {
  if (!items || items.length === 0) {
    return <span className="text-[color:var(--ink-muted)]">—</span>;
  }
  return (
    <div className="flex flex-col gap-0.5">
      {items.map((it) => (
        <span key={it.currency} className="tabular-nums">
          {formatMoney(it.amountCents, it.currency)}
        </span>
      ))}
    </div>
  );
}

function StatsCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[var(--border)] p-4">
      <div className="font-label text-[11px] uppercase tracking-widest text-[color:var(--ink-muted)]">
        {label}
      </div>
      <div className="mt-1.5 font-label text-[18px] font-semibold leading-tight">{value}</div>
    </div>
  );
}

export default function AdminOrdersPage() {
  const { t } = useTranslation();

  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<AdminOrderStatus | undefined>();

  const [stats, setStats] = useState<AdminOrderStats | null>(null);
  const [statsDays, setStatsDays] = useState<number>(30);
  const [statsLoading, setStatsLoading] = useState(true);

  const [detailId, setDetailId] = useState<number | null>(null);
  const [detail, setDetail] = useState<AdminOrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminOrdersApi.list({
        page,
        pageSize: PAGE_SIZE,
        status: statusFilter,
        keyword: keyword || undefined,
      });
      setOrders(data.items);
      setTotal(data.total);
      setTotalPages(Math.max(1, Math.ceil(data.total / PAGE_SIZE)));
    } finally {
      setLoading(false);
    }
  }, [page, keyword, statusFilter]);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const s = await adminOrdersApi.stats(statsDays);
      setStats(s);
    } finally {
      setStatsLoading(false);
    }
  }, [statsDays]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    setPage(1);
  }, [keyword, statusFilter]);

  const openDetail = async (orderId: number) => {
    setDetailId(orderId);
    setDetail(null);
    setDetailLoading(true);
    try {
      const d = await adminOrdersApi.detail(orderId);
      setDetail(d);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setDetailId(null);
    setDetail(null);
  };

  const statusOptions = ORDER_STATUSES.map((s) => ({
    value: s,
    label: t(STATUS_LABEL_KEY[s]),
  }));

  const STATS_RANGES: { value: number; label: string }[] = [
    { value: 7, label: t("admin.statsRange7") },
    { value: 30, label: t("admin.statsRange30") },
    { value: 90, label: t("admin.statsRange90") },
    { value: 0, label: t("admin.statsRangeAllLabel") },
  ];

  return (
    <div>
      <PageHeader title={t("admin.orders")} description={t("admin.ordersDesc")} />

      {/* ───── 顶部聚合统计 ───── */}
      <div className="mb-4 flex items-center justify-between">
        <span className="font-label text-[12px] text-[color:var(--ink-muted)]">
          {statsDays > 0
            ? t("admin.statsRangeDays", { days: statsDays })
            : t("admin.statsRangeAll")}
        </span>
        <div className="flex gap-1.5">
          {STATS_RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setStatsDays(r.value)}
              className={`rounded-full border px-3 py-1 font-label text-[12px] transition-colors ${
                r.value === statsDays
                  ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--canvas)]"
                  : "border-[var(--border)] text-[color:var(--ink-muted)] hover:border-[var(--ink-muted)]"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {statsLoading ? (
        <div className="mb-8">
          <LoadingState />
        </div>
      ) : stats ? (
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatsCard
            label={t("admin.statTotalOrders")}
            value={<span className="tabular-nums">{stats.totalOrders}</span>}
          />
          <StatsCard
            label={t("admin.statCompletedOrders")}
            value={<span className="tabular-nums">{stats.completedOrders}</span>}
          />
          <StatsCard
            label={t("admin.statRefundedOrders")}
            value={<span className="tabular-nums">{stats.refundedOrders}</span>}
          />
          <StatsCard label={t("admin.statGmv")} value={<CurrencyTotals items={stats.gmv} />} />
          <StatsCard
            label={t("admin.statCommission")}
            value={<CurrencyTotals items={stats.commission} />}
          />
          <StatsCard
            label={t("admin.statSellerPayout")}
            value={<CurrencyTotals items={stats.sellerPayout} />}
          />
        </div>
      ) : null}

      {/* ───── 过滤区 ───── */}
      <div className="mb-3 max-w-sm">
        <SearchBar value={keyword} onChange={setKeyword} placeholder={t("admin.searchOrder")} />
      </div>
      <div className="mb-4">
        <FilterChips
          options={statusOptions}
          value={statusFilter}
          onChange={setStatusFilter}
          allLabel={t("admin.filterAllStatus")}
        />
      </div>

      {/* ───── 列表 ───── */}
      {loading ? (
        <LoadingState />
      ) : orders.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="mb-3 font-label text-[12px] text-[color:var(--ink-muted)]">
            {t("admin.ordersTotal", { count: total })}
          </div>
          <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
            <table className="w-full font-label text-[13px]">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--canvas-soft)]">
                  <th className="px-4 py-2.5 text-left text-[11px] tracking-wider text-[color:var(--ink-muted)]">
                    {t("admin.colOrderNo")}
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] tracking-wider text-[color:var(--ink-muted)]">
                    {t("admin.colProduct")}
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] tracking-wider text-[color:var(--ink-muted)]">
                    {t("admin.colBuyer")}
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] tracking-wider text-[color:var(--ink-muted)]">
                    {t("admin.colSeller")}
                  </th>
                  <th className="px-4 py-2.5 text-right text-[11px] tracking-wider text-[color:var(--ink-muted)]">
                    {t("admin.colAmount")}
                  </th>
                  <th className="px-4 py-2.5 text-right text-[11px] tracking-wider text-[color:var(--ink-muted)]">
                    {t("admin.colCommission")}
                  </th>
                  <th className="px-4 py-2.5 text-right text-[11px] tracking-wider text-[color:var(--ink-muted)]">
                    {t("admin.colPayout")}
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] tracking-wider text-[color:var(--ink-muted)]">
                    {t("admin.colOrderStatus")}
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] tracking-wider text-[color:var(--ink-muted)]">
                    {t("admin.colCreatedAt")}
                  </th>
                  <th className="px-4 py-2.5 text-right text-[11px] tracking-wider text-[color:var(--ink-muted)]">
                    {t("admin.colActions")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-[var(--canvas-soft)] transition-colors">
                    <td className="px-4 py-3 font-mono text-[12px]">{o.orderNo}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {o.product?.coverImage ? (
                          <Image
                            src={o.product.coverImage}
                            alt=""
                            width={32}
                            height={32}
                            className="h-8 w-8 rounded object-cover"
                          />
                        ) : (
                          <div className="h-8 w-8 rounded bg-[var(--canvas-raised)]" />
                        )}
                        <div className="min-w-0">
                          <div className="max-w-[180px] truncate">
                            {o.product?.title || `#${o.productId}`}
                          </div>
                          {o.product?.brand && (
                            <div className="text-[11px] text-[color:var(--ink-muted)]">
                              {o.product.brand}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[color:var(--ink-muted)]">
                      {o.buyer ? `@${o.buyer.username}` : `#${o.buyerUserId}`}
                    </td>
                    <td className="px-4 py-3 text-[color:var(--ink-muted)]">
                      {o.seller
                        ? `@${o.seller.username}`
                        : o.merchant?.storeName
                          ? o.merchant.storeName
                          : "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatMoney(o.paidPriceCents, o.currency)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-[color:var(--ink-muted)]">
                      {formatMoney(o.commissionCents, o.currency)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatMoney(o.sellerPayoutCents, o.currency)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        active={["paid", "shipped", "delivered", "completed", "settled"].includes(
                          o.status,
                        )}
                      >
                        {t(STATUS_LABEL_KEY[o.status] || "admin.unknown")}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[color:var(--ink-muted)]">
                      {o.createdAt ? new Date(o.createdAt).toLocaleString() : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openDetail(o.id)}
                        className="rounded px-2 py-1 text-[12px] text-[color:var(--ink-muted)] transition-colors hover:bg-[var(--canvas-raised)] hover:text-[var(--ink)]"
                      >
                        {t("admin.viewDetail")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </>
      )}

      {/* ───── 详情抽屉 ───── */}
      <FormDialog
        open={detailId !== null}
        title={t("admin.orderDetailTitle", { orderNo: detail?.orderNo ?? "" })}
        onClose={closeDetail}
        wide
      >
        {detailLoading || !detail ? (
          <LoadingState />
        ) : (
          <OrderDetailBody detail={detail} />
        )}
      </FormDialog>
    </div>
  );
}

// ─── 详情面板 ────────────────────────────────────────────────────────────────

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h4 className="font-label text-[11px] uppercase tracking-widest text-[color:var(--ink-muted)]">
        {title}
      </h4>
      <div className="rounded-lg border border-[var(--border)] p-3 font-label text-[13px]">
        {children}
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1">
      <span className="text-[12px] text-[color:var(--ink-muted)]">{label}</span>
      <span className="text-right">{value || "—"}</span>
    </div>
  );
}

function PartyBlock({ label, user }: { label: string; user?: { username: string; phone?: string; email?: string; avatarUrl?: string | null } | null }) {
  if (!user) {
    return <Row label={label} value="—" />;
  }
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <span className="text-[12px] text-[color:var(--ink-muted)]">{label}</span>
      <div className="flex items-center gap-2">
        {user.avatarUrl ? (
          <Image
            src={user.avatarUrl}
            alt=""
            width={24}
            height={24}
            className="h-6 w-6 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--canvas-raised)] text-[10px] font-medium">
            {user.username?.[0]?.toUpperCase() ?? "?"}
          </div>
        )}
        <div className="text-right">
          <div>@{user.username}</div>
          {(user.phone || user.email) && (
            <div className="text-[11px] text-[color:var(--ink-muted)]">
              {user.phone || user.email}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function OrderDetailBody({ detail }: { detail: AdminOrderDetail }) {
  const { t } = useTranslation();
  const c = detail.currency;
  const fmt = (cents?: number | null) => formatMoney(cents, c);

  const shippingAddr = detail.shippingAddress as
    | { name?: string; phone?: string; province?: string; city?: string; district?: string; detail?: string; address?: string }
    | undefined
    | null;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* 商品信息 */}
      <Section title={t("admin.orderDetailProduct")}>
        <div className="flex items-start gap-3">
          {detail.product?.coverImage ? (
            <Image
              src={detail.product.coverImage}
              alt=""
              width={64}
              height={64}
              className="h-16 w-16 rounded object-cover"
            />
          ) : (
            <div className="h-16 w-16 rounded bg-[var(--canvas-raised)]" />
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium">{detail.product?.title || `#${detail.productId}`}</div>
            {detail.product?.brand && (
              <div className="text-[12px] text-[color:var(--ink-muted)]">{detail.product.brand}</div>
            )}
            <div className="mt-1 text-[12px] text-[color:var(--ink-muted)]">
              ID: {detail.productId}
            </div>
          </div>
        </div>
      </Section>

      {/* 买卖双方 */}
      <Section title={t("admin.orderDetailParties")}>
        <PartyBlock label={t("admin.orderDetailBuyerLabel")} user={detail.buyer} />
        <PartyBlock label={t("admin.orderDetailSellerLabel")} user={detail.seller} />
        {detail.merchant && (
          <Row
            label={t("admin.orderDetailMerchantLabel")}
            value={detail.merchant.storeName || detail.merchant.storeId || `#${detail.merchant.id}`}
          />
        )}
      </Section>

      {/* 金额拆分 */}
      <Section title={t("admin.orderDetailAmount")}>
        <Row label={t("admin.orderDetailListingPrice")} value={fmt(detail.listingPriceCents)} />
        <Row label={t("admin.orderDetailPaidPrice")} value={fmt(detail.paidPriceCents)} />
        <Row
          label={t("admin.orderDetailCommissionRate")}
          value={`${(detail.commissionRateBps / 100).toFixed(2)}%`}
        />
        <Row label={t("admin.statCommission")} value={fmt(detail.commissionCents)} />
        <Row label={t("admin.orderDetailPayoutAmount")} value={fmt(detail.sellerPayoutCents)} />
      </Section>

      {/* 时间轴 */}
      <Section title={t("admin.orderDetailTimeline")}>
        <Row label={t("admin.orderTimelineCreated")} value={detail.createdAt ? new Date(detail.createdAt).toLocaleString() : "—"} />
        <Row label={t("admin.orderTimelinePaid")} value={detail.paidAt ? new Date(detail.paidAt).toLocaleString() : "—"} />
        <Row label={t("admin.orderTimelineShippingDue")} value={detail.shippingDueAt ? new Date(detail.shippingDueAt).toLocaleString() : "—"} />
        <Row label={t("admin.orderTimelineShipped")} value={detail.shippedAt ? new Date(detail.shippedAt).toLocaleString() : "—"} />
        <Row label={t("admin.orderTimelineDelivered")} value={detail.deliveredAt ? new Date(detail.deliveredAt).toLocaleString() : "—"} />
        <Row label={t("admin.orderTimelineAutoConfirmDue")} value={detail.autoConfirmDueAt ? new Date(detail.autoConfirmDueAt).toLocaleString() : "—"} />
        <Row label={t("admin.orderTimelineCompleted")} value={detail.completedAt ? new Date(detail.completedAt).toLocaleString() : "—"} />
        <Row label={t("admin.orderTimelineSettlementDue")} value={detail.settlementDueAt ? new Date(detail.settlementDueAt).toLocaleString() : "—"} />
        <Row label={t("admin.orderTimelineSettled")} value={detail.settledAt ? new Date(detail.settledAt).toLocaleString() : "—"} />
        {detail.refundedAt && (
          <Row label={t("admin.orderTimelineRefunded")} value={new Date(detail.refundedAt).toLocaleString()} />
        )}
        {detail.cancelReason && (
          <Row label={t("admin.cancelReason")} value={detail.cancelReason} />
        )}
      </Section>

      {/* 物流凭证 */}
      <Section title={t("admin.orderDetailLogistics")}>
        {detail.shipment ? (
          <>
            <Row label={t("admin.shippingCarrier")} value={detail.shipment.carrier || "—"} />
            <Row label={t("admin.shippingTrackingNo")} value={detail.shipment.trackingNo || "—"} />
            {detail.shipment.latestDescription && (
              <Row label={t("admin.shippingLatestStatus")} value={detail.shipment.latestDescription} />
            )}
            {detail.shipment.latestLocation && (
              <Row label={t("admin.shippingLatestLocation")} value={detail.shipment.latestLocation} />
            )}
          </>
        ) : (
          <span className="text-[color:var(--ink-muted)]">{t("admin.noShipment")}</span>
        )}
      </Section>

      {/* 卖家待结算 */}
      <Section title={t("admin.orderDetailPayout")}>
        {detail.pendingPayout ? (
          <>
            <Row
              label={t("admin.orderDetailPayoutAmount")}
              value={formatMoney(detail.pendingPayout.amountCents, detail.pendingPayout.currency)}
            />
            <Row
              label={t("admin.colOrderStatus")}
              value={
                <StatusBadge active={detail.pendingPayout.status === "locked"}>
                  {detail.pendingPayout.status === "locked"
                    ? t("admin.payoutStatusLocked")
                    : detail.pendingPayout.status === "released"
                      ? t("admin.payoutStatusReleased")
                      : t("admin.payoutStatusReversed")}
                </StatusBadge>
              }
            />
            {detail.pendingPayout.releaseAt && (
              <Row
                label={t("admin.payoutReleaseAt")}
                value={new Date(detail.pendingPayout.releaseAt).toLocaleString()}
              />
            )}
          </>
        ) : (
          <span className="text-[color:var(--ink-muted)]">{t("admin.noPendingPayout")}</span>
        )}
      </Section>

      {/* 收货地址 */}
      {shippingAddr && (
        <Section title={t("admin.orderDetailShipping")}>
          {shippingAddr.name && <Row label={t("admin.orderDetailBuyerLabel")} value={shippingAddr.name} />}
          {shippingAddr.phone && <Row label={t("admin.shippingCarrier")} value={shippingAddr.phone} />}
          <Row
            label={t("admin.orderDetailShipping")}
            value={
              [shippingAddr.province, shippingAddr.city, shippingAddr.district, shippingAddr.detail || shippingAddr.address]
                .filter(Boolean)
                .join(" ") || "—"
            }
          />
        </Section>
      )}

      {/* 支付信息 */}
      <Section title={t("admin.orderDetailPayment")}>
        <Row label={t("admin.paymentProvider")} value={detail.paymentProvider || "—"} />
        <Row label={t("admin.paymentIntent")} value={
          detail.paymentIntentId
            ? <span className="font-mono text-[11px] break-all">{detail.paymentIntentId}</span>
            : "—"
        } />
      </Section>
    </div>
  );
}
