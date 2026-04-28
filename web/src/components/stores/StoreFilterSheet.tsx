"use client";

/**
 * 买手店高级筛选面板（抽屉）。
 *
 * 对齐 iOS BuyerMapScreen.tsx 的 Filter Bottom Sheet：
 *   - 国家 / 城市按店铺数量降序排列
 *   - 热门品牌（预置 10 个）
 *   - 风格分类（设计师 / 复古 / 特色 / 集合店）
 *   - 更多选项：仅营业中、有联系电话
 *
 * 交互：点击遮罩或关闭按钮关闭；"查看 N 家店铺" 提交并关闭。
 */

import { useMemo } from "react";
import {
  POPULAR_BRANDS,
  STYLE_CATEGORIES,
  getCityDisplayName,
  getCountryDisplayName,
} from "./storeI18n";

export interface StoreFilters {
  country: string;
  city: string;
  brand: string;
  styles: string[];
  openOnly: boolean;
  hasPhone: boolean;
  searchQuery: string;
}

export interface StoreFilterSheetProps {
  open: boolean;
  onClose: () => void;
  filters: StoreFilters;
  onChange: (patch: Partial<StoreFilters>) => void;
  onReset: () => void;
  countries: string[];
  cities: string[];
  countryCounts: Record<string, number>;
  cityCounts: Record<string, number>;
  matchCount: number;
}

export function StoreFilterSheet({
  open,
  onClose,
  filters,
  onChange,
  onReset,
  countries,
  cities,
  countryCounts,
  cityCounts,
  matchCount,
}: StoreFilterSheetProps) {
  // Pre-sort lists by popularity (store count desc) — matches iOS UX where the
  // most stocked countries / cities float to the top of the chip row.
  const sortedCountries = useMemo(
    () =>
      [...countries].sort(
        (a, b) => (countryCounts[b] ?? 0) - (countryCounts[a] ?? 0),
      ),
    [countries, countryCounts],
  );
  const sortedCities = useMemo(
    () =>
      [...cities].sort(
        (a, b) => (cityCounts[b] ?? 0) - (cityCounts[a] ?? 0),
      ),
    [cities, cityCounts],
  );

  const toggleCountry = (country: string) => {
    const next = filters.country === country ? "" : country;
    onChange({
      country: next,
      // Switching country invalidates the city selection.
      city: filters.country === country ? filters.city : "",
    });
  };

  const toggleCity = (city: string) => {
    onChange({ city: filters.city === city ? "" : city });
  };

  const toggleBrand = (brand: string) => {
    onChange({ brand: filters.brand === brand ? "" : brand });
  };

  const toggleStyle = (style: string) => {
    const has = filters.styles.includes(style);
    onChange({
      styles: has
        ? filters.styles.filter((s) => s !== style)
        : [...filters.styles, style],
    });
  };

  return (
    <div
      aria-hidden={!open}
      className={`fixed inset-0 z-[60] transition-opacity duration-300 ${
        open ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-label="关闭筛选"
      />
      <aside
        className={`absolute right-0 top-0 flex h-full w-full flex-col overflow-hidden bg-[var(--canvas)] shadow-2xl transition-transform duration-300 ease-out md:max-w-[440px] ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <header className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <h2 className="font-serif text-xl text-[var(--ink)]">筛选条件</h2>
          <button
            type="button"
            onClick={onClose}
            className="font-label text-[13px] text-[color:var(--ink-muted)] hover:text-[var(--ink)]"
          >
            关闭
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-6">
          <Section title="国家 / Country">
            <Chips>
              {sortedCountries.map((c) => (
                <Chip
                  key={c}
                  active={filters.country === c}
                  onClick={() => toggleCountry(c)}
                >
                  {getCountryDisplayName(c)}
                  {countryCounts[c] ? (
                    <span className="ml-1 opacity-60">{countryCounts[c]}</span>
                  ) : null}
                </Chip>
              ))}
            </Chips>
          </Section>

          {sortedCities.length > 0 && (
            <Section
              title={
                <>
                  城市 / City{" "}
                  {filters.country && (
                    <span className="font-label text-[11px] text-[color:var(--ink-muted)]">
                      ({filters.country})
                    </span>
                  )}
                </>
              }
            >
              <Chips>
                {sortedCities.map((c) => (
                  <Chip
                    key={c}
                    active={filters.city === c}
                    onClick={() => toggleCity(c)}
                  >
                    {getCityDisplayName(c)}
                    {cityCounts[c] ? (
                      <span className="ml-1 opacity-60">{cityCounts[c]}</span>
                    ) : null}
                  </Chip>
                ))}
              </Chips>
            </Section>
          )}

          <Section title="热门品牌">
            <Chips>
              {POPULAR_BRANDS.map((b) => (
                <Chip
                  key={b}
                  active={filters.brand === b}
                  onClick={() => toggleBrand(b)}
                >
                  {b}
                </Chip>
              ))}
            </Chips>
          </Section>

          {Object.entries(STYLE_CATEGORIES).map(([category, styles]) => (
            <Section key={category} title={category}>
              <Chips>
                {styles.map((s) => (
                  <Chip
                    key={s}
                    active={filters.styles.includes(s)}
                    onClick={() => toggleStyle(s)}
                  >
                    {s}
                  </Chip>
                ))}
              </Chips>
            </Section>
          ))}

          <Section title="更多选项">
            <div className="flex flex-wrap gap-5">
              <Checkbox
                checked={filters.openOnly}
                onChange={() => onChange({ openOnly: !filters.openOnly })}
                label="仅显示营业中"
              />
              <Checkbox
                checked={filters.hasPhone}
                onChange={() => onChange({ hasPhone: !filters.hasPhone })}
                label="有联系电话"
              />
            </div>
          </Section>
        </div>

        <footer className="flex gap-2 border-t border-[var(--border)] bg-[var(--canvas)] p-4">
          <button
            type="button"
            onClick={onReset}
            className="flex-1 rounded border border-[var(--border)] py-3 font-label text-sm text-[var(--ink)] transition-colors hover:bg-[var(--canvas-raised)]"
          >
            重置
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-[2] rounded bg-black py-3 font-label text-sm font-semibold text-white transition-colors hover:bg-[#222] dark:bg-white dark:text-black dark:hover:bg-[#e0e0e0]"
          >
            查看 {matchCount} 家店铺
          </button>
        </footer>
      </aside>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6">
      <h3 className="mb-3 font-label text-[12px] font-semibold uppercase tracking-[0.16em] text-[var(--ink)]">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Chips({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-2">{children}</div>;
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded border px-3 py-1.5 font-label text-[12px] transition-colors ${
        active
          ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
          : "border-[var(--border)] bg-[var(--canvas)] text-[var(--ink)] hover:border-[var(--ink)]"
      }`}
    >
      {children}
    </button>
  );
}

function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 font-label text-[13px] text-[var(--ink)]">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 accent-black dark:accent-white"
      />
      {label}
    </label>
  );
}
