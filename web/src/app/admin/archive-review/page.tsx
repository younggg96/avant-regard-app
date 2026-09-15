"use client";

/**
 * 数字护照 · 档案人工审核队列 (5.3)。
 *
 * 用卡片而不是表格：审核这件事的核心判断依据是图，表格塞不下图。审核员要做的
 * 是「看图 + 看 AI 当初说了什么 + 看用户最后改成了什么」，然后放行或驳回。
 *
 * 三种入队原因的处理方式完全不同，所以原因徽章放在最显眼的位置：
 *   新品牌待审   等品牌审核通过后放行，这里会自动补 brand_id
 *   AI 置信度低  人眼确认品牌对不对
 *   跳过 AI 识别 这张图没过有效性检查，必须自己看图判断是不是服装
 */

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  archiveReviewApi,
  type ArchiveReviewItem,
  type ArchiveReviewReason,
} from "@/lib/services/admin";
import {
  PageHeader,
  StatusBadge,
  Pagination,
  EmptyState,
  LoadingState,
  Button,
  PromptDialog,
} from "@/components/admin/ui";

const PAGE_SIZE = 20;

export default function ArchiveReviewPage() {
  const { t } = useTranslation();

  const REASON_LABEL: Record<ArchiveReviewReason, string> = {
    PENDING_BRAND: t("admin.archiveReview.reasonPendingBrand"),
    LOW_CONFIDENCE: t("admin.archiveReview.reasonLowConfidence"),
    SKIPPED_AI: t("admin.archiveReview.reasonSkippedAi"),
  };

  const [items, setItems] = useState<ArchiveReviewItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<number | null>(null);
  const [rejecting, setRejecting] = useState<ArchiveReviewItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await archiveReviewApi.list("manual_review", page, PAGE_SIZE);
      setItems(data.items);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  const decide = async (
    item: ArchiveReviewItem,
    decision: "passed" | "rejected",
    note?: string,
  ) => {
    setActing(item.id);
    try {
      const res = await archiveReviewApi.review(item.id, decision, note);
      // 放行时后端可能顺手把裸品牌名归一到了 brands，告诉审核员一声。
      if (res?.backfilledBrand) {
        alert(
          t("admin.archiveReview.brandBackfilled", { brand: res.backfilledBrand }),
        );
      }
      await load();
    } finally {
      setActing(null);
      setRejecting(null);
    }
  };

  return (
    <div>
      <PageHeader
        title={t("admin.archiveReview.title")}
        description={t("admin.archiveReview.pendingCount", { count: total })}
      />

      {loading ? (
        <LoadingState />
      ) : items.length === 0 ? (
        <EmptyState message={t("admin.archiveReview.empty")} />
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {items.map((it) => (
              <div
                key={it.id}
                className="flex gap-4 rounded-lg border border-[var(--border)] p-4"
              >
                {/* 图 —— 审核判断的主要依据，所以给足尺寸 */}
                <div className="flex shrink-0 gap-1.5">
                  {it.photos.slice(0, 3).map((url, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={url + i}
                      src={url}
                      alt=""
                      className="h-28 w-28 rounded border border-[var(--border)] object-cover"
                    />
                  ))}
                  {it.photos.length === 0 && (
                    <div className="flex h-28 w-28 items-center justify-center rounded border border-[var(--border)] font-label text-[11px] text-[color:var(--ink-muted)]">
                      {t("admin.archiveReview.noPhoto")}
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1 font-label text-[13px]">
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <StatusBadge active>{REASON_LABEL[it.reason]}</StatusBadge>
                    <span className="font-semibold">{it.title || "—"}</span>
                    <span className="text-[color:var(--ink-muted)]">
                      @{it.username}
                    </span>
                    <span className="text-[12px] text-[color:var(--ink-muted)]">
                      {new Date(it.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="mb-1 text-[color:var(--ink-muted)]">
                    {t("admin.archiveReview.userChose")}:{" "}
                    <span className="text-[var(--ink)]">
                      {it.brandName || "—"}
                      {it.brandId ? "" : ` (${t("admin.archiveReview.notLinked")})`}
                      {it.releaseYear ? ` · ${it.releaseYear}` : ""}
                    </span>
                  </div>

                  {it.aiBrands.length > 0 && (
                    <div className="mb-1 text-[color:var(--ink-muted)]">
                      {t("admin.archiveReview.aiSuggested")}:{" "}
                      <span className="text-[var(--ink)]">
                        {it.aiBrands.join(" / ")}
                      </span>
                      {it.aiConfidence != null && (
                        <span> · {Math.round(it.aiConfidence * 100)}%</span>
                      )}
                    </div>
                  )}

                  {Object.keys(it.divergence).length > 0 && (
                    <div className="text-[12px] text-[color:var(--ink-muted)]">
                      {t("admin.archiveReview.diverged", {
                        fields: Object.keys(it.divergence).join(", "),
                      })}
                    </div>
                  )}
                </div>

                <div className="flex shrink-0 flex-col justify-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => decide(it, "passed")}
                    disabled={acting === it.id}
                  >
                    {t("admin.archiveReview.approve")}
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => setRejecting(it)}
                    disabled={acting === it.id}
                  >
                    {t("admin.archiveReview.reject")}
                  </Button>
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
        open={rejecting !== null}
        title={t("admin.archiveReview.rejectTitle")}
        placeholder={t("admin.archiveReview.rejectPlaceholder")}
        confirmLabel={t("admin.archiveReview.reject")}
        loading={acting !== null}
        onConfirm={(note) => rejecting && decide(rejecting, "rejected", note)}
        onCancel={() => setRejecting(null)}
      />
    </div>
  );
}
