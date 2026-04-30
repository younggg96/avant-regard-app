"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { showsApi, type AdminShow } from "@/lib/services/admin";
import {
  PageHeader,
  SearchBar,
  FilterChips,
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


export default function ShowsPage() {
  const { t } = useTranslation();

  const STATUS_OPTIONS = [
    { value: "APPROVED", label: t("admin.statusApproved") },
    { value: "PENDING", label: t("admin.statusPending") },
    { value: "REJECTED", label: t("admin.statusRejected") },
  ] as const;

  type ShowStatus = (typeof STATUS_OPTIONS)[number]["value"];

  const [shows, setShows] = useState<AdminShow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState<ShowStatus>();

  const [editing, setEditing] = useState<AdminShow | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminShow | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [form, setForm] = useState({ brandName: "", season: "", title: "", description: "", category: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await showsApi.getAll({ keyword, status, page, pageSize: 20 });
      setShows(data.shows);
      setTotal(data.total);
      setTotalPages(Math.ceil(data.total / 20));
    } finally {
      setLoading(false);
    }
  }, [page, keyword, status]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [keyword, status]);

  const openCreate = () => {
    setForm({ brandName: "", season: "", title: "", description: "", category: "" });
    setCreating(true);
  };

  const openEdit = (s: AdminShow) => {
    setForm({
      brandName: s.brandName,
      season: s.season,
      title: s.title || "",
      description: s.description || "",
      category: s.category || "",
    });
    setEditing(s);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editing) {
        await showsApi.update(editing.id, form);
      } else {
        await showsApi.create(form);
      }
      setEditing(null);
      setCreating(false);
      load();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await showsApi.delete(deleteTarget.id);
      setDeleteTarget(null);
      load();
    } finally {
      setDeleting(false);
    }
  };

  const isFormOpen = creating || !!editing;

  const statusLabel = (s: string) =>
    s === "APPROVED" ? t("admin.statusApproved") :
    s === "REJECTED" ? t("admin.statusRejected") : t("admin.statusPending");

  return (
    <div>
      <PageHeader
        title={t("admin.shows")}
        description={t("admin.showTotal", { count: total })}
        actions={
          <Button size="sm" onClick={openCreate}>
            {t("admin.createShow")}
          </Button>
        }
      />

      <div className="mb-4 space-y-3">
        <div className="max-w-sm">
          <SearchBar value={keyword} onChange={setKeyword} placeholder={t("admin.searchShow")} />
        </div>
        <FilterChips options={[...STATUS_OPTIONS]} value={status} onChange={setStatus} allLabel={t("admin.allStatus")} />
      </div>

      {loading ? (
        <LoadingState />
      ) : shows.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
            <table className="w-full font-label text-[13px]">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--canvas-soft)]">
                  <th className="px-4 py-2.5 text-left text-[11px] tracking-wider text-[color:var(--ink-muted)]">{t("admin.colShow")}</th>
                  <th className="px-4 py-2.5 text-left text-[11px] tracking-wider text-[color:var(--ink-muted)]">{t("admin.colBrand")}</th>
                  <th className="px-4 py-2.5 text-left text-[11px] tracking-wider text-[color:var(--ink-muted)]">{t("admin.colSeason")}</th>
                  <th className="px-4 py-2.5 text-left text-[11px] tracking-wider text-[color:var(--ink-muted)]">{t("admin.colStatus")}</th>
                  <th className="px-4 py-2.5 text-left text-[11px] tracking-wider text-[color:var(--ink-muted)]">{t("admin.colImages")}</th>
                  <th className="px-4 py-2.5 text-left text-[11px] tracking-wider text-[color:var(--ink-muted)]">{t("admin.colTime")}</th>
                  <th className="px-4 py-2.5 text-right text-[11px] tracking-wider text-[color:var(--ink-muted)]">{t("admin.colActions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {shows.map((s) => (
                  <tr key={s.id} className="hover:bg-[var(--canvas-soft)] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {s.coverImage && <img src={s.coverImage} alt="" className="h-10 w-10 rounded object-cover" />}
                        <span className="font-medium">{s.title || `${s.brandName} ${s.season}`}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[color:var(--ink-muted)]">{s.brandName}</td>
                    <td className="px-4 py-3 text-[color:var(--ink-muted)]">{s.season}</td>
                    <td className="px-4 py-3">
                      <StatusBadge active={s.status === "APPROVED"}>
                        {statusLabel(s.status)}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3 text-[color:var(--ink-muted)]">{s.imageCount ?? 0}</td>
                    <td className="px-4 py-3 text-[12px] text-[color:var(--ink-muted)]">
                      {new Date(s.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openEdit(s)} className="rounded px-2 py-1 text-[12px] text-[color:var(--ink-muted)] transition-colors hover:bg-[var(--canvas-raised)] hover:text-[var(--ink)]">{t("admin.edit")}</button>
                        <button onClick={() => setDeleteTarget(s)} className="rounded px-2 py-1 text-[12px] text-[color:var(--ink-muted)] transition-colors hover:bg-[var(--canvas-raised)] hover:text-[var(--ink)]">{t("admin.delete")}</button>
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

      <FormDialog open={isFormOpen} title={editing ? t("admin.editShow") : t("admin.createShow")} onClose={() => { setCreating(false); setEditing(null); }}>
        <div className="space-y-4">
          <FormField label={t("admin.brandName")} required><TextInput value={form.brandName} onChange={(v) => setForm({ ...form, brandName: v })} /></FormField>
          <FormField label={t("admin.season")} required><TextInput value={form.season} onChange={(v) => setForm({ ...form, season: v })} placeholder="SS25" /></FormField>
          <FormField label={t("admin.titleLabel")}><TextInput value={form.title} onChange={(v) => setForm({ ...form, title: v })} /></FormField>
          <FormField label={t("admin.category")}><TextInput value={form.category} onChange={(v) => setForm({ ...form, category: v })} /></FormField>
          <FormField label={t("admin.description")}><TextInput value={form.description} onChange={(v) => setForm({ ...form, description: v })} multiline /></FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => { setCreating(false); setEditing(null); }}>{t("admin.cancel")}</Button>
            <Button onClick={handleSave} loading={saving} disabled={!form.brandName || !form.season}>{editing ? t("admin.save") : t("admin.create")}</Button>
          </div>
        </div>
      </FormDialog>

      <ConfirmDialog
        open={!!deleteTarget}
        title={t("admin.confirmDeleteShow")}
        message={`${deleteTarget?.brandName} ${deleteTarget?.season}`}
        confirmLabel={t("admin.delete")}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
