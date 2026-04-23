"use client";

import { useEffect, useState, useCallback } from "react";
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


const CATEGORIES: { value: CommunityCategory; label: string }[] = [
  { value: "GENERAL", label: "综合" },
  { value: "FASHION", label: "时尚" },
  { value: "LIFESTYLE", label: "生活" },
  { value: "BEAUTY", label: "美妆" },
  { value: "CULTURE", label: "文化" },
];

export default function CommunitiesPage() {
  const [communities, setCommunities] = useState<AdminCommunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AdminCommunity | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminCommunity | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [form, setForm] = useState<CreateCommunityParams & { isActive?: boolean }>({
    name: "",
    slug: "",
    description: "",
    category: "GENERAL",
    isOfficial: false,
    sortOrder: 0,
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
    setForm({
      name: c.name,
      slug: c.slug,
      description: c.description,
      category: c.category,
      isOfficial: c.isOfficial,
      isActive: c.isActive,
      sortOrder: c.sortOrder,
      iconUrl: c.iconUrl,
      coverUrl: c.coverUrl,
    });
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
      } catch (e) {
        alert("上传失败");
      }
    };
    input.click();
  };

  const isFormOpen = creating || !!editing;

  return (
    <div>
      <PageHeader
        title="社区管理"
        description={`共 ${communities.length} 个社区`}
        actions={
          <Button size="sm" onClick={openCreate}>
            创建社区
          </Button>
        }
      />

      {loading ? (
        <LoadingState />
      ) : communities.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {communities.map((c) => (
            <div
              key={c.id}
              className="rounded-lg border border-[var(--border)] overflow-hidden"
            >
              {c.coverUrl && (
                <img src={c.coverUrl} alt="" className="h-28 w-full object-cover" />
              )}
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {c.iconUrl && (
                      <img src={c.iconUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
                    )}
                    <div>
                      <h3 className="font-label text-[14px] font-semibold">{c.name}</h3>
                      <p className="font-label text-[12px] text-[color:var(--ink-muted)]">/{c.slug}</p>
                    </div>
                  </div>
                  <StatusBadge variant={c.isActive ? "success" : "muted"}>
                    {c.isActive ? "活跃" : "停用"}
                  </StatusBadge>
                </div>

                <p className="mt-2 line-clamp-2 font-label text-[12px] text-[color:var(--ink-muted)]">
                  {c.description || "暂无描述"}
                </p>

                <div className="mt-3 flex items-center gap-3 font-label text-[12px] text-[color:var(--ink-muted)]">
                  <span>{c.memberCount} 成员</span>
                  <span>{c.postCount} 帖子</span>
                  <span>{CATEGORIES.find((cat) => cat.value === c.category)?.label}</span>
                </div>

                <div className="mt-3 flex gap-1 border-t border-[var(--border)] pt-3">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>
                    编辑
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleToggleActive(c)}>
                    {c.isActive ? "停用" : "启用"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(c)}>
                    删除
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <FormDialog
        open={isFormOpen}
        title={editing ? "编辑社区" : "创建社区"}
        onClose={() => { setCreating(false); setEditing(null); }}
      >
        <div className="space-y-4">
          <FormField label="名称" required>
            <TextInput value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
          </FormField>
          {!editing && (
            <FormField label="Slug" required>
              <TextInput value={form.slug} onChange={(v) => setForm({ ...form, slug: v })} placeholder="英文标识" />
            </FormField>
          )}
          <FormField label="描述">
            <TextInput value={form.description || ""} onChange={(v) => setForm({ ...form, description: v })} multiline />
          </FormField>
          <FormField label="分类">
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value as CommunityCategory })}
              className="h-9 w-full rounded border border-[var(--border)] bg-[var(--canvas)] px-3 font-label text-[13px] outline-none"
            >
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </FormField>
          <div className="flex gap-4">
            <FormField label="图标">
              <div className="flex items-center gap-2">
                {form.iconUrl && <img src={form.iconUrl} alt="" className="h-8 w-8 rounded-full object-cover" />}
                <Button variant="secondary" size="sm" onClick={() => handleImageUpload("iconUrl")}>上传</Button>
              </div>
            </FormField>
            <FormField label="封面">
              <div className="flex items-center gap-2">
                {form.coverUrl && <img src={form.coverUrl} alt="" className="h-8 w-12 rounded object-cover" />}
                <Button variant="secondary" size="sm" onClick={() => handleImageUpload("coverUrl")}>上传</Button>
              </div>
            </FormField>
          </div>
          <FormField label="排序">
            <TextInput value={String(form.sortOrder ?? 0)} onChange={(v) => setForm({ ...form, sortOrder: Number(v) || 0 })} type="number" />
          </FormField>
          <Toggle checked={!!form.isOfficial} onChange={(v) => setForm({ ...form, isOfficial: v })} label="官方社区" />

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => { setCreating(false); setEditing(null); }}>取消</Button>
            <Button onClick={handleSave} loading={saving} disabled={!form.name}>
              {editing ? "保存" : "创建"}
            </Button>
          </div>
        </div>
      </FormDialog>

      <ConfirmDialog
        open={!!deleteTarget}
        title="确认删除社区？"
        message={`将删除社区「${deleteTarget?.name}」及其所有帖子。`}
        confirmLabel="删除"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
