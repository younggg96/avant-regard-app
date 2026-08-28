"use client";

/**
 * /me/orders/[id] — 订单详情。
 *
 * 对齐移动端 `frontend/src/screens/Trading/OrderDetailScreen.tsx`：状态头图、
 * 进度时间轴、商品卡、费用明细、收货地址、物流轨迹，底部按角色给操作。
 *
 * 买家和卖家看的是同一个页面，按 order.buyerUserId 判角色——移动端也是这么做的，
 * 分成两个页面会让状态机逻辑重复一遍。
 */

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import useSWR from "swr";

import { Button, ConfirmDialog, LoadingState } from "@/components/admin/ui";
import { AfterSalesDialog } from "@/components/trading/AfterSalesDialog";
import {
  OrderTimeline,
  TrackingFeedList,
} from "@/components/trading/OrderTimeline";
import { PaymentHandoffCard } from "@/components/trading/PaymentHandoffCard";
import { ReviewDialog } from "@/components/trading/ReviewDialog";
import { ShipDialog } from "@/components/trading/ShipDialog";
import { useAuthStore } from "@/lib/auth/store";
import { formatShippingAddress } from "@/lib/services/address";
import { reviewService } from "@/lib/services/aftersales";
import { formatOrderStatus, orderService } from "@/lib/services/order";
import { formatPriceCents } from "@/lib/services/store-product";
import { orderStatusVisual } from "@/lib/trading/order-status";

export default function OrderDetailPage() {
  const { t } = useTranslation();
  const params = useParams<{ id: string }>();
  const orderId = Number(params.id);
  const user = useAuthStore((s) => s.user);

  const {
    data: order,
    isLoading,
    mutate,
  } = useSWR(Number.isFinite(orderId) ? ["order", orderId] : null, () =>
    orderService.getOrder(orderId),
  );

  const { data: tracking } = useSWR(
    order && ["shipped", "delivered", "completed", "settled"].includes(order.status)
      ? ["order-tracking", orderId]
      : null,
    () => orderService.getTrackingEvents(orderId),
  );

  const { data: reviewStatus, mutate: mutateReviewStatus } = useSWR(
    order && ["completed", "settled"].includes(order.status)
      ? ["order-review-status", orderId]
      : null,
    () => reviewService.getOrderReviewStatus(orderId),
  );

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [signOpen, setSignOpen] = useState(false);
  const [acting, setActing] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [afterSalesOpen, setAfterSalesOpen] = useState(false);
  const [shipOpen, setShipOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (isLoading) return <LoadingState />;
  if (!order) {
    return (
      <p className="font-label text-[13px] text-[color:var(--ink-muted)]">
        {t("common.loadFailed")}
      </p>
    );
  }

  const isBuyer = order.buyerUserId === user?.userId;
  const visual = orderStatusVisual(order.status);
  const StatusIcon = visual.icon;
  const shippingText = formatShippingAddress(order.shippingAddress);

  const runAction = async (action: () => Promise<unknown>) => {
    setActing(true);
    setActionError(null);
    try {
      await action();
      await mutate();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : t("common.failed"));
    } finally {
      setActing(false);
      setConfirmOpen(false);
      setSignOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/me/orders"
          className="font-label text-[12px] text-[color:var(--ink-muted)] transition-colors hover:text-[var(--ink)]"
        >
          ← {t("trading.ordersTitle")}
        </Link>
      </div>

      {/* 状态头图 */}
      <section
        className={`flex items-center gap-3 rounded border px-5 py-4 ${visual.badgeClass}`}
      >
        <StatusIcon size={20} className="shrink-0" />
        <div>
          <p className="font-label text-[15px] font-semibold">
            {formatOrderStatus(order.status, t)}
          </p>
          <p className="mt-0.5 font-label text-[11px] opacity-70">
            {t("trading.orderNo")} {order.orderNo}
          </p>
        </div>
      </section>

      {isBuyer && order.status === "pending_payment" && (
        <PaymentHandoffCard order={order} onRefresh={() => mutate()} />
      )}

      {/* 商品 */}
      <section className="rounded border border-[var(--border)] bg-[var(--canvas-soft)] p-4">
        <div className="flex gap-4">
          <div className="size-20 shrink-0 overflow-hidden rounded bg-[var(--canvas-raised)]">
            {order.product?.coverImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={order.product.coverImage}
                alt={order.product.title ?? ""}
                className="size-full object-cover"
              />
            )}
          </div>
          <div className="min-w-0 flex-1">
            {order.product?.brand && (
              <p className="font-label text-[11px] uppercase tracking-widest text-[color:var(--ink-muted)]">
                {order.product.brand}
              </p>
            )}
            <Link
              href={`/listings/${order.productId}`}
              className="mt-0.5 block font-label text-[13px] text-[var(--ink)] underline-offset-4 hover:underline"
            >
              {order.product?.title ?? `#${order.productId}`}
            </Link>
            <p className="mt-2 font-serif text-[16px] font-semibold text-[var(--ink)]">
              {formatPriceCents(order.paidPriceCents, order.currency)}
            </p>
          </div>
        </div>
      </section>

      {/* 进度 */}
      <section>
        <h2 className="mb-3 font-label text-[12px] uppercase tracking-widest text-[color:var(--ink-muted)]">
          {t("trading.orderDetail")}
        </h2>
        <OrderTimeline order={order} />
      </section>

      {/* 收货地址 */}
      <section>
        <h2 className="mb-2 font-label text-[12px] uppercase tracking-widest text-[color:var(--ink-muted)]">
          {t("trading.shippingAddressTitle")}
        </h2>
        <p className="font-label text-[13px] leading-relaxed text-[color:var(--ink-muted)]">
          {shippingText || t("trading.noShippingAddress")}
        </p>
      </section>

      {/* 物流 */}
      {tracking && (
        <section>
          <h2 className="mb-3 font-label text-[12px] uppercase tracking-widest text-[color:var(--ink-muted)]">
            {t("trading.tracking")}
          </h2>
          <TrackingFeedList feed={tracking} />
        </section>
      )}

      {/* 费用明细 */}
      <section>
        <h2 className="mb-2 font-label text-[12px] uppercase tracking-widest text-[color:var(--ink-muted)]">
          {t("trading.priceBreakdown")}
        </h2>
        <dl className="space-y-1.5 font-label text-[13px]">
          <div className="flex justify-between">
            <dt className="text-[color:var(--ink-muted)]">
              {t("trading.itemPrice")}
            </dt>
            <dd className="text-[var(--ink)]">
              {formatPriceCents(order.listingPriceCents, order.currency)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[color:var(--ink-muted)]">
              {t("trading.paidAmount")}
            </dt>
            <dd className="text-[var(--ink)]">
              {formatPriceCents(order.paidPriceCents, order.currency)}
            </dd>
          </div>
          {!isBuyer && (
            <>
              <div className="flex justify-between">
                <dt className="text-[color:var(--ink-muted)]">
                  {t("trading.commission")}
                </dt>
                <dd className="text-[var(--ink)]">
                  −{formatPriceCents(order.commissionCents, order.currency)}
                </dd>
              </div>
              <div className="flex justify-between border-t border-[var(--border)] pt-1.5">
                <dt className="text-[color:var(--ink-muted)]">
                  {t("trading.sellerPayout")}
                </dt>
                <dd className="font-semibold text-[var(--ink)]">
                  {formatPriceCents(order.sellerPayoutCents, order.currency)}
                </dd>
              </div>
            </>
          )}
        </dl>
      </section>

      {actionError && (
        <p className="font-label text-[12px] text-red-600 dark:text-red-400">
          {actionError}
        </p>
      )}

      {/* 操作 */}
      <section className="flex flex-wrap gap-2 border-t border-[var(--border)] pt-5">
        {isBuyer && order.status === "shipped" && (
          <Button onClick={() => setSignOpen(true)}>
            {t("trading.signReceipt")}
          </Button>
        )}
        {isBuyer && order.status === "delivered" && (
          <Button onClick={() => setConfirmOpen(true)}>
            {t("trading.confirmReceipt")}
          </Button>
        )}
        {isBuyer &&
          ["paid", "shipped", "delivered"].includes(order.status) && (
            <Button variant="secondary" onClick={() => setAfterSalesOpen(true)}>
              {t("trading.requestAfterSales")}
            </Button>
          )}
        {!isBuyer && order.status === "paid" && (
          <Button onClick={() => setShipOpen(true)}>
            {t("trading.shipOrder")}
          </Button>
        )}
        {!isBuyer &&
          ["paid", "shipped", "delivered", "disputed"].includes(
            order.status,
          ) && (
            <Link
              href="/me/after-sales"
              className="inline-flex items-center justify-center rounded border border-[var(--border)] px-4 py-2 font-label text-[13px] text-[color:var(--ink-muted)] transition-colors hover:text-[var(--ink)]"
            >
              {t("trading.sellerAfterSales")}
            </Link>
          )}
        {reviewStatus?.canReview && !reviewStatus.myReviewSubmitted && (
          <Button variant="secondary" onClick={() => setReviewOpen(true)}>
            {t("trading.writeReview")}
          </Button>
        )}
        {["completed", "settled"].includes(order.status) && (
          <Link
            href={`/me/orders/${order.id}/reviews`}
            className="inline-flex items-center justify-center rounded border border-[var(--border)] px-4 py-2 font-label text-[13px] text-[color:var(--ink-muted)] transition-colors hover:text-[var(--ink)]"
          >
            {t("trading.viewReviews")}
          </Link>
        )}
      </section>

      <ConfirmDialog
        open={signOpen}
        title={t("trading.signReceipt")}
        loading={acting}
        onConfirm={() => runAction(() => orderService.signReceipt(order.id))}
        onCancel={() => setSignOpen(false)}
      />

      <ConfirmDialog
        open={confirmOpen}
        title={t("trading.confirmReceipt")}
        message={t("trading.confirmReceiptWarning")}
        loading={acting}
        onConfirm={() => runAction(() => orderService.confirmOrder(order.id))}
        onCancel={() => setConfirmOpen(false)}
      />

      <ReviewDialog
        open={reviewOpen}
        orderId={order.id}
        onClose={() => setReviewOpen(false)}
        onSubmitted={() => mutateReviewStatus()}
      />

      <AfterSalesDialog
        open={afterSalesOpen}
        orderId={order.id}
        onClose={() => setAfterSalesOpen(false)}
        onSubmitted={() => mutate()}
      />

      <ShipDialog
        open={shipOpen}
        orderId={order.id}
        onClose={() => setShipOpen(false)}
        onShipped={() => mutate()}
      />
    </div>
  );
}
