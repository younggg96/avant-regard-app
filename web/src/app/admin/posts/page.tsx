"use client";

import { useEffect, useState, useCallback } from "react";
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

const POST_TYPES = [
  { value: "OUTFIT", label: "Lookbook" },
  { value: "DAILY_SHARE", label: "穿搭" },
  { value: "ITEM_REVIEW", label: "测评" },
  { value: "ARTICLES", label: "论坛" },
] as const;

const AUDIT_STATUSES = [
  { value: "PENDING", label: "待审核" },
  { value: "APPROVED", label: "已通过" },
  { value: "REJECTED", label: "已拒绝" },
] as const;

type PostType = (typeof POST_TYPES)[number]["value"];
type AuditStatus = (typeof AUDIT_STATUSES)[number]["value"];

const POST_TYPE_LABEL: Record<string, string> = {
  OUTFIT: "Lookbook", DAILY_SHARE: "穿搭", ITEM_REVIEW: "测评", ARTICLES: "论坛",
};

export default function PostsManagementPage() {
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
      alert(`已触发 ${result.triggered} 条帖子重新评级`);
    } finally {
      setRegrading(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="帖子管理"
        description={`共 ${total} 条`}
        actions={
          <Button variant="secondary" size="sm" onClick={handleBatchRegrade} loading={regrading}>
            全量重新评级
          </Button>
        }
      />

      <div className="mb-4 space-y-3">
        <div className="max-w-sm">
          <SearchBar value={keyword} onChange={setKeyword} placeholder="搜索标题、用户名…" />
        </div>
        <div className="flex flex-wrap gap-4">
          <FilterChips options={[...POST_TYPES]} value={postType} onChange={setPostType} allLabel="全部类型" />
          <FilterChips options={[...AUDIT_STATUSES]} value={auditStatus} onChange={setAuditStatus} allLabel="全部状态" />
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
                  <th className="px-4 py-2.5 text-left text-[11px] tracking-wider">帖子</th>
                  <th className="px-4 py-2.5 text-left text-[11px] tracking-wider">类型</th>
                  <th className="px-4 py-2.5 text-left text-[11px] tracking-wider">评级</th>
                  <th className="px-4 py-2.5 text-left text-[11px] tracking-wider">审核</th>
                  <th className="px-4 py-2.5 text-left text-[11px] tracking-wider">互动</th>
                  <th className="px-4 py-2.5 text-left text-[11px] tracking-wider">时间</th>
                  <th className="px-4 py-2.5 text-right text-[11px] tracking-wider">操作</th>
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
                          <div className="max-w-[200px] truncate">{post.title || "无标题"}</div>
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
                        {post.auditStatus === "APPROVED" ? "通过" :
                         post.auditStatus === "REJECTED" ? "拒绝" : "待审"}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[color:var(--ink-muted)] tabular-nums">
                      {post.likeCount} 赞 · {post.commentCount} 评论
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[color:var(--ink-muted)] tabular-nums">
                      {new Date(post.createdAt).toLocaleDateString("zh-CN")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1 text-[12px]">
                        <button
                          onClick={() => setActionTarget({ post, action: "approve" })}
                          className="rounded px-2 py-1 text-[color:var(--ink-muted)] transition-colors hover:bg-[var(--canvas-raised)] hover:text-[var(--ink)]"
                        >
                          通过
                        </button>
                        <button
                          onClick={() => setRejectTarget(post)}
                          className="rounded px-2 py-1 text-[color:var(--ink-muted)] transition-colors hover:bg-[var(--canvas-raised)] hover:text-[var(--ink)]"
                        >
                          拒绝
                        </button>
                        <button
                          onClick={async () => { await postsApi.regrade(post.id); load(); }}
                          className="rounded px-2 py-1 text-[color:var(--ink-muted)] transition-colors hover:bg-[var(--canvas-raised)] hover:text-[var(--ink)]"
                        >
                          评级
                        </button>
                        <button
                          onClick={() => setActionTarget({ post, action: "delete" })}
                          className="rounded px-2 py-1 text-[color:var(--ink-muted)] transition-colors hover:bg-[var(--canvas-raised)] hover:text-[var(--ink)]"
                        >
                          删除
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
        title={actionTarget?.action === "approve" ? "确认通过审核？" : "确认删除帖子？"}
        message={actionTarget?.post.title}
        confirmLabel={actionTarget?.action === "approve" ? "通过" : "删除"}
        loading={actionLoading}
        onConfirm={handleAction}
        onCancel={() => setActionTarget(null)}
      />

      <PromptDialog
        open={!!rejectTarget}
        title="拒绝原因"
        placeholder="请输入拒绝原因（可选）"
        confirmLabel="拒绝"
        loading={actionLoading}
        onConfirm={handleReject}
        onCancel={() => setRejectTarget(null)}
      />
    </div>
  );
}
