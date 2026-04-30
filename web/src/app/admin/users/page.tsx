"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { useTranslation } from "react-i18next";
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

function resolveUserKind(u: AdminUser): UserKind {
  if (u.isAdmin) return "ADMIN";
  if (u.merchant?.status === "APPROVED") return "MERCHANT";
  return "USER";
}

export default function UsersPage() {
  const { t } = useTranslation();

  const KIND_STYLE: Record<UserKind, { label: string; className: string }> = {
    ADMIN: {
      label: "ADMIN",
      className: "bg-[var(--ink)] text-[var(--canvas)]",
    },
    MERCHANT: {
      label: t("admin.merchant"),
      className: "border border-[var(--ink)] bg-transparent text-[var(--ink)]",
    },
    USER: {
      label: "USER",
      className: "bg-[var(--canvas-raised)] text-[color:var(--ink-muted)]",
    },
  };

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
      <PageHeader title={t("admin.users")} description={t("admin.userTotal", { count: total })} />

      <div className="mb-4 max-w-sm">
        <SearchBar value={keyword} onChange={setKeyword} placeholder={t("admin.searchUsers")} />
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
                  <th className="px-4 py-2.5 text-left text-[11px] tracking-wider text-[color:var(--ink-muted)]">{t("admin.colUser")}</th>
                  <th className="px-4 py-2.5 text-left text-[11px] tracking-wider text-[color:var(--ink-muted)]">{t("admin.colType")}</th>
                  <th className="px-4 py-2.5 text-left text-[11px] tracking-wider text-[color:var(--ink-muted)]">{t("admin.colLevel")}</th>
                  <th className="px-4 py-2.5 text-left text-[11px] tracking-wider text-[color:var(--ink-muted)]">{t("admin.colTitles")}</th>
                  <th className="px-4 py-2.5 text-left text-[11px] tracking-wider text-[color:var(--ink-muted)]">{t("admin.colData")}</th>
                  <th className="px-4 py-2.5 text-left text-[11px] tracking-wider text-[color:var(--ink-muted)]">{t("admin.colRegTime")}</th>
                  <th className="px-4 py-2.5 text-right text-[11px] tracking-wider text-[color:var(--ink-muted)]">{t("admin.colActions")}</th>
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
                          <Image src={user.avatarUrl} alt="" width={32} height={32} className="h-8 w-8 rounded-full object-cover" />
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
                        {user.titles?.map((tt) => (
                          <StatusBadge key={tt.id} variant="info">{tt.title}</StatusBadge>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[color:var(--ink-muted)]">
                      <div>{t("admin.postsCount", { count: user.postCount ?? 0 })} · {t("admin.followersCount", { count: user.followerCount ?? 0 })}</div>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[color:var(--ink-muted)]">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => openTitles(user)}
                          className="rounded px-2 py-1 text-[12px] text-[color:var(--ink-muted)] transition-colors hover:bg-[var(--canvas-raised)] hover:text-[var(--ink)]"
                        >
                          {t("admin.manageTitles")}
                        </button>
                        <button
                          onClick={() => setDeleteTarget(user)}
                          className="rounded px-2 py-1 text-[12px] text-[color:var(--ink-muted)] transition-colors hover:bg-[var(--canvas-raised)] hover:text-[var(--ink)]"
                        >
                          {t("admin.delete")}
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
        title={t("admin.confirmDeleteUser")}
        message={t("admin.deleteUserMsg", { username: deleteTarget?.username })}
        confirmLabel={t("admin.delete")}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <FormDialog
        open={!!titlesUser}
        title={t("admin.manageTitlesFor", { username: titlesUser?.username })}
        onClose={() => setTitlesUser(null)}
      >
        <div className="space-y-3">
          {titlesLoading && !titles.length ? (
            <p className="text-center font-label text-[13px] text-[color:var(--ink-muted)]">{t("admin.loading")}</p>
          ) : titles.length === 0 ? (
            <p className="text-center font-label text-[13px] text-[color:var(--ink-muted)]">{t("admin.noTitles")}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {titles.map((tt) => (
                <span
                  key={tt.id}
                  className="inline-flex items-center gap-1 rounded-full bg-[var(--canvas-raised)] px-3 py-1 font-label text-[12px] text-[color:var(--ink-muted)]"
                >
                  {tt.title}
                  <button onClick={() => handleRemoveTitle(tt.id)} className="text-[color:var(--ink-muted)] hover:text-[var(--ink)]">
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <FormField label={t("admin.newTitle")}>
              <TextInput
                value={newTitle}
                onChange={setNewTitle}
                placeholder={t("admin.titlePlaceholder")}
              />
            </FormField>
            <div className="flex items-end">
              <Button size="sm" onClick={handleAddTitle} disabled={!newTitle.trim()}>
                {t("admin.add")}
              </Button>
            </div>
          </div>
        </div>
      </FormDialog>
    </div>
  );
}
