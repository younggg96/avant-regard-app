/**
 * 通知全局状态 (zustand)
 *
 * Why: 互动页的入口 (ActivityEntry / SystemEntry)、互动消息详情页 (Activity)、
 * Tab Bar 角标 (App.tsx)、以及 Chat 页面都需要读写同一份通知数据。
 * 之前每个页面各自 `useState` + `getAllNotifications`，导致：
 *   1. Tab 角标最长要等 30 秒 polling 才刷新
 *   2. 在详情页点击「全部已读」后，回到互动页入口上的红点还在
 *   3. 打开一个聊天后，该聊天对应的「XX 发来了一条消息」通知仍然记为未读
 *
 * 统一到一个 store 后：任意页面调用 markRead / markManyRead / markChatNotificationsRead，
 * 所有消费方都会立刻同步。
 */

import { create } from "zustand";
import {
  Notification,
  getAllNotifications,
  getUnreadCount,
  markAsRead as markNotifReadApi,
  markAllAsRead as markAllNotifsReadApi,
} from "../services/notificationService";

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  isInitialLoaded: boolean;
}

interface NotificationActions {
  loadNotifications: () => Promise<void>;
  refreshUnreadCount: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markManyRead: (ids: string[]) => Promise<void>;
  markAllRead: () => Promise<void>;
  /**
   * 把某个会话相关的聊天通知全部标已读。
   * 用于 Chat 屏打开时清理「XX 发来了一条消息」这类通知。
   */
  markChatNotificationsRead: (conversationId: number) => Promise<void>;
  reset: () => void;
}

type NotificationStore = NotificationState & NotificationActions;

const sortByCreatedAtDesc = (list: Notification[]): Notification[] =>
  [...list].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

const computeUnread = (list: Notification[]): number =>
  list.filter((n) => !n.isRead).length;

export const useNotificationStore = create<NotificationStore>()((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isInitialLoaded: false,

  loadNotifications: async () => {
    try {
      const raw = await getAllNotifications();
      const sorted = sortByCreatedAtDesc(raw);
      set({
        notifications: sorted,
        unreadCount: computeUnread(sorted),
        isInitialLoaded: true,
      });
    } catch (e) {
      console.error("Failed to load notifications:", e);
      set({ isInitialLoaded: true });
    }
  },

  refreshUnreadCount: async () => {
    try {
      const count = await getUnreadCount();
      set({ unreadCount: count });
    } catch (e) {
      console.error("Failed to refresh notification unread count:", e);
    }
  },

  markRead: async (id) => {
    const state = get();
    const target = state.notifications.find((n) => n.id === id);
    if (!target || target.isRead) return;

    set({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, isRead: true } : n
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    });

    try {
      await markNotifReadApi(id);
    } catch (e) {
      console.error("Failed to mark notification read:", e);
    }
  },

  markManyRead: async (ids) => {
    if (ids.length === 0) return;

    const state = get();
    const idSet = new Set(ids);
    const affected = state.notifications.filter(
      (n) => idSet.has(n.id) && !n.isRead
    );
    if (affected.length === 0) return;

    set({
      notifications: state.notifications.map((n) =>
        idSet.has(n.id) && !n.isRead ? { ...n, isRead: true } : n
      ),
      unreadCount: Math.max(0, state.unreadCount - affected.length),
    });

    await Promise.all(
      affected.map((n) =>
        markNotifReadApi(n.id).catch((e) =>
          console.error("Failed to mark notification read:", e)
        )
      )
    );
  },

  markAllRead: async () => {
    const state = get();
    if (state.unreadCount === 0) return;

    set({
      notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
      unreadCount: 0,
    });

    try {
      await markAllNotifsReadApi();
    } catch (e) {
      console.error("Failed to mark all notifications read:", e);
    }
  },

  markChatNotificationsRead: async (conversationId) => {
    const state = get();
    const targets = state.notifications.filter((n) => {
      if (n.isRead) return false;
      if (n.actionData?.navigateTo !== "Chat") return false;
      const cid = n.actionData?.navigateParams?.conversationId as
        | number
        | string
        | undefined;
      if (cid === undefined || cid === null) return false;
      return String(cid) === String(conversationId);
    });
    if (targets.length === 0) return;

    const ids = new Set(targets.map((t) => t.id));
    set({
      notifications: state.notifications.map((n) =>
        ids.has(n.id) ? { ...n, isRead: true } : n
      ),
      unreadCount: Math.max(0, state.unreadCount - targets.length),
    });

    await Promise.all(
      targets.map((t) =>
        markNotifReadApi(t.id).catch((e) =>
          console.error("Failed to mark chat notification read:", e)
        )
      )
    );
  },

  reset: () => {
    set({ notifications: [], unreadCount: 0, isInitialLoaded: false });
  },
}));
