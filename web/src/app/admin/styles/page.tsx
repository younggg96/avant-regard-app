"use client";

/**
 * Admin: 风格管理 (AI 发帖助手 V3 #25)
 *
 * 提供 styles 字典表的 CRUD UI。每条 style:
 *   - slug (稳定标识符,改了会破坏前端 i18n key 与 URL slug)
 *   - 多语言名 / 描述 (en + zh 双输入框, 至少 en 必填)
 *   - 封面图 URL (Q1 大卡用)
 *   - 排序权重 + active 开关
 *   - brandCount: 当前关联了多少个 brands (只读, 决定能否安全删除)
 *
 * 删除走 047 的 ON DELETE SET NULL: 关联的 brands.primary_style_id 自动清空,
 * 不会留下野指针。
 */

import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  stylesApi,
  type AdminStyle,
  type CreateStyleParams,
  type UpdateStyleParams,
} from "@/lib/services/admin";
import {
  PageHeader,
  EmptyState,
  LoadingState,
  ConfirmDialog,
  FormDialog,
  FormField,
  TextInput,
  Toggle,
  Button,
} from "@/components/admin/ui";

// 编辑表单的内部状态; create 与 update 都用同一份。
interface StyleFormState {
  slug: string;
  nameEn: string;
  nameZh: string;
  descriptionEn: string;
  descriptionZh: string;
  coverUrl: string;
  sortOrder: number;
  isActive: boolean;
}

const EMPTY_FORM: StyleFormState = {
  slug: "",
  nameEn: "",
  nameZh: "",
  descriptionEn: "",
  descriptionZh: "",
  coverUrl: "",
  sortOrder: 0,
  isActive: true,
};

function styleToForm(s: AdminStyle): StyleFormState {
  return {
    slug: s.slug,
    nameEn: s.nameI18n?.en || "",
    nameZh: s.nameI18n?.zh || "",
    descriptionEn: s.descriptionI18n?.en || "",
    descriptionZh: s.descriptionI18n?.zh || "",
    coverUrl: s.coverUrl || "",
    sortOrder: s.sortOrder ?? 0,
    isActive: s.isActive ?? true,
  };
}

function formToCreatePayload(f: StyleFormState): CreateStyleParams {
  const nameI18n: Record<string, string> = {};
  if (f.nameEn.trim()) nameI18n.en = f.nameEn.trim();
  if (f.nameZh.trim()) nameI18n.zh = f.nameZh.trim();

  const descriptionI18n: Record<string, string> = {};
  if (f.descriptionEn.trim()) descriptionI18n.en = f.descriptionEn.trim();
  if (f.descriptionZh.trim()) descriptionI18n.zh = f.descriptionZh.trim();

  return {
    slug: f.slug.trim(),
    nameI18n,
    descriptionI18n,
    coverUrl: f.coverUrl.trim() || null,
    sortOrder: f.sortOrder,
    isActive: f.isActive,
  };
}

function formToUpdatePayload(f: StyleFormState): UpdateStyleParams {
  // update 时所有字段都发,后端按 None 跳过的逻辑这里用不上, 全量覆盖更直观。
  return formToCreatePayload(f);
}

export default function StylesPage() {
  const { t } = useTranslation();
  const [styles, setStyles] = useState<AdminStyle[]>([]);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState<AdminStyle | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminStyle | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [form, setForm] = useState<StyleFormState>(EMPTY_FORM);
  const [errorMsg, setErrorMsg] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await stylesApi.getAll();
      setStyles(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setErrorMsg("");
    setCreating(true);
  };

  const openEdit = (s: AdminStyle) => {
    setForm(styleToForm(s));
    setErrorMsg("");
    setEditing(s);
  };

  const closeDialogs = () => {
    setCreating(false);
    setEditing(null);
    setErrorMsg("");
  };

  const handleSave = async () => {
    setErrorMsg("");
    // 客户端轻量校验; 严格检查由后端 047 CHECK + Pydantic validator 兜底。
    if (!form.slug.trim()) {
      setErrorMsg(t("admin.style.errSlugRequired"));
      return;
    }
    if (!form.nameEn.trim()) {
      setErrorMsg(t("admin.style.errNameEnRequired"));
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        await stylesApi.update(editing.id, formToUpdatePayload(form));
      } else {
        await stylesApi.create(formToCreatePayload(form));
      }
      closeDialogs();
      load();
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await stylesApi.delete(deleteTarget.id);
      setDeleteTarget(null);
      load();
    } finally {
      setDeleting(false);
    }
  };

  const total = styles.length;

  return (
    <div>
      <PageHeader
        title={t("admin.styles")}
        description={t("admin.style.totalCount", { count: total })}
        actions={
          <Button onClick={openCreate}>{t("admin.style.addNew")}</Button>
        }
      />

      {loading ? (
        <LoadingState />
      ) : styles.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
          <table className="w-full font-label text-[13px]">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--canvas-soft)]">
                <th className="px-4 py-2.5 text-left text-[11px] tracking-wider text-[color:var(--ink-muted)]">
                  {t("admin.style.colSlug")}
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] tracking-wider text-[color:var(--ink-muted)]">
                  {t("admin.style.colNameEn")}
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] tracking-wider text-[color:var(--ink-muted)]">
                  {t("admin.style.colNameZh")}
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] tracking-wider text-[color:var(--ink-muted)]">
                  {t("admin.style.colCover")}
                </th>
                <th className="px-4 py-2.5 text-right text-[11px] tracking-wider text-[color:var(--ink-muted)]">
                  {t("admin.style.colBrandCount")}
                </th>
                <th className="px-4 py-2.5 text-right text-[11px] tracking-wider text-[color:var(--ink-muted)]">
                  {t("admin.style.colSortOrder")}
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] tracking-wider text-[color:var(--ink-muted)]">
                  {t("admin.style.colActive")}
                </th>
                <th className="px-4 py-2.5 text-right text-[11px] tracking-wider text-[color:var(--ink-muted)]">
                  {t("admin.colActions")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {styles.map((s) => (
                <tr
                  key={s.id}
                  className="hover:bg-[var(--canvas-soft)] transition-colors"
                >
                  <td className="px-4 py-3 font-medium">{s.slug}</td>
                  <td className="px-4 py-3 text-[color:var(--ink-muted)]">
                    {s.nameI18n?.en || "—"}
                  </td>
                  <td className="px-4 py-3 text-[color:var(--ink-muted)]">
                    {s.nameI18n?.zh || "—"}
                  </td>
                  <td className="px-4 py-3 text-[color:var(--ink-muted)] max-w-[200px] truncate">
                    {s.coverUrl ? (
                      <a
                        href={s.coverUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline"
                      >
                        {s.coverUrl}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-[color:var(--ink-muted)]">
                    {s.brandCount ?? 0}
                  </td>
                  <td className="px-4 py-3 text-right text-[color:var(--ink-muted)]">
                    {s.sortOrder}
                  </td>
                  <td className="px-4 py-3">
                    {s.isActive ? (
                      <span className="text-[color:var(--ink)]">●</span>
                    ) : (
                      <span className="text-[color:var(--ink-muted)]">○</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => openEdit(s)}
                        className="rounded px-2 py-1 text-[12px] text-[color:var(--ink-muted)] transition-colors hover:bg-[var(--canvas-raised)] hover:text-[var(--ink)]"
                      >
                        {t("admin.edit")}
                      </button>
                      <button
                        onClick={() => setDeleteTarget(s)}
                        className="rounded px-2 py-1 text-[12px] text-[color:var(--ink-muted)] transition-colors hover:bg-[var(--canvas-raised)] hover:text-[var(--ink)]"
                      >
                        {t("admin.delete")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <FormDialog
        open={creating || !!editing}
        title={
          editing
            ? t("admin.style.editTitle", { slug: editing.slug })
            : t("admin.style.createTitle")
        }
        onClose={closeDialogs}
      >
        <div className="space-y-4">
          <FormField label={t("admin.style.slugLabel")} required>
            <TextInput
              value={form.slug}
              onChange={(v) => setForm({ ...form, slug: v })}
              placeholder="avant_garde"
              disabled={!!editing} // 修改 slug 会破坏 i18n key, 编辑模式禁用
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label={t("admin.style.nameEnLabel")} required>
              <TextInput
                value={form.nameEn}
                onChange={(v) => setForm({ ...form, nameEn: v })}
                placeholder="Avant-garde"
              />
            </FormField>
            <FormField label={t("admin.style.nameZhLabel")}>
              <TextInput
                value={form.nameZh}
                onChange={(v) => setForm({ ...form, nameZh: v })}
                placeholder="先锋"
              />
            </FormField>
          </div>

          <FormField label={t("admin.style.descriptionEnLabel")}>
            <TextInput
              value={form.descriptionEn}
              onChange={(v) => setForm({ ...form, descriptionEn: v })}
              multiline
              rows={2}
            />
          </FormField>
          <FormField label={t("admin.style.descriptionZhLabel")}>
            <TextInput
              value={form.descriptionZh}
              onChange={(v) => setForm({ ...form, descriptionZh: v })}
              multiline
              rows={2}
            />
          </FormField>

          <FormField label={t("admin.style.coverUrlLabel")}>
            <TextInput
              value={form.coverUrl}
              onChange={(v) => setForm({ ...form, coverUrl: v })}
              placeholder="https://..."
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label={t("admin.style.sortOrderLabel")}>
              <TextInput
                type="number"
                value={String(form.sortOrder)}
                onChange={(v) =>
                  setForm({ ...form, sortOrder: Number(v) || 0 })
                }
              />
            </FormField>
            <FormField label={t("admin.style.activeLabel")}>
              <Toggle
                checked={form.isActive}
                onChange={(v) => setForm({ ...form, isActive: v })}
              />
            </FormField>
          </div>

          {errorMsg ? (
            <div className="rounded border border-[var(--border)] bg-[var(--canvas-soft)] px-3 py-2 text-[12px] text-[color:var(--ink-muted)]">
              {errorMsg}
            </div>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={closeDialogs}>
              {t("admin.cancel")}
            </Button>
            <Button onClick={handleSave} loading={saving}>
              {t("admin.save")}
            </Button>
          </div>
        </div>
      </FormDialog>

      <ConfirmDialog
        open={!!deleteTarget}
        title={t("admin.style.confirmDeleteTitle")}
        message={t("admin.style.confirmDeleteMsg", {
          slug: deleteTarget?.slug,
          count: deleteTarget?.brandCount ?? 0,
        })}
        confirmLabel={t("admin.delete")}
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
