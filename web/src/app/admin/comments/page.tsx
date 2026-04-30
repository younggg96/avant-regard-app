"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { commentsApi, type AdminComment } from "@/lib/services/admin";
import {
  PageHeader,
  Pagination,
  EmptyState,
  LoadingState,
  ConfirmDialog,
} from "@/components/admin/ui";


export default function CommentsPage() {
  const { t } = useTranslation();
  const [comments, setComments] = useState<AdminComment[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<AdminComment | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await commentsApi.getAll(page, 20);
      setComments(data.comments);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await commentsApi.delete(deleteTarget.id);
      setDeleteTarget(null);
      load();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <PageHeader title={t("admin.comments")} description={t("admin.commentTotal", { count: total })} />

      {loading ? (
        <LoadingState />
      ) : comments.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
            <table className="w-full font-label text-[13px]">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--canvas-soft)]">
                  <th className="px-4 py-2.5 text-left text-[11px] tracking-wider text-[color:var(--ink-muted)]">{t("admin.colContent")}</th>
                  <th className="px-4 py-2.5 text-left text-[11px] tracking-wider text-[color:var(--ink-muted)]">{t("admin.colUser")}</th>
                  <th className="px-4 py-2.5 text-left text-[11px] tracking-wider text-[color:var(--ink-muted)]">{t("admin.colPostTitle")}</th>
                  <th className="px-4 py-2.5 text-left text-[11px] tracking-wider text-[color:var(--ink-muted)]">{t("admin.colLikes")}</th>
                  <th className="px-4 py-2.5 text-left text-[11px] tracking-wider text-[color:var(--ink-muted)]">{t("admin.colTime")}</th>
                  <th className="px-4 py-2.5 text-right text-[11px] tracking-wider text-[color:var(--ink-muted)]">{t("admin.colActions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {comments.map((c) => (
                  <tr key={c.id} className="hover:bg-[var(--canvas-soft)] transition-colors">
                    <td className="px-4 py-3 max-w-[300px]">
                      <div className="line-clamp-2">{c.content}</div>
                    </td>
                    <td className="px-4 py-3 text-[color:var(--ink-muted)]">@{c.username}</td>
                    <td className="px-4 py-3">
                      <div className="max-w-[200px] truncate text-[color:var(--ink-muted)]">{c.postTitle}</div>
                    </td>
                    <td className="px-4 py-3 text-[color:var(--ink-muted)]">{c.likeCount}</td>
                    <td className="px-4 py-3 text-[12px] text-[color:var(--ink-muted)]">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setDeleteTarget(c)}
                        className="rounded px-2 py-1 text-[12px] text-[color:var(--ink-muted)] transition-colors hover:bg-[var(--canvas-raised)] hover:text-[var(--ink)]"
                      >
                        {t("admin.delete")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title={t("admin.confirmDeleteComment")}
        message={deleteTarget?.content}
        confirmLabel={t("admin.delete")}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
