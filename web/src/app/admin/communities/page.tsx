"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { useTranslation } from "react-i18next";
import {
  communitiesApi,
  uploadImage,
  type AdminCommunity,
  type CreateCommunityParams,
  type UpdateCommunityParams,
  type CommunityCategory,
} from "@/lib/services/admin";
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


export default function CommunitiesPage() {
  const { t } = useTranslation();

  const CATEGORIES: { value: CommunityCategory; label: string }[] = [
    { value: "GENERAL", label: t("admin.categoryGeneral") },
    { value: "FASHION", label: t("admin.categoryFashion") },
    { value: "LIFESTYLE", label: t("admin.categoryLifestyle") },
    { value: "BEAUTY", label: t("admin.categoryBeauty") },
    { value: "CULTURE", label: t("admin.categoryCulture") },
  ];

  const [communities, setCommunities] = useState<AdminCommunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AdminCommunity | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminCommunity | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [form, setForm] = useState<CreateCommunityParams & { isActive?: boolean }>({
    name: "", slug: "", description: "", category: "GENERAL", isOfficial: false, sortOrder: 0,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await communitiesApi.getAll(true);
      setCommunities(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setForm({ name: "", slug: "", description: "", category: "GENERAL", isOfficial: false, sortOrder: 0 });
    setCreating(true);
  };

  const openEdit = (c: AdminCommunity) => {
    setForm({ name: c.name, slug: c.slug, description: c.description, category: c.category, isOfficial: c.isOfficial, isActive: c.isActive, sortOrder: c.sortOrder, iconUrl: c.iconUrl, coverUrl: c.coverUrl });
    setEditing(c);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editing) {
        const params: UpdateCommunityParams = { ...form };
        delete (params as Record<string, unknown>).slug;
        await communitiesApi.update(editing.id, params);
      } else {
        await communitiesApi.create(form);
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
      await communitiesApi.delete(deleteTarget.id);
      setDeleteTarget(null);
      load();
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleActive = async (c: AdminCommunity) => {
    await communitiesApi.update(c.id, { isActive: !c.isActive });
    load();
  };

  const handleImageUpload = async (field: "iconUrl" | "coverUrl") => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const url = await uploadImage(file);
        setForm((prev) => ({ ...prev, [field]: url }));
      } catch {
        alert(t("admin.uploadFailed"));
      }
    };
    input.click();
  };

  const isFormOpen = creating || !!editing;

  return (
    <div>
      <PageHeader
        title={t("admin.communities")}
        description={t("admin.communityTotal", { count: communities.length })}
        actions={<Button size="sm" onClick={openCreate}>{t("admin.createCommunity")}</Button>}
      />

      {loading ? (
        <LoadingState />
      ) : communities.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {communities.map((c) => (
            <div key={c.id} className="rounded-lg border border-[var(--border)] overflow-hidden">
              {c.coverUrl && (
                <div className="relative h-28 w-full">
                  <Image
                    src={c.coverUrl}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                </div>
              )}
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {c.iconUrl && <Image src={c.iconUrl} alt="" width={32} height={32} className="h-8 w-8 rounded-full object-cover" />}
                    <div>
                      <h3 className="font-label text-[14px] font-semibold">{c.name}</h3>
                      <p className="font-label text-[12px] text-[color:var(--ink-muted)]">/{c.slug}</p>
                    </div>
                  </div>
                  <StatusBadge variant={c.isActive ? "success" : "muted"}>
                    {c.isActive ? t("admin.communityActive") : t("admin.communityInactive")}
                  </StatusBadge>
                </div>
                <p className="mt-2 line-clamp-2 font-label text-[12px] text-[color:var(--ink-muted)]">
                  {c.description || t("admin.noDescription")}
                </p>
                <div className="mt-3 flex items-center gap-3 font-label text-[12px] text-[color:var(--ink-muted)]">
                  <span>{t("admin.members", { count: c.memberCount })}</span>
                  <span>{t("admin.communityPosts", { count: c.postCount })}</span>
                  <span>{CATEGORIES.find((cat) => cat.value === c.category)?.label}</span>
                </div>
                <div className="mt-3 flex gap-1 border-t border-[var(--border)] pt-3">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>{t("admin.edit")}</Button>
                  <Button variant="ghost" size="sm" onClick={() => handleToggleActive(c)}>
                    {c.isActive ? t("admin.disable") : t("admin.enable")}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(c)}>{t("admin.delete")}</Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <FormDialog open={isFormOpen} title={editing ? t("admin.editCommunity") : t("admin.createCommunity")} onClose={() => { setCreating(false); setEditing(null); }}>
        <div className="space-y-4">
          <FormField label={t("admin.name")} required><TextInput value={form.name} onChange={(v) => setForm({ ...form, name: v })} /></FormField>
          {!editing && (
            <FormField label={t("admin.slug")} required><TextInput value={form.slug} onChange={(v) => setForm({ ...form, slug: v })} placeholder={t("admin.slugPlaceholder")} /></FormField>
          )}
          <FormField label={t("admin.description")}><TextInput value={form.description || ""} onChange={(v) => setForm({ ...form, description: v })} multiline /></FormField>
          <FormField label={t("admin.category")}>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value as CommunityCategory })}
              className="h-9 w-full rounded border border-[var(--border)] bg-[var(--canvas)] px-3 font-label text-[13px] outline-none"
            >
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </FormField>
          <div className="flex gap-4">
            <FormField label={t("admin.icon")}>
              <div className="flex items-center gap-2">
                {form.iconUrl && <Image src={form.iconUrl} alt="" width={32} height={32} className="h-8 w-8 rounded-full object-cover" />}
                <Button variant="secondary" size="sm" onClick={() => handleImageUpload("iconUrl")}>{t("admin.upload")}</Button>
              </div>
            </FormField>
            <FormField label={t("admin.cover")}>
              <div className="flex items-center gap-2">
                {form.coverUrl && <Image src={form.coverUrl} alt="" width={48} height={32} className="h-8 w-12 rounded object-cover" />}
                <Button variant="secondary" size="sm" onClick={() => handleImageUpload("coverUrl")}>{t("admin.upload")}</Button>
              </div>
            </FormField>
          </div>
          <FormField label={t("admin.sortOrderLabel")}><TextInput value={String(form.sortOrder ?? 0)} onChange={(v) => setForm({ ...form, sortOrder: Number(v) || 0 })} type="number" /></FormField>
          <Toggle checked={!!form.isOfficial} onChange={(v) => setForm({ ...form, isOfficial: v })} label={t("admin.officialCommunity")} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => { setCreating(false); setEditing(null); }}>{t("admin.cancel")}</Button>
            <Button onClick={handleSave} loading={saving} disabled={!form.name}>{editing ? t("admin.save") : t("admin.create")}</Button>
          </div>
        </div>
      </FormDialog>

      <ConfirmDialog
        open={!!deleteTarget}
        title={t("admin.confirmDeleteCommunity")}
        message={t("admin.deleteCommunityMsg", { name: deleteTarget?.name })}
        confirmLabel={t("admin.delete")}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
