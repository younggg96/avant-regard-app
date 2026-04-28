"use client";

import { useEffect, useState, useCallback } from "react";
import { usersApi, type AdminUser, type UserTitle } from "@/lib/services/admin";
import { LEVEL_TITLES } from "@/lib/levels/titles";
import {
  PageHeader,
  SearchBar,
  StatusBadge,
  Pagination,
  EmptyState,
  LoadingState,
  ConfirmDialog,
  FormDialog,
  FormField,
  TextInput,
  Button,
} from "@/components/admin/ui";


type UserKind = "ADMIN" | "MERCHANT" | "USER";

/**
 * 根据后端返回的身份字段判定展示类型.
 *   - is_admin=True                                 -> ADMIN
 *   - 在 store_merchants 有 APPROVED 的入驻记录      -> MERCHANT
 *   - 其它                                          -> USER
 *
 * ADMIN 与 MERCHANT 同时成立时优先展示 ADMIN (权限最高, 避免误导).
 */
function resolveUserKind(u: AdminUser): UserKind {
  if (u.isAdmin) return "ADMIN";
  if (u.merchant?.status === "APPROVED") return "MERCHANT";
  return "USER";
}

/**
 * 三档视觉区分 (不依赖 StatusBadge.variant, 因其已 deprecated / 被忽略):
 *   ADMIN    — 实心黑底, 最醒目
 *   MERCHANT — 描边,     次醒目
 *   USER     — 灰底,     默认
 */
const KIND_STYLE: Record<UserKind, { label: string; className: string }> = {
  ADMIN: {
    label: "ADMIN",
    className: "bg-[var(--ink)] text-[var(--canvas)]",
  },
  MERCHANT: {
    label: "商家",
    className:
      "border border-[var(--ink)] bg-transparent text-[var(--ink)]",
  },
  USER: {
    label: "USER",
    className: "bg-[var(--canvas-raised)] text-[color:var(--ink-muted)]",
  },
};


export default function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [titlesUser, setTitlesUser] = useState<AdminUser | null>(null);
  const [titles, setTitles] = useState<UserTitle[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [titlesLoading, setTitlesLoading] = useState(false);

  const pageSize = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await usersApi.getAll(keyword || undefined, page, pageSize);
      setUsers(data.users);
      setTotal(data.total);
      setTotalPages(Math.ceil(data.total / pageSize));
    } finally {
      setLoading(false);
    }
  }, [page, keyword]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [keyword]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await usersApi.delete(deleteTarget.id);
      setDeleteTarget(null);
      load();
    } finally {
      setDeleting(false);
    }
  };

  const openTitles = async (user: AdminUser) => {
    setTitlesUser(user);
    setTitlesLoading(true);
    try {
      const data = await usersApi.getTitles(user.id);
      setTitles(data);
    } finally {
      setTitlesLoading(false);
    }
  };

  const handleAddTitle = async () => {
    if (!titlesUser || !newTitle.trim()) return;
    setTitlesLoading(true);
    try {
      const title = await usersApi.addTitle(titlesUser.id, newTitle.trim());
      setTitles((prev) => [...prev, title]);
      setNewTitle("");
    } finally {
      setTitlesLoading(false);
    }
  };

  const handleRemoveTitle = async (titleId: number) => {
    setTitlesLoading(true);
    try {
      await usersApi.removeTitle(titleId);
      setTitles((prev) => prev.filter((t) => t.id !== titleId));
    } finally {
      setTitlesLoading(false);
    }
  };

  return (
    <div>
      <PageHeader title="用户管理" description={`共 ${total} 位用户`} />

      <div className="mb-4 max-w-sm">
        <SearchBar value={keyword} onChange={setKeyword} placeholder="搜索用户名、手机号…" />
      </div>

      {loading ? (
        <LoadingState />
      ) : users.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
            <table className="w-full font-label text-[13px]">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--canvas-soft)]">
                  <th className="px-4 py-2.5 text-left text-[11px] tracking-wider text-[color:var(--ink-muted)]">用户</th>
                  <th className="px-4 py-2.5 text-left text-[11px] tracking-wider text-[color:var(--ink-muted)]">类型</th>
                  <th className="px-4 py-2.5 text-left text-[11px] tracking-wider text-[color:var(--ink-muted)]">等级</th>
                  <th className="px-4 py-2.5 text-left text-[11px] tracking-wider text-[color:var(--ink-muted)]">头衔</th>
                  <th className="px-4 py-2.5 text-left text-[11px] tracking-wider text-[color:var(--ink-muted)]">数据</th>
                  <th className="px-4 py-2.5 text-left text-[11px] tracking-wider text-[color:var(--ink-muted)]">注册时间</th>
                  <th className="px-4 py-2.5 text-right text-[11px] tracking-wider text-[color:var(--ink-muted)]">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {users.map((user) => {
                  const kind = resolveUserKind(user);
                  const kindStyle = KIND_STYLE[kind];
                  const level = user.currentLevel ?? 0;
                  const levelTitle = LEVEL_TITLES[level];
                  return (
                  <tr key={user.id} className="hover:bg-[var(--canvas-soft)] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {user.avatarUrl ? (
                          <img src={user.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--canvas-raised)] text-[11px] font-medium">
                            {user.username?.[0]?.toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div className="font-medium">@{user.username}</div>
                          <div className="text-[12px] text-[color:var(--ink-muted)]">{user.phone}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 font-label text-[11px] tracking-[0.08em] ${kindStyle.className}`}
                      >
                        {kindStyle.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {level >= 1 && levelTitle ? (
                        <span className="inline-flex items-center gap-1 rounded-sm bg-[var(--ink)] px-2 py-0.5 font-label text-[11px] tracking-[0.1em] text-[var(--canvas)]">
                          <span className="font-semibold">Lv{level}</span>
                          <span className="opacity-80">· {levelTitle}</span>
                        </span>
                      ) : (
                        <span className="font-label text-[12px] text-[color:var(--ink-muted)]">
                          —
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {user.titles?.map((t) => (
                          <StatusBadge key={t.id} variant="info">{t.title}</StatusBadge>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[color:var(--ink-muted)]">
                      <div>帖子 {user.postCount ?? 0} · 粉丝 {user.followerCount ?? 0}</div>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[color:var(--ink-muted)]">
                      {new Date(user.createdAt).toLocaleDateString("zh-CN")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => openTitles(user)}
                          className="rounded px-2 py-1 text-[12px] text-[color:var(--ink-muted)] transition-colors hover:bg-[var(--canvas-raised)] hover:text-[var(--ink)]"
                        >
                          头衔
                        </button>
                        <button
                          onClick={() => setDeleteTarget(user)}
                          className="rounded px-2 py-1 text-[12px] text-[color:var(--ink-muted)] transition-colors hover:bg-[var(--canvas-raised)] hover:text-[var(--ink)]"
                        >
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="确认删除用户？"
        message={`将永久删除用户 @${deleteTarget?.username} 及其所有数据，此操作不可撤销。`}
        confirmLabel="删除"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <FormDialog
        open={!!titlesUser}
        title={`管理头衔 — @${titlesUser?.username}`}
        onClose={() => setTitlesUser(null)}
      >
        <div className="space-y-3">
          {titlesLoading && !titles.length ? (
            <p className="text-center font-label text-[13px] text-[color:var(--ink-muted)]">加载中…</p>
          ) : titles.length === 0 ? (
            <p className="text-center font-label text-[13px] text-[color:var(--ink-muted)]">暂无头衔</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {titles.map((t) => (
                <span
                  key={t.id}
                  className="inline-flex items-center gap-1 rounded-full bg-[var(--canvas-raised)] px-3 py-1 font-label text-[12px] text-[color:var(--ink-muted)]"
                >
                  {t.title}
                  <button onClick={() => handleRemoveTitle(t.id)} className="text-[color:var(--ink-muted)] hover:text-[var(--ink)]">
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <FormField label="新头衔">
              <TextInput
                value={newTitle}
                onChange={setNewTitle}
                placeholder="输入头衔名称"
              />
            </FormField>
            <div className="flex items-end">
              <Button size="sm" onClick={handleAddTitle} disabled={!newTitle.trim()}>
                添加
              </Button>
            </div>
          </div>
        </div>
      </FormDialog>
    </div>
  );
}
