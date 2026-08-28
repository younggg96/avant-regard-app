"use client";

/**
 * 单品发布向导（4 步），对齐移动端 `frontend/src/screens/PublishListing/*`
 * 与 `store/publishListingStore.ts` 的字段与校验。
 *
 * 步骤：
 *   1 基本信息   品牌 / 分类 / 款式 / 尺码 / 颜色 / 成色 / 配件
 *   2 视角图     7 张必拍图 + 最多 7 张补充图
 *   3 定价描述   价格 / 是否议价 / 标题 / 描述 / 标签
 *   4 物流       入手时间 / 发货地 / 运费方式 → 提交审核
 *
 * 草稿策略跟移动端一致：第 1 步「下一步」时就落一条 draft 拿到 id，
 * 之后每步 PATCH。这样中途关掉页面也不会丢内容，代价是会产生空草稿，
 * 卖家可以在 /me/listings 的草稿 tab 里删掉。
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";

import {
  Button,
  FormField,
  TextInput,
  Toggle,
} from "@/components/admin/ui";
import { ImagePicker, MultiImagePicker } from "@/components/merchant/shared";
import {
  calculateExpectedPayout,
  listingService,
  type Listing,
  type PhotoAngles,
  type ProductCondition,
  type ShippingFeeMode,
} from "@/lib/services/listing";
import {
  formatPriceCents,
  parsePriceInputToCents,
} from "@/lib/services/store-product";
import {
  isMarketplaceCategory,
  MARKETPLACE_CATEGORIES,
  MARKETPLACE_COLORS,
  MARKETPLACE_CONDITIONS,
  PHOTO_SLOT_LABEL_KEY,
  REQUIRED_PHOTO_SLOTS,
  suggestedSizes,
  type RequiredPhotoSlot,
} from "@/lib/trading/taxonomy";

const TOTAL_STEPS = 4;
const MAX_EXTRA_PHOTOS = 7;
const MAX_TAGS = 8;

interface WizardForm {
  brand: string;
  categoryKind: string;
  styleName: string;
  size: string;
  color: string;
  condition: ProductCondition | null;
  accessoriesNote: string;
  photoAngles: PhotoAngles;
  title: string;
  description: string;
  priceInput: string;
  acceptOffer: boolean;
  tags: string[];
  originalAcquiredAt: string;
  shipFromCountry: string;
  shipFromState: string;
  shipFromCity: string;
  shippingFeeMode: ShippingFeeMode;
}

const EMPTY_FORM: WizardForm = {
  brand: "",
  categoryKind: "",
  styleName: "",
  size: "",
  color: "",
  condition: null,
  accessoriesNote: "",
  photoAngles: { extras: [] },
  title: "",
  description: "",
  priceInput: "",
  acceptOffer: true,
  tags: [],
  originalAcquiredAt: "",
  shipFromCountry: "中国",
  shipFromState: "",
  shipFromCity: "",
  shippingFeeMode: "cod",
};

/**
 * 老草稿可能只有 images 没有 photoAngles（早期版本），按落库顺序还原回槽位，
 * 否则卖家再次编辑时会看到 7 个空槽、以为图片丢了。
 */
function resolvePhotoAngles(listing: Listing): PhotoAngles {
  const stored = listing.photoAngles;
  if (stored && REQUIRED_PHOTO_SLOTS.some((slot) => stored[slot])) {
    return stored;
  }
  const images = listing.images ?? [];
  if (images.length === 0) return { extras: [] };

  const rebuilt: PhotoAngles = { extras: [] };
  REQUIRED_PHOTO_SLOTS.forEach((slot, idx) => {
    if (idx < images.length) rebuilt[slot] = images[idx];
  });
  if (images.length > REQUIRED_PHOTO_SLOTS.length) {
    rebuilt.extras = images.slice(REQUIRED_PHOTO_SLOTS.length);
  }
  return rebuilt;
}

function hydrate(listing: Listing): WizardForm {
  const photoAngles = resolvePhotoAngles(listing);
  return {
    brand: listing.brand ?? "",
    categoryKind: listing.categoryKind ?? listing.categoryName ?? "",
    styleName: listing.styleName ?? "",
    size: listing.size ?? "",
    color: listing.color ?? "",
    condition: listing.condition ?? null,
    accessoriesNote: listing.accessoriesNote ?? "",
    photoAngles,
    title: listing.title ?? "",
    description: listing.description ?? "",
    priceInput: listing.priceCents ? String(listing.priceCents / 100) : "",
    acceptOffer: listing.acceptOffer ?? true,
    tags: listing.tags ?? [],
    originalAcquiredAt: listing.originalAcquiredAt?.slice(0, 10) ?? "",
    shipFromCountry: listing.shipFromCountry ?? "中国",
    shipFromState: listing.shipFromState ?? "",
    shipFromCity: listing.shipFromCity ?? "",
    shippingFeeMode: listing.shippingFeeMode ?? "cod",
  };
}

/** 落库的 images 顺序必须与 resolvePhotoAngles 的还原顺序一致。 */
function flattenPhotos(angles: PhotoAngles): string[] {
  const slots = REQUIRED_PHOTO_SLOTS.map((slot) => angles[slot]).filter(
    (url): url is string => !!url,
  );
  return [...slots, ...(angles.extras ?? [])];
}

function validateStep(step: number, form: WizardForm): string[] {
  switch (step) {
    case 1: {
      const missing: string[] = [];
      if (!form.brand.trim()) missing.push("brand");
      if (!isMarketplaceCategory(form.categoryKind)) missing.push("category");
      if (!form.size.trim()) missing.push("size");
      if (!form.color.trim()) missing.push("color");
      if (!form.condition) missing.push("condition");
      return missing;
    }
    case 2:
      return REQUIRED_PHOTO_SLOTS.filter(
        (slot) => !form.photoAngles[slot],
      ).map((slot) => `photo:${slot}`);
    case 3: {
      const missing: string[] = [];
      if (!form.title.trim()) missing.push("title");
      const cents = parsePriceInputToCents(form.priceInput);
      if (!cents || cents <= 0) missing.push("price");
      if (!form.description.trim()) missing.push("description");
      return missing;
    }
    case 4:
      return form.shipFromCountry.trim() ? [] : ["shipFromCountry"];
    default:
      return [];
  }
}

export function ListingWizard({ listing }: { listing?: Listing }) {
  const { t } = useTranslation();
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<WizardForm>(
    listing ? hydrate(listing) : EMPTY_FORM,
  );
  const [productId, setProductId] = useState<number | null>(listing?.id ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patch = (data: Partial<WizardForm>) =>
    setForm((prev) => ({ ...prev, ...data }));

  const priceCents = parsePriceInputToCents(form.priceInput);
  const missing = validateStep(step, form);

  const buildPayload = () => ({
    brand: form.brand.trim(),
    categoryKind: form.categoryKind || null,
    styleName: form.styleName.trim() || null,
    size: form.size.trim(),
    color: form.color.trim(),
    condition: form.condition ?? undefined,
    accessoriesNote: form.accessoriesNote.trim() || null,
    photoAngles: form.photoAngles,
    images: flattenPhotos(form.photoAngles),
    title: form.title.trim() || t("trading.publish.untitledDraft"),
    description: form.description.trim(),
    priceCents: priceCents ?? 0,
    acceptOffer: form.acceptOffer,
    tags: form.tags,
    originalAcquiredAt: form.originalAcquiredAt || null,
    shipFromCountry: form.shipFromCountry.trim() || null,
    shipFromState: form.shipFromState.trim() || null,
    shipFromCity: form.shipFromCity.trim() || null,
    shippingFeeMode: form.shippingFeeMode,
  });

  /** 保存并返回最新的 productId（首次会创建草稿）。 */
  const persist = async (): Promise<number> => {
    const payload = buildPayload();
    if (productId) {
      await listingService.patch(productId, payload);
      return productId;
    }
    const created = await listingService.create({
      ...payload,
      sellerKind: "individual",
    });
    setProductId(created.id);
    return created.id;
  };

  const saveDraft = async () => {
    setSaving(true);
    setError(null);
    try {
      await persist();
      router.push("/me/listings");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.failed"));
    } finally {
      setSaving(false);
    }
  };

  const goNext = async () => {
    if (missing.length > 0) return;
    setSaving(true);
    setError(null);
    try {
      await persist();
      setStep((s) => s + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.failed"));
    } finally {
      setSaving(false);
    }
  };

  const submit = async () => {
    if (missing.length > 0) return;
    setSaving(true);
    setError(null);
    try {
      const id = await persist();
      await listingService.submitForReview(id);
      router.push("/me/listings");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.failed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <StepIndicator step={step} />

      {step === 1 && <StepBasics form={form} patch={patch} />}
      {step === 2 && <StepPhotos form={form} patch={patch} />}
      {step === 3 && (
        <StepPricing form={form} patch={patch} priceCents={priceCents} />
      )}
      {step === 4 && <StepLogistics form={form} patch={patch} />}

      {missing.length > 0 && (
        <p className="font-label text-[12px] text-[color:var(--ink-muted)]">
          {t("trading.publish.missingFields", { count: missing.length })}
        </p>
      )}

      {error && (
        <p className="font-label text-[12px] text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between gap-2 border-t border-[var(--border)] pt-5">
        <Button variant="ghost" onClick={saveDraft} disabled={saving}>
          {t("trading.publish.saveDraft")}
        </Button>
        <div className="flex gap-2">
          {step > 1 && (
            <Button
              variant="secondary"
              onClick={() => setStep((s) => s - 1)}
              disabled={saving}
            >
              {t("trading.publish.prev")}
            </Button>
          )}
          {step < TOTAL_STEPS ? (
            <Button
              onClick={goNext}
              loading={saving}
              disabled={missing.length > 0}
            >
              {t("trading.publish.next")}
            </Button>
          ) : (
            <Button
              onClick={submit}
              loading={saving}
              disabled={missing.length > 0}
            >
              {t("trading.submitForReview")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function StepIndicator({ step }: { step: number }) {
  const { t } = useTranslation();
  const labels = [
    t("trading.publish.step1"),
    t("trading.publish.step2"),
    t("trading.publish.step3"),
    t("trading.publish.step4"),
  ];
  return (
    <ol className="flex flex-wrap gap-x-6 gap-y-2 border-b border-[var(--border)] pb-4 font-label text-[12px]">
      {labels.map((label, idx) => {
        const n = idx + 1;
        const state =
          n === step ? "current" : n < step ? "done" : "upcoming";
        return (
          <li
            key={label}
            className={`flex items-center gap-2 ${
              state === "upcoming"
                ? "text-[color:var(--ink-muted)]"
                : "text-[var(--ink)]"
            }`}
          >
            <span
              className={`inline-flex size-5 items-center justify-center rounded-full text-[11px] ${
                state === "current"
                  ? "bg-[var(--ink)] text-[var(--canvas)]"
                  : "border border-[var(--border)]"
              }`}
            >
              {n}
            </span>
            {label}
          </li>
        );
      })}
    </ol>
  );
}

// ── Step 1 ──────────────────────────────────────────────────────────────────

function StepBasics({
  form,
  patch,
}: {
  form: WizardForm;
  patch: (data: Partial<WizardForm>) => void;
}) {
  const { t } = useTranslation();
  const sizes = suggestedSizes(form.categoryKind);

  return (
    <div className="grid gap-5">
      <FormField label={t("trading.publish.brand")} required>
        <TextInput
          value={form.brand}
          onChange={(v) => patch({ brand: v })}
          placeholder={t("trading.publish.brandPlaceholder")}
        />
      </FormField>

      <FormField label={t("trading.publish.category")} required>
        <div className="flex flex-wrap gap-1.5">
          {MARKETPLACE_CATEGORIES.map((c) => (
            <OptionChip
              key={c.value}
              label={t(c.labelKey)}
              selected={form.categoryKind === c.value}
              onClick={() => patch({ categoryKind: c.value, size: "" })}
            />
          ))}
        </div>
      </FormField>

      <FormField label={t("trading.publish.styleName")}>
        <TextInput
          value={form.styleName}
          onChange={(v) => patch({ styleName: v })}
          placeholder={t("trading.publish.styleNamePlaceholder")}
        />
      </FormField>

      <FormField label={t("trading.publish.size")} required>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {sizes.map((s) => (
            <OptionChip
              key={s}
              label={s}
              selected={form.size === s}
              onClick={() => patch({ size: s })}
            />
          ))}
        </div>
        <TextInput
          value={form.size}
          onChange={(v) => patch({ size: v })}
          placeholder={t("trading.publish.sizePlaceholder")}
        />
      </FormField>

      <FormField label={t("trading.publish.color")} required>
        <div className="flex flex-wrap gap-2">
          {MARKETPLACE_COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => patch({ color: c.value })}
              title={t(c.labelKey)}
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-label text-[12px] transition-colors ${
                form.color === c.value
                  ? "border-[var(--ink)] text-[var(--ink)]"
                  : "border-[var(--border)] text-[color:var(--ink-muted)] hover:border-[var(--ink-muted)]"
              }`}
            >
              <span
                className={`inline-block size-3 rounded-full ${
                  c.bordered ? "border border-[var(--border)]" : ""
                }`}
                style={{ backgroundColor: c.hex }}
              />
              {t(c.labelKey)}
            </button>
          ))}
        </div>
      </FormField>

      <FormField label={t("trading.publish.condition")} required>
        <div className="flex flex-wrap gap-1.5">
          {MARKETPLACE_CONDITIONS.map((c) => (
            <OptionChip
              key={c.value}
              label={t(c.labelKey)}
              selected={form.condition === c.value}
              onClick={() => patch({ condition: c.value })}
            />
          ))}
        </div>
      </FormField>

      <FormField label={t("trading.publish.accessories")}>
        <TextInput
          value={form.accessoriesNote}
          onChange={(v) => patch({ accessoriesNote: v })}
          placeholder={t("trading.publish.accessoriesPlaceholder")}
        />
      </FormField>
    </div>
  );
}

// ── Step 2 ──────────────────────────────────────────────────────────────────

function StepPhotos({
  form,
  patch,
}: {
  form: WizardForm;
  patch: (data: Partial<WizardForm>) => void;
}) {
  const { t } = useTranslation();

  const setSlot = (slot: RequiredPhotoSlot, url: string) =>
    patch({ photoAngles: { ...form.photoAngles, [slot]: url || null } });

  return (
    <div className="space-y-5">
      <p className="font-label text-[12px] leading-relaxed text-[color:var(--ink-muted)]">
        {t("trading.publish.photosHint")}
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REQUIRED_PHOTO_SLOTS.map((slot) => (
          <FormField
            key={slot}
            label={t(PHOTO_SLOT_LABEL_KEY[slot])}
            required
          >
            <ImagePicker
              value={form.photoAngles[slot] ?? ""}
              onChange={(url) => setSlot(slot, url)}
              height={140}
            />
          </FormField>
        ))}
      </div>

      <FormField label={t("trading.publish.extraPhotos")}>
        <MultiImagePicker
          value={form.photoAngles.extras ?? []}
          onChange={(extras) =>
            patch({ photoAngles: { ...form.photoAngles, extras } })
          }
          max={MAX_EXTRA_PHOTOS}
          height={96}
        />
      </FormField>
    </div>
  );
}

// ── Step 3 ──────────────────────────────────────────────────────────────────

function StepPricing({
  form,
  patch,
  priceCents,
}: {
  form: WizardForm;
  patch: (data: Partial<WizardForm>) => void;
  priceCents: number | null;
}) {
  const { t } = useTranslation();
  const [tagDraft, setTagDraft] = useState("");

  const addTag = () => {
    const v = tagDraft.trim();
    if (!v || form.tags.includes(v) || form.tags.length >= MAX_TAGS) return;
    patch({ tags: [...form.tags, v] });
    setTagDraft("");
  };

  return (
    <div className="grid gap-5">
      <FormField label={t("trading.publish.price")} required>
        <TextInput
          value={form.priceInput}
          onChange={(v) => patch({ priceInput: v })}
          placeholder={t("trading.publish.pricePlaceholder")}
        />
        {priceCents != null && priceCents > 0 && (
          <p className="font-label text-[11px] text-[color:var(--ink-muted)]">
            {t("trading.expectedPayout", {
              price: formatPriceCents(calculateExpectedPayout(priceCents)),
            })}
          </p>
        )}
      </FormField>

      <FormField label={t("trading.publish.acceptOffer")}>
        <Toggle
          checked={form.acceptOffer}
          onChange={(v) => patch({ acceptOffer: v })}
          label={t("trading.publish.acceptOfferHint")}
        />
      </FormField>

      <FormField label={t("trading.publish.title")} required>
        <TextInput
          value={form.title}
          onChange={(v) => patch({ title: v })}
          placeholder={t("trading.publish.titlePlaceholder")}
        />
      </FormField>

      <FormField label={t("trading.publish.description")} required>
        <TextInput
          value={form.description}
          onChange={(v) => patch({ description: v })}
          multiline
          rows={6}
          placeholder={t("trading.publish.descriptionPlaceholder")}
        />
      </FormField>

      <FormField label={t("trading.publish.tags")}>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {form.tags.map((tag, idx) => (
            <button
              key={tag}
              type="button"
              onClick={() =>
                patch({ tags: form.tags.filter((_, i) => i !== idx) })
              }
              className="rounded-full border border-[var(--border)] px-3 py-1 font-label text-[12px] text-[color:var(--ink-muted)] transition-colors hover:text-[var(--ink)]"
            >
              {tag} ×
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <TextInput
            value={tagDraft}
            onChange={setTagDraft}
            placeholder={t("trading.publish.tagPlaceholder")}
          />
          <Button
            variant="secondary"
            onClick={addTag}
            disabled={form.tags.length >= MAX_TAGS}
          >
            {t("common.add")}
          </Button>
        </div>
      </FormField>
    </div>
  );
}

// ── Step 4 ──────────────────────────────────────────────────────────────────

function StepLogistics({
  form,
  patch,
}: {
  form: WizardForm;
  patch: (data: Partial<WizardForm>) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="grid gap-5">
      <FormField label={t("trading.publish.acquiredAt")}>
        <TextInput
          value={form.originalAcquiredAt}
          onChange={(v) => patch({ originalAcquiredAt: v })}
          type="date"
        />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label={t("trading.country")} required>
          <TextInput
            value={form.shipFromCountry}
            onChange={(v) => patch({ shipFromCountry: v })}
          />
        </FormField>
        <FormField label={t("trading.province")}>
          <TextInput
            value={form.shipFromState}
            onChange={(v) => patch({ shipFromState: v })}
          />
        </FormField>
        <FormField label={t("trading.city")}>
          <TextInput
            value={form.shipFromCity}
            onChange={(v) => patch({ shipFromCity: v })}
          />
        </FormField>
      </div>

      <FormField label={t("trading.publish.shippingFee")} required>
        <div className="flex flex-wrap gap-1.5">
          {(["cod", "free"] as const).map((mode) => (
            <OptionChip
              key={mode}
              label={t(`trading.publish.shipping_${mode}`)}
              selected={form.shippingFeeMode === mode}
              onClick={() => patch({ shippingFeeMode: mode })}
            />
          ))}
        </div>
      </FormField>

      <p className="font-label text-[12px] leading-relaxed text-[color:var(--ink-muted)]">
        {t("trading.publish.submitHint")}
      </p>
    </div>
  );
}

function OptionChip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 font-label text-[12px] transition-colors ${
        selected
          ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--canvas)]"
          : "border-[var(--border)] text-[color:var(--ink-muted)] hover:border-[var(--ink-muted)]"
      }`}
    >
      {label}
    </button>
  );
}
