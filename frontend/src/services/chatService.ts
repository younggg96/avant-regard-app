/**
 * Chat service
 * REST API calls + WebSocket real-time messaging
 */

import { useAuthStore } from "../store/authStore";
import { config } from "../config/env";

const API_BASE = config.EXPO_PUBLIC_API_BASE_URL;

// ======================= Types =======================

interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

export interface ConversationParticipant {
  userId: number;
  username: string;
  avatarUrl: string | null;
  primaryTitle?: string | null;
}

/** 对端相对当前用户的角色（由后端按订单 / 出价 / 商品归属推导）。 */
export type CounterpartRole = "buyer" | "seller";

/**
 * 会话的交易上下文（后端推导）。用于把「交易 / 帖子 / 活动相关」会话归入
 * 互动页「交易」tab，并在列表行直接展示商品封面图 + 买家 / 订单状态标识。
 */
export interface TradeContext {
  /** 会话内是否出现过交易 / 分享类卡片 */
  isTrade: boolean;
  /** 关联商品 / 内容封面图 */
  coverImage?: string | null;
  /** 对端角色：buyer = 对方是买家（我是卖家）；seller = 对方是卖家（我是买家） */
  counterpartRole?: CounterpartRole | null;
  /** 我作为买家时关联订单的实时状态（如 paid / shipped） */
  orderStatus?: string | null;
  /** 触发归类的卡片类型 */
  kind?: string | null;
}

export interface Conversation {
  id: number;
  participants: ConversationParticipant[];
  lastMessageText: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  otherUser: ConversationParticipant | null;
  updatedAt: string;
  /** Number of messages the current user has sent; 0 = stranger conversation. */
  myMessageCount?: number;
  /** 交易上下文；非交易会话为 null/undefined */
  tradeContext?: TradeContext | null;
}

/** 会话是否属于「交易 / 帖子 / 活动相关」（归入互动页「交易」tab）。 */
export function isTradeConversation(c: Conversation): boolean {
  return !!c.tradeContext?.isTrade;
}

export interface Message {
  id: number;
  conversationId: number;
  senderId: number;
  senderName: string;
  senderAvatar: string | null;
  senderTitle?: string;
  content: string;
  messageType: string;
  createdAt: string;
  isDeleted: boolean;
  isMine: boolean;
}

export type WSIncomingMessage =
  | { type: "new_message"; data: Message }
  | { type: "message_sent"; data: Message }
  | { type: "message_deleted"; data: { messageId: number; conversationId: number } }
  | { type: "conversation_read"; conversation_id: number }
  | { type: "pong" }
  | { type: "error"; message: string };

// ======================= HTTP helpers =======================

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "*/*",
    ...((options.headers as Record<string, string>) || {}),
  };

  const token = useAuthStore.getState().getAccessToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(url, { ...options, headers });
  const contentType = response.headers.get("content-type");

  if (!response.ok) {
    let msg = "Request failed";
    if (contentType?.includes("application/json")) {
      const err = await response.json();
      msg = err.message || err.error || msg;
    }
    throw new Error(msg);
  }

  if (contentType?.includes("application/json")) {
    const json = await response.json();
    if (json && typeof json === "object" && "code" in json) {
      const api = json as ApiResponse<T>;
      if (api.code !== 0) throw new Error(api.message || "Request failed");
      if ("data" in api) return api.data;
    }
    return json as T;
  }

  return (await response.text()) as unknown as T;
}

// ======================= REST API =======================

export async function getConversations(): Promise<Conversation[]> {
  return request<Conversation[]>("/api/chat/conversations");
}

export async function createConversation(
  targetUserId: number
): Promise<{ conversationId: number }> {
  return request<{ conversationId: number }>("/api/chat/conversations", {
    method: "POST",
    body: JSON.stringify({ target_user_id: targetUserId }),
  });
}

export async function getMessages(
  conversationId: number,
  limit = 50,
  beforeId?: number
): Promise<Message[]> {
  let url = `/api/chat/conversations/${conversationId}/messages?limit=${limit}`;
  if (beforeId) url += `&before_id=${beforeId}`;
  return request<Message[]>(url);
}

export async function sendMessageREST(
  conversationId: number,
  content: string,
  messageType = "text"
): Promise<Message> {
  return request<Message>(
    `/api/chat/conversations/${conversationId}/messages`,
    {
      method: "POST",
      body: JSON.stringify({ content, message_type: messageType }),
    }
  );
}

export async function markConversationRead(
  conversationId: number
): Promise<void> {
  await request(`/api/chat/conversations/${conversationId}/read`, {
    method: "POST",
  });
}

export async function markConversationUnread(
  conversationId: number
): Promise<void> {
  await request(`/api/chat/conversations/${conversationId}/unread`, {
    method: "POST",
  });
}

export async function deleteConversation(
  conversationId: number
): Promise<void> {
  await request(`/api/chat/conversations/${conversationId}`, {
    method: "DELETE",
  });
}

export async function deleteMessage(messageId: number): Promise<void> {
  await request(`/api/chat/messages/${messageId}`, {
    method: "DELETE",
  });
}

export async function deleteConversationsBatch(
  conversationIds: number[]
): Promise<{ deletedIds: number[] }> {
  return request<{ deletedIds: number[] }>(
    "/api/chat/conversations/batch-delete",
    {
      method: "POST",
      body: JSON.stringify({ conversation_ids: conversationIds }),
    }
  );
}

export async function getUnreadCount(): Promise<number> {
  const data = await request<{ count: number }>("/api/chat/unread-count");
  return data.count;
}

// ======================= WebSocket =======================

type WSMessageHandler = (msg: WSIncomingMessage) => void;

class ChatWebSocket {
  private ws: WebSocket | null = null;
  private handlers: Set<WSMessageHandler> = new Set();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private _isConnecting = false;

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN || this._isConnecting) return;

    const token = useAuthStore.getState().getAccessToken();
    if (!token) return;

    this._isConnecting = true;
    const wsBase = API_BASE.replace(/^http/, "ws");
    const url = `${wsBase}/api/chat/ws?token=${encodeURIComponent(token)}`;

    try {
      this.ws = new WebSocket(url);
    } catch {
      this._isConnecting = false;
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this._isConnecting = false;
      this.reconnectAttempts = 0;
      this.startPing();
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as WSIncomingMessage;
        this.handlers.forEach((h) => h(msg));
      } catch {
        // ignore parse errors
      }
    };

    this.ws.onclose = () => {
      this._isConnecting = false;
      this.stopPing();
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      this._isConnecting = false;
    };
  }

  disconnect() {
    this.stopPing();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempts = this.maxReconnectAttempts;
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
  }

  send(data: Record<string, unknown>) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  sendMessage(conversationId: number, content: string, messageType = "text") {
    this.send({
      type: "send_message",
      conversation_id: conversationId,
      content,
      message_type: messageType,
    });
  }

  markRead(conversationId: number) {
    this.send({ type: "mark_read", conversation_id: conversationId });
  }

  onMessage(handler: WSMessageHandler) {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  get isConnected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private startPing() {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      this.send({ type: "ping" });
    }, 30000);
  }

  private stopPing() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }
}

export const chatWS = new ChatWebSocket();

export const chatService = {
  getConversations,
  createConversation,
  getMessages,
  sendMessageREST,
  markConversationRead,
  markConversationUnread,
  deleteConversation,
  deleteConversationsBatch,
  deleteMessage,
  getUnreadCount,
  chatWS,
};

export default chatService;
