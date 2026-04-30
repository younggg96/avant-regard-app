"use client";

/**
 * 店铺详情页"入口卡片"组件.
 *
 * 对齐移动端 `frontend/src/screens/Discover/components/BuyerTab/CategoryCards.tsx`.
 * 每张卡片：imageUrl 背景 + label/labelEn 叠加. 点击后：
 *   - CLASSIFICATION  → 跳 '全部商品' Tab，带 categoryId filter
 *   - DISCOUNT        → 跳 '全部商品' Tab，带 hasDiscount=1
 *   - NEW_ARRIVAL     → 跳 '上新' Tab
 *   - EVENT           → Phase 5 暂不支持（仍留 UI，点击 no-op + 提示）
 *
 * 没有入口卡片（未配置）时：
 *   - 显示一组 fallback "全部商品 / 上新 / 折扣" 简约卡，不让整排空掉.
 *   - 和移动端"mock 兜底"思路一致，让用户在"商家还没配置"阶段也有基本导航.
 */

import useSWR from "swr";
import {
  storeProductService,
  type StoreEntryCard,
  type EntryCardType,
} from "@/lib/services/store-product";

interface Props {
  storeId: string;
  /** 点击某张卡片时触发，由父 page 转为切换 Tab + URL filter 的动作. */
  onNavigate: (navigate: EntryCardNavigation) => void;
}

/**
 * 给父组件的语义事件（不含 card 本体，让导航逻辑解耦）.
 */
export interface EntryCardNavigation {
  type: EntryCardType;
  targetCategoryId?: number | null;
  label: string;
}

export function StoreCategoryCards({ storeId, onNavigate }: Props) {
  const { data, isLoading } = useSWR(
    storeId ? ["store-entry-cards", storeId] : null,
    () => storeProductService.listPublicEntryCards(storeId),
    { revalidateOnFocus: false },
  );

  if (isLoading) {
    return <div className="mb-10 h-[120px] animate-pulse rounded bg-[var(--canvas-soft)]" />;
  }

  const cards = data?.cards ?? [];
  const effective: CardLike[] =
    cards.length > 0
      ? cards.map((c) => ({
          key: `real-${c.id}`,
          imageUrl: c.imageUrl,
          label: c.label,
          labelEn: c.labelEn,
          type: c.cardType as EntryCardType,
          targetCategoryId: c.targetCategoryId ?? null,
        }))
      : FALLBACK_CARDS;

  return (
    <section className="mb-12">
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
        {effective.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() =>
              onNavigate({
                type: c.type,
                targetCategoryId: c.targetCategoryId,
                label: c.label,
              })
            }
            className="group relative block h-[120px] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--canvas-soft)] text-left transition-transform hover:-translate-y-[1px]"
          >
            {c.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={c.imageUrl}
                alt={c.label}
                className="absolute inset-0 h-full w-full object-cover opacity-85 transition-opacity group-hover:opacity-100"
                loading="lazy"
              />
            ) : (
              <div
                className="absolute inset-0"
                style={{
                  background: "linear-gradient(135deg, var(--canvas-raised) 0%, var(--canvas-soft) 100%)",
                }}
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-transparent" />
            <div className="relative flex h-full flex-col justify-center gap-2 p-5">
              <div className="rounded border border-white/30 bg-white/10 px-3 py-1 font-label text-[11px] uppercase tracking-widest text-white backdrop-blur-sm self-start">
                {c.labelEn || fallbackLabelEn(c.type)}
              </div>
              <div className="font-serif text-[20px] text-white">{c.label}</div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

interface CardLike {
  key: string;
  imageUrl: string;
  label: string;
  labelEn?: string | null;
  type: EntryCardType;
  targetCategoryId: number | null;
}

// 没有入口卡片配置时的兜底导航 —— 仅用客户端颜色，不依赖图片.
const FALLBACK_CARDS: CardLike[] = [
  {
    key: "fb-all",
    imageUrl: "",
    label: "全部商品",
    labelEn: "ALL",
    type: "CLASSIFICATION",
    targetCategoryId: null,
  },
  {
    key: "fb-new",
    imageUrl: "",
    label: "近期上新",
    labelEn: "NEW",
    type: "NEW_ARRIVAL",
    targetCategoryId: null,
  },
  {
    key: "fb-sale",
    imageUrl: "",
    label: "折扣专区",
    labelEn: "SALE",
    type: "DISCOUNT",
    targetCategoryId: null,
  },
];

function fallbackLabelEn(type: EntryCardType): string {
  switch (type) {
    case "CLASSIFICATION":
      return "SHOP";
    case "DISCOUNT":
      return "SALE";
    case "NEW_ARRIVAL":
      return "NEW";
    case "EVENT":
      return "EVENT";
  }
}
