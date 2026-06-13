import { NotificationType } from "../../services/notificationService";

export type ActivityFilter = "all" | "like_collection" | "comment" | "follow";

export const FILTER_TABS: { id: ActivityFilter; labelKey: string }[] = [
  { id: "all", labelKey: "activity.all" },
  { id: "like_collection", labelKey: "activity.likesAndSaves" },
  { id: "comment", labelKey: "activity.comments" },
  { id: "follow", labelKey: "activity.follows" },
];

export const EXCLUDED_TYPES: NotificationType[] = ["system", "mention"];

/**
 * 通知图标统一配色 —— 只保留「中性 / 正向 / 提醒」三档,避免列表里五颜六色。
 * 用固定 hex(而非 theme.accent)以保证在浅色/深色主题下白色字形都有对比度。
 */
export const ACTIVITY_ICON_COLOR = {
  neutral: "#3F3F46",
  positive: "#34A853",
  alert: "#E08A2B",
} as const;

export const NOTIF_ICON_MAP: Record<string, { name: string; color: string }> = {
  like: { name: "heart", color: ACTIVITY_ICON_COLOR.alert },
  comment: { name: "chatbubble", color: ACTIVITY_ICON_COLOR.neutral },
  follow: { name: "person-add", color: ACTIVITY_ICON_COLOR.positive },
  mention: { name: "at", color: ACTIVITY_ICON_COLOR.neutral },
  collection: { name: "briefcase-outline", color: ACTIVITY_ICON_COLOR.neutral },
  system: { name: "notifications", color: ACTIVITY_ICON_COLOR.neutral },
};

/**
 * 交易 / 订单类通知（后端统一发 `system` 类型）按标题关键词细分图标,
 * 否则物流列表里全是一模一样的橙色铃铛,无法一眼区分事件。
 *
 * 与 notificationService 的分类逻辑一致,走「标题关键词」匹配(后端标题为
 * 固定中文文案);同时带上英文关键词,兼容未来标题本地化。规则按数组顺序
 * 命中第一条即返回,因此把更具体的短语(如「尽快发货」「确认收货」)排在
 * 通用词(如「已发货」「已签收」)之后不影响——这里已确保彼此不交叉误伤。
 */
export const ORDER_EVENT_ICON_RULES: {
  kws: string[];
  icon: { name: string; color: string };
}[] = [
  // 付款
  { kws: ["已付款", "支付成功", "付款", "paid"], icon: { name: "card", color: ACTIVITY_ICON_COLOR.positive } },
  // 发货(卖家已发货)
  { kws: ["已发货", "shipped"], icon: { name: "cube", color: ACTIVITY_ICON_COLOR.neutral } },
  // 签收(包裹已签收)
  { kws: ["已签收", "签收", "delivered"], icon: { name: "checkmark-done-circle", color: ACTIVITY_ICON_COLOR.positive } },
  // 交易完成
  { kws: ["交易已完成", "已完成", "completed"], icon: { name: "ribbon", color: ACTIVITY_ICON_COLOR.positive } },
  // 结算 / 入账 / 提现
  { kws: ["结算", "入账", "到账", "提现", "钱包", "settle", "payout", "wallet"], icon: { name: "wallet", color: ACTIVITY_ICON_COLOR.neutral } },
  // 取消 / 超时
  { kws: ["取消", "超时", "cancel"], icon: { name: "close-circle", color: ACTIVITY_ICON_COLOR.alert } },
  // 物流异常 / 停更
  { kws: ["停止更新", "物流异常", "异常", "stuck"], icon: { name: "warning", color: ACTIVITY_ICON_COLOR.alert } },
  // 催发货提醒
  { kws: ["尽快发货", "催发货", "逾期未发货", "请发货"], icon: { name: "alarm", color: ACTIVITY_ICON_COLOR.alert } },
  // 确认收货提醒
  { kws: ["确认收货", "自动确认", "即将自动", "reminder"], icon: { name: "time", color: ACTIVITY_ICON_COLOR.alert } },
];
