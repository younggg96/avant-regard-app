"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { bannersApi, uploadImage, type AdminBanner } from "@/lib/services/admin";
import {
  PageHeader,
  StatusBadge,
  EmptyState,
  LoadingState,
  ConfirmDialog,
  FormDialog,
  FormField,
  TextInput,
  Toggle,
  Button,
} from "@/components/admin/ui";


export default function BannersPage() {
  const { t } = useTranslation();

  const LINK_TYPES = [
    { value: "NONE", label: t("admin.linkTypeNone") },
    { value: "POST", label: t("admin.linkTypePost") },
    { value: "BRAND", label: t("admin.linkTypeBrand") },
    { value: "SHOW", label: t("admin.linkTypeShow") },
    { value: "EXTERNAL", label: t("admin.linkTypeExternal") },
  ] as const;

  type LinkType = (typeof LINK_TYPES)[number]["value"];

  const [banners, setBanners] = useState<AdminBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AdminBanner | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminBanner | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const emptyForm = { imageUrl: "", linkType: "NONE" as LinkType, linkValue: "", sortOrder: 0, title: "", isActive: true };
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setBanners(await bannersApi.getAll());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setForm(emptyForm); setCreating(true); };

  const openEdit = (b: AdminBanner) => {
    setForm({
      imageUrl: b.imageUrl,
      linkType: b.linkType as LinkType,
      linkValue: b.linkValue || "",
      sortOrder: b.sortOrder,
      title: b.title || "",
      isActive: b.isActive,
    });
    setEditing(b);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editing) await bannersApi.update(editing.id, form);
      else await bannersApi.create(form);
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
      await bannersApi.delete(deleteTarget.id);
      setDeleteTarget(null);
      load();
    } finally {
      setDeleting(false);
    }
  };

  const handleToggle = async (b: AdminBanner) => {
    await bannersApi.toggleStatus(b.id);
    load();
  };

  const handleImageUpload = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const url = await uploadImage(file);
        setForm((prev) => ({ ...prev, imageUrl: url }));
      } catch { alert(t("admin.uploadFailed")); }
    };
    input.click();
  };

  const isFormOpen = creating || !!editing;

  return (
    <div>
      <PageHeader
        title={t("admin.banners")}
        description={t("admin.bannerTotal", { count: banners.length })}
        actions={<Button size="sm" onClick={openCreate}>{t("admin.createBanner")}</Button>}
      />

      {loading ? (
        <LoadingState />
      ) : banners.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-3">
          {banners.map((b) => (
            <div key={b.id} className="flex items-center gap-4 rounded-lg border border-[var(--border)] p-4">
              <img src={b.imageUrl} alt="" className="h-16 w-28 shrink-0 rounded object-cover" />
              <div className="min-w-0 flex-1 font-label">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-medium">{b.title || t("admin.noTitle")}</span>
                  <StatusBadge variant={b.isActive ? "success" : "muted"}>
                    {b.isActive ? t("admin.active") : t("admin.inactive")}
                  </StatusBadge>
                </div>
                <div className="mt-0.5 text-[12px] text-[color:var(--ink-muted)]">
                  {t("admin.linkColon")} {LINK_TYPES.find((tp) => tp.value === b.linkType)?.label}
                  {b.linkValue && ` → ${b.linkValue}`}
                  {" · "}{t("admin.sortOrder")} {b.sortOrder}
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <button onClick={() => openEdit(b)} className="rounded px-2 py-1 text-[12px] text-[color:var(--ink-muted)] transition-colors hover:bg-[var(--canvas-raised)] hover:text-[var(--ink)]">{t("admin.edit")}</button>
                <button onClick={() => handleToggle(b)} className="rounded px-2 py-1 text-[12px] text-[color:var(--ink-muted)] transition-colors hover:bg-[var(--canvas-raised)] hover:text-[var(--ink)]">{t("admin.toggle")}</button>
                <button onClick={() => setDeleteTarget(b)} className="rounded px-2 py-1 text-[12px] text-[color:var(--ink-muted)] transition-colors hover:bg-[var(--canvas-raised)] hover:text-[var(--ink)]">{t("admin.delete")}</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <FormDialog open={isFormOpen} title={editing ? t("admin.editBanner") : t("admin.createBanner")} onClose={() => { setCreating(false); setEditing(null); }}>
        <div className="space-y-4">
          <FormField label={t("admin.image")} required>
            <div className="flex items-center gap-3">
              {form.imageUrl && <img src={form.imageUrl} alt="" className="h-16 w-28 rounded object-cover" />}
              <Button variant="secondary" size="sm" onClick={handleImageUpload}>{t("admin.uploadImage")}</Button>
            </div>
          </FormField>
          <FormField label={t("admin.titleLabel")}><TextInput value={form.title} onChange={(v) => setForm({ ...form, title: v })} /></FormField>
          <FormField label={t("admin.linkType")}>
            <div className="flex flex-wrap gap-1.5">
              {LINK_TYPES.map((tp) => (
                <button
                  key={tp.value}
                  onClick={() => setForm({ ...form, linkType: tp.value, linkValue: "" })}
                  className={`rounded-full border px-3 py-1 font-label text-[12px] transition-colors ${
                    form.linkType === tp.value
                      ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--canvas)]"
                      : "border-[var(--border)] text-[color:var(--ink-muted)] hover:border-[var(--ink-muted)]"
                  }`}
                >
                  {tp.label}
                </button>
              ))}
            </div>
          </FormField>
          {form.linkType !== "NONE" && (
            <FormField label={form.linkType === "EXTERNAL" ? "URL" : "ID"}>
              <TextInput
                value={form.linkValue}
                onChange={(v) => setForm({ ...form, linkValue: v })}
                placeholder={form.linkType === "EXTERNAL" ? "https://..." : t("admin.inputId")}
              />
            </FormField>
          )}
          <FormField label={t("admin.sortOrderLabel")}>
            <TextInput value={String(form.sortOrder)} onChange={(v) => setForm({ ...form, sortOrder: Number(v) || 0 })} type="number" />
          </FormField>
          <Toggle checked={form.isActive} onChange={(v) => setForm({ ...form, isActive: v })} label={t("admin.enable")} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => { setCreating(false); setEditing(null); }}>{t("admin.cancel")}</Button>
            <Button onClick={handleSave} loading={saving} disabled={!form.imageUrl}>{editing ? t("admin.save") : t("admin.create")}</Button>
          </div>
        </div>
      </FormDialog>

      <ConfirmDialog
        open={!!deleteTarget}
        title={t("admin.confirmDeleteBanner")}
        confirmLabel={t("admin.delete")}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
