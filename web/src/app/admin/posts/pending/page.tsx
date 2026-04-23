"use client";

import { useEffect, useState, useCallback } from "react";
import { postsApi, type AdminPost } from "@/lib/services/admin";
import {
  PageHeader,
  StatusBadge,
  EmptyState,
  LoadingState,
  ConfirmDialog,
  PromptDialog,
  Button,
} from "@/components/admin/ui";

export default function PendingPostsPage() {
  const [posts, setPosts] = useState<AdminPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionTarget, setActionTarget] = useState<{ post: AdminPost; action: "approve" | "delete" } | null>(null);
  const [rejectTarget, setRejectTarget] = useState<AdminPost | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPosts(await postsApi.getPending());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (postId: number) => {
    setActionLoading(true);
    try {
      await postsApi.approve(postId);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      setActionTarget(null);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (postId: number, remark: string) => {
    setActionLoading(true);
    try {
      await postsApi.reject(postId, remark || undefined);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      setRejectTarget(null);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (postId: number) => {
    setActionLoading(true);
    try {
      await postsApi.delete(postId);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      setActionTarget(null);
    } finally {
      setActionLoading(false);
    }
  };

  const handleBatchApprove = async () => {
    for (const id of selected) {
      try { await postsApi.approve(id); } catch { /* continue */ }
    }
    setSelected(new Set());
    load();
  };

  const postTypeName = (t: string) => {
    const map: Record<string, string> = { OUTFIT: "穿搭", REVIEW: "测评", LOOKBOOK: "Lookbook", FORUM: "论坛" };
    return map[t] || t;
  };

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="待审核帖子"
        description={`${posts.length} 条待审核`}
        actions={
          <div className="flex gap-2">
            {selected.size > 0 && (
              <Button onClick={handleBatchApprove} size="sm">
                批量通过 ({selected.size})
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={load}>刷新</Button>
          </div>
        }
      />

      {posts.length === 0 ? (
        <EmptyState message="暂无待审核帖子" />
      ) : (
        <div className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)]">
          {posts.map((post) => (
            <div key={post.id} className="flex items-center gap-4 px-4 py-3">
              <input
                type="checkbox"
                checked={selected.has(post.id)}
                onChange={(e) => {
                  const next = new Set(selected);
                  e.target.checked ? next.add(post.id) : next.delete(post.id);
                  setSelected(next);
                }}
                className="h-3.5 w-3.5 shrink-0 accent-[var(--ink)]"
              />

              {post.coverImage && (
                <img src={post.coverImage} alt="" className="h-11 w-11 shrink-0 rounded object-cover" />
              )}

              <div className="min-w-0 flex-1 font-label">
                <div className="truncate text-[13px]">{post.title || "无标题"}</div>
                <div className="mt-0.5 flex items-center gap-2 text-[12px] text-[color:var(--ink-muted)]">
                  <span>@{post.username}</span>
                  <StatusBadge>{postTypeName(post.postType)}</StatusBadge>
                  <span>{new Date(post.createdAt).toLocaleDateString("zh-CN")}</span>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1 font-label text-[12px]">
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
                  onClick={() => setActionTarget({ post, action: "delete" })}
                  className="rounded px-2 py-1 text-[color:var(--ink-muted)] transition-colors hover:bg-[var(--canvas-raised)] hover:text-[var(--ink)]"
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!actionTarget}
        title={actionTarget?.action === "approve" ? "确认通过审核？" : "确认删除帖子？"}
        message={actionTarget?.post.title}
        confirmLabel={actionTarget?.action === "approve" ? "通过" : "删除"}
        loading={actionLoading}
        onConfirm={() => {
          if (!actionTarget) return;
          if (actionTarget.action === "approve") handleApprove(actionTarget.post.id);
          else handleDelete(actionTarget.post.id);
        }}
        onCancel={() => setActionTarget(null)}
      />

      <PromptDialog
        open={!!rejectTarget}
        title="拒绝原因"
        placeholder="请输入拒绝原因（可选）"
        confirmLabel="拒绝"
        loading={actionLoading}
        onConfirm={(reason) => rejectTarget && handleReject(rejectTarget.id, reason)}
        onCancel={() => setRejectTarget(null)}
      />
    </div>
  );
}
