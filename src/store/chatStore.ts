import { create } from "zustand";
import {
  Conversation,
  Message,
  chatWS,
  getConversations,
  getMessages,
  getUnreadCount,
  deleteConversation as deleteConversationApi,
  markConversationRead as markConversationReadApi,
  markConversationUnread as markConversationUnreadApi,
  WSIncomingMessage,
} from "../services/chatService";

interface ChatState {
  conversations: Conversation[];
  currentConversationId: number | null;
  messages: Record<number, Message[]>;
  totalUnread: number;
  isLoadingConversations: boolean;
  isLoadingMessages: boolean;
  wsConnected: boolean;
}

interface ChatActions {
  loadConversations: () => Promise<void>;
  loadMessages: (conversationId: number, beforeId?: number) => Promise<void>;
  refreshUnreadCount: () => Promise<void>;
  setCurrentConversation: (id: number | null) => void;
  addMessage: (conversationId: number, message: Message) => void;
  connectWebSocket: () => void;
  disconnectWebSocket: () => void;
  handleWSMessage: (msg: WSIncomingMessage) => void;
  markConversationRead: (conversationId: number) => void;
  removeConversation: (conversationId: number) => Promise<void>;
  toggleConversationRead: (conversationId: number) => Promise<void>;
}

type ChatStore = ChatState & ChatActions;

let wsCleanup: (() => void) | null = null;

export const useChatStore = create<ChatStore>()((set, get) => ({
  conversations: [],
  currentConversationId: null,
  messages: {},
  totalUnread: 0,
  isLoadingConversations: false,
  isLoadingMessages: false,
  wsConnected: false,

  loadConversations: async () => {
    set({ isLoadingConversations: true });
    try {
      const data = await getConversations();
      set({ conversations: data });
    } catch (e) {
      console.error("Failed to load conversations:", e);
    } finally {
      set({ isLoadingConversations: false });
    }
  },

  loadMessages: async (conversationId: number, beforeId?: number) => {
    set({ isLoadingMessages: true });
    try {
      const newMsgs = await getMessages(conversationId, 50, beforeId);
      set((state) => {
        const existing = beforeId ? (state.messages[conversationId] || []) : [];
        const merged = beforeId ? [...newMsgs, ...existing] : newMsgs;
        return {
          messages: { ...state.messages, [conversationId]: merged },
        };
      });
    } catch (e) {
      console.error("Failed to load messages:", e);
    } finally {
      set({ isLoadingMessages: false });
    }
  },

  refreshUnreadCount: async () => {
    try {
      const count = await getUnreadCount();
      set({ totalUnread: count });
    } catch (e) {
      console.error("Failed to refresh unread count:", e);
    }
  },

  setCurrentConversation: (id) => {
    set({ currentConversationId: id });
  },

  addMessage: (conversationId, message) => {
    set((state) => {
      const existing = state.messages[conversationId] || [];
      const isDuplicate = existing.some((m) => m.id === message.id);
      if (isDuplicate) return state;

      const conversations = state.conversations.map((c) => {
        if (c.id === conversationId) {
          return {
            ...c,
            lastMessageText: message.content,
            lastMessageAt: message.createdAt,
            unreadCount: message.isMine ? c.unreadCount : c.unreadCount + 1,
          };
        }
        return c;
      });

      conversations.sort((a, b) => {
        const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return tb - ta;
      });

      return {
        messages: {
          ...state.messages,
          [conversationId]: [...existing, message],
        },
        conversations,
        totalUnread: message.isMine
          ? state.totalUnread
          : state.totalUnread + 1,
      };
    });
  },

  markConversationRead: (conversationId) => {
    chatWS.markRead(conversationId);
    set((state) => {
      const conv = state.conversations.find((c) => c.id === conversationId);
      const unreadDelta = conv?.unreadCount || 0;
      return {
        conversations: state.conversations.map((c) =>
          c.id === conversationId ? { ...c, unreadCount: 0 } : c
        ),
        totalUnread: Math.max(0, state.totalUnread - unreadDelta),
      };
    });
  },

  removeConversation: async (conversationId) => {
    try {
      await deleteConversationApi(conversationId);
      set((state) => {
        const conv = state.conversations.find((c) => c.id === conversationId);
        const unreadDelta = conv?.unreadCount || 0;
        const { [conversationId]: _, ...restMessages } = state.messages;
        return {
          conversations: state.conversations.filter((c) => c.id !== conversationId),
          messages: restMessages,
          totalUnread: Math.max(0, state.totalUnread - unreadDelta),
        };
      });
    } catch (e) {
      console.error("Failed to delete conversation:", e);
    }
  },

  toggleConversationRead: async (conversationId) => {
    const conv = get().conversations.find((c) => c.id === conversationId);
    if (!conv) return;

    try {
      if (conv.unreadCount > 0) {
        await markConversationReadApi(conversationId);
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === conversationId ? { ...c, unreadCount: 0 } : c
          ),
          totalUnread: Math.max(0, state.totalUnread - conv.unreadCount),
        }));
      } else {
        await markConversationUnreadApi(conversationId);
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === conversationId ? { ...c, unreadCount: 1 } : c
          ),
          totalUnread: state.totalUnread + 1,
        }));
      }
    } catch (e) {
      console.error("Failed to toggle conversation read:", e);
    }
  },

  handleWSMessage: (msg) => {
    const state = get();
    switch (msg.type) {
      case "new_message":
        state.addMessage(msg.data.conversationId, msg.data);
        break;
      case "message_sent":
        state.addMessage(msg.data.conversationId, msg.data);
        break;
      case "conversation_read":
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === msg.conversation_id ? { ...c, unreadCount: 0 } : c
          ),
        }));
        break;
      default:
        break;
    }
  },

  connectWebSocket: () => {
    if (wsCleanup) wsCleanup();
    chatWS.connect();
    wsCleanup = chatWS.onMessage((msg) => {
      get().handleWSMessage(msg);
    });
    set({ wsConnected: true });
  },

  disconnectWebSocket: () => {
    if (wsCleanup) {
      wsCleanup();
      wsCleanup = null;
    }
    chatWS.disconnect();
    set({ wsConnected: false });
  },
}));
