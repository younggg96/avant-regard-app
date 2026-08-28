"use client";

/**
 * /me/merchant/[merchantId]/products —— 商品 CRUD.
 *
 * Phase 5 商家商品系统的核心编辑面板：列出店铺下的全部商品（含 DRAFT/HIDDEN/
 * SOLD_OUT），支持：
 *   - 按状态 / 分类 / 关键字过滤
 *   - 分页
 *   - 新建 / 编辑（多图 + 折扣 + tags + 新品标记）
 *   - 删除
 *   - 快速切换 status（上架 / 下架）
 *
 * 端点：
 *   - GET    /api/store-merchants/{merchantId}/products
 *   - POST   /api/store-merchants/{merchantId}/products
 *   - PUT    /api/store-merchants/products/{productId}
 *   - DELETE /api/store-merchants/products/{productId}
 *
 * 金额：入参 / 出参全部走整数 `priceCents`；表单里用元为单位输入，
 * 经 `parsePriceInputToCents` 换算，避免浮点误差传到后端.
 */

import { useMemo, useState } from "react";
import { Eye, Heart, MessageCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useParams } from "next/navigation";
import useSWR from "swr";
import {
  Button,
  ConfirmDialog,
  EmptyState,
  FormDialog,
  FormField,
  LoadingState,
  SearchBar,
  StatusBadge,
  TextInput,
  Toggle,
} from "@/components/admin/ui";
import {
  ChipEditor,
  ChipPicker,
  MultiImagePicker,
  SubPageBackLink,
  SubPageHeader,
} from "@/components/merchant/shared";
import {
  storeProductService,
  formatPriceCents,
  normalizeProductStatus,
  parsePriceInputToCents,
  type CanonicalProductStatus,
  type StoreProduct,
  type StoreProductCreateParams,
  type StoreProductUpdateParams,
} from "@/lib/services/store-product";
import { storeMerchantService } from "@/lib/services/store-merchant";

const STATUS_I18N_KEY: Record<CanonicalProductStatus, string> = {
  active: "merchant.statusPublished",
  draft: "merchant.statusDraft",
  reviewing: "merchant.statusReviewing",
  frozen: "merchant.statusFrozen",
  offline: "merchant.statusHidden",
  sold: "merchant.statusSoldOut",
  rejected: "merchant.statusRejected",
};

function useStatusOptions() {
  const { t } = useTranslation();
  const filterOptions = useMemo(
    () => [
      { value: "ALL" as const, label: t("common.all") },
      { value: "active" as const, label: t("merchant.statusPublished") },
      { value: "draft" as const, label: t("merchant.statusDraft") },
      { value: "reviewing" as const, label: t("merchant.statusReviewing") },
      { value: "offline" as const, label: t("merchant.statusHidden") },
      { value: "sold" as const, label: t("merchant.statusSoldOut") },
    ],
    [t],
  );
  const formOptions = useMemo(
    () => [
      { value: "active" as const, label: t("merchant.statusPublished") },
      { value: "draft" as const, label: t("merchant.statusDraft") },
      { value: "offline" as const, label: t("merchant.statusHidden") },
      { value: "sold" as const, label: t("merchant.statusSoldOut") },
    ],
    [t],
  );
  return { filterOptions, formOptions };
}

const PAGE_SIZE = 20;

/** 表单 state 用字符串存价格（为了保留"5.00"这种中间输入），提交前再换算成 cents. */
interface ProductForm {
  title: string;
  description: string;
  brand: string;
  images: string[];
  priceInput: string;
  discountPriceInput: string;
  hasDiscount: boolean;
  categoryId: number | null;
  isNew: boolean;
  tags: string[];
  status: CanonicalProductStatus;
}

const EMPTY_FORM: ProductForm = {
  title: "",
  description: "",
  brand: "",
  images: [],
  priceInput: "",
  discountPriceInput: "",
  hasDiscount: false,
  categoryId: null,
  isNew: false,
  tags: [],
  status: "active",
};

export default function MerchantProductsPage() {
  const { t } = useTranslation();
  const { filterOptions: STATUS_FILTER_OPTIONS, formOptions: STATUS_FORM_OPTIONS } = useStatusOptions();
  const params = useParams<{ merchantId: string }>();
  const merchantId = Number(params?.merchantId);

  const { data: myMerchants, isLoading: loadingMerchants } = useSWR(
    Number.isFinite(merchantId) ? ["my-merchants-for-products", merchantId] : null,
    () => storeMerchantService.getMyMerchants(1, 50),
  );

  const merchant = useMemo(
    () => myMerchants?.merchants.find((m) => m.id === merchantId) ?? null,
    [myMerchants, merchantId],
  );

  const storeId = merchant?.storeId ?? null;

  // 过滤器 state
  const [statusFilter, setStatusFilter] =
    useState<CanonicalProductStatus | "ALL">("ALL");
  const [categoryFilter, setCategoryFilter] = useState<number | "ALL">("ALL");
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);

  // 分类列表（用于表单下拉 + 过滤器）
  const { data: categoryList } = useSWR(
    storeId && merchant?.status === "APPROVED"
      ? ["store-categories-for-products", storeId]
      : null,
    () => storeProductService.listCategories(storeId as string),
  );
  const categories = categoryList?.categories ?? [];

  // 商品列表（后端支持 status/categoryId；搜索走前端本地过滤，简化实现）.
  const {
    data,
    isLoading: loadingProducts,
    mutate,
  } = useSWR(
    Number.isFinite(merchantId) && merchant?.status === "APPROVED"
      ? [
          "merchant-products",
          merchantId,
          statusFilter,
          categoryFilter,
          page,
        ]
      : null,
    () =>
      storeProductService.listMerchantProducts(merchantId, {
        status: statusFilter === "ALL" ? "" : statusFilter,
        categoryId: categoryFilter === "ALL" ? undefined : categoryFilter,
        page,
        pageSize: PAGE_SIZE,
      }),
  );

  const productsAll = useMemo(() => data?.products ?? [], [data]);
  const total = data?.total ?? 0;
  const products = useMemo(() => {
    if (!keyword.trim()) return productsAll;
    const q = keyword.trim().toLowerCase();
    return productsAll.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        (p.brand ?? "").toLowerCase().includes(q),
    );
  }, [productsAll, keyword]);

  const [editing, setEditing] = useState<StoreProduct | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<ProductForm>(EMPTY_FORM);
  const [tagDraft, setTagDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StoreProduct | null>(null);
  const [deleting, setDeleting] = useState(false);

  if (loadingMerchants) return <LoadingState />;
  if (!merchant || merchant.status !== "APPROVED") {
    return <NoAccess merchantId={merchantId} />;
  }

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setTagDraft("");
    setErr(null);
    setCreating(true);
  };

  const openEdit = (p: StoreProduct) => {
    setForm({
      title: p.title,
      description: p.description ?? "",
      brand: p.brand ?? "",
      images: p.images ?? [],
      priceInput: centsToInput(p.priceCents),
      discountPriceInput:
        p.discountPriceCents != null ? centsToInput(p.discountPriceCents) : "",
      hasDiscount: p.discountPriceCents != null,
      categoryId: p.categoryId ?? null,
      isNew: p.isNew,
      tags: p.tags ?? [],
      status: normalizeProductStatus(p.status),
    });
    setTagDraft("");
    setErr(null);
    setEditing(p);
  };

  const closeDialog = () => {
    setCreating(false);
    setEditing(null);
  };

  const validateForm = (): string | null => {
    if (!form.title.trim()) return t("merchant.validateTitleRequired");
    if (form.images.length === 0) return t("merchant.validateImageRequired");
    const priceCents = parsePriceInputToCents(form.priceInput);
    if (priceCents == null) return t("merchant.validatePriceInvalid");
    if (form.hasDiscount) {
      const dc = parsePriceInputToCents(form.discountPriceInput);
      if (dc == null) return t("merchant.validateDiscountInvalid");
      if (dc > priceCents) return t("merchant.validateDiscountExceed");
    }
    return null;
  };

  const onSave = async () => {
    const validationError = validateForm();
    if (validationError) {
      setErr(validationError);
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const priceCents = parsePriceInputToCents(form.priceInput)!;
      const discountPriceCents = form.hasDiscount
        ? parsePriceInputToCents(form.discountPriceInput)
        : null;

      if (editing) {
        const payload: StoreProductUpdateParams = {
          title: form.title.trim(),
          description: form.description || undefined,
          brand: form.brand.trim() || undefined,
          images: form.images,
          priceCents,
          // 显式置 null 代表"取消折扣"，后端 schema 支持.
          discountPriceCents: discountPriceCents,
          categoryId: form.categoryId,
          isNew: form.isNew,
          tags: form.tags,
          status: form.status,
        };
        await storeProductService.updateProduct(editing.id, payload);
      } else {
        const payload: StoreProductCreateParams = {
          title: form.title.trim(),
          description: form.description || undefined,
          brand: form.brand.trim() || undefined,
          images: form.images,
          priceCents,
          discountPriceCents,
          categoryId: form.categoryId,
          isNew: form.isNew,
          tags: form.tags,
          status: form.status,
        };
        await storeProductService.createProduct(merchantId, payload);
      }
      closeDialog();
      await mutate();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("common.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await storeProductService.deleteProduct(deleteTarget.id);
      setDeleteTarget(null);
      await mutate();
    } finally {
      setDeleting(false);
    }
  };

  const onQuickToggleStatus = async (p: StoreProduct) => {
    // 只做 active <-> offline 两态切换，其他状态需进编辑弹窗.
    const current = normalizeProductStatus(p.status);
    if (current !== "active" && current !== "offline") return;
    const nextStatus: CanonicalProductStatus =
      current === "active" ? "offline" : "active";
    // 乐观更新.
    const optimistic = productsAll.map((x) =>
      x.id === p.id ? { ...x, status: nextStatus } : x,
    );
    await mutate(
      { ...(data ?? { products: [], total: 0, page, pageSize: PAGE_SIZE }), products: optimistic },
      { revalidate: false },
    );
    try {
      await storeProductService.updateProduct(p.id, { status: nextStatus });
    } finally {
      await mutate();
    }
  };

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <section className="min-w-0">
      <SubPageBackLink merchantId={merchantId} />
      <SubPageHeader
        title={t("merchant.productsTitle")}
        description={t("merchant.productsDesc")}
        actions={
          <Button size="sm" onClick={openCreate}>
            {t("merchant.newProduct")}
          </Button>
        }
      />

      <div className="mb-4 grid gap-3 rounded-lg border border-[var(--border)] bg-[var(--canvas-soft)] p-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <SearchBar
          value={keyword}
          onChange={setKeyword}
          placeholder={t("merchant.searchPlaceholder")}
        />
        <div className="flex flex-wrap items-center gap-2 font-label text-[12px]">
          <span className="text-[color:var(--ink-muted)]">{t("merchant.statusLabel")}</span>
          <div className="flex flex-wrap gap-1.5">
            {STATUS_FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  setStatusFilter(opt.value);
                  setPage(1);
                }}
                className={chipClass(statusFilter === opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        {categories.length > 0 && (
          <div className="sm:col-span-2 flex flex-wrap items-center gap-2 font-label text-[12px]">
            <span className="text-[color:var(--ink-muted)]">{t("merchant.categoryLabel")}</span>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => {
                  setCategoryFilter("ALL");
                  setPage(1);
                }}
                className={chipClass(categoryFilter === "ALL")}
              >
                {t("common.all")}
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setCategoryFilter(c.id);
                    setPage(1);
                  }}
                  className={chipClass(categoryFilter === c.id)}
                >
                  {c.name}
                  {c.productCount != null && ` (${c.productCount})`}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {loadingProducts ? (
        <LoadingState />
      ) : products.length === 0 ? (
        <EmptyState
          message={
            keyword.trim()
              ? t("merchant.noProductsSearch")
              : t("merchant.noProductsEmpty")
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {products.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              onEdit={() => openEdit(p)}
              onDelete={() => setDeleteTarget(p)}
              onQuickToggle={() => onQuickToggleStatus(p)}
            />
          ))}
        </div>
      )}

      {pageCount > 1 && (
        <div className="mt-6 flex items-center justify-center gap-3 font-label text-[12px]">
          <button
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="rounded border border-[var(--border)] px-3 py-1 text-[color:var(--ink-muted)] transition-colors hover:border-[var(--ink-muted)] hover:text-[var(--ink)] disabled:opacity-30"
          >
            {t("common.previousPage")}
          </button>
          <span className="text-[color:var(--ink-muted)]">
            {page} / {pageCount}
          </span>
          <button
            disabled={page >= pageCount}
            onClick={() => setPage(page + 1)}
            className="rounded border border-[var(--border)] px-3 py-1 text-[color:var(--ink-muted)] transition-colors hover:border-[var(--ink-muted)] hover:text-[var(--ink)] disabled:opacity-30"
          >
            {t("common.nextPage")}
          </button>
        </div>
      )}

      <FormDialog
        open={creating || !!editing}
        title={editing ? t("merchant.editProduct") : t("merchant.createProduct")}
        onClose={closeDialog}
        wide
      >
        <div className="grid gap-4">
          <FormField label={t("merchant.productImages")} required>
            <MultiImagePicker
              value={form.images}
              onChange={(v) => setForm({ ...form, images: v })}
              max={9}
              height={96}
            />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={t("merchant.productTitle")} required>
              <TextInput
                value={form.title}
                onChange={(v) => setForm({ ...form, title: v })}
                placeholder={t("merchant.productTitlePlaceholder")}
              />
            </FormField>
            <FormField label={t("merchant.productBrand")}>
              <TextInput
                value={form.brand}
                onChange={(v) => setForm({ ...form, brand: v })}
                placeholder={t("merchant.productBrandPlaceholder")}
              />
            </FormField>
          </div>

          <FormField label={t("merchant.productCategory")}>
            <CategorySelect
              value={form.categoryId}
              options={categories.map((c) => ({ id: c.id, name: c.name }))}
              onChange={(id) => setForm({ ...form, categoryId: id })}
            />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={t("merchant.priceLabel")} required>
              <TextInput
                type="number"
                value={form.priceInput}
                onChange={(v) => setForm({ ...form, priceInput: v })}
                placeholder={t("merchant.pricePlaceholder")}
              />
            </FormField>
            <FormField label={t("merchant.discountPriceLabel")}>
              <div className="grid gap-2">
                <Toggle
                  checked={form.hasDiscount}
                  onChange={(v) =>
                    setForm({
                      ...form,
                      hasDiscount: v,
                      discountPriceInput: v ? form.discountPriceInput : "",
                    })
                  }
                  label={t("merchant.enableDiscount")}
                />
                {form.hasDiscount && (
                  <TextInput
                    type="number"
                    value={form.discountPriceInput}
                    onChange={(v) =>
                      setForm({ ...form, discountPriceInput: v })
                    }
                    placeholder={t("merchant.discountPricePlaceholder")}
                  />
                )}
              </div>
            </FormField>
          </div>

          <FormField label={t("merchant.productDescription")}>
            <TextInput
              value={form.description}
              onChange={(v) => setForm({ ...form, description: v })}
              multiline
              rows={4}
              placeholder={t("merchant.productDescPlaceholder")}
            />
          </FormField>

          <ChipEditor
            label={t("merchant.productTags")}
            placeholder={t("merchant.productTagsPlaceholder")}
            draft={tagDraft}
            onDraftChange={setTagDraft}
            items={form.tags}
            onAdd={(v) => setForm({ ...form, tags: [...form.tags, v] })}
            onRemove={(idx) =>
              setForm({ ...form, tags: form.tags.filter((_, i) => i !== idx) })
            }
            max={10}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Toggle
              checked={form.isNew}
              onChange={(v) => setForm({ ...form, isNew: v })}
              label={t("merchant.isNew")}
            />
            <FormField label={t("merchant.listingStatus")}>
              <ChipPicker
                options={STATUS_FORM_OPTIONS}
                value={form.status}
                onChange={(v) => setForm({ ...form, status: v })}
              />
            </FormField>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--border)] pt-3">
            {err && (
              <span className="font-label text-[12px] text-red-600">{err}</span>
            )}
            <Button variant="secondary" onClick={closeDialog}>
              {t("common.cancel")}
            </Button>
            <Button onClick={onSave} loading={saving}>
              {editing ? t("common.save") : t("merchant.publish")}
            </Button>
          </div>
        </div>
      </FormDialog>

      <ConfirmDialog
        open={!!deleteTarget}
        title={t("merchant.deleteProduct")}
        message={
          deleteTarget
            ? t("merchant.deleteProductMsg", { title: deleteTarget.title })
            : ""
        }
        confirmLabel={t("common.delete")}
        loading={deleting}
        onConfirm={onDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </section>
  );
}

function ProductCard({
  product,
  onEdit,
  onDelete,
  onQuickToggle,
}: {
  product: StoreProduct;
  onEdit: () => void;
  onDelete: () => void;
  onQuickToggle: () => void;
}) {
  const { t } = useTranslation();
  const cover = product.images[0];
  const status = normalizeProductStatus(product.status);
  const canQuickToggle = status === "active" || status === "offline";

  return (
    <div className="group relative overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--canvas-soft)]">
      <div className="relative aspect-[4/5] bg-[var(--canvas-raised)]">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt={product.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center font-label text-[11px] text-[color:var(--ink-muted)]">
            {t("common.noImage")}
          </div>
        )}
        <div className="absolute left-2 top-2 flex flex-wrap gap-1">
          {product.isNew && (
            <span className="rounded bg-[var(--ink)] px-1.5 py-0.5 font-label text-[10px] text-[var(--canvas)]">
              NEW
            </span>
          )}
          {product.hasDiscount && (
            <span className="rounded bg-red-600 px-1.5 py-0.5 font-label text-[10px] text-white">
              SALE
            </span>
          )}
        </div>
      </div>
      <div className="p-3 font-label">
        <div className="flex items-center gap-2">
          <span className="truncate font-serif text-[14px] text-[var(--ink)]">
            {product.title}
          </span>
          <StatusBadge active={status === "active"}>
            {t(STATUS_I18N_KEY[status])}
          </StatusBadge>
        </div>
        <div className="mt-0.5 truncate text-[11px] text-[color:var(--ink-muted)]">
          {product.brand || "—"} · {product.categoryName ?? t("merchant.uncategorized")}
        </div>
        <div className="mt-1 flex items-baseline gap-2">
          {product.hasDiscount && product.discountPriceCents != null ? (
            <>
              <span className="font-serif text-[15px] text-[var(--ink)]">
                {formatPriceCents(product.discountPriceCents, product.currency)}
              </span>
              <span className="text-[11px] text-[color:var(--ink-muted)] line-through">
                {formatPriceCents(product.priceCents, product.currency)}
              </span>
            </>
          ) : (
            <span className="font-serif text-[15px] text-[var(--ink)]">
              {formatPriceCents(product.priceCents, product.currency)}
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[color:var(--ink-muted)]">
          <span className="inline-flex items-center gap-0.5">
            <Heart className="size-3 shrink-0" strokeWidth={2} aria-hidden />
            {product.likeCount}
          </span>
          <span className="inline-flex items-center gap-0.5">
            <MessageCircle className="size-3 shrink-0" strokeWidth={2} aria-hidden />
            {product.commentCount}
          </span>
          <span className="inline-flex items-center gap-0.5">
            <Eye className="size-3 shrink-0" strokeWidth={2} aria-hidden />
            {product.viewCount}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1 text-[11px]">
          <button
            onClick={onEdit}
            className="rounded border border-[var(--border)] px-2 py-0.5 text-[color:var(--ink-muted)] transition-colors hover:border-[var(--ink-muted)] hover:text-[var(--ink)]"
          >
            {t("common.edit")}
          </button>
          {canQuickToggle && (
            <button
              onClick={onQuickToggle}
              className="rounded border border-[var(--border)] px-2 py-0.5 text-[color:var(--ink-muted)] transition-colors hover:border-[var(--ink-muted)] hover:text-[var(--ink)]"
            >
              {status === "active" ? t("merchant.unpublishProduct") : t("merchant.publishProduct")}
            </button>
          )}
          <button
            onClick={onDelete}
            className="rounded border border-[var(--border)] px-2 py-0.5 text-[color:var(--ink-muted)] transition-colors hover:border-[var(--ink-muted)] hover:text-[var(--ink)]"
          >
            {t("common.delete")}
          </button>
        </div>
      </div>
    </div>
  );
}

function CategorySelect({
  value,
  options,
  onChange,
}: {
  value: number | null;
  options: { id: number; name: string }[];
  onChange: (v: number | null) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        onClick={() => onChange(null)}
        className={chipClass(value == null)}
      >
        {t("merchant.uncategorized")}
      </button>
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={chipClass(value === o.id)}
        >
          {o.name}
        </button>
      ))}
      {options.length === 0 && (
        <span className="font-label text-[12px] text-[color:var(--ink-muted)]">
          {t("merchant.noCategoryCreateHint")}
        </span>
      )}
    </div>
  );
}

function chipClass(active: boolean) {
  return `rounded-full border px-3 py-1 font-label text-[12px] transition-colors ${
    active
      ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--canvas)]"
      : "border-[var(--border)] text-[color:var(--ink-muted)] hover:border-[var(--ink-muted)]"
  }`;
}

function NoAccess({ merchantId }: { merchantId: number }) {
  const { t } = useTranslation();
  return (
    <section className="min-w-0">
      <SubPageBackLink merchantId={merchantId} />
      <div className="mt-8 rounded border border-[var(--border)] bg-[var(--canvas-soft)] p-10 text-center">
        <div className="font-serif text-[17px] text-[var(--ink)]">
          {t("common.noPermission")}
        </div>
        <div className="mt-2 font-label text-[13px] text-[color:var(--ink-muted)]">
          {t("common.merchantIdMismatch")}
        </div>
      </div>
    </section>
  );
}

// ── 金额输入辅助 ─────────────────────────────────────────────────────────

function centsToInput(cents: number): string {
  if (cents % 100 === 0) return String(Math.round(cents / 100));
  return (cents / 100).toFixed(2);
}
