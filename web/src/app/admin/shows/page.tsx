"use client";

import { useEffect, useState, useCallback } from "react";
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


const STATUS_OPTIONS = [
  { value: "APPROVED", label: "已通过" },
  { value: "PENDING", label: "待审核" },
  { value: "REJECTED", label: "已拒绝" },
] as const;

type ShowStatus = (typeof STATUS_OPTIONS)[number]["value"];

export default function ShowsPage() {
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

  return (
    <div>
      <PageHeader
        title="秀场管理"
        description={`共 ${total} 场秀`}
        actions={
          <Button size="sm" onClick={openCreate}>
            创建秀场
          </Button>
        }
      />

      <div className="mb-4 space-y-3">
        <div className="max-w-sm">
          <SearchBar value={keyword} onChange={setKeyword} placeholder="搜索品牌名、季节…" />
        </div>
        <FilterChips options={[...STATUS_OPTIONS]} value={status} onChange={setStatus} allLabel="全部状态" />
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
                  <th className="px-4 py-2.5 text-left text-[11px] tracking-wider text-[color:var(--ink-muted)]">秀场</th>
                  <th className="px-4 py-2.5 text-left text-[11px] tracking-wider text-[color:var(--ink-muted)]">品牌</th>
                  <th className="px-4 py-2.5 text-left text-[11px] tracking-wider text-[color:var(--ink-muted)]">季节</th>
                  <th className="px-4 py-2.5 text-left text-[11px] tracking-wider text-[color:var(--ink-muted)]">状态</th>
                  <th className="px-4 py-2.5 text-left text-[11px] tracking-wider text-[color:var(--ink-muted)]">图片</th>
                  <th className="px-4 py-2.5 text-left text-[11px] tracking-wider text-[color:var(--ink-muted)]">时间</th>
                  <th className="px-4 py-2.5 text-right text-[11px] tracking-wider text-[color:var(--ink-muted)]">操作</th>
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
                      <StatusBadge variant={s.status === "APPROVED" ? "success" : s.status === "REJECTED" ? "danger" : "warning"}>
                        {s.status === "APPROVED" ? "已通过" : s.status === "REJECTED" ? "已拒绝" : "待审核"}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3 text-[color:var(--ink-muted)]">{s.imageCount ?? 0}</td>
                    <td className="px-4 py-3 text-[12px] text-[color:var(--ink-muted)]">
                      {new Date(s.createdAt).toLocaleDateString("zh-CN")}
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

      <FormDialog open={isFormOpen} title={editing ? "编辑秀场" : "创建秀场"} onClose={() => { setCreating(false); setEditing(null); }}>
        <div className="space-y-4">
          <FormField label="品牌名" required><TextInput value={form.brandName} onChange={(v) => setForm({ ...form, brandName: v })} /></FormField>
          <FormField label="季节" required><TextInput value={form.season} onChange={(v) => setForm({ ...form, season: v })} placeholder="如 SS25" /></FormField>
          <FormField label="标题"><TextInput value={form.title} onChange={(v) => setForm({ ...form, title: v })} /></FormField>
          <FormField label="分类"><TextInput value={form.category} onChange={(v) => setForm({ ...form, category: v })} /></FormField>
          <FormField label="描述"><TextInput value={form.description} onChange={(v) => setForm({ ...form, description: v })} multiline /></FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => { setCreating(false); setEditing(null); }}>取消</Button>
            <Button onClick={handleSave} loading={saving} disabled={!form.brandName || !form.season}>{editing ? "保存" : "创建"}</Button>
          </div>
        </div>
      </FormDialog>

      <ConfirmDialog
        open={!!deleteTarget}
        title="确认删除秀场？"
        message={`${deleteTarget?.brandName} ${deleteTarget?.season}`}
        confirmLabel="删除"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
