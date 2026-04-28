/**
 * 等级称号单一事实源 (RN 端).
 *
 * 与 `web/src/lib/levels/titles.ts` 对称, 与 PRD 保持一致:
 *   Lv1 萌新 · Lv2 活跃 · Lv3 探店官 · Lv4 档案官 · Lv5 荣誉官
 *
 * 所有展示 "Lv{n} · 称号" 的地方 (徽章 / 用户表 / 审批页) 都走这里,
 * 未来改文案只改一处.
 */

export const LEVEL_TITLES: Record<number, string> = {
  1: "萌新",
  2: "活跃",
  3: "探店官",
  4: "档案官",
  5: "荣誉官",
};

export function getLevelTitle(level: number): string {
  return LEVEL_TITLES[level] ?? "";
}

/** 返回 "Lv{n} 称号", 无效 level 返回空串. */
export function formatLevelLabel(level: number, suffix: string = ""): string {
  if (!level || level < 1 || level > 5) return "";
  const title = LEVEL_TITLES[level] ?? "";
  const base = title ? `Lv${level} ${title}` : `Lv${level}`;
  return suffix ? `${base}${suffix}` : base;
}

/** 等级下拉选项 (admin 手动授予 / 审批等场景). */
export const LEVEL_OPTIONS: Array<{ value: number; label: string }> = [1, 2, 3, 4, 5].map(
  (v) => ({
    value: v,
    label: v === 5 ? `${formatLevelLabel(v)} (专用通道)` : formatLevelLabel(v),
  }),
);
