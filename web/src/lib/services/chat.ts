/**
 * Chat service (web) — REST-only.
 *
 * WebSocket support is intentionally omitted from the first web port; the
 * message list polls / SWR-revalidates on focus instead. Adding WS later is a
 * drop-in: just import `chatService.ws = new ChatWebSocket(...)` and merge.
 */

import { apiClient } from "../api-client";

export interface ConversationParticipant {
  userId: number;
  username: string;
  avatarUrl: string | null;
  primaryTitle?: string | null;
}

export interface Conversation {
  id: number;
  participants: ConversationParticipant[];
  lastMessageText: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  otherUser: ConversationParticipant | null;
  updatedAt: string;
  myMessageCount?: number;
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

export const chatService = {
  getConversations: () =>
    apiClient.get<Conversation[]>("/api/chat/conversations"),

  createConversation: (targetUserId: number) =>
    apiClient.post<{ conversationId: number }>("/api/chat/conversations", {
      target_user_id: targetUserId,
    }),

  getMessages: (conversationId: number, limit = 50, beforeId?: number) => {
    const query: Record<string, unknown> = { limit };
    if (beforeId) query.before_id = beforeId;
    return apiClient.get<Message[]>(
      `/api/chat/conversations/${conversationId}/messages`,
      query,
    );
  },

  sendMessage: (
    conversationId: number,
    content: string,
    messageType = "text",
  ) =>
    apiClient.post<Message>(
      `/api/chat/conversations/${conversationId}/messages`,
      { content, message_type: messageType },
    ),

  markRead: (conversationId: number) =>
    apiClient.post<void>(
      `/api/chat/conversations/${conversationId}/read`,
    ),

  markUnread: (conversationId: number) =>
    apiClient.post<void>(
      `/api/chat/conversations/${conversationId}/unread`,
    ),

  deleteConversation: (conversationId: number) =>
    apiClient.delete<void>(`/api/chat/conversations/${conversationId}`),

  getUnreadCount: () =>
    apiClient.get<{ count: number }>("/api/chat/unread-count"),
};
