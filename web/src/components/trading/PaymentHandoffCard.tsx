"use client";

/**
 * 待付款订单的支付交接卡片。
 *
 * 支付本身在 App 里完成（见 PayInAppNotice），这里额外负责库存锁倒计时：
 * 锁 30 分钟（后端 `HOLD_TTL_MINUTES`），按 createdAt 推算——`getOrder`
 * 不返回 hold 本身，所以这是估算值，只用来传达紧迫性。
 */

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { PayInAppNotice } from "@/components/trading/PayInAppNotice";
import type { Order } from "@/lib/services/order";

/** 与后端 `order_service.HOLD_TTL_MINUTES` 保持一致。 */
const HOLD_TTL_MS = 30 * 60 * 1000;

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function PaymentHandoffCard({
  order,
  onRefresh,
}: {
  order: Order;
  onRefresh: () => void;
}) {
  const { t } = useTranslation();
  const [now, setNow] = useState(() => Date.now());

  const createdAt = order.createdAt ? new Date(order.createdAt).getTime() : NaN;
  const expiresAt = Number.isNaN(createdAt) ? null : createdAt + HOLD_TTL_MS;
  const remaining = expiresAt == null ? null : expiresAt - now;
  const expired = remaining != null && remaining <= 0;

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <PayInAppNotice onRefresh={onRefresh}>
      {remaining != null && (
        <p
          className={`mt-3 font-label text-[12px] ${
            expired
              ? "text-red-600 dark:text-red-400"
              : "text-[color:var(--ink-muted)]"
          }`}
        >
          {expired
            ? t("trading.holdExpired")
            : t("trading.holdExpiresIn", { time: formatRemaining(remaining) })}
        </p>
      )}
    </PayInAppNotice>
  );
}
