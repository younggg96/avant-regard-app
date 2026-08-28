"use client";

/**
 * 「回 App 完成支付」提示卡。
 *
 * Web 端不接支付：后端的支付通道（Stripe PaymentSheet / 支付宝 / 微信）都是
 * 移动端 SDK 流程，`pay-mock` 又只在 DEBUG 下开放。商品订单、Plus 订阅、
 * 鉴定订单三处都会创建出待支付单据，共用这张卡片保持话术一致。
 */

import { useEffect, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Smartphone } from "lucide-react";

import { Button } from "@/components/admin/ui";
import { config } from "@/lib/config";

const APP_SCHEME_URL = "avantregard://";

export function PayInAppNotice({
  title,
  description,
  children,
  onRefresh,
}: {
  title?: string;
  description?: string;
  /** 额外内容，例如库存锁倒计时。 */
  children?: ReactNode;
  onRefresh?: () => void;
}) {
  const { t } = useTranslation();

  // 用户多半是切到 App 付款再切回来，回到前台时立刻对一次状态。
  useEffect(() => {
    if (!onRefresh) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") onRefresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [onRefresh]);

  return (
    <section className="rounded border border-[var(--border)] bg-[var(--canvas-soft)] p-5">
      <div className="flex items-start gap-3">
        <Smartphone size={18} className="mt-0.5 shrink-0 text-[var(--ink)]" />
        <div className="min-w-0 flex-1">
          <h2 className="font-label text-[14px] font-semibold text-[var(--ink)]">
            {title ?? t("trading.payInApp")}
          </h2>
          <p className="mt-1.5 font-label text-[13px] leading-relaxed text-[color:var(--ink-muted)]">
            {description ?? t("trading.payInAppDesc")}
          </p>

          {children}

          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href={APP_SCHEME_URL}
              className="inline-flex items-center justify-center rounded bg-[var(--ink)] px-4 py-2 font-label text-[13px] text-[var(--canvas)] transition-opacity hover:opacity-80"
            >
              {t("trading.openInApp")}
            </a>
            <a
              href={config.appStoreUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded border border-[var(--border)] px-4 py-2 font-label text-[13px] text-[color:var(--ink-muted)] transition-colors hover:text-[var(--ink)]"
            >
              {t("trading.getTheApp")}
            </a>
            {onRefresh && (
              <Button variant="ghost" onClick={onRefresh}>
                {t("trading.refreshStatus")}
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
