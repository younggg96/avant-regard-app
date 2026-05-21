import { create } from "zustand";

import type {
  ProductCondition,
  SellerKind,
  PhotoAngles,
  StoreProduct,
} from "../services/storeProductService";

/**
 * 发布单品 Wizard 全局状态。
 *
 * 为什么用 zustand 而不是 navigation params：
 *   - 3 个 Step 屏要共享同一份编辑中的 draft，按钮里只想跳 Step；
 *   - 编辑既存 listing 时（一键转卖 / 修改草稿）也走同一套 Step，需要从外部
 *     一次性灌入 listing 数据；
 *   - 用 zustand 比拼接 route params 简单很多。
 *
 * `productId` 在第一次保存草稿后由后端返回，后续 PATCH / Submit 都用它。
 */

export interface ListingFormState {
  productId: number | null;
  sellerKind: SellerKind;

  // Step 1 — 属性
  brand: string;
  brandId: number | null;
  categoryId: number | null;
  categoryName: string | null;
  size: string;
  color: string;
  condition: ProductCondition | null;
  originalShowId: number | null;
  originalShowLabel: string | null;
  originalAcquiredAt: string | null;

  // Step 2 — 图片
  photoAngles: PhotoAngles;
  extras: string[];

  // Step 3 — 定价与描述
  title: string;
  description: string;
  priceCents: number | null;
  acceptOffer: boolean;
  conditionNote: string;
}

const EMPTY: ListingFormState = {
  productId: null,
  sellerKind: "individual",
  brand: "",
  brandId: null,
  categoryId: null,
  categoryName: null,
  size: "",
  color: "",
  condition: null,
  originalShowId: null,
  originalShowLabel: null,
  originalAcquiredAt: null,
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
  conditionNote: "",
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
      size: listing.size ?? "",
      color: listing.color ?? "",
      condition: (listing.condition as ProductCondition) ?? null,
      originalShowId: listing.originalShowId ?? null,
      originalShowLabel: null,
      originalAcquiredAt: listing.originalAcquiredAt ?? null,
      photoAngles: listing.photoAngles ?? EMPTY.photoAngles,
      extras: listing.photoAngles?.extras ?? [],
      title: listing.title,
      description: listing.description ?? "",
      priceCents: listing.priceCents,
      acceptOffer: listing.acceptOffer ?? true,
      conditionNote: listing.conditionNote ?? "",
    }),
}));

/**
 * 提交前的校验。返回缺失字段名数组；空数组表示可提交。
 */
export const validateForSubmit = (s: ListingFormState): string[] => {
  const missing: string[] = [];
  if (!s.brand.trim()) missing.push("brand");
  if (!s.condition) missing.push("condition");
  if (!s.size.trim()) missing.push("size");
  if (!s.color.trim()) missing.push("color");
  const angles = s.photoAngles;
  (["front", "back", "wash_label", "brand_label", "flaw"] as const).forEach(
    (k) => {
      if (!angles[k]) missing.push(`photo:${k}`);
    }
  );
  if (!s.title.trim()) missing.push("title");
  if (!s.priceCents || s.priceCents <= 0) missing.push("price");
  if (!s.conditionNote.trim()) missing.push("conditionNote");
  return missing;
};
