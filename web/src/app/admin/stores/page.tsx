"use client";

import { useEffect, useState, useCallback } from "react";
import { storesApi, uploadImage, type AdminStore } from "@/lib/services/admin";
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
  Toggle,
  Button,
} from "@/components/admin/ui";


export default function StoresPage() {
  const [stores, setStores] = useState<AdminStore[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");

  const [editing, setEditing] = useState<AdminStore | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminStore | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const emptyForm = {
    name: "", description: "", address: "", city: "", country: "",
    phone: "", website: "", openingHours: "", isActive: true,
    latitude: undefined as number | undefined,
    longitude: undefined as number | undefined,
    coverImage: "",
  };
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await storesApi.getAll({ keyword, page, pageSize: 20 });
      setStores(data.stores);
      setTotal(data.total);
      setTotalPages(Math.ceil(data.total / 20));
    } finally {
      setLoading(false);
    }
  }, [page, keyword]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [keyword]);

  const openCreate = () => { setForm(emptyForm); setCreating(true); };

  const openEdit = (s: AdminStore) => {
    setForm({
      name: s.name,
      description: s.description || "",
      address: s.address || "",
      city: s.city || "",
      country: s.country || "",
      phone: s.phone || "",
      website: s.website || "",
      openingHours: s.openingHours || "",
      isActive: s.isActive,
      latitude: s.latitude,
      longitude: s.longitude,
      coverImage: s.coverImage || "",
    });
    setEditing(s);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        latitude: form.latitude || undefined,
        longitude: form.longitude || undefined,
      };
      if (editing) await storesApi.update(editing.id, payload);
      else await storesApi.create(payload);
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
      await storesApi.delete(deleteTarget.id);
      setDeleteTarget(null);
      load();
    } finally {
      setDeleting(false);
    }
  };

  const handleCoverUpload = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const url = await uploadImage(file);
        setForm((prev) => ({ ...prev, coverImage: url }));
      } catch { alert("上传失败"); }
    };
    input.click();
  };

  const isFormOpen = creating || !!editing;

  return (
    <div>
      <PageHeader
        title="买手店管理"
        description={`共 ${total} 家买手店`}
        actions={<Button size="sm" onClick={openCreate}>创建店铺</Button>}
      />

      <div className="mb-4 max-w-sm">
        <SearchBar value={keyword} onChange={setKeyword} placeholder="搜索店铺名…" />
      </div>

      {loading ? (
        <LoadingState />
      ) : stores.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
            <table className="w-full font-label text-[13px]">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--canvas-soft)]">
                  <th className="px-4 py-2.5 text-left text-[11px] tracking-wider text-[color:var(--ink-muted)]">店铺</th>
                  <th className="px-4 py-2.5 text-left text-[11px] tracking-wider text-[color:var(--ink-muted)]">城市</th>
                  <th className="px-4 py-2.5 text-left text-[11px] tracking-wider text-[color:var(--ink-muted)]">国家</th>
                  <th className="px-4 py-2.5 text-left text-[11px] tracking-wider text-[color:var(--ink-muted)]">地址</th>
                  <th className="px-4 py-2.5 text-right text-[11px] tracking-wider text-[color:var(--ink-muted)]">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {stores.map((s) => (
                  <tr key={s.id} className="hover:bg-[var(--canvas-soft)] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {s.coverImage && <img src={s.coverImage} alt="" className="h-10 w-10 rounded object-cover" />}
                        <span className="font-medium">{s.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[color:var(--ink-muted)]">{s.city || "—"}</td>
                    <td className="px-4 py-3 text-[color:var(--ink-muted)]">{s.country || "—"}</td>
                    <td className="px-4 py-3 max-w-[200px]">
                      <div className="truncate text-[color:var(--ink-muted)]">{s.address || "—"}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openEdit(s)} className="rounded px-2 py-1 text-[12px] text-[color:var(--ink-muted)] transition-colors hover:bg-[var(--canvas-raised)] hover:text-[var(--ink)]">编辑</button>
                        <button onClick={() => setDeleteTarget(s)} className="rounded px-2 py-1 text-[12px] text-[color:var(--ink-muted)] transition-colors hover:bg-[var(--canvas-raised)] hover:text-[var(--ink)]">删除</button>
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

      <FormDialog open={isFormOpen} title={editing ? "编辑店铺" : "创建店铺"} onClose={() => { setCreating(false); setEditing(null); }} wide>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="店铺名" required><TextInput value={form.name} onChange={(v) => setForm({ ...form, name: v })} /></FormField>
          <FormField label="国家"><TextInput value={form.country} onChange={(v) => setForm({ ...form, country: v })} /></FormField>
          <FormField label="城市"><TextInput value={form.city} onChange={(v) => setForm({ ...form, city: v })} /></FormField>
          <FormField label="电话"><TextInput value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} /></FormField>
          <div className="sm:col-span-2">
            <FormField label="地址"><TextInput value={form.address} onChange={(v) => setForm({ ...form, address: v })} /></FormField>
          </div>
          <FormField label="网站"><TextInput value={form.website} onChange={(v) => setForm({ ...form, website: v })} /></FormField>
          <FormField label="营业时间"><TextInput value={form.openingHours} onChange={(v) => setForm({ ...form, openingHours: v })} /></FormField>
          <FormField label="经度"><TextInput value={String(form.longitude ?? "")} onChange={(v) => setForm({ ...form, longitude: v ? Number(v) : undefined })} type="number" /></FormField>
          <FormField label="纬度"><TextInput value={String(form.latitude ?? "")} onChange={(v) => setForm({ ...form, latitude: v ? Number(v) : undefined })} type="number" /></FormField>
          <div className="sm:col-span-2">
            <FormField label="描述"><TextInput value={form.description} onChange={(v) => setForm({ ...form, description: v })} multiline /></FormField>
          </div>
          <FormField label="封面">
            <div className="flex items-center gap-3">
              {form.coverImage && <img src={form.coverImage} alt="" className="h-12 w-16 rounded object-cover" />}
              <Button variant="secondary" size="sm" onClick={handleCoverUpload}>上传</Button>
            </div>
          </FormField>
          <div className="flex items-end">
            <Toggle checked={form.isActive} onChange={(v) => setForm({ ...form, isActive: v })} label="启用" />
          </div>
          <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => { setCreating(false); setEditing(null); }}>取消</Button>
            <Button onClick={handleSave} loading={saving} disabled={!form.name}>{editing ? "保存" : "创建"}</Button>
          </div>
        </div>
      </FormDialog>

      <ConfirmDialog
        open={!!deleteTarget}
        title="确认删除店铺？"
        message={deleteTarget?.name}
        confirmLabel="删除"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
