import type { Ionicons } from "@expo/vector-icons";
import type { AppTheme } from "../theme";
import type { OrderStatus } from "../services/orderService";

export interface OrderStatusVisual {
  icon: keyof typeof Ionicons.glyphMap;
  bg: string;
  fg: string;
}

/** 订单状态视觉 —— OrderDetail hero 与 OrderCard status pill 共用。 */
export function orderStatusVisual(
  status: OrderStatus,
  t: AppTheme,
): OrderStatusVisual {
  switch (status) {
    case "pending_payment":
      return {
        icon: "wallet-outline",
        bg: t.mode === "dark" ? "#2A2410" : "#FFF8E6",
        fg: t.colors.plusGold,
      };
    case "paid":
      return {
        icon: "cube-outline",
        bg: t.mode === "dark" ? "#1A1A1A" : "#F5F5F5",
        fg: t.colors.text,
      };
    case "shipped":
      return {
        icon: "airplane-outline",
        bg: t.mode === "dark" ? "#101A24" : "#EEF4FF",
        fg: t.mode === "dark" ? "#7EB8FF" : "#2563EB",
      };
    case "delivered":
      return {
        icon: "checkmark-circle-outline",
        bg: t.mode === "dark" ? "#0F1F14" : "#EEFBF2",
        fg: t.colors.success,
      };
    case "completed":
    case "settled":
      return {
        icon: "ribbon-outline",
        bg: t.mode === "dark" ? "#0F1F14" : "#EEFBF2",
        fg: t.colors.success,
      };
    case "refunded":
    case "refunded_auto":
      return {
        icon: "return-down-back-outline",
        bg: t.mode === "dark" ? "#2A1414" : "#FFF5F5",
        fg: t.colors.error,
      };
    default:
      return {
        icon: "document-text-outline",
        bg: t.colors.cardElevated,
        fg: t.colors.text,
      };
  }
}
