/**
 * Human-readable previews for chat list / push notifications.
 *
 * Card messages store JSON in `content`; the DB trigger copies raw JSON into
 * `conversations.last_message_text`. We sniff the payload shape here when
 * `messageType` is unavailable.
 *
 * Keep in sync with:
 *   - backend/app/services/chat_service.py::format_chat_message_preview
 *   - web/src/lib/chatShareCards.ts::summarizeSharePayload
 */
import i18n from "../i18n";

type CardType =
  | "post_card"
  | "store_card"
  | "brand_card"
  | "show_card"
  | "user_card"
  | "product_listing"
  | "offer"
  | "order_status"
  | "dispute"
  | "image";

const LABEL_KEYS: Record<CardType, string> = {
  post_card: "chat.sharePost",
  store_card: "chat.shareStore",
  brand_card: "chat.shareBrand",
  show_card: "chat.shareShow",
  user_card: "chat.shareUser",
  product_listing: "chat.previewProduct",
  offer: "chat.previewOffer",
  order_status: "chat.previewOrder",
  dispute: "chat.previewDispute",
  image: "chat.previewImage",
};

function safeJson(content: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(content);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function inferCardType(parsed: Record<string, unknown>): CardType | null {
  if (typeof parsed.postId === "string") return "post_card";
  if (typeof parsed.storeId === "string") return "store_card";
  if (typeof parsed.brandId === "number") return "brand_card";
  if (typeof parsed.showId === "string") return "show_card";
  if (
    typeof parsed.userId === "number" &&
    typeof parsed.username === "string"
  ) {
    return "user_card";
  }
  if (typeof parsed.disputeId === "number") return "dispute";
  if (typeof parsed.offerId === "number") return "offer";
  if (typeof parsed.orderId === "number" && typeof parsed.orderNo === "string") {
    return "order_status";
  }
  if (typeof parsed.productId === "number" && typeof parsed.title === "string") {
    return "product_listing";
  }
  return null;
}

function nestedProductTitle(parsed: Record<string, unknown>): string | null {
  const product = parsed.product;
  if (!product || typeof product !== "object" || Array.isArray(product)) {
    return null;
  }
  const title = (product as Record<string, unknown>).title;
  return typeof title === "string" && title.trim() ? title.trim() : null;
}

function extractDetail(
  cardType: CardType,
  parsed: Record<string, unknown>,
): string | null {
  switch (cardType) {
    case "product_listing": {
      const title = parsed.title;
      return typeof title === "string" && title.trim() ? title.trim() : null;
    }
    case "offer":
      return nestedProductTitle(parsed);
    case "order_status": {
      const orderNo = parsed.orderNo;
      return typeof orderNo === "string" && orderNo.trim()
        ? orderNo.trim()
        : null;
    }
    case "dispute": {
      const reason = parsed.reason;
      return typeof reason === "string" && reason.trim() ? reason.trim() : null;
    }
    default:
      for (const key of ["title", "name", "brandName", "username"] as const) {
        const value = parsed[key];
        if (typeof value === "string" && value.trim()) return value.trim();
      }
      return null;
  }
}

function orderStatusLabel(parsed: Record<string, unknown>): string | null {
  const status = parsed.status;
  if (typeof status !== "string" || !status) return null;
  const key = `trading.orderStatus.${status}`;
  const translated = i18n.t(key);
  return translated !== key ? translated : null;
}

function formatCardPreview(cardType: CardType, parsed: Record<string, unknown>): string {
  const detail = extractDetail(cardType, parsed);

  if (cardType === "product_listing" && detail) {
    return i18n.t("chat.previewProduct", { title: detail });
  }
  if (cardType === "offer") {
    return detail
      ? i18n.t("chat.previewOfferWithTitle", { title: detail })
      : i18n.t("chat.previewOffer");
  }
  if (cardType === "order_status" && detail) {
    const statusLabel = orderStatusLabel(parsed);
    if (statusLabel) {
      return i18n.t("chat.previewOrderWithStatus", {
        orderNo: detail,
        status: statusLabel,
        defaultValue: `${i18n.t("chat.previewOrder", { orderNo: detail })} · ${statusLabel}`,
      });
    }
    return i18n.t("chat.previewOrder", { orderNo: detail });
  }
  if (cardType === "dispute" && detail) {
    return i18n.t("chat.previewDispute", { reason: detail });
  }

  const labelKey = LABEL_KEYS[cardType];
  const label = i18n.t(labelKey);
  return detail ? `${label} ${detail}` : label;
}

export function formatChatMessagePreview(
  content: string | null | undefined,
  messageType?: string | null,
): string {
  if (!content) return "";

  const trimmed = content.trimStart();
  const looksLikeJson = trimmed.startsWith("{");
  const parsed = looksLikeJson ? safeJson(trimmed) : null;

  const resolvedType: CardType | null =
    (messageType && messageType in LABEL_KEYS
      ? (messageType as CardType)
      : null) ?? (parsed ? inferCardType(parsed) : null);

  if (resolvedType && parsed) {
    return formatCardPreview(resolvedType, parsed);
  }

  if (resolvedType && !parsed) {
    return i18n.t(LABEL_KEYS[resolvedType]);
  }

  return content;
}

/** Conversation list helper — includes empty-state fallback. */
export function formatLastMessage(
  text: string | null,
  emptyFallbackKey = "chat.noMessages",
): string {
  if (!text) return i18n.t(emptyFallbackKey);
  const preview = formatChatMessagePreview(text);
  return preview || i18n.t(emptyFallbackKey);
}
