/**
 * Chat share-card payloads.
 *
 * Mirrors the mobile side (`frontend/src/components/ShareToChatModal.tsx`
 * and `frontend/src/screens/Chat/components/MessageBubble.tsx`):
 *   - when a user shares a post / store / brand / show / profile into a DM,
 *     the mobile client serializes a typed JSON payload into `message.content`
 *     and sets `message.messageType` to one of the `*_card` values;
 *   - the receiver's client parses the JSON by `messageType`, renders a
 *     preview card, and deep-links back to the corresponding detail page.
 *
 * Keeping the payload shapes identical here means the same DM thread renders
 * correctly on web without any server-side translation. Any shape change must
 * land in both places in lockstep — treat this as a shared wire format.
 *
 * The conversation-list preview (`summarizeSharePayload`) matches
 * `backend/app/services/chat_service.py::format_chat_message_preview` and
 * `frontend/src/screens/ChatList/utils.ts::formatLastMessage` so the list /
 * detail / push notification previews stay consistent.
 */

// -------- Payload shapes (must match frontend/src/components/ShareToChatModal.tsx) --------

export interface PostSharePayload {
  postId: string;
  title: string;
  imageUrl?: string;
  authorName: string;
  authorAvatar?: string;
}

export interface StoreSharePayload {
  storeId: string;
  name: string;
  imageUrl?: string;
  city: string;
  country: string;
  rating?: number;
  styles?: string[];
}

export interface BrandSharePayload {
  brandId: number;
  name: string;
  imageUrl?: string;
  country?: string;
  category?: string;
  foundedYear?: string;
  founder?: string;
}

export interface ShowSharePayload {
  showId: string;
  title: string;
  season: string;
  year?: string;
  imageUrl?: string;
  brandName?: string;
  designer?: string;
  category?: string;
}

export interface UserSharePayload {
  userId: number;
  username: string;
  avatarUrl?: string;
  bio?: string;
  location?: string;
  primaryTitle?: string;
}

// -------- Discriminated union returned by parseSharePayload --------

export type ParsedShareCard =
  | { kind: "post"; payload: PostSharePayload }
  | { kind: "store"; payload: StoreSharePayload }
  | { kind: "brand"; payload: BrandSharePayload }
  | { kind: "show"; payload: ShowSharePayload }
  | { kind: "user"; payload: UserSharePayload };

const CARD_TYPE_LABELS: Record<string, string> = {
  post_card: "[帖子分享]",
  store_card: "[店铺分享]",
  brand_card: "[品牌分享]",
  show_card: "[秀场分享]",
  user_card: "[名片分享]",
  image: "[图片]",
};

function safeJson(content: string): unknown {
  if (!content) return null;
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Parse a chat message's `content` into a typed share-card payload when its
 * `messageType` indicates one. Returns null for plain text / malformed JSON /
 * unknown types.
 *
 * The shape validation is defensive: servers that downgrade unknown card
 * types should still fail cleanly to a text bubble rather than crash the
 * chat view.
 */
export function parseSharePayload(
  messageType: string | undefined | null,
  content: string,
): ParsedShareCard | null {
  const parsed = safeJson(content);
  if (!isRecord(parsed)) return null;

  switch (messageType) {
    case "post_card":
      if (typeof parsed.postId === "string" && typeof parsed.title === "string") {
        return { kind: "post", payload: parsed as unknown as PostSharePayload };
      }
      return null;
    case "store_card":
      if (typeof parsed.storeId === "string" && typeof parsed.name === "string") {
        return { kind: "store", payload: parsed as unknown as StoreSharePayload };
      }
      return null;
    case "brand_card":
      if (typeof parsed.brandId === "number" && typeof parsed.name === "string") {
        return { kind: "brand", payload: parsed as unknown as BrandSharePayload };
      }
      return null;
    case "show_card":
      if (typeof parsed.showId === "string" && typeof parsed.title === "string") {
        return { kind: "show", payload: parsed as unknown as ShowSharePayload };
      }
      return null;
    case "user_card":
      if (
        typeof parsed.userId === "number" &&
        typeof parsed.username === "string"
      ) {
        return { kind: "user", payload: parsed as unknown as UserSharePayload };
      }
      return null;
    default:
      return null;
  }
}

/**
 * When `messageType` is not available (the conversations list endpoint only
 * exposes `last_message_text`, not the message type), sniff the card kind by
 * looking for its discriminator key in the parsed JSON. Keep this in sync
 * with the shape of `*SharePayload` above.
 */
function inferCardType(parsed: Record<string, unknown>): string | null {
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
  return null;
}

/**
 * Produce the short human-readable preview shown in conversation lists and
 * push notifications (e.g. `[帖子分享] 2026SS Runway`). Falls back to the raw
 * text when the message isn't a card or the payload is malformed.
 *
 * `messageType` is optional: the conversations list API only returns
 * `last_message_text`, so we sniff the type from the payload shape in that
 * case. Kept in sync with `frontend/src/screens/ChatList/utils.ts` and
 * `backend/app/services/chat_service.py::format_chat_message_preview`.
 */
export function summarizeSharePayload(
  messageType: string | undefined | null,
  content: string | null | undefined,
): string {
  if (!content) return "";

  // Cheap early exit: only attempt JSON work if the text actually looks like
  // a serialized payload.
  const trimmed = content.trimStart();
  const looksLikeJson = trimmed.startsWith("{");
  if (!looksLikeJson && messageType && !CARD_TYPE_LABELS[messageType]) {
    return content;
  }

  const parsed = looksLikeJson ? safeJson(content) : null;
  const resolvedType =
    (messageType && CARD_TYPE_LABELS[messageType] ? messageType : null) ??
    (isRecord(parsed) ? inferCardType(parsed) : null);

  if (!resolvedType) return content;
  const label = CARD_TYPE_LABELS[resolvedType];
  if (!label) return content;

  if (isRecord(parsed)) {
    // Keep this key list aligned with `_extract_card_title` in the backend.
    for (const key of ["title", "name", "brandName", "username"] as const) {
      const value = parsed[key];
      if (typeof value === "string" && value.trim()) {
        return `${label} ${value.trim()}`;
      }
    }
  }
  return label;
}
