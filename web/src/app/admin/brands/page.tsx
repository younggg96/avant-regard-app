"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { brandsApi, type AdminBrand, type UpdateBrandParams } from "@/lib/services/admin";
import {
  PageHeader,
  SearchBar,
  Pagination,
  EmptyState,
  LoadingState,
  ConfirmDialog,
  FormDialog,
  FormField,
  TextInput,
  Button,
} from "@/components/admin/ui";


export default function BrandsPage() {
  const { t } = useTranslation();
  const [brands, setBrands] = useState<AdminBrand[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");

  const [editing, setEditing] = useState<AdminBrand | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminBrand | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState<UpdateBrandParams>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await brandsApi.getAll(keyword || undefined, page, 30);
      setBrands(data.brands);
      setTotal(data.total);
      setTotalPages(Math.ceil(data.total / 30));
    } finally {
      setLoading(false);
    }
  }, [page, keyword]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [keyword]);

  const openEdit = (b: AdminBrand) => {
    setForm({ name: b.name, category: b.category, foundedYear: b.foundedYear, founder: b.founder, country: b.country, website: b.website });
    setEditing(b);
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await brandsApi.update(editing.id, form);
      setEditing(null);
      load();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await brandsApi.delete(deleteTarget.id);
      setDeleteTarget(null);
      load();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <PageHeader title={t("admin.brands")} description={t("admin.brandTotal", { count: total })} />

      <div className="mb-4 max-w-sm">
        <SearchBar value={keyword} onChange={setKeyword} placeholder={t("admin.searchBrand")} />
      </div>

      {loading ? (
        <LoadingState />
      ) : brands.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
            <table className="w-full font-label text-[13px]">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--canvas-soft)]">
                  <th className="px-4 py-2.5 text-left text-[11px] tracking-wider text-[color:var(--ink-muted)]">{t("admin.colBrand")}</th>
                  <th className="px-4 py-2.5 text-left text-[11px] tracking-wider text-[color:var(--ink-muted)]">{t("admin.category")}</th>
                  <th className="px-4 py-2.5 text-left text-[11px] tracking-wider text-[color:var(--ink-muted)]">{t("admin.colFounder")}</th>
                  <th className="px-4 py-2.5 text-left text-[11px] tracking-wider text-[color:var(--ink-muted)]">{t("admin.colCountry")}</th>
                  <th className="px-4 py-2.5 text-left text-[11px] tracking-wider text-[color:var(--ink-muted)]">{t("admin.colFoundedYear")}</th>
                  <th className="px-4 py-2.5 text-right text-[11px] tracking-wider text-[color:var(--ink-muted)]">{t("admin.colActions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {brands.map((b) => (
                  <tr key={b.id} className="hover:bg-[var(--canvas-soft)] transition-colors">
                    <td className="px-4 py-3 font-medium">{b.name}</td>
                    <td className="px-4 py-3 text-[color:var(--ink-muted)]">{b.category || "—"}</td>
                    <td className="px-4 py-3 text-[color:var(--ink-muted)]">{b.founder || "—"}</td>
                    <td className="px-4 py-3 text-[color:var(--ink-muted)]">{b.country || "—"}</td>
                    <td className="px-4 py-3 text-[color:var(--ink-muted)]">{b.foundedYear || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openEdit(b)} className="rounded px-2 py-1 text-[12px] text-[color:var(--ink-muted)] transition-colors hover:bg-[var(--canvas-raised)] hover:text-[var(--ink)]">{t("admin.edit")}</button>
                        <button onClick={() => setDeleteTarget(b)} className="rounded px-2 py-1 text-[12px] text-[color:var(--ink-muted)] transition-colors hover:bg-[var(--canvas-raised)] hover:text-[var(--ink)]">{t("admin.delete")}</button>
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

      <FormDialog open={!!editing} title={t("admin.editBrand", { name: editing?.name })} onClose={() => setEditing(null)}>
        <div className="space-y-4">
          <FormField label={t("admin.brandNameLabel")}><TextInput value={form.name || ""} onChange={(v) => setForm({ ...form, name: v })} /></FormField>
          <FormField label={t("admin.category")}><TextInput value={form.category || ""} onChange={(v) => setForm({ ...form, category: v })} /></FormField>
          <FormField label={t("admin.founderLabel")}><TextInput value={form.founder || ""} onChange={(v) => setForm({ ...form, founder: v })} /></FormField>
          <FormField label={t("admin.colCountry")}><TextInput value={form.country || ""} onChange={(v) => setForm({ ...form, country: v })} /></FormField>
          <FormField label={t("admin.foundedYearLabel")}><TextInput value={form.foundedYear || ""} onChange={(v) => setForm({ ...form, foundedYear: v })} /></FormField>
          <FormField label={t("admin.websiteLabel")}><TextInput value={form.website || ""} onChange={(v) => setForm({ ...form, website: v })} /></FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setEditing(null)}>{t("admin.cancel")}</Button>
            <Button onClick={handleSave} loading={saving}>{t("admin.save")}</Button>
          </div>
        </div>
      </FormDialog>

      <ConfirmDialog
        open={!!deleteTarget}
        title={t("admin.confirmDeleteBrand")}
        message={t("admin.deleteBrandMsg", { name: deleteTarget?.name })}
        confirmLabel={t("admin.delete")}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
