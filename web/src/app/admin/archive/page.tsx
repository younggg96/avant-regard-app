"use client";

/**
 * 数字护照 · 典藏全量管理。
 *
 * 与 /admin/archive-review 的分工：那边是「处理异常」（只有待复核队列），
 * 这边是「管理全量」——按标题/品牌搜索、按状态过滤、改字段、删除。
 *
 * 缩略图上会给 AI 生成的那几张打角标。这不是装饰：photos 里实拍和 AI 推测的
 * 侧背面混在一起，管理员得先能看出区别，才谈得上判断这条档案能不能公开。
 */

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  adminArchiveApi,
  type AdminArchiveItem,
} from "@/lib/services/admin";
import {
  PageHeader,
  SearchBar,
  FilterChips,
  StatusBadge,
  Pagination,
  EmptyState,
  LoadingState,
  Button,
  ConfirmDialog,
} from "@/components/admin/ui";

const PAGE_SIZE = 20;

export default function AdminArchivePage() {
  const { t } = useTranslation();

  const STATUS_OPTIONS = [
    { value: "passed" as const, label: t("admin.archiveAdmin.statusPassed") },
    { value: "manual_review" as const, label: t("admin.archiveAdmin.statusReview") },
    { value: "rejected" as const, label: t("admin.archiveAdmin.statusRejected") },
    { value: "warned" as const, label: t("admin.archiveAdmin.statusWarned") },
  ];
  type Status = (typeof STATUS_OPTIONS)[number]["value"];

  const STATUS_LABEL: Record<string, string> = {
    passed: t("admin.archiveAdmin.statusPassed"),
    manual_review: t("admin.archiveAdmin.statusReview"),
    rejected: t("admin.archiveAdmin.statusRejected"),
    warned: t("admin.archiveAdmin.statusWarned"),
  };

  const [items, setItems] = useState<AdminArchiveItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState<Status>();
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<AdminArchiveItem | null>(null);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminArchiveApi.list({
        keyword: keyword || undefined,
        status,
        page,
        pageSize: PAGE_SIZE,
      });
      setItems(data.items);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }, [keyword, status, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [keyword, status]);

  const confirmDelete = async () => {
    if (!deleting) return;
    setActing(true);
    try {
      await adminArchiveApi.remove(deleting.id);
      setDeleting(null);
      await load();
    } finally {
      setActing(false);
    }
  };

  return (
    <div>
      <PageHeader
        title={t("admin.archiveAdmin.title")}
        description={t("admin.archiveAdmin.total", { count: total })}
      />

      <div className="mb-4 flex flex-col gap-3">
        <SearchBar
          value={keyword}
          onChange={setKeyword}
          placeholder={t("admin.archiveAdmin.searchPlaceholder")}
        />
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
                <div className="flex shrink-0 gap-1.5">
                  {it.photos.slice(0, 4).map((url, i) => {
                    const isAi = it.aiPhotos.includes(url);
                    return (
                      <div key={url + i} className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt=""
                          className="h-24 w-24 rounded border border-[var(--border)] object-cover"
                        />
                        {isAi && (
                          <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1 py-0.5 font-label text-[9px] text-white">
                            {t("admin.archiveAdmin.aiBadge")}
                          </span>
                        )}
                      </div>
                    );
                  })}
                  {it.photos.length === 0 && (
                    <div className="flex h-24 w-24 items-center justify-center rounded border border-[var(--border)] font-label text-[11px] text-[color:var(--ink-muted)]">
                      —
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1 font-label text-[13px]">
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{it.title || "—"}</span>
                    <StatusBadge active={it.validityStatus === "passed"}>
                      {STATUS_LABEL[it.validityStatus] || it.validityStatus}
                    </StatusBadge>
                    <span className="text-[color:var(--ink-muted)]">@{it.username}</span>
                    <span className="text-[12px] text-[color:var(--ink-muted)]">
                      #{it.id} · {new Date(it.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="text-[color:var(--ink-muted)]">
                    {it.brandName || "—"}
                    {it.brandId ? "" : ` (${t("admin.archiveReview.notLinked")})`}
                    {it.releaseYear ? ` · ${it.releaseYear}` : ""}
                  </div>
                  {it.aiPhotos.length > 0 && (
                    <div className="mt-1 text-[12px] text-[color:var(--ink-muted)]">
                      {t("admin.archiveAdmin.aiPhotoCount", {
                        count: it.aiPhotos.length,
                      })}
                    </div>
                  )}
                  {it.reviewNote && (
                    <div className="mt-1 text-[12px] text-[color:var(--ink-muted)]">
                      {t("admin.archiveAdmin.note")}: {it.reviewNote}
                    </div>
                  )}
                </div>

                <div className="flex shrink-0 items-center">
                  <Button variant="danger" size="sm" onClick={() => setDeleting(it)}>
                    {t("admin.archiveAdmin.delete")}
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

      <ConfirmDialog
        open={deleting !== null}
        title={t("admin.archiveAdmin.deleteConfirm", {
          title: deleting?.title || `#${deleting?.id}`,
        })}
        loading={acting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
