/**
 * 订单状态的视觉与流程映射。
 *
 * 对齐移动端 `frontend/src/utils/orderStatusVisual.ts`，但把 Ionicons + 主题色
 * 换成 lucide 图标 + Tailwind 类名，颜色沿用 web 的 CSS 变量与 dark: 变体。
 *
 * 订单卡片上的状态徽章、订单详情页的状态头图和时间轴都从这里取值，
 * 保证同一状态在各处的观感一致。
 */

import {
  AlertCircle,
  Award,
  CheckCircle2,
  FileText,
  Package,
  Plane,
  Undo2,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import type { OrderStatus } from "@/lib/services/order";

export interface OrderStatusVisual {
  icon: LucideIcon;
  /** 徽章 / 头图的背景与前景类名。 */
  badgeClass: string;
  /** 图标或强调文字的前景色类名。 */
  accentClass: string;
}

const NEUTRAL: OrderStatusVisual = {
  icon: FileText,
  badgeClass:
    "bg-[var(--canvas-raised)] text-[var(--ink)] border-[var(--border)]",
  accentClass: "text-[var(--ink)]",
};

const VISUALS: Partial<Record<OrderStatus, OrderStatusVisual>> = {
  pending_payment: {
    icon: Wallet,
    badgeClass:
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
    accentClass: "text-amber-600 dark:text-amber-400",
  },
  paid: {
    icon: Package,
    badgeClass:
      "bg-[var(--canvas-raised)] text-[var(--ink)] border-[var(--border)]",
    accentClass: "text-[var(--ink)]",
  },
  shipped: {
    icon: Plane,
    badgeClass:
      "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900",
    accentClass: "text-blue-600 dark:text-blue-400",
  },
  delivered: {
    icon: CheckCircle2,
    badgeClass:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900",
    accentClass: "text-emerald-600 dark:text-emerald-400",
  },
  completed: {
    icon: Award,
    badgeClass:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900",
    accentClass: "text-emerald-600 dark:text-emerald-400",
  },
  settled: {
    icon: Award,
    badgeClass:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900",
    accentClass: "text-emerald-600 dark:text-emerald-400",
  },
  refunded: {
    icon: Undo2,
    badgeClass:
      "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900",
    accentClass: "text-red-600 dark:text-red-400",
  },
  refunded_auto: {
    icon: Undo2,
    badgeClass:
      "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900",
    accentClass: "text-red-600 dark:text-red-400",
  },
  disputed: {
    icon: AlertCircle,
    badgeClass:
      "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900",
    accentClass: "text-red-600 dark:text-red-400",
  },
};

export function orderStatusVisual(status: OrderStatus): OrderStatusVisual {
  return VISUALS[status] ?? NEUTRAL;
}

/**
 * 正常履约路径上的节点，用于订单详情的进度时间轴。
 * 退款 / 争议是分支状态，不在时间轴上，单独用状态头图表达。
 */
export const ORDER_TIMELINE_STEPS: OrderStatus[] = [
  "pending_payment",
  "paid",
  "shipped",
  "delivered",
  "completed",
];

/**
 * 当前状态在时间轴上的位置。
 * `settled` 视作已走完全程；退款 / 争议返回 -1 表示不适用时间轴。
 */
export function orderTimelineIndex(status: OrderStatus): number {
  if (status === "settled") return ORDER_TIMELINE_STEPS.length - 1;
  return ORDER_TIMELINE_STEPS.indexOf(status);
}

/** 订单在时间轴之外的分支状态（退款、争议）。 */
export function isOffTimelineStatus(status: OrderStatus): boolean {
  return orderTimelineIndex(status) === -1;
}

/**
 * 订单列表的筛选分组。
 * 与移动端 `screens/Profile/types.ts` 的 chip 映射保持一致：
 * 「已完成」把 delivered / completed / settled 合并，
 * 「售后」把争议与退款合并。
 */
export type OrderFilterKey =
  | "all"
  | "pending_payment"
  | "paid"
  | "shipped"
  | "completed"
  | "after_sales";

export const ORDER_FILTER_STATUSES: Record<OrderFilterKey, OrderStatus[]> = {
  all: [],
  pending_payment: ["pending_payment"],
  paid: ["paid"],
  shipped: ["shipped"],
  completed: ["delivered", "completed", "settled"],
  after_sales: ["disputed", "refunded", "refunded_auto", "resolved"],
};

export const ORDER_FILTER_KEYS: OrderFilterKey[] = [
  "all",
  "pending_payment",
  "paid",
  "shipped",
  "completed",
  "after_sales",
];

/** 前端按分组过滤，避免为合并分组多次请求后端。 */
export function matchesOrderFilter(
  status: OrderStatus,
  filter: OrderFilterKey,
): boolean {
  if (filter === "all") return true;
  return ORDER_FILTER_STATUSES[filter].includes(status);
}
