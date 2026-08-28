"use client";

/**
 * 订单列表里的单张订单卡片。
 *
 * 对齐移动端 `frontend/src/screens/Profile/components/OrderCard.tsx`：
 * 封面 + 标题 + 状态徽章 + 实付金额，右下角给一个角色相关的主操作
 * （买家待付款 → 去支付；买家已签收 → 确认收货；卖家待发货 → 发货）。
 */

import Link from "next/link";
import { useTranslation } from "react-i18next";

import { formatOrderStatus, type Order } from "@/lib/services/order";
import { formatPriceCents } from "@/lib/services/store-product";
import { orderStatusVisual } from "@/lib/trading/order-status";

export function OrderCard({ order }: { order: Order }) {
  const { t } = useTranslation();
  const visual = orderStatusVisual(order.status);
  const StatusIcon = visual.icon;
  const cover = order.product?.coverImage;

  return (
    <li className="rounded border border-[var(--border)] bg-[var(--canvas-soft)] transition-colors hover:bg-[var(--canvas-raised)]">
      <Link href={`/me/orders/${order.id}`} className="block p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="truncate font-label text-[11px] text-[color:var(--ink-muted)]">
            {t("trading.orderNo")} {order.orderNo}
          </span>
          <span
            className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 font-label text-[11px] ${visual.badgeClass}`}
          >
            <StatusIcon size={12} />
            {formatOrderStatus(order.status, t)}
          </span>
        </div>

        <div className="mt-3 flex gap-3">
          <div className="size-16 shrink-0 overflow-hidden rounded bg-[var(--canvas-raised)]">
            {cover && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={cover}
                alt={order.product?.title ?? ""}
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
            <p className="mt-0.5 truncate font-label text-[13px] text-[var(--ink)]">
              {order.product?.title ?? `#${order.productId}`}
            </p>
            <p className="mt-1.5 font-serif text-[15px] font-semibold text-[var(--ink)]">
              {formatPriceCents(order.paidPriceCents, order.currency)}
            </p>
          </div>
        </div>

      </Link>
    </li>
  );
}
