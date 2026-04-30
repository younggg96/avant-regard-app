"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { postsApi, type AllPostsParams, type AdminPost } from "@/lib/services/admin";
import {
  PageHeader,
  SearchBar,
  FilterChips,
  StatusBadge,
  Pagination,
  EmptyState,
  LoadingState,
  ConfirmDialog,
  PromptDialog,
  Button,
} from "@/components/admin/ui";

export default function PostsManagementPage() {
  const { t } = useTranslation();

  const POST_TYPES = [
    { value: "OUTFIT", label: "Lookbook" },
    { value: "DAILY_SHARE", label: t("admin.postTypeDailyShare") },
    { value: "ITEM_REVIEW", label: t("admin.postTypeReview") },
    { value: "ARTICLES", label: t("admin.postTypeForum") },
  ] as const;

  const AUDIT_STATUSES = [
    { value: "PENDING", label: t("admin.statusPending") },
    { value: "APPROVED", label: t("admin.statusApproved") },
    { value: "REJECTED", label: t("admin.statusRejected") },
  ] as const;

  type PostType = (typeof POST_TYPES)[number]["value"];
  type AuditStatus = (typeof AUDIT_STATUSES)[number]["value"];

  const POST_TYPE_LABEL: Record<string, string> = {
    OUTFIT: "Lookbook", DAILY_SHARE: t("admin.postTypeDailyShare"), ITEM_REVIEW: t("admin.postTypeReview"), ARTICLES: t("admin.postTypeForum"),
  };

  const [posts, setPosts] = useState<AdminPost[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [postType, setPostType] = useState<PostType>();
  const [auditStatus, setAuditStatus] = useState<AuditStatus>();

  const [actionTarget, setActionTarget] = useState<{ post: AdminPost; action: "approve" | "delete" } | null>(null);
  const [rejectTarget, setRejectTarget] = useState<AdminPost | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [regrading, setRegrading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: AllPostsParams = { page, pageSize: 20, keyword, postType, auditStatus };
      const data = await postsApi.getAll(params);
      setPosts(data.posts);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } finally {
      setLoading(false);
    }
  }, [page, keyword, postType, auditStatus]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [keyword, postType, auditStatus]);

  const handleAction = async () => {
    if (!actionTarget) return;
    setActionLoading(true);
    try {
      if (actionTarget.action === "approve") await postsApi.approve(actionTarget.post.id);
      else await postsApi.delete(actionTarget.post.id);
      setActionTarget(null);
      load();
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (reason: string) => {
    if (!rejectTarget) return;
    setActionLoading(true);
    try {
      await postsApi.reject(rejectTarget.id, reason || undefined);
      setRejectTarget(null);
      load();
    } finally {
      setActionLoading(false);
    }
  };

  const handleBatchRegrade = async () => {
    setRegrading(true);
    try {
      const result = await postsApi.batchRegrade(undefined, true);
      alert(t("admin.batchTriggered", { count: result.triggered }));
    } finally {
      setRegrading(false);
    }
  };

  return (
    <div>
      <PageHeader
        title={t("admin.postsManagement")}
        description={t("admin.postTotal", { count: total })}
        actions={
          <Button variant="secondary" size="sm" onClick={handleBatchRegrade} loading={regrading}>
            {t("admin.batchRegrade")}
          </Button>
        }
      />

      <div className="mb-4 space-y-3">
        <div className="max-w-sm">
          <SearchBar value={keyword} onChange={setKeyword} placeholder={t("admin.searchPost")} />
        </div>
        <div className="flex flex-wrap gap-4">
          <FilterChips options={[...POST_TYPES]} value={postType} onChange={setPostType} allLabel={t("admin.allType")} />
          <FilterChips options={[...AUDIT_STATUSES]} value={auditStatus} onChange={setAuditStatus} allLabel={t("admin.allStatus")} />
        </div>
      </div>

      {loading ? (
        <LoadingState />
      ) : posts.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
            <table className="w-full font-label text-[13px]">
              <thead>
                <tr className="border-b border-[var(--border)] text-[color:var(--ink-muted)]">
                  <th className="px-4 py-2.5 text-left text-[11px] tracking-wider">{t("admin.colPost")}</th>
                  <th className="px-4 py-2.5 text-left text-[11px] tracking-wider">{t("admin.colType")}</th>
                  <th className="px-4 py-2.5 text-left text-[11px] tracking-wider">{t("admin.colGrade")}</th>
                  <th className="px-4 py-2.5 text-left text-[11px] tracking-wider">{t("admin.colAudit")}</th>
                  <th className="px-4 py-2.5 text-left text-[11px] tracking-wider">{t("admin.colInteraction")}</th>
                  <th className="px-4 py-2.5 text-left text-[11px] tracking-wider">{t("admin.colTime")}</th>
                  <th className="px-4 py-2.5 text-right text-[11px] tracking-wider">{t("admin.colActions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {posts.map((post) => (
                  <tr key={post.id} className="transition-colors hover:bg-[var(--canvas-soft)]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {post.coverImage && (
                          <img src={post.coverImage} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
                        )}
                        <div className="min-w-0">
                          <div className="max-w-[200px] truncate">{post.title || t("admin.noTitle")}</div>
                          <div className="text-[12px] text-[color:var(--ink-muted)]">@{post.username}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge>{POST_TYPE_LABEL[post.postType] || post.postType}</StatusBadge>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge active={post.grade === "S" || post.grade === "A"}>
                        {post.grade || "—"}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge active={post.auditStatus === "APPROVED"}>
                        {post.auditStatus === "APPROVED" ? t("admin.auditApproved") :
                         post.auditStatus === "REJECTED" ? t("admin.auditRejected") : t("admin.auditPending")}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[color:var(--ink-muted)] tabular-nums">
                      {t("admin.likesCount", { count: post.likeCount })} · {t("admin.commentCount", { count: post.commentCount })}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[color:var(--ink-muted)] tabular-nums">
                      {new Date(post.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1 text-[12px]">
                        <button
                          onClick={() => setActionTarget({ post, action: "approve" })}
                          className="rounded px-2 py-1 text-[color:var(--ink-muted)] transition-colors hover:bg-[var(--canvas-raised)] hover:text-[var(--ink)]"
                        >
                          {t("admin.approve")}
                        </button>
                        <button
                          onClick={() => setRejectTarget(post)}
                          className="rounded px-2 py-1 text-[color:var(--ink-muted)] transition-colors hover:bg-[var(--canvas-raised)] hover:text-[var(--ink)]"
                        >
                          {t("admin.reject")}
                        </button>
                        <button
                          onClick={async () => { await postsApi.regrade(post.id); load(); }}
                          className="rounded px-2 py-1 text-[color:var(--ink-muted)] transition-colors hover:bg-[var(--canvas-raised)] hover:text-[var(--ink)]"
                        >
                          {t("admin.regrade")}
                        </button>
                        <button
                          onClick={() => setActionTarget({ post, action: "delete" })}
                          className="rounded px-2 py-1 text-[color:var(--ink-muted)] transition-colors hover:bg-[var(--canvas-raised)] hover:text-[var(--ink)]"
                        >
                          {t("admin.delete")}
                        </button>
                      </div>
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
        open={!!actionTarget}
        title={actionTarget?.action === "approve" ? t("admin.confirmApprovePost") : t("admin.confirmDeletePost")}
        message={actionTarget?.post.title}
        confirmLabel={actionTarget?.action === "approve" ? t("admin.approve") : t("admin.delete")}
        loading={actionLoading}
        onConfirm={handleAction}
        onCancel={() => setActionTarget(null)}
      />

      <PromptDialog
        open={!!rejectTarget}
        title={t("admin.rejectReason")}
        placeholder={t("admin.rejectReasonPlaceholder")}
        confirmLabel={t("admin.reject")}
        loading={actionLoading}
        onConfirm={handleReject}
        onCancel={() => setRejectTarget(null)}
      />
    </div>
  );
}
