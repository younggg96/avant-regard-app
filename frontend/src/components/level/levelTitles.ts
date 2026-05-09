/**
 * 等级称号单一事实源 (RN 端).
 *
 * 与 `web/src/lib/levels/titles.ts` 对称, 与 PRD 保持一致:
 *   Lv1 Rookie · Lv2 Head · Lv3 Digger · Lv4 Archivist · Lv5 CONNOISSEUR
 *
 * 多语言使用方式:
 *   - React 组件: const { t } = useTranslation(); t(getLevelTitleKey(level))
 *   - 选项列表:    getLevelOptions(t)
 *
 * LEVEL_TITLES 保留为兜底, 仅在无法获取 t 函数时使用.
 */

export const LEVEL_TITLES: Record<number, string> = {
  1: "Rookie",
  2: "Head",
  3: "Digger",
  4: "Archivist",
  5: "CONNOISSEUR",
};

/** 返回等级称号的 i18n key, 供 t() 调用. */
export function getLevelTitleKey(level: number): string {
  return `level.titles.${level}`;
}

/**
 * 返回等级称号字符串.
 * 传入 t 函数时使用 i18n; 否则用内置中文兜底.
 */
export function getLevelTitle(level: number, t?: (key: string) => string): string {
  if (t) return t(getLevelTitleKey(level));
  return LEVEL_TITLES[level] ?? "";
}

/**
 * 返回 "Lv{n} 称号".
 * 传入 t 函数时使用 i18n; 否则用内置中文兜底.
 */
export function formatLevelLabel(
  level: number,
  t?: (key: string) => string,
  suffix: string = "",
): string {
  if (!level || level < 1 || level > 5) return "";
  const title = getLevelTitle(level, t);
  const base = title ? `Lv${level} ${title}` : `Lv${level}`;
  return suffix ? `${base}${suffix}` : base;
}

/**
 * 等级下拉选项 — 多语言版本, 推荐在 React 组件中使用.
 * 用法: const opts = getLevelOptions(t);
 */
export function getLevelOptions(
  t: (key: string) => string,
): Array<{ value: number; label: string }> {
  return [1, 2, 3, 4, 5].map((v) => ({
    value: v,
    label:
      v === 5
        ? `${formatLevelLabel(v, t)} (${t("level.lv5Channel")})`
        : formatLevelLabel(v, t),
  }));
}

/**
 * @deprecated 使用 getLevelOptions(t) 以支持多语言.
 * 仅在无法访问 i18n 的静态上下文中保留.
 */
export const LEVEL_OPTIONS: Array<{ value: number; label: string }> = [1, 2, 3, 4, 5].map(
  (v) => ({
    value: v,
    label: v === 5 ? `${formatLevelLabel(v)} (专用通道)` : formatLevelLabel(v),
  }),
);
