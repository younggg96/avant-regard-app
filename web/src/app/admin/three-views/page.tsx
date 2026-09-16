"use client";

/**
 * 数字护照 · AI 三视图管理。
 *
 * 三件事：
 *   1. 看用量 —— gpt-image-1 按张计费，成功/失败/已下架的张数直接影响账单
 *   2. 核对质量 —— 源图和生成图并排放，一眼看出模型有没有跑偏
 *      （烟测时出现过把配饰保留下来、把"平铺"做成幽灵模特的情况）
 *   3. 下架不合格的图 —— 记录保留（钱已经花了要留着算账），但会从所有引用它的
 *      档案的 photos / ai_photos 里摘掉，否则公开验证页还会继续展示
 */

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  adminThreeViewApi,
  type AdminThreeView,
  type AdminThreeViewStats,
} from "@/lib/services/admin";
import {
  PageHeader,
  FilterChips,
  StatusBadge,
  Pagination,
  EmptyState,
  LoadingState,
  Button,
  PromptDialog,
} from "@/components/admin/ui";

const PAGE_SIZE = 20;

/** 单张三视图常在 ¥0.5 这个量级，两位小数会把差异抹平，所以留到 4 位。 */
function formatMoney(amount: number, currency: string) {
  const symbol: Record<string, string> = { CNY: "¥", USD: "$" };
  const text = amount.toFixed(4).replace(/\.?0+$/, "");
  return `${symbol[currency] ?? `${currency} `}${text}`;
}

export default function AdminThreeViewsPage() {
  const { t } = useTranslation();

  const STATUS_OPTIONS = [
    { value: "success" as const, label: t("admin.threeViews.statusSuccess") },
    { value: "failed" as const, label: t("admin.threeViews.statusFailed") },
    { value: "disabled" as const, label: t("admin.threeViews.statusDisabled") },
  ];
  type Status = (typeof STATUS_OPTIONS)[number]["value"];

  const VIEW_LABEL: Record<string, string> = {
    front: t("admin.threeViews.viewFront"),
    side: t("admin.threeViews.viewSide"),
    back: t("admin.threeViews.viewBack"),
  };

  const [items, setItems] = useState<AdminThreeView[]>([]);
  const [stats, setStats] = useState<AdminThreeViewStats | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<Status>();
  const [loading, setLoading] = useState(true);
  const [disabling, setDisabling] = useState<AdminThreeView | null>(null);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, s] = await Promise.all([
        adminThreeViewApi.list(status, page, PAGE_SIZE),
        adminThreeViewApi.stats(),
      ]);
      setItems(list.items);
      setTotal(list.total);
      setStats(s);
    } finally {
      setLoading(false);
    }
  }, [status, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [status]);

  const confirmDisable = async (reason: string) => {
    if (!disabling) return;
    setActing(true);
    try {
      const res = await adminThreeViewApi.disable(disabling.id, reason);
      if (res?.removedFromItems?.length) {
        alert(
          t("admin.threeViews.removedFrom", {
            count: res.removedFromItems.length,
          }),
        );
      }
      setDisabling(null);
      await load();
    } finally {
      setActing(false);
    }
  };

  return (
    <div>
      <PageHeader
        title={t("admin.threeViews.title")}
        description={t("admin.threeViews.total", { count: total })}
      />

      {stats && (
        <div className="mb-4 grid grid-cols-4 gap-3">
          {[
            { label: t("admin.threeViews.statTotal"), value: stats.total },
            { label: t("admin.threeViews.statusSuccess"), value: stats.success },
            { label: t("admin.threeViews.statusFailed"), value: stats.failed },
            { label: t("admin.threeViews.statusDisabled"), value: stats.disabled },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-lg border border-[var(--border)] px-4 py-3"
            >
              <div className="font-label text-[11px] tracking-wider text-[color:var(--ink-muted)]">
                {s.label}
              </div>
              <div className="mt-1 font-label text-[20px]">{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* 花费一币种一张卡，不做汇总：万相计人民币、OpenAI 计美元，
          相加得不到有意义的数。 */}
      {stats && stats.cost.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-3">
          {stats.cost.map((c) =>
            c.currency === "UNKNOWN" ? (
              <div
                key={c.currency}
                className="rounded-lg border border-dashed border-[var(--border)] px-4 py-3"
              >
                <div className="font-label text-[11px] tracking-wider text-[color:var(--ink-muted)]">
                  {t("admin.threeViews.costUnknown")}
                </div>
                <div className="mt-1 font-label text-[20px]">
                  {t("admin.threeViews.costImages", { count: c.images })}
                </div>
              </div>
            ) : (
              <div
                key={c.currency}
                className="rounded-lg border border-[var(--border)] px-4 py-3"
              >
                <div className="font-label text-[11px] tracking-wider text-[color:var(--ink-muted)]">
                  {t("admin.threeViews.costTotal", { currency: c.currency })}
                </div>
                <div className="mt-1 font-label text-[20px]">
                  {formatMoney(c.amount, c.currency)}
                </div>
                <div className="font-label text-[11px] text-[color:var(--ink-muted)]">
                  {t("admin.threeViews.costImages", { count: c.images })}
                </div>
              </div>
            ),
          )}
        </div>
      )}

      <div className="mb-4">
        <FilterChips
          options={STATUS_OPTIONS}
          value={status}
          onChange={setStatus}
          allLabel={t("admin.all")}
        />
      </div>

      {loading ? (
        <LoadingState />
      ) : items.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {items.map((it) => (
              <div
                key={it.id}
                className="flex gap-4 rounded-lg border border-[var(--border)] p-4"
              >
                {/* 源图与生成图并排 —— 核对质量必须两张一起看 */}
                <div className="flex shrink-0 items-center gap-2">
                  <div className="text-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={it.sourceImageUrl}
                      alt=""
                      className="h-24 w-24 rounded border border-[var(--border)] object-cover"
                    />
                    <div className="mt-1 font-label text-[10px] text-[color:var(--ink-muted)]">
                      {t("admin.threeViews.source")}
                    </div>
                  </div>
                  <span className="font-label text-[color:var(--ink-muted)]">→</span>
                  <div className="text-center">
                    {it.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={it.imageUrl}
                        alt=""
                        className="h-24 w-24 rounded border border-[var(--border)] object-cover"
                      />
                    ) : (
                      <div className="flex h-24 w-24 items-center justify-center rounded border border-[var(--border)] font-label text-[10px] text-[color:var(--ink-muted)]">
                        {t("admin.threeViews.noOutput")}
                      </div>
                    )}
                    <div className="mt-1 font-label text-[10px] text-[color:var(--ink-muted)]">
                      {VIEW_LABEL[it.viewSlug] || it.viewSlug}
                    </div>
                  </div>
                </div>

                <div className="min-w-0 flex-1 font-label text-[13px]">
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <StatusBadge active={it.status === "success"}>
                      {t(`admin.threeViews.status${
                        it.status.charAt(0).toUpperCase() + it.status.slice(1)
                      }`)}
                    </StatusBadge>
                    <span className="text-[color:var(--ink-muted)]">@{it.username}</span>
                    <span className="text-[12px] text-[color:var(--ink-muted)]">
                      #{it.id} · {new Date(it.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-[12px] text-[color:var(--ink-muted)]">
                    {it.model || "—"}
                    {it.imageSize ? ` · ${it.imageSize}` : ""}
                    {it.costMicros != null && it.costCurrency
                      ? ` · ${formatMoney(it.costMicros / 1_000_000, it.costCurrency)}`
                      : ""}
                    {it.archiveItemId
                      ? ` · ${t("admin.threeViews.linkedItem", { id: it.archiveItemId })}`
                      : ` · ${t("admin.threeViews.notLinked")}`}
                  </div>
                  {it.errorMessage && (
                    <div className="mt-1 text-[12px] text-[color:var(--ink-muted)]">
                      {it.errorMessage}
                    </div>
                  )}
                  {it.disableReason && (
                    <div className="mt-1 text-[12px] text-[color:var(--ink-muted)]">
                      {t("admin.threeViews.disableReason")}: {it.disableReason}
                    </div>
                  )}
                </div>

                <div className="flex shrink-0 items-center">
                  {it.status === "success" && (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => setDisabling(it)}
                    >
                      {t("admin.threeViews.disable")}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <Pagination
            page={page}
            totalPages={Math.ceil(total / PAGE_SIZE)}
            onChange={setPage}
          />
        </>
      )}

      <PromptDialog
        open={disabling !== null}
        title={t("admin.threeViews.disableTitle")}
        placeholder={t("admin.threeViews.disablePlaceholder")}
        confirmLabel={t("admin.threeViews.disable")}
        loading={acting}
        onConfirm={confirmDisable}
        onCancel={() => setDisabling(null)}
      />
    </div>
  );
}
