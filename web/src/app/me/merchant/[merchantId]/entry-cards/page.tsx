"use client";

/**
 * /me/merchant/[merchantId]/entry-cards —— 入口卡片 CRUD.
 *
 * 对齐移动端 `frontend/src/screens/Discover/components/BuyerTab/CategoryCards.tsx`.
 * 卡片类型：
 *   - CLASSIFICATION: 跳转 StoreProductListScreen（mode=category, categoryId=targetCategoryId 或不传代表全部）
 *   - DISCOUNT:       跳转 StoreProductListScreen（mode=discount）
 *   - NEW_ARRIVAL:    跳转 StoreProductListScreen（mode=new）
 *   - EVENT:          跳转 StoreDetail（Phase 5 暂不支持活动商品，保留占位）
 *
 * 数据源：
 *   - GET   /api/store-merchants/{merchantId}/entry-cards        —— 含 HIDDEN
 *   - POST  /api/store-merchants/{merchantId}/entry-cards
 *   - PUT   /api/store-merchants/entry-cards/{cardId}
 *   - DELETE/api/store-merchants/entry-cards/{cardId}
 *
 * UX 细节：
 *   - CLASSIFICATION 类型可选绑定一个已有分类（从 categories 接口拉）；未绑定
 *     代表"全部单品"，前端导航时不传 categoryId.
 *   - 上下两个排序按钮，避免用户心算 sort_order 整数值.
 *   - 发布 / 隐藏用 Toggle 切换.
 */

import { useMemo, useState } from "react";
import Image from "next/image";
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
  StatusBadge,
  TextInput,
  Toggle,
} from "@/components/admin/ui";
import {
  ChipPicker,
  ImagePicker,
  SubPageBackLink,
  SubPageHeader,
} from "@/components/merchant/shared";
import {
  storeProductService,
  ENTRY_CARD_TYPE_LABEL,
  type EntryCardType,
  type StoreEntryCard,
  type StoreEntryCardCreateParams,
} from "@/lib/services/store-product";
import { storeMerchantService } from "@/lib/services/store-merchant";

const CARD_TYPE_OPTIONS: { value: EntryCardType; label: string }[] = [
  { value: "CLASSIFICATION", label: ENTRY_CARD_TYPE_LABEL.CLASSIFICATION },
  { value: "DISCOUNT", label: ENTRY_CARD_TYPE_LABEL.DISCOUNT },
  { value: "NEW_ARRIVAL", label: ENTRY_CARD_TYPE_LABEL.NEW_ARRIVAL },
  { value: "EVENT", label: ENTRY_CARD_TYPE_LABEL.EVENT },
];

interface CardForm {
  cardType: EntryCardType;
  label: string;
  labelEn: string;
  imageUrl: string;
  targetCategoryId: number | null;
  status: "PUBLISHED" | "HIDDEN";
}

const EMPTY_FORM: CardForm = {
  cardType: "CLASSIFICATION",
  label: "",
  labelEn: "",
  imageUrl: "",
  targetCategoryId: null,
  status: "PUBLISHED",
};

export default function EntryCardsPage() {
  const { t } = useTranslation();
  const params = useParams<{ merchantId: string }>();
  const merchantId = Number(params?.merchantId);

  const { data: myMerchants, isLoading: loadingMerchants } = useSWR(
    Number.isFinite(merchantId) ? ["my-merchants-for-entry-cards", merchantId] : null,
    () => storeMerchantService.getMyMerchants(1, 50),
  );

  const merchant = useMemo(
    () => myMerchants?.merchants.find((m) => m.id === merchantId) ?? null,
    [myMerchants, merchantId],
  );

  const storeId = merchant?.storeId ?? null;

  const {
    data: cardList,
    isLoading: loadingCards,
    mutate,
  } = useSWR(
    Number.isFinite(merchantId) && merchant?.status === "APPROVED"
      ? ["merchant-entry-cards", merchantId]
      : null,
    () => storeProductService.listMerchantEntryCards(merchantId),
  );

  // CLASSIFICATION 卡片需要绑定分类，所以要把分类列表也拉过来.
  const { data: categoryList } = useSWR(
    storeId && merchant?.status === "APPROVED"
      ? ["store-categories-for-entry-cards", storeId]
      : null,
    () => storeProductService.listCategories(storeId as string),
  );

  const cards = cardList?.cards ?? [];
  const categories = categoryList?.categories ?? [];

  const [editing, setEditing] = useState<StoreEntryCard | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<CardForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StoreEntryCard | null>(null);
  const [deleting, setDeleting] = useState(false);

  if (loadingMerchants) return <LoadingState />;
  if (!merchant || merchant.status !== "APPROVED") {
    return <NoAccess merchantId={merchantId} />;
  }

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setErr(null);
    setCreating(true);
  };

  const openEdit = (c: StoreEntryCard) => {
    setForm({
      cardType: c.cardType,
      label: c.label,
      labelEn: c.labelEn ?? "",
      imageUrl: c.imageUrl,
      targetCategoryId: c.targetCategoryId ?? null,
      status: c.status,
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
      // 非 CLASSIFICATION 不应携带 targetCategoryId，避免数据污染.
      const payload: StoreEntryCardCreateParams = {
        cardType: form.cardType,
        label: form.label.trim(),
        labelEn: form.labelEn.trim() || undefined,
        imageUrl: form.imageUrl,
        targetCategoryId:
          form.cardType === "CLASSIFICATION" ? form.targetCategoryId : null,
        status: form.status,
      };
      if (editing) {
        await storeProductService.updateEntryCard(editing.id, payload);
      } else {
        await storeProductService.createEntryCard(merchantId, payload);
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
      await storeProductService.deleteEntryCard(deleteTarget.id);
      setDeleteTarget(null);
      await mutate();
    } finally {
      setDeleting(false);
    }
  };

  // 通过改 sortOrder 实现"上移 / 下移"：相邻两项交换 sortOrder.
  const onReorder = async (idx: number, direction: -1 | 1) => {
    const target = idx + direction;
    if (target < 0 || target >= cards.length) return;
    const a = cards[idx];
    const b = cards[target];
    // 乐观更新：本地交换后立即重绘，后台实际写入两个 PUT.
    const optimistic = [...cards];
    [optimistic[idx], optimistic[target]] = [optimistic[target], optimistic[idx]];
    await mutate(
      { cards: optimistic, total: optimistic.length },
      { revalidate: false },
    );
    try {
      await Promise.all([
        storeProductService.updateEntryCard(a.id, { sortOrder: b.sortOrder }),
        storeProductService.updateEntryCard(b.id, { sortOrder: a.sortOrder }),
      ]);
    } finally {
      await mutate();
    }
  };

  return (
    <section className="min-w-0">
      <SubPageBackLink merchantId={merchantId} />
      <SubPageHeader
        title={t("merchant.entryCardsTitle")}
        description={t("merchant.entryCardsDesc")}
        actions={
          <Button size="sm" onClick={openCreate}>
            {t("merchant.newEntryCard")}
          </Button>
        }
      />

      {loadingCards ? (
        <LoadingState />
      ) : cards.length === 0 ? (
        <EmptyState message={t("merchant.noEntryCards")} />
      ) : (
        <ul className="grid gap-3">
          {cards.map((c, idx) => (
            <li
              key={c.id}
              className="flex items-center gap-4 rounded-lg border border-[var(--border)] bg-[var(--canvas-soft)] p-3"
            >
              <Image
                src={c.imageUrl}
                alt={c.label}
                width={112}
                height={64}
                className="h-16 w-28 shrink-0 rounded object-cover"
              />
              <div className="min-w-0 flex-1 font-label">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[14px] font-medium text-[var(--ink)]">
                    {c.label}
                  </span>
                  {c.labelEn && (
                    <span className="text-[11px] uppercase tracking-widest text-[color:var(--ink-muted)]">
                      {c.labelEn}
                    </span>
                  )}
                  <StatusBadge active={c.status === "PUBLISHED"}>
                    {c.status === "PUBLISHED" ? t("merchant.published") : t("merchant.hidden")}
                  </StatusBadge>
                </div>
                <div className="mt-0.5 text-[12px] text-[color:var(--ink-muted)]">
                  {ENTRY_CARD_TYPE_LABEL[c.cardType]}
                  {c.cardType === "CLASSIFICATION" &&
                    c.targetCategoryId != null && (
                      <>
                        {t("merchant.bindCategory")}
                        {categories.find((cat) => cat.id === c.targetCategoryId)?.name ??
                          `#${c.targetCategoryId}`}
                      </>
                    )}
                  {c.cardType === "CLASSIFICATION" &&
                    c.targetCategoryId == null && ` · ${t("merchant.allProducts")}`}
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
                  disabled={idx === cards.length - 1}
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
                  {t("common.edit")}
                </button>
                <button
                  onClick={() => setDeleteTarget(c)}
                  className="rounded px-2 py-1 text-[color:var(--ink-muted)] transition-colors hover:bg-[var(--canvas-raised)] hover:text-[var(--ink)]"
                >
                  {t("common.delete")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <FormDialog
        open={creating || !!editing}
        title={editing ? t("merchant.editEntryCard") : t("merchant.createEntryCard")}
        onClose={closeDialog}
        wide
      >
        <div className="grid gap-4">
          <FormField label={t("merchant.cardType")} required>
            <ChipPicker
              options={CARD_TYPE_OPTIONS}
              value={form.cardType}
              onChange={(v) =>
                setForm({
                  ...form,
                  cardType: v,
                  targetCategoryId:
                    v === "CLASSIFICATION" ? form.targetCategoryId : null,
                })
              }
            />
          </FormField>

          <FormField label={t("merchant.cardImage")} required>
            <ImagePicker
              value={form.imageUrl}
              onChange={(v) => setForm({ ...form, imageUrl: v })}
              height={150}
              hint={t("merchant.cardImageHint")}
            />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={t("merchant.cardLabelZh")} required>
              <TextInput
                value={form.label}
                onChange={(v) => setForm({ ...form, label: v })}
                placeholder={t("merchant.cardLabelZhPlaceholder")}
              />
            </FormField>
            <FormField label={t("merchant.cardLabelEn")}>
              <TextInput
                value={form.labelEn}
                onChange={(v) => setForm({ ...form, labelEn: v })}
                placeholder={t("merchant.cardLabelEnPlaceholder")}
              />
            </FormField>
          </div>

          {form.cardType === "CLASSIFICATION" && (
            <FormField label={t("merchant.relatedCategory")}>
              <CategorySelect
                value={form.targetCategoryId}
                options={categories.map((c) => ({ id: c.id, name: c.name }))}
                onChange={(id) => setForm({ ...form, targetCategoryId: id })}
              />
            </FormField>
          )}

          <Toggle
            checked={form.status === "PUBLISHED"}
            onChange={(v) =>
              setForm({ ...form, status: v ? "PUBLISHED" : "HIDDEN" })
            }
            label={t("merchant.publishNow")}
          />

          <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
            {err && (
              <span className="font-label text-[12px] text-red-600">{err}</span>
            )}
            <Button variant="secondary" onClick={closeDialog}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={onSave}
              loading={saving}
              disabled={!form.imageUrl || !form.label.trim()}
            >
              {editing ? t("common.save") : t("merchant.publish")}
            </Button>
          </div>
        </div>
      </FormDialog>

      <ConfirmDialog
        open={!!deleteTarget}
        title={t("merchant.deleteEntryCard")}
        message={t("merchant.deleteEntryCardMsg")}
        confirmLabel={t("common.delete")}
        loading={deleting}
        onConfirm={onDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </section>
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
        {t("merchant.allProducts")}
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
          {t("merchant.noCategoryHint")}
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
