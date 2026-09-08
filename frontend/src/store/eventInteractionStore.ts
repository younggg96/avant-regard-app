/**
 * 活动收藏 / 预约 的跨页面同步状态。
 *
 * 日历弹层、近期活动列表、活动详情页、「我 → 收藏 → 活动」四处都会展示同一个
 * 活动的收藏 / 预约按钮；这里做一层 id → 状态的覆盖表，任何一处切换后其他
 * 页面立即一致，不必等各自重新拉数据。
 */
import { create } from "zustand";
import {
  EventSummary,
  toggleEventFavorite,
  toggleEventReservation,
} from "../services/eventService";

interface EventFlags {
  isFavorited?: boolean;
  isReserved?: boolean;
  favoriteCount?: number;
  reservationCount?: number;
}

interface EventInteractionState {
  flags: Record<number, EventFlags>;
  pending: Record<number, boolean>;
  /** 用服务端返回的列表 / 详情覆盖本地缓存 */
  syncFromEvents: (events: Pick<EventSummary, "id" | "isFavorited" | "isReserved" | "favoriteCount" | "reservationCount">[]) => void;
  resolve: <T extends EventSummary>(event: T) => T;
  toggleFavorite: (eventId: number) => Promise<boolean>;
  toggleReservation: (eventId: number) => Promise<boolean>;
  reset: () => void;
}

export const useEventInteractionStore = create<EventInteractionState>((set, get) => ({
  flags: {},
  pending: {},

  syncFromEvents: (events) => {
    if (!events.length) return;
    const next = { ...get().flags };
    for (const e of events) {
      next[e.id] = {
        isFavorited: e.isFavorited,
        isReserved: e.isReserved,
        favoriteCount: e.favoriteCount,
        reservationCount: e.reservationCount,
      };
    }
    set({ flags: next });
  },

  resolve: (event) => {
    const f = get().flags[event.id];
    if (!f) return event;
    return {
      ...event,
      isFavorited: f.isFavorited ?? event.isFavorited,
      isReserved: f.isReserved ?? event.isReserved,
      favoriteCount: f.favoriteCount ?? event.favoriteCount,
      reservationCount: f.reservationCount ?? event.reservationCount,
    };
  },

  toggleFavorite: async (eventId) => {
    if (get().pending[eventId]) return get().flags[eventId]?.isFavorited ?? false;
    const prev = get().flags[eventId] ?? {};
    const optimistic = !(prev.isFavorited ?? false);
    set({
      pending: { ...get().pending, [eventId]: true },
      flags: {
        ...get().flags,
        [eventId]: {
          ...prev,
          isFavorited: optimistic,
          favoriteCount: Math.max(0, (prev.favoriteCount ?? 0) + (optimistic ? 1 : -1)),
        },
      },
    });
    try {
      const res = await toggleEventFavorite(eventId);
      set({
        flags: {
          ...get().flags,
          [eventId]: { ...get().flags[eventId], isFavorited: res.isFavorited, favoriteCount: res.favoriteCount },
        },
      });
      return res.isFavorited;
    } catch (e) {
      set({ flags: { ...get().flags, [eventId]: prev } });
      throw e;
    } finally {
      const { [eventId]: _omit, ...rest } = get().pending;
      set({ pending: rest });
    }
  },

  toggleReservation: async (eventId) => {
    if (get().pending[eventId]) return get().flags[eventId]?.isReserved ?? false;
    const prev = get().flags[eventId] ?? {};
    const optimistic = !(prev.isReserved ?? false);
    set({
      pending: { ...get().pending, [eventId]: true },
      flags: {
        ...get().flags,
        [eventId]: {
          ...prev,
          isReserved: optimistic,
          reservationCount: Math.max(0, (prev.reservationCount ?? 0) + (optimistic ? 1 : -1)),
        },
      },
    });
    try {
      const res = await toggleEventReservation(eventId);
      set({
        flags: {
          ...get().flags,
          [eventId]: { ...get().flags[eventId], isReserved: res.isReserved, reservationCount: res.reservationCount },
        },
      });
      return res.isReserved;
    } catch (e) {
      set({ flags: { ...get().flags, [eventId]: prev } });
      throw e;
    } finally {
      const { [eventId]: _omit, ...rest } = get().pending;
      set({ pending: rest });
    }
  },

  reset: () => set({ flags: {}, pending: {} }),
}));

/** 便捷 hook：把一条活动摘要与本地覆盖状态合并 */
export const useResolvedEvent = <T extends EventSummary>(event: T): T => {
  const f = useEventInteractionStore((s) => s.flags[event.id]);
  if (!f) return event;
  return {
    ...event,
    isFavorited: f.isFavorited ?? event.isFavorited,
    isReserved: f.isReserved ?? event.isReserved,
    favoriteCount: f.favoriteCount ?? event.favoriteCount,
    reservationCount: f.reservationCount ?? event.reservationCount,
  };
};
