"use client";

/**
 * /me/merchant/[merchantId]/categories —— 商品分类 CRUD.
 *
 * 分类的用途有两条：
 *   1) 商品上架时必选一个分类（或留空 => 未分类）；
 *   2) 入口卡片 CLASSIFICATION 可以绑定分类，用作 App "上衣/裤子/女装/男装..."
 *     一级入口.
 *
 * 数据源：
 *   - GET   /api/store-merchants/store/{storeId}/product-categories?withCount=true
 *   - POST  /api/store-merchants/{merchantId}/product-categories
 *   - PUT   /api/store-merchants/product-categories/{id}
 *   - DELETE/api/store-merchants/product-categories/{id}
 *
 * 约束：
 *   - 同一店铺下分类名唯一；后端 unique violation 会被 route 层翻译成 400，
 *     前端把 error message 透给用户即可.
 *   - 删除分类时后端会清掉相关商品的 category_id（置空），不会删除商品；
 *     因此我们在 UI 上直白说明这一点，避免用户误解.
 */

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import useSWR from "swr";
import {
  Button,
  ConfirmDialog,
  EmptyState,
  FormDialog,
  FormField,
  LoadingState,
  StatusBadge,
  TextInput,
} from "@/components/admin/ui";
import {
  ImagePicker,
  SubPageBackLink,
  SubPageHeader,
} from "@/components/merchant/shared";
import {
  storeProductService,
  type StoreProductCategory,
} from "@/lib/services/store-product";
import { storeMerchantService } from "@/lib/services/store-merchant";

interface CategoryForm {
  name: string;
  coverImage: string;
  sortOrder: number;
}

const EMPTY_FORM: CategoryForm = { name: "", coverImage: "", sortOrder: 0 };

export default function ProductCategoriesPage() {
  const params = useParams<{ merchantId: string }>();
  const merchantId = Number(params?.merchantId);

  const { data: myMerchants, isLoading: loadingMerchants } = useSWR(
    Number.isFinite(merchantId) ? ["my-merchants-for-categories", merchantId] : null,
    () => storeMerchantService.getMyMerchants(1, 50),
  );

  const merchant = useMemo(
    () => myMerchants?.merchants.find((m) => m.id === merchantId) ?? null,
    [myMerchants, merchantId],
  );

  const storeId = merchant?.storeId ?? null;

  const {
    data,
    isLoading: loadingCats,
    mutate,
  } = useSWR(
    storeId && merchant?.status === "APPROVED"
      ? ["store-categories", storeId]
      : null,
    () => storeProductService.listCategories(storeId as string, true),
  );

  const categories = data?.categories ?? [];

  const [editing, setEditing] = useState<StoreProductCategory | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<CategoryForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] =
    useState<StoreProductCategory | null>(null);
  const [deleting, setDeleting] = useState(false);

  if (loadingMerchants) return <LoadingState />;
  if (!merchant || merchant.status !== "APPROVED") {
    return <NoAccess merchantId={merchantId} />;
  }

  const openCreate = () => {
    setForm({ ...EMPTY_FORM, sortOrder: categories.length });
    setErr(null);
    setCreating(true);
  };

  const openEdit = (c: StoreProductCategory) => {
    setForm({
      name: c.name,
      coverImage: c.coverImage ?? "",
      sortOrder: c.sortOrder,
    });
    setErr(null);
    setEditing(c);
  };

  const closeDialog = () => {
    setCreating(false);
    setEditing(null);
  };

  const onSave = async () => {
    setSaving(true);
    setErr(null);
    try {
      const payload = {
        name: form.name.trim(),
        coverImage: form.coverImage || undefined,
        sortOrder: form.sortOrder,
      };
      if (editing) {
        await storeProductService.updateCategory(editing.id, payload);
      } else {
        await storeProductService.createCategory(merchantId, payload);
      }
      closeDialog();
      await mutate();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await storeProductService.deleteCategory(deleteTarget.id);
      setDeleteTarget(null);
      await mutate();
    } finally {
      setDeleting(false);
    }
  };

  const onReorder = async (idx: number, direction: -1 | 1) => {
    const target = idx + direction;
    if (target < 0 || target >= categories.length) return;
    const a = categories[idx];
    const b = categories[target];
    const optimistic = [...categories];
    [optimistic[idx], optimistic[target]] = [optimistic[target], optimistic[idx]];
    await mutate({ ...data!, categories: optimistic }, { revalidate: false });
    try {
      await Promise.all([
        storeProductService.updateCategory(a.id, { sortOrder: b.sortOrder }),
        storeProductService.updateCategory(b.id, { sortOrder: a.sortOrder }),
      ]);
    } finally {
      await mutate();
    }
  };

  return (
    <section className="min-w-0">
      <SubPageBackLink merchantId={merchantId} />
      <SubPageHeader
        title="商品分类"
        description="管理店铺下的商品分类；分类可被「入口卡片」绑定为一级入口，也用于商品上架时归类."
        actions={
          <Button size="sm" onClick={openCreate}>
            + 新建分类
          </Button>
        }
      />

      {loadingCats ? (
        <LoadingState />
      ) : categories.length === 0 ? (
        <EmptyState message="暂无分类，点击右上角新建." />
      ) : (
        <ul className="grid gap-3">
          {categories.map((c, idx) => (
            <li
              key={c.id}
              className="flex items-center gap-4 rounded-lg border border-[var(--border)] bg-[var(--canvas-soft)] p-3"
            >
              {c.coverImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={c.coverImage}
                  alt={c.name}
                  className="h-14 w-20 shrink-0 rounded object-cover"
                />
              ) : (
                <div className="flex h-14 w-20 shrink-0 items-center justify-center rounded border border-dashed border-[var(--border)] font-label text-[10px] text-[color:var(--ink-muted)]">
                  无封面
                </div>
              )}
              <div className="min-w-0 flex-1 font-label">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[14px] font-medium text-[var(--ink)]">
                    {c.name}
                  </span>
                  <StatusBadge active={(c.productCount ?? 0) > 0}>
                    {c.productCount ?? 0} 件商品
                  </StatusBadge>
                </div>
                <div className="mt-0.5 text-[12px] text-[color:var(--ink-muted)]">
                  排序: {c.sortOrder} · ID #{c.id}
                </div>
              </div>
              <div className="flex shrink-0 flex-col gap-0.5 font-label text-[11px]">
                <button
                  onClick={() => onReorder(idx, -1)}
                  disabled={idx === 0}
                  className="rounded px-2 py-0.5 text-[color:var(--ink-muted)] transition-colors hover:bg-[var(--canvas-raised)] hover:text-[var(--ink)] disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  onClick={() => onReorder(idx, 1)}
                  disabled={idx === categories.length - 1}
                  className="rounded px-2 py-0.5 text-[color:var(--ink-muted)] transition-colors hover:bg-[var(--canvas-raised)] hover:text-[var(--ink)] disabled:opacity-30"
                >
                  ↓
                </button>
              </div>
              <div className="flex shrink-0 gap-1 font-label text-[12px]">
                <button
                  onClick={() => openEdit(c)}
                  className="rounded px-2 py-1 text-[color:var(--ink-muted)] transition-colors hover:bg-[var(--canvas-raised)] hover:text-[var(--ink)]"
                >
                  编辑
                </button>
                <button
                  onClick={() => setDeleteTarget(c)}
                  className="rounded px-2 py-1 text-[color:var(--ink-muted)] transition-colors hover:bg-[var(--canvas-raised)] hover:text-[var(--ink)]"
                >
                  删除
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <FormDialog
        open={creating || !!editing}
        title={editing ? "编辑分类" : "新建分类"}
        onClose={closeDialog}
      >
        <div className="grid gap-4">
          <FormField label="分类名称" required>
            <TextInput
              value={form.name}
              onChange={(v) => setForm({ ...form, name: v })}
              placeholder="如: 上衣, 外套, 女装"
            />
          </FormField>
          <FormField label="封面图（可选）">
            <ImagePicker
              value={form.coverImage}
              onChange={(v) => setForm({ ...form, coverImage: v })}
              height={120}
              hint="部分入口场景下会使用分类封面图."
            />
          </FormField>
          <FormField label="排序">
            <TextInput
              type="number"
              value={String(form.sortOrder)}
              onChange={(v) =>
                setForm({ ...form, sortOrder: Number(v) || 0 })
              }
            />
          </FormField>
          <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
            {err && (
              <span className="font-label text-[12px] text-red-600">{err}</span>
            )}
            <Button variant="secondary" onClick={closeDialog}>
              取消
            </Button>
            <Button
              onClick={onSave}
              loading={saving}
              disabled={!form.name.trim()}
            >
              {editing ? "保存" : "创建"}
            </Button>
          </div>
        </div>
      </FormDialog>

      <ConfirmDialog
        open={!!deleteTarget}
        title="删除该分类?"
        message={
          deleteTarget && (deleteTarget.productCount ?? 0) > 0
            ? `该分类下仍有 ${deleteTarget.productCount} 件商品，删除后它们会变为"未分类"，但不会被下架.`
            : "删除后无法恢复."
        }
        confirmLabel="删除"
        loading={deleting}
        onConfirm={onDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </section>
  );
}

function NoAccess({ merchantId }: { merchantId: number }) {
  return (
    <section className="min-w-0">
      <SubPageBackLink merchantId={merchantId} />
      <div className="mt-8 rounded border border-[var(--border)] bg-[var(--canvas-soft)] p-10 text-center">
        <div className="font-serif text-[17px] text-[var(--ink)]">
          无权限访问该页面
        </div>
        <div className="mt-2 font-label text-[13px] text-[color:var(--ink-muted)]">
          商家 ID 不匹配或尚未通过审核.
        </div>
      </div>
    </section>
  );
}
