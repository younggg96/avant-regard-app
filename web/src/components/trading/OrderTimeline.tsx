"use client";

/**
 * 订单进度时间轴与物流轨迹。
 *
 * 对齐移动端 `OrderDetailScreen` 里的状态时间轴：正常履约路径画成 5 个节点，
 * 退款 / 争议这类分支状态不进时间轴（由状态头图表达），见 isOffTimelineStatus。
 */

import { useTranslation } from "react-i18next";

import { formatOrderStatus, type Order, type TrackingFeed } from "@/lib/services/order";
import {
  ORDER_TIMELINE_STEPS,
  isOffTimelineStatus,
  orderTimelineIndex,
} from "@/lib/trading/order-status";

function formatDateTime(iso?: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
}

export function OrderTimeline({ order }: { order: Order }) {
  const { t } = useTranslation();

  if (isOffTimelineStatus(order.status)) return null;

  const currentIndex = orderTimelineIndex(order.status);
  const timestamps: Record<string, string | null | undefined> = {
    pending_payment: order.createdAt,
    paid: order.paidAt,
    shipped: order.shippedAt,
    delivered: order.deliveredAt,
    completed: order.completedAt,
  };

  return (
    <ol className="space-y-0">
      {ORDER_TIMELINE_STEPS.map((step, index) => {
        const reached = index <= currentIndex;
        const isLast = index === ORDER_TIMELINE_STEPS.length - 1;
        const time = formatDateTime(timestamps[step]);

        return (
          <li key={step} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={`mt-1 size-2 shrink-0 rounded-full ${
                  reached ? "bg-[var(--ink)]" : "bg-[var(--border)]"
                }`}
              />
              {!isLast && (
                <span
                  className={`w-px flex-1 ${
                    index < currentIndex ? "bg-[var(--ink)]" : "bg-[var(--border)]"
                  }`}
                />
              )}
            </div>
            <div className={`pb-5 ${isLast ? "pb-0" : ""}`}>
              <p
                className={`font-label text-[13px] ${
                  reached
                    ? "text-[var(--ink)]"
                    : "text-[color:var(--ink-muted)]"
                }`}
              >
                {formatOrderStatus(step, t)}
              </p>
              {time && reached && (
                <p className="mt-0.5 font-label text-[11px] text-[color:var(--ink-muted)]">
                  {time}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function TrackingFeedList({ feed }: { feed: TrackingFeed | undefined }) {
  const { t } = useTranslation();
  const events = feed?.items ?? [];

  if (events.length === 0) {
    return (
      <p className="font-label text-[13px] text-[color:var(--ink-muted)]">
        {t("trading.noTracking")}
      </p>
    );
  }

  return (
    <ol className="space-y-4">
      {events.map((event) => (
        <li key={event.id} className="flex gap-3">
          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--ink-muted)]" />
          <div className="min-w-0">
            <p className="font-label text-[13px] text-[var(--ink)]">
              {event.description || event.statusCode}
            </p>
            <p className="mt-0.5 font-label text-[11px] text-[color:var(--ink-muted)]">
              {[formatDateTime(event.occurredAt), event.location]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
