/**
 * 等级称号单一事实源.
 *
 * 与 PRD 保持一致:
 *   Lv1 萌新 · Lv2 活跃 · Lv3 探店官 · Lv4 档案官 · Lv5 荣誉官
 *
 * 多语言使用方式:
 *   - React 组件: const { t } = useTranslation(); t(getLevelTitleKey(level))
 *   - Server 组件: const t = getServerT(); t(getLevelTitleKey(level))
 *   - 选项列表:    getLevelOptions(t)
 *
 * LEVEL_TITLES 保留为中文兜底, 仅在无法获取 t 函数时使用.
 */

export const LEVEL_TITLES: Record<number, string> = {
  1: "萌新",
  2: "活跃",
  3: "探店官",
  4: "档案官",
  5: "荣誉官",
};

/** 返回等级称号的 i18n key, 供 t() 调用. */
export function getLevelTitleKey(level: number): string {
  return `level.titles.${level}`;
}

/**
 * 返回 "Lv{n} 称号".
 * 传入 t 函数时使用 i18n; 否则用内置中文兜底.
 */
export function formatLevelLabel(
  level: number,
  t?: (key: string) => string,
): string {
  if (!level || level < 1 || level > 5) return "";
  const title = t ? t(getLevelTitleKey(level)) : (LEVEL_TITLES[level] ?? "");
  return `Lv${level} ${title}`.trim();
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
  (v) => ({ value: v, label: v === 5 ? `${formatLevelLabel(v)} (专用通道)` : formatLevelLabel(v) }),
);
