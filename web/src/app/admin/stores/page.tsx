"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
      } catch { alert(t("admin.uploadFailed")); }
    };
    input.click();
  };

  const isFormOpen = creating || !!editing;

  return (
    <div>
      <PageHeader
        title={t("admin.stores")}
        description={t("admin.storeTotal", { count: total })}
        actions={<Button size="sm" onClick={openCreate}>{t("admin.createStore")}</Button>}
      />

      <div className="mb-4 max-w-sm">
        <SearchBar value={keyword} onChange={setKeyword} placeholder={t("admin.searchStore")} />
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
                  <th className="px-4 py-2.5 text-left text-[11px] tracking-wider text-[color:var(--ink-muted)]">{t("admin.colStore")}</th>
                  <th className="px-4 py-2.5 text-left text-[11px] tracking-wider text-[color:var(--ink-muted)]">{t("admin.colCity")}</th>
                  <th className="px-4 py-2.5 text-left text-[11px] tracking-wider text-[color:var(--ink-muted)]">{t("admin.colCountry")}</th>
                  <th className="px-4 py-2.5 text-left text-[11px] tracking-wider text-[color:var(--ink-muted)]">{t("admin.colAddress")}</th>
                  <th className="px-4 py-2.5 text-right text-[11px] tracking-wider text-[color:var(--ink-muted)]">{t("admin.colActions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {stores.map((s) => (
                  <tr key={s.id} className="hover:bg-[var(--canvas-soft)] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {s.coverImage && <Image src={s.coverImage} alt="" width={40} height={40} className="h-10 w-10 rounded object-cover" />}
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

      <FormDialog open={isFormOpen} title={editing ? t("admin.editStore") : t("admin.createStore")} onClose={() => { setCreating(false); setEditing(null); }} wide>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t("admin.storeName")} required><TextInput value={form.name} onChange={(v) => setForm({ ...form, name: v })} /></FormField>
          <FormField label={t("admin.country")}><TextInput value={form.country} onChange={(v) => setForm({ ...form, country: v })} /></FormField>
          <FormField label={t("admin.city")}><TextInput value={form.city} onChange={(v) => setForm({ ...form, city: v })} /></FormField>
          <FormField label={t("admin.phone")}><TextInput value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} /></FormField>
          <div className="sm:col-span-2">
            <FormField label={t("admin.address")}><TextInput value={form.address} onChange={(v) => setForm({ ...form, address: v })} /></FormField>
          </div>
          <FormField label={t("admin.website")}><TextInput value={form.website} onChange={(v) => setForm({ ...form, website: v })} /></FormField>
          <FormField label={t("admin.openingHours")}><TextInput value={form.openingHours} onChange={(v) => setForm({ ...form, openingHours: v })} /></FormField>
          <FormField label={t("admin.longitude")}><TextInput value={String(form.longitude ?? "")} onChange={(v) => setForm({ ...form, longitude: v ? Number(v) : undefined })} type="number" /></FormField>
          <FormField label={t("admin.latitude")}><TextInput value={String(form.latitude ?? "")} onChange={(v) => setForm({ ...form, latitude: v ? Number(v) : undefined })} type="number" /></FormField>
          <div className="sm:col-span-2">
            <FormField label={t("admin.description")}><TextInput value={form.description} onChange={(v) => setForm({ ...form, description: v })} multiline /></FormField>
          </div>
          <FormField label={t("admin.cover")}>
            <div className="flex items-center gap-3">
              {form.coverImage && <Image src={form.coverImage} alt="" width={64} height={48} className="h-12 w-16 rounded object-cover" />}
              <Button variant="secondary" size="sm" onClick={handleCoverUpload}>{t("admin.upload")}</Button>
            </div>
          </FormField>
          <div className="flex items-end">
            <Toggle checked={form.isActive} onChange={(v) => setForm({ ...form, isActive: v })} label={t("admin.enable")} />
          </div>
          <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => { setCreating(false); setEditing(null); }}>{t("admin.cancel")}</Button>
            <Button onClick={handleSave} loading={saving} disabled={!form.name}>{editing ? t("admin.save") : t("admin.create")}</Button>
          </div>
        </div>
      </FormDialog>

      <ConfirmDialog
        open={!!deleteTarget}
        title={t("admin.confirmDeleteStore")}
        message={deleteTarget?.name}
        confirmLabel={t("admin.delete")}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
