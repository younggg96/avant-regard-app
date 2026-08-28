"use client";

/**
 * 价格基准柱状图（PRD 3.3）。
 *
 * 移动端只有 service、没有对应界面，所以这里是 web 独有的实现。
 *
 * 口径说明：后端按「品牌 + 可选 SKU 维度」聚合最近 N 个月的真实成交价，
 * 等宽分桶。这里只按品牌查——同时带上 condition / size 会让样本急剧变少，
 * 大多数单品会直接落到 sampleSize=0 而整块消失。
 *
 * sampleSize 为 0（或接口不可用）时整块不渲染：与其给一个空图，
 * 不如什么都不显示。
 */

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import useSWR from "swr";

import { getPriceHistory } from "@/lib/services/trading-extras";
import { formatPriceCents } from "@/lib/services/store-product";

const MONTHS = 6;

export function PriceBenchmark({
  brand,
  currency,
  currentPriceCents,
}: {
  brand: string;
  currency?: string | null;
  currentPriceCents: number;
}) {
  const { t } = useTranslation();
  const cur = currency ?? undefined;

  const { data } = useSWR(
    brand ? ["price-history", brand] : null,
    () => getPriceHistory({ brand, months: MONTHS }),
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );

  const maxCount = useMemo(
    () => Math.max(1, ...(data?.buckets ?? []).map((b) => b.count)),
    [data],
  );

  if (!data || data.sampleSize === 0 || data.buckets.length === 0) return null;

  const { medianPriceCents, p25PriceCents, p75PriceCents } = data;
  const diffPct =
    medianPriceCents > 0
      ? Math.round(
          ((currentPriceCents - medianPriceCents) / medianPriceCents) * 100,
        )
      : 0;

  const verdict =
    diffPct > 2
      ? t("trading.priceBenchmark.above", { percent: Math.abs(diffPct) })
      : diffPct < -2
        ? t("trading.priceBenchmark.below", { percent: Math.abs(diffPct) })
        : t("trading.priceBenchmark.atMedian");

  return (
    <section className="mt-12 border-t border-[var(--border)] pt-8">
      <h2 className="font-serif text-[20px] text-[var(--ink)]">
        {t("trading.priceBenchmark.title")}
      </h2>
      <p className="mt-1 font-label text-[12px] text-[color:var(--ink-muted)]">
        {t("trading.priceBenchmark.subtitle", {
          brand,
          months: MONTHS,
          count: data.sampleSize,
        })}
      </p>

      <dl className="mt-5 grid grid-cols-3 gap-4">
        <Stat
          label={t("trading.priceBenchmark.p25")}
          value={formatPriceCents(p25PriceCents, cur)}
        />
        <Stat
          label={t("trading.priceBenchmark.median")}
          value={formatPriceCents(medianPriceCents, cur)}
          emphasis
        />
        <Stat
          label={t("trading.priceBenchmark.p75")}
          value={formatPriceCents(p75PriceCents, cur)}
        />
      </dl>

      <div className="mt-6">
        <div className="flex h-28 items-end gap-1.5">
          {data.buckets.map((b) => (
            <div
              key={b.bucketLabel}
              className="group relative flex flex-1 flex-col items-center justify-end"
            >
              <span
                className="w-full rounded-t bg-[var(--ink)] opacity-70 transition-opacity group-hover:opacity-100"
                style={{
                  height: `${Math.max(4, (b.count / maxCount) * 100)}%`,
                }}
              />
              {/* 悬停才显示区间与笔数，避免 8 个桶的标签互相挤压 */}
              <span className="pointer-events-none absolute bottom-full mb-1 hidden whitespace-nowrap rounded bg-[var(--ink)] px-1.5 py-0.5 font-label text-[10px] text-[var(--canvas)] group-hover:block">
                {formatPriceCents(b.avgPriceCents, cur)} ·{" "}
                {t("trading.priceBenchmark.sampleCount", { count: b.count })}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex justify-between font-label text-[10px] text-[color:var(--ink-muted)]">
          <span>{formatPriceCents(data.minPriceCents, cur)}</span>
          <span>{formatPriceCents(data.maxPriceCents, cur)}</span>
        </div>
      </div>

      <p className="mt-4 font-label text-[12px] text-[var(--ink)]">
        {t("trading.priceBenchmark.thisItem", {
          price: formatPriceCents(currentPriceCents, cur),
        })}
        <span className="text-[color:var(--ink-muted)]"> · {verdict}</span>
      </p>
    </section>
  );
}

function Stat({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="rounded border border-[var(--border)] bg-[var(--canvas-soft)] px-3 py-2.5">
      <dt className="font-label text-[11px] text-[color:var(--ink-muted)]">
        {label}
      </dt>
      <dd
        className={`mt-0.5 font-serif ${
          emphasis
            ? "text-[18px] font-semibold text-[var(--ink)]"
            : "text-[15px] text-[var(--ink)]"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
