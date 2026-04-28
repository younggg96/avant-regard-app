/**
 * 等级称号单一事实源.
 *
 * 与 PRD 保持一致:
 *   Lv1 萌新 · Lv2 活跃 · Lv3 探店官 · Lv4 档案官 · Lv5 荣誉官
 *
 * 所有展示 "Lv{n} · 称号" 的地方 (徽章 / 用户表 / 审批页) 都必须走这里,
 * 避免未来改文案时漏改某处.
 */

export const LEVEL_TITLES: Record<number, string> = {
  1: "萌新",
  2: "活跃",
  3: "探店官",
  4: "档案官",
  5: "荣誉官",
};

/** 返回 "Lv{n} 称号", 无效 level 返回空串. */
export function formatLevelLabel(level: number): string {
  if (!level || level < 1 || level > 5) return "";
  return `Lv${level} ${LEVEL_TITLES[level] ?? ""}`.trim();
}

/** 等级下拉选项, 用于 admin 手动授予等场景. */
export const LEVEL_OPTIONS: Array<{ value: number; label: string }> = [1, 2, 3, 4, 5].map(
  (v) => ({ value: v, label: formatLevelLabel(v) }),
);
