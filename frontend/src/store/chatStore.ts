import { create } from "zustand";
import {
  Conversation,
  Message,
  chatWS,
  getConversations,
  getMessages,
  getUnreadCount,
  deleteConversation as deleteConversationApi,
  deleteConversationsBatch as deleteConversationsBatchApi,
  markConversationRead as markConversationReadApi,
  markConversationUnread as markConversationUnreadApi,
  WSIncomingMessage,
} from "../services/chatService";
import { getBlockedUsers } from "../services/moderationService";

interface ChatState {
  conversations: Conversation[];
  currentConversationId: number | null;
  messages: Record<number, Message[]>;
  hasMoreMessages: Record<number, boolean>;
  totalUnread: number;
  isLoadingConversations: boolean;
  isLoadingMessages: boolean;
  deletingConversationIds: Set<number>;
  wsConnected: boolean;
  blockedUserIds: Set<number>;
}

interface ChatActions {
  loadConversations: () => Promise<void>;
  loadMessages: (conversationId: number, beforeId?: number) => Promise<void>;
  refreshUnreadCount: () => Promise<void>;
  refreshBlockedUsers: () => Promise<void>;
  setCurrentConversation: (id: number | null) => void;
  addMessage: (conversationId: number, message: Message) => void;
  connectWebSocket: () => void;
  disconnectWebSocket: () => void;
  handleWSMessage: (msg: WSIncomingMessage) => void;
  markConversationRead: (conversationId: number) => Promise<void>;
  removeConversation: (conversationId: number) => Promise<void>;
  removeConversationsBatch: (conversationIds: number[]) => Promise<void>;
  toggleConversationRead: (conversationId: number) => Promise<void>;
}

type ChatStore = ChatState & ChatActions;

let wsCleanup: (() => void) | null = null;

export const useChatStore = create<ChatStore>()((set, get) => ({
  conversations: [],
  currentConversationId: null,
  messages: {},
  hasMoreMessages: {},
  totalUnread: 0,
  isLoadingConversations: false,
  isLoadingMessages: false,
  deletingConversationIds: new Set<number>(),
  wsConnected: false,
  blockedUserIds: new Set<number>(),

  loadConversations: async () => {
    set({ isLoadingConversations: true });
    try {
      const data = await getConversations();
      // Merge: if local state already marked a conversation as read
      // (unreadCount 0) and no newer message has arrived on the server
      // (lastMessageAt unchanged), preserve the local 0. This guards
      // against the race where the user opens a chat (optimistic
      // unread=0), pops back before the mark-read REST round-trip
      // finishes, and the re-fetch would otherwise resurrect the badge.
      set((state) => {
        const prevMap = new Map(
          state.conversations.map((c) => [c.id, c] as const)
        );
        const merged = data.map((incoming) => {
          const prev = prevMap.get(incoming.id);
          if (
            prev &&
            prev.unreadCount === 0 &&
            prev.lastMessageAt === incoming.lastMessageAt
          ) {
            return { ...incoming, unreadCount: 0 };
          }
          return incoming;
        });
        return { conversations: merged };
      });
    } catch (e) {
      console.error("Failed to load conversations:", e);
    } finally {
      set({ isLoadingConversations: false });
    }
  },

  loadMessages: async (conversationId: number, beforeId?: number) => {
    set({ isLoadingMessages: true });
    try {
      const PAGE_SIZE = 50;
      const newMsgs = await getMessages(conversationId, PAGE_SIZE, beforeId);
      set((state) => {
        const existing = beforeId ? (state.messages[conversationId] || []) : [];
        const merged = beforeId ? [...newMsgs, ...existing] : newMsgs;
        return {
          messages: { ...state.messages, [conversationId]: merged },
          hasMoreMessages: {
            ...state.hasMoreMessages,
            [conversationId]: newMsgs.length >= PAGE_SIZE,
          },
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

  refreshBlockedUsers: async () => {
    try {
      const users = await getBlockedUsers();
      set({ blockedUserIds: new Set(users.map((u) => u.userId)) });
    } catch (e) {
      console.error("Failed to refresh blocked users:", e);
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
            myMessageCount: message.isMine
              ? (c.myMessageCount ?? 0) + 1
              : c.myMessageCount,
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

  markConversationRead: async (conversationId) => {
    // Always broadcast via WS so other tabs/devices update in realtime.
    // Note: WS send is fire-and-forget and is silently dropped when the
    // socket is still CONNECTING (common right after entering Chat screen),
    // so we MUST also persist via REST below — otherwise the backend keeps
    // `last_read_at` stale and the unread badge resurrects the next time
    // the conversation list is reloaded.
    chatWS.markRead(conversationId);

    const state = get();
    const conv = state.conversations.find((c) => c.id === conversationId);
    const unreadDelta = conv?.unreadCount || 0;

    if (unreadDelta > 0) {
      set({
        conversations: state.conversations.map((c) =>
          c.id === conversationId ? { ...c, unreadCount: 0 } : c
        ),
        totalUnread: Math.max(0, state.totalUnread - unreadDelta),
      });
    }

    try {
      await markConversationReadApi(conversationId);
    } catch (e) {
      console.error("Failed to persist conversation read state:", e);
    }
  },

  removeConversation: async (conversationId) => {
    set((s) => ({
      deletingConversationIds: new Set(s.deletingConversationIds).add(conversationId),
    }));
    try {
      await deleteConversationApi(conversationId);
      set((state) => {
        const conv = state.conversations.find((c) => c.id === conversationId);
        const unreadDelta = conv?.unreadCount || 0;
        const { [conversationId]: _, ...restMessages } = state.messages;
        const nextDeleting = new Set(state.deletingConversationIds);
        nextDeleting.delete(conversationId);
        return {
          conversations: state.conversations.filter((c) => c.id !== conversationId),
          messages: restMessages,
          totalUnread: Math.max(0, state.totalUnread - unreadDelta),
          deletingConversationIds: nextDeleting,
        };
      });
    } catch (e) {
      set((s) => {
        const nextDeleting = new Set(s.deletingConversationIds);
        nextDeleting.delete(conversationId);
        return { deletingConversationIds: nextDeleting };
      });
      console.error("Failed to delete conversation:", e);
      throw e;
    }
  },

  removeConversationsBatch: async (conversationIds) => {
    const idsSet = new Set(conversationIds);
    set((s) => ({
      deletingConversationIds: new Set([...s.deletingConversationIds, ...idsSet]),
    }));
    try {
      const { deletedIds } = await deleteConversationsBatchApi(conversationIds);
      const deletedSet = new Set(deletedIds);
      set((state) => {
        let unreadDelta = 0;
        const restMessages = { ...state.messages };
        for (const id of deletedIds) {
          const conv = state.conversations.find((c) => c.id === id);
          unreadDelta += conv?.unreadCount || 0;
          delete restMessages[id];
        }
        const nextDeleting = new Set(state.deletingConversationIds);
        for (const id of conversationIds) nextDeleting.delete(id);
        return {
          conversations: state.conversations.filter((c) => !deletedSet.has(c.id)),
          messages: restMessages,
          totalUnread: Math.max(0, state.totalUnread - unreadDelta),
          deletingConversationIds: nextDeleting,
        };
      });
    } catch (e) {
      set((s) => {
        const nextDeleting = new Set(s.deletingConversationIds);
        for (const id of conversationIds) nextDeleting.delete(id);
        return { deletingConversationIds: nextDeleting };
      });
      console.error("Failed to batch delete conversations:", e);
      throw e;
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
      case "new_message": {
        const senderId = msg.data.senderId;
        if (state.blockedUserIds.has(senderId)) return;
        state.addMessage(msg.data.conversationId, msg.data);
        break;
      }
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
    get().refreshBlockedUsers();
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
