import { create } from "zustand";

import type {
  ProductCondition,
  SellerKind,
  PhotoAngles,
  StoreProduct,
  YearDecade,
} from "../services/storeProductService";

/**
 * 发布单品 Wizard 全局状态（4-step flow，PRD 单品发布 Phase 2）。
 *
 * 步骤拆分：
 *   - Step 1 / 4 · 基本信息：品牌、款式/系列、单品类型、尺码、颜色、成色、年代、配件
 *   - Step 2 / 4 · 5 视角图（强制）+ 最多 7 张额外图
 *   - Step 3 / 4 · 定价描述：价格、参考区间、是否议价、标题、描述、标签
 *   - Step 4 / 4 · 物流：原入手时间、关联秀场、发货地（国 / 省 / 市）、运费方式
 *
 * `productId` 在第一次保存草稿后由后端返回，后续 PATCH / Submit 都用它。
 */

export type ShippingFeeMode = "cod" | "free";

export interface ListingFormState {
  productId: number | null;
  sellerKind: SellerKind;

  // Step 1 · 基本信息
  brand: string;
  brandId: number | null;
  categoryId: number | null;
  categoryName: string | null;
  styleName: string;
  size: string;
  color: string;
  condition: ProductCondition | null;
  yearDecade: YearDecade | null;
  accessoriesNote: string;
  conditionNote: string;

  // Step 2 · 图片
  photoAngles: PhotoAngles;
  /** 兼容旧字段；实际数据已合并到 photoAngles.extras，保留以便迁移期读老草稿。 */
  extras: string[];

  // Step 3 · 定价描述
  title: string;
  description: string;
  priceCents: number | null;
  acceptOffer: boolean;
  tags: string[];

  // Step 4 · 物流 / 其他
  originalShowId: number | null;
  originalShowLabel: string | null;
  originalAcquiredAt: string | null;
  shipFromCountry: string | null;
  shipFromState: string | null;
  shipFromCity: string | null;
  shippingFeeMode: ShippingFeeMode;
}

export const TOTAL_PUBLISH_STEPS = 4;

const EMPTY: ListingFormState = {
  productId: null,
  sellerKind: "individual",
  brand: "",
  brandId: null,
  categoryId: null,
  categoryName: null,
  styleName: "",
  size: "",
  color: "",
  condition: null,
  yearDecade: null,
  accessoriesNote: "",
  conditionNote: "",
  photoAngles: {
    front: null,
    back: null,
    wash_label: null,
    brand_label: null,
    flaw: null,
    extras: [],
  },
  extras: [],
  title: "",
  description: "",
  priceCents: null,
  acceptOffer: true,
  tags: [],
  originalShowId: null,
  originalShowLabel: null,
  originalAcquiredAt: null,
  shipFromCountry: "中国",
  shipFromState: null,
  shipFromCity: null,
  shippingFeeMode: "cod",
};

interface PublishListingStore extends ListingFormState {
  reset: (preset?: Partial<ListingFormState>) => void;
  patch: (data: Partial<ListingFormState>) => void;
  setProductId: (id: number | null) => void;
  hydrateFromListing: (listing: StoreProduct) => void;
}

export const usePublishListingStore = create<PublishListingStore>((set) => ({
  ...EMPTY,
  reset: (preset) => set({ ...EMPTY, ...(preset ?? {}) }),
  patch: (data) => set((prev) => ({ ...prev, ...data })),
  setProductId: (id) => set({ productId: id }),
  hydrateFromListing: (listing) =>
    set({
      productId: listing.id,
      sellerKind: (listing.sellerKind as SellerKind) ?? "individual",
      brand: listing.brand ?? "",
      brandId: null,
      categoryId: listing.categoryId ?? null,
      categoryName: listing.categoryName ?? null,
      styleName: listing.styleName ?? "",
      size: listing.size ?? "",
      color: listing.color ?? "",
      condition: (listing.condition as ProductCondition) ?? null,
      yearDecade: (listing.yearDecade as YearDecade) ?? null,
      accessoriesNote: listing.accessoriesNote ?? "",
      conditionNote: listing.conditionNote ?? "",
      photoAngles: listing.photoAngles ?? EMPTY.photoAngles,
      extras: listing.photoAngles?.extras ?? [],
      title: listing.title,
      description: listing.description ?? "",
      priceCents: listing.priceCents,
      acceptOffer: listing.acceptOffer ?? true,
      tags: listing.tags ?? [],
      originalShowId:
        listing.originalShowId != null && !Number.isNaN(Number(listing.originalShowId))
          ? Number(listing.originalShowId)
          : null,
      originalShowLabel: null,
      originalAcquiredAt: listing.originalAcquiredAt ?? null,
      shipFromCountry: listing.shipFromCountry ?? "中国",
      shipFromState: listing.shipFromState ?? null,
      shipFromCity: listing.shipFromCity ?? null,
      shippingFeeMode: (listing.shippingFeeMode as ShippingFeeMode) ?? "cod",
    }),
}));

/**
 * 各 step 的轻量校验。Step 4 全部 OK 才能提交审核。
 */
export const validateStep1 = (s: ListingFormState): string[] => {
  const missing: string[] = [];
  if (!s.brand.trim()) missing.push("brand");
  if (!s.size.trim()) missing.push("size");
  if (!s.color.trim()) missing.push("color");
  if (!s.condition) missing.push("condition");
  if (!s.yearDecade) missing.push("yearDecade");
  return missing;
};

export const validateStep2 = (s: ListingFormState): string[] => {
  const missing: string[] = [];
  const angles = s.photoAngles;
  (["front", "back", "wash_label", "brand_label", "flaw"] as const).forEach(
    (k) => {
      if (!angles[k]) missing.push(`photo:${k}`);
    }
  );
  return missing;
};

export const validateStep3 = (s: ListingFormState): string[] => {
  const missing: string[] = [];
  if (!s.title.trim()) missing.push("title");
  if (!s.priceCents || s.priceCents <= 0) missing.push("price");
  if (!s.conditionNote.trim()) missing.push("conditionNote");
  return missing;
};

export const validateStep4 = (s: ListingFormState): string[] => {
  const missing: string[] = [];
  if (!s.shipFromCountry?.trim()) missing.push("shipFromCountry");
  if (!s.shippingFeeMode) missing.push("shippingFeeMode");
  return missing;
};

/**
 * 提交前的最终校验。返回缺失字段名数组；空数组表示可提交。
 */
export const validateForSubmit = (s: ListingFormState): string[] => [
  ...validateStep1(s),
  ...validateStep2(s),
  ...validateStep3(s),
  ...validateStep4(s),
];
