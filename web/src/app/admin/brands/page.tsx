"use client";

import { useEffect, useState, useCallback } from "react";
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
    setForm({
      name: b.name,
      category: b.category,
      foundedYear: b.foundedYear,
      founder: b.founder,
      country: b.country,
      website: b.website,
    });
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
      <PageHeader title="品牌管理" description={`共 ${total} 个品牌`} />

      <div className="mb-4 max-w-sm">
        <SearchBar value={keyword} onChange={setKeyword} placeholder="搜索品牌名…" />
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
                  <th className="px-4 py-2.5 text-left text-[11px] tracking-wider text-[color:var(--ink-muted)]">品牌</th>
                  <th className="px-4 py-2.5 text-left text-[11px] tracking-wider text-[color:var(--ink-muted)]">分类</th>
                  <th className="px-4 py-2.5 text-left text-[11px] tracking-wider text-[color:var(--ink-muted)]">创始人</th>
                  <th className="px-4 py-2.5 text-left text-[11px] tracking-wider text-[color:var(--ink-muted)]">国家</th>
                  <th className="px-4 py-2.5 text-left text-[11px] tracking-wider text-[color:var(--ink-muted)]">创立年份</th>
                  <th className="px-4 py-2.5 text-right text-[11px] tracking-wider text-[color:var(--ink-muted)]">操作</th>
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
                        <button onClick={() => openEdit(b)} className="rounded px-2 py-1 text-[12px] text-[color:var(--ink-muted)] transition-colors hover:bg-[var(--canvas-raised)] hover:text-[var(--ink)]">
                          编辑
                        </button>
                        <button onClick={() => setDeleteTarget(b)} className="rounded px-2 py-1 text-[12px] text-[color:var(--ink-muted)] transition-colors hover:bg-[var(--canvas-raised)] hover:text-[var(--ink)]">
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

      <FormDialog open={!!editing} title={`编辑品牌 — ${editing?.name}`} onClose={() => setEditing(null)}>
        <div className="space-y-4">
          <FormField label="品牌名"><TextInput value={form.name || ""} onChange={(v) => setForm({ ...form, name: v })} /></FormField>
          <FormField label="分类"><TextInput value={form.category || ""} onChange={(v) => setForm({ ...form, category: v })} /></FormField>
          <FormField label="创始人"><TextInput value={form.founder || ""} onChange={(v) => setForm({ ...form, founder: v })} /></FormField>
          <FormField label="国家"><TextInput value={form.country || ""} onChange={(v) => setForm({ ...form, country: v })} /></FormField>
          <FormField label="创立年份"><TextInput value={form.foundedYear || ""} onChange={(v) => setForm({ ...form, foundedYear: v })} /></FormField>
          <FormField label="官网"><TextInput value={form.website || ""} onChange={(v) => setForm({ ...form, website: v })} /></FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setEditing(null)}>取消</Button>
            <Button onClick={handleSave} loading={saving}>保存</Button>
          </div>
        </div>
      </FormDialog>

      <ConfirmDialog
        open={!!deleteTarget}
        title="确认删除品牌？"
        message={`将删除品牌「${deleteTarget?.name}」及其所有图片。`}
        confirmLabel="删除"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
