"use client";

/**
 * 交易大厅筛选面板。
 *
 * 对齐移动端 `frontend/src/screens/Marketplace/MarketplaceFilterSheet.tsx`
 * 的维度与取值——两端必须共用 `lib/trading/taxonomy.ts` 的入库值，
 * 否则筛选匹配不到卖家发布时选的项。
 *
 * 移动端是底部 sheet，web 上有横向空间，直接做成常驻侧栏（窄屏折叠）。
 */

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/admin/ui";
import type { ProductCondition, SellerKind } from "@/lib/services/listing";
import type { MarketplaceFilter } from "@/lib/services/marketplace";
import { parsePriceInputToCents } from "@/lib/services/store-product";
import {
  LETTER_SIZES,
  MARKETPLACE_CATEGORIES,
  MARKETPLACE_COLORS,
  MARKETPLACE_CONDITIONS,
  NUMERIC_SIZES,
} from "@/lib/trading/taxonomy";

export interface MarketplaceFilterState {
  categoryKinds: string[];
  conditions: ProductCondition[];
  colors: string[];
  sizes: string[];
  brands: string[];
  sellerKind?: SellerKind;
  priceMin: string;
  priceMax: string;
}

export const EMPTY_FILTERS: MarketplaceFilterState = {
  categoryKinds: [],
  conditions: [],
  colors: [],
  sizes: [],
  brands: [],
  sellerKind: undefined,
  priceMin: "",
  priceMax: "",
};

/** 面板状态 → 查询参数。价格是文本输入，这里统一转成分。 */
export function toFilterParams(
  state: MarketplaceFilterState,
): Pick<
  MarketplaceFilter,
  | "categoryKinds"
  | "conditions"
  | "colors"
  | "sizes"
  | "brands"
  | "sellerKind"
  | "priceMinCents"
  | "priceMaxCents"
> {
  return {
    categoryKinds: state.categoryKinds,
    conditions: state.conditions,
    colors: state.colors,
    sizes: state.sizes,
    brands: state.brands,
    sellerKind: state.sellerKind,
    priceMinCents: parsePriceInputToCents(state.priceMin) ?? undefined,
    priceMaxCents: parsePriceInputToCents(state.priceMax) ?? undefined,
  };
}

/**
 * URL ⇄ 面板状态。
 *
 * 多值维度用逗号 CSV，和后端的传参约定一致；品牌名里出现逗号会破坏这个编码，
 * 但那种品牌本来也过不了后端的 CSV 解析。
 */
export function parseFilterState(sp: URLSearchParams): MarketplaceFilterState {
  const list = (key: string) => {
    const raw = sp.get(key);
    return raw ? raw.split(",").filter(Boolean) : [];
  };
  const seller = sp.get("seller");
  return {
    categoryKinds: list("cat"),
    conditions: list("cond") as ProductCondition[],
    colors: list("color"),
    sizes: list("size"),
    brands: list("brand"),
    sellerKind:
      seller === "individual" || seller === "merchant" ? seller : undefined,
    priceMin: sp.get("min") || "",
    priceMax: sp.get("max") || "",
  };
}

/** 空值一律返回 undefined，交给调用方从 URL 里删掉对应参数。 */
export function filterStateToQuery(
  state: MarketplaceFilterState,
): Record<string, string | undefined> {
  const csv = (v: string[]) => (v.length > 0 ? v.join(",") : undefined);
  return {
    cat: csv(state.categoryKinds),
    cond: csv(state.conditions),
    color: csv(state.colors),
    size: csv(state.sizes),
    brand: csv(state.brands),
    seller: state.sellerKind,
    min: state.priceMin || undefined,
    max: state.priceMax || undefined,
  };
}

export function countActiveFilters(state: MarketplaceFilterState): number {
  return (
    state.categoryKinds.length +
    state.conditions.length +
    state.colors.length +
    state.sizes.length +
    state.brands.length +
    (state.sellerKind ? 1 : 0) +
    (state.priceMin ? 1 : 0) +
    (state.priceMax ? 1 : 0)
  );
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value];
}

export function MarketplaceFilters({
  state,
  onChange,
}: {
  state: MarketplaceFilterState;
  onChange: (next: MarketplaceFilterState) => void;
}) {
  const { t } = useTranslation();
  const patch = (data: Partial<MarketplaceFilterState>) =>
    onChange({ ...state, ...data });

  const activeCount = countActiveFilters(state);

  // 价格是自由输入：状态提上去会写 URL 并触发请求，逐字符提交等于每敲一下
  // 打一次后端。本地暂存，失焦或回车才提交。
  const [priceDraft, setPriceDraft] = useState({
    min: state.priceMin,
    max: state.priceMax,
  });
  useEffect(() => {
    setPriceDraft({ min: state.priceMin, max: state.priceMax });
  }, [state.priceMin, state.priceMax]);

  const commitPrice = () => {
    if (priceDraft.min === state.priceMin && priceDraft.max === state.priceMax)
      return;
    patch({ priceMin: priceDraft.min, priceMax: priceDraft.max });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-label text-[12px] uppercase tracking-widest text-[color:var(--ink-muted)]">
          {t("trading.marketplace.filters")}
        </h2>
        {activeCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange(EMPTY_FILTERS)}
          >
            {t("trading.marketplace.clearFilters")}
          </Button>
        )}
      </div>

      <Group label={t("trading.publish.category")}>
        {MARKETPLACE_CATEGORIES.map((c) => (
          <Chip
            key={c.value}
            label={t(c.labelKey)}
            selected={state.categoryKinds.includes(c.value)}
            onClick={() =>
              patch({ categoryKinds: toggle(state.categoryKinds, c.value) })
            }
          />
        ))}
      </Group>

      <Group label={t("trading.publish.condition")}>
        {MARKETPLACE_CONDITIONS.map((c) => (
          <Chip
            key={c.value}
            label={t(c.labelKey)}
            selected={state.conditions.includes(c.value)}
            onClick={() =>
              patch({ conditions: toggle(state.conditions, c.value) })
            }
          />
        ))}
      </Group>

      <Group label={t("trading.publish.color")}>
        {MARKETPLACE_COLORS.map((c) => {
          const selected = state.colors.includes(c.value);
          return (
            <button
              key={c.value}
              type="button"
              onClick={() => patch({ colors: toggle(state.colors, c.value) })}
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-label text-[12px] transition-colors ${
                selected
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
          );
        })}
      </Group>

      <Group label={t("trading.publish.size")}>
        {[...LETTER_SIZES, ...NUMERIC_SIZES].map((s) => (
          <Chip
            key={s}
            label={s}
            selected={state.sizes.includes(s)}
            onClick={() => patch({ sizes: toggle(state.sizes, s) })}
          />
        ))}
      </Group>

      <Group label={t("trading.marketplace.sellerKind")}>
        {(["individual", "merchant"] as const).map((kind) => (
          <Chip
            key={kind}
            label={t(`trading.marketplace.sellerKind_${kind}`)}
            selected={state.sellerKind === kind}
            onClick={() =>
              patch({ sellerKind: state.sellerKind === kind ? undefined : kind })
            }
          />
        ))}
      </Group>

      <div>
        <p className="mb-2 font-label text-[12px] text-[color:var(--ink-muted)]">
          {t("trading.marketplace.priceRange")}
        </p>
        <div className="flex items-center gap-2">
          <input
            value={priceDraft.min}
            onChange={(e) =>
              setPriceDraft((d) => ({ ...d, min: e.target.value }))
            }
            onBlur={commitPrice}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitPrice();
            }}
            placeholder={t("trading.marketplace.priceMin")}
            inputMode="decimal"
            className="w-full rounded border border-[var(--border)] bg-[var(--canvas)] px-2.5 py-1.5 font-label text-[12px] outline-none transition-colors focus:border-[var(--ink-muted)]"
          />
          <span className="font-label text-[12px] text-[color:var(--ink-muted)]">
            –
          </span>
          <input
            value={priceDraft.max}
            onChange={(e) =>
              setPriceDraft((d) => ({ ...d, max: e.target.value }))
            }
            onBlur={commitPrice}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitPrice();
            }}
            placeholder={t("trading.marketplace.priceMax")}
            inputMode="decimal"
            className="w-full rounded border border-[var(--border)] bg-[var(--canvas)] px-2.5 py-1.5 font-label text-[12px] outline-none transition-colors focus:border-[var(--ink-muted)]"
          />
        </div>
      </div>

      {state.brands.length > 0 && (
        <Group label={t("trading.publish.brand")}>
          {state.brands.map((b) => (
            <Chip
              key={b}
              label={`${b} ×`}
              selected
              onClick={() => patch({ brands: toggle(state.brands, b) })}
            />
          ))}
        </Group>
      )}
    </div>
  );
}

function Group({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-2 font-label text-[12px] text-[color:var(--ink-muted)]">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Chip({
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
