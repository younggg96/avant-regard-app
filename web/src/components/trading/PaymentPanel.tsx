"use client";

/**
 * 待付款订单的 web 端支付面板。
 *
 * 背景：中国 web 之前只能「回 App 支付」（见 PayInAppNotice），下单后卡在
 * pending_payment。这里在浏览器内直接完成支付闭环。
 *
 * 策略（对齐后端 `payment/factory.py`）：
 *   - 拉取 `/api/orders/{id}/payment-options`。
 *   - 若可用通道包含 `mock`（当前国内部署 `PAYMENT_PROVIDER=mock`，或联调环境
 *     `PAYMENT_ENABLE_MOCK=1`），走标准 `startPayment("mock") → confirmPayment`
 *     把订单推到 paid。`mock.confirm()` 恒成功，且该路径不受 `DEBUG` 限制，生产可用。
 *   - 否则（真实 alipay/wechat/stripe）暂时回退到 PayInAppNotice：这些通道目前只做了
 *     移动端 SDK，浏览器还没有跳转/扫码支付；而后端 alipay/wechat 的 confirm() 在
 *     没配密钥时是 stub，直接 confirm 会「未真正付款却标记已付」，故不放开。
 *
 * 待接入真实网页支付（alipay.trade.page.pay / 微信 Native 扫码）后，在这里补
 * 跳转 / 二维码轮询逻辑即可，无需改动订单详情页。
 */

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CreditCard } from "lucide-react";
import useSWR from "swr";

import { Button } from "@/components/admin/ui";
import { PayInAppNotice } from "@/components/trading/PayInAppNotice";
import { orderService, type Order } from "@/lib/services/order";
import { formatPriceCents } from "@/lib/services/store-product";

/** 与后端 `order_service.HOLD_TTL_MINUTES` 保持一致。 */
const HOLD_TTL_MS = 30 * 60 * 1000;

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function HoldCountdown({ order }: { order: Order }) {
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

  if (remaining == null) return null;

  return (
    <p
      className={`font-label text-[12px] ${
        expired
          ? "text-red-600 dark:text-red-400"
          : "text-[color:var(--ink-muted)]"
      }`}
    >
      {expired
        ? t("trading.holdExpired")
        : t("trading.holdExpiresIn", { time: formatRemaining(remaining) })}
    </p>
  );
}

export function PaymentPanel({
  order,
  onRefresh,
}: {
  order: Order;
  onRefresh: () => void | Promise<unknown>;
}) {
  const { t } = useTranslation();
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: options, isLoading } = useSWR(
    ["order-payment-options", order.id],
    () => orderService.listPaymentOptions(order.id),
  );

  const hasMock = options?.items?.some((o) => o.provider === "mock") ?? false;
  const amountCents = options?.amountCents ?? order.paidPriceCents;
  const currency = options?.currency ?? order.currency;

  const handlePay = async () => {
    setPaying(true);
    setError(null);
    try {
      // mock 通道：create_intent → confirm 恒成功，订单推进到 paid。
      await orderService.startPayment(order.id, "mock");
      await orderService.confirmPayment(order.id);
      await onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.failed"));
    } finally {
      setPaying(false);
    }
  };

  // 加载支付方式期间先占位；真实通道（无 mock）回退到 App 支付提示。
  if (isLoading) {
    return (
      <section className="rounded border border-[var(--border)] bg-[var(--canvas-soft)] p-5">
        <p className="font-label text-[13px] text-[color:var(--ink-muted)]">
          {t("trading.paymentPending")}…
        </p>
      </section>
    );
  }

  if (!hasMock) {
    return (
      <PayInAppNotice onRefresh={onRefresh}>
        <div className="mt-3">
          <HoldCountdown order={order} />
        </div>
      </PayInAppNotice>
    );
  }

  return (
    <section className="rounded border border-[var(--border)] bg-[var(--canvas-soft)] p-5">
      <div className="flex items-start gap-3">
        <CreditCard size={18} className="mt-0.5 shrink-0 text-[var(--ink)]" />
        <div className="min-w-0 flex-1">
          <h2 className="font-label text-[14px] font-semibold text-[var(--ink)]">
            {t("trading.payTitle")}
          </h2>

          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-label text-[12px] text-[color:var(--ink-muted)]">
              {t("trading.total")}
            </span>
            <span className="font-serif text-[20px] font-semibold text-[var(--ink)]">
              {formatPriceCents(amountCents, currency)}
            </span>
          </div>

          <div className="mt-3">
            <HoldCountdown order={order} />
          </div>

          {/* mock 通道说明：不会真实扣款，仅打通交易流程。 */}
          <p className="mt-3 rounded bg-[var(--canvas-raised)] px-3 py-2 font-label text-[12px] leading-relaxed text-[color:var(--ink-muted)]">
            {t("trading.paySimulatedNotice")}
          </p>

          {error && (
            <p className="mt-3 font-label text-[12px] text-red-600 dark:text-red-400">
              {error}
            </p>
          )}

          <div className="mt-4">
            <Button onClick={handlePay} disabled={paying}>
              {paying ? t("trading.paying") : t("trading.payNow")}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
