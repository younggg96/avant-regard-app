/**
 * LevelBadge — 黑白极简等级徽章
 *
 * 仅在 user.currentLevel >= 1 时渲染;  0 级用户不挂徽章, 保持主页视觉干净.
 * 设计语言: 纯黑底 + 无衬线数字, 与 Web 端全局 ink/canvas 主题一致.
 *
 * 使用场景: 用户主页姓名旁 / 评论区头像旁 (未来扩展).
 */

import Link from "next/link";

import { LEVEL_TITLES } from "@/lib/levels/titles";

interface LevelBadgeProps {
  level: number;
  size?: "sm" | "md";
  /** 若提供, 点击跳到该路径 (一般是自己的 /me/level); 不提供则是纯展示. */
  href?: string;
}

export function LevelBadge({ level, size = "md", href }: LevelBadgeProps) {
  if (!level || level < 1) return null;

  const title = LEVEL_TITLES[level] ?? "";
  const sizes =
    size === "sm"
      ? "h-5 text-[10px] px-1.5 gap-0.5"
      : "h-6 text-[11px] px-2 gap-1";

  const body = (
    <span
      className={`inline-flex items-center rounded-sm bg-[var(--ink)] font-label tracking-[0.1em] text-[var(--canvas)] ${sizes}`}
      aria-label={`Lv${level} ${title}`}
    >
      <span className="font-semibold">Lv{level}</span>
      {title && <span className="opacity-80">· {title}</span>}
    </span>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex">
        {body}
      </Link>
    );
  }
  return body;
}
