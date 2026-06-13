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

function orderStatusLabel(status: unknown): string | null {
  if (typeof status !== "string" || !status) return null;
  const key = `trading.orderStatus.${status}`;
  const translated = i18n.t(key);
  return translated !== key ? translated : null;
}

function formatCardPreview(
  cardType: CardType,
  parsed: Record<string, unknown>,
  orderStatusOverride?: string | null,
): string {
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
    // 卡片 content 里的 status 是发送时刻的快照（如 pending_payment），
    // 支付后即过期；列表行优先用 tradeContext 携带的订单实时状态覆盖。
    const statusLabel = orderStatusLabel(orderStatusOverride ?? parsed.status);
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
  orderStatusOverride?: string | null,
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
    return formatCardPreview(resolvedType, parsed, orderStatusOverride);
  }

  if (resolvedType && !parsed) {
    return i18n.t(LABEL_KEYS[resolvedType]);
  }

  return content;
}

function formatCents(cents: unknown, currency?: unknown): string | null {
  if (typeof cents !== "number") return null;
  const cur = typeof currency === "string" && currency ? currency : "CNY";
  const amount = (cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: cur === "CNY" ? 0 : 2,
    maximumFractionDigits: 2,
  });
  const prefix = cur === "CNY" ? "¥" : cur === "USD" ? "$" : `${cur} `;
  return `${prefix}${amount}`;
}

function translateEnum(keyPrefix: string, value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  const key = `${keyPrefix}.${value}`;
  const translated = i18n.t(key);
  return translated !== key ? translated : value;
}

function pushLine(lines: string[], key: string, params: Record<string, unknown>) {
  lines.push(i18n.t(key, params));
}

/** Structured audit lines for card payloads — replaces raw JSON in admin views. */
export function formatChatCardAuditLines(
  content: string,
  messageType?: string | null,
): string[] {
  const trimmed = (content || "").trimStart();
  const parsed = trimmed.startsWith("{") ? safeJson(trimmed) : null;
  if (!parsed) return [];

  const resolvedType: CardType | null =
    (messageType && messageType in LABEL_KEYS
      ? (messageType as CardType)
      : null) ?? inferCardType(parsed);
  if (!resolvedType) return [];

  const lines: string[] = [];
  const ns = "admin.chatMonitor.cardDetail";

  switch (resolvedType) {
    case "dispute": {
      if (typeof parsed.disputeId === "number") {
        pushLine(lines, `${ns}.disputeId`, { id: parsed.disputeId });
      }
      if (typeof parsed.orderId === "number") {
        pushLine(lines, `${ns}.orderId`, { id: parsed.orderId });
      }
      const reason = parsed.reason;
      if (typeof reason === "string" && reason.trim()) {
        pushLine(lines, `${ns}.reason`, { value: reason.trim() });
      }
      const status = parsed.status;
      if (typeof status === "string" && status.trim()) {
        pushLine(lines, `${ns}.status`, { value: status.trim() });
      }
      if (parsed.sellerAction === "reject") {
        lines.push(i18n.t(`${ns}.sellerReject`));
      } else if (parsed.sellerAction === "agree_refund") {
        lines.push(i18n.t(`${ns}.sellerAgreeRefund`));
      }
      const note = parsed.note;
      if (typeof note === "string" && note.trim()) {
        pushLine(lines, `${ns}.note`, { value: note.trim() });
      }
      break;
    }
    case "offer": {
      const title = nestedProductTitle(parsed);
      if (title) pushLine(lines, `${ns}.product`, { value: title });
      const price = formatCents(parsed.priceCents, parsed.currency);
      if (price) pushLine(lines, `${ns}.price`, { value: price });
      const status = translateEnum("trading.offerStatus", parsed.status);
      if (status) pushLine(lines, `${ns}.status`, { value: status });
      if (typeof parsed.offerId === "number") {
        pushLine(lines, `${ns}.offerId`, { id: parsed.offerId });
      }
      break;
    }
    case "order_status": {
      const orderNo = parsed.orderNo;
      if (typeof orderNo === "string" && orderNo.trim()) {
        pushLine(lines, `${ns}.orderNo`, { value: orderNo.trim() });
      }
      const status =
        orderStatusLabel(parsed.status) ??
        (typeof parsed.status === "string" ? parsed.status : null);
      if (status) pushLine(lines, `${ns}.status`, { value: status });
      const price = formatCents(parsed.paidPriceCents, parsed.currency);
      if (price) pushLine(lines, `${ns}.price`, { value: price });
      const productTitle = nestedProductTitle(parsed);
      if (productTitle) pushLine(lines, `${ns}.product`, { value: productTitle });
      break;
    }
    case "product_listing": {
      const title = parsed.title;
      if (typeof title === "string" && title.trim()) {
        pushLine(lines, `${ns}.product`, { value: title.trim() });
      }
      const brand = parsed.brand;
      if (typeof brand === "string" && brand.trim()) {
        pushLine(lines, `${ns}.brand`, { value: brand.trim() });
      }
      const price = formatCents(parsed.priceCents, parsed.currency);
      if (price) pushLine(lines, `${ns}.price`, { value: price });
      break;
    }
    case "post_card":
    case "show_card": {
      const title = parsed.title;
      if (typeof title === "string" && title.trim()) {
        pushLine(lines, `${ns}.title`, { value: title.trim() });
      }
      break;
    }
    case "store_card":
    case "brand_card": {
      const name = parsed.name ?? parsed.brandName;
      if (typeof name === "string" && name.trim()) {
        pushLine(lines, `${ns}.name`, { value: name.trim() });
      }
      break;
    }
    case "user_card": {
      const username = parsed.username;
      if (typeof username === "string" && username.trim()) {
        pushLine(lines, `${ns}.user`, { value: username.trim() });
      }
      break;
    }
    case "image":
      lines.push(i18n.t(`${ns}.image`));
      break;
  }

  return lines;
}

/** Conversation list helper — includes empty-state fallback. */
export function formatLastMessage(
  text: string | null,
  emptyFallbackKey = "chat.noMessages",
  orderStatusOverride?: string | null,
): string {
  if (!text) return i18n.t(emptyFallbackKey);
  const preview = formatChatMessagePreview(text, null, orderStatusOverride);
  return preview || i18n.t(emptyFallbackKey);
}
