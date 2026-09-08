/**
 * 活动日历 客户端 API（PRD 论坛改造 M1 / P0）
 *
 * 后端：backend/app/api/routes/events.py
 */
import { request } from "./http";

export type EventType = "MARKET" | "SALE" | "EXHIBITION" | "POPUP" | "ONLINE";
export type EventStatus = "DRAFT" | "PUBLISHED" | "ENDED" | "HIDDEN";

export const EVENT_TYPES: EventType[] = ["MARKET", "SALE", "EXHIBITION", "POPUP", "ONLINE"];

/**
 * 五类活动的分色。产品整体是黑白灰，这里是日历 / 地图 pin 上唯一允许的
 * 语义色，刻意选低饱和、彼此可区分的色调。
 */
export const EVENT_TYPE_COLORS: Record<EventType, string> = {
  MARKET: "#C0392B",     // 市集 · 砖红
  SALE: "#D68910",       // 特卖会 · 琥珀
  EXHIBITION: "#1F618D", // 展览 · 靛蓝
  POPUP: "#6C3483",      // 快闪 · 紫
  ONLINE: "#117A65",     // 线上 · 墨绿
};

export interface EventSummary {
  id: number;
  title: string;
  coverImage?: string | null;
  eventType: EventType;
  startAt: string;
  endAt: string;
  isOnline: boolean;
  locationName?: string | null;
  city?: string | null;
  organizer?: string | null;
  status: EventStatus;
  favoriteCount: number;
  reservationCount: number;
  commentCount: number;
  isFavorited: boolean;
  isReserved: boolean;
}

export interface EventStoreBrief {
  id: string;
  name: string;
  city?: string | null;
  address?: string | null;
}

export interface EventDetail extends EventSummary {
  description: string;
  images: string[];
  address?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  storeId?: string | null;
  store?: EventStoreBrief | null;
  linkUrl?: string | null;
  brandIds: number[];
  organizerUserId?: number | null;
  createdBy?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface EventMapItem extends EventSummary {
  latitude?: number | null;
  longitude?: number | null;
  storeId?: string | null;
  address?: string | null;
}

export interface EventCalendarDay {
  date: string; // YYYY-MM-DD
  eventTypes: EventType[];
  eventIds: number[];
  hasFavorite: boolean;
  hasReserved: boolean;
}

export interface EventCalendarResponse {
  month: string; // YYYY-MM
  days: EventCalendarDay[];
  events: EventSummary[];
}

export interface EventCommentUser {
  id: number;
  username: string;
  avatarUrl?: string | null;
}

export interface EventCommentArchiveBrief {
  id: number;
  title?: string | null;
  brandName?: string | null;
  photo?: string | null;
}

export interface EventComment {
  id: number;
  eventId: number;
  user: EventCommentUser;
  content: string;
  rating?: number | null;
  images: string[];
  archiveItem?: EventCommentArchiveBrief | null;
  createdAt: string;
}

export interface EventCreatePayload {
  title: string;
  description?: string;
  coverImage?: string | null;
  images?: string[];
  eventType: EventType;
  startAt: string;
  endAt: string;
  isOnline?: boolean;
  locationName?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  storeId?: string | null;
  organizer?: string | null;
  linkUrl?: string | null;
  brandIds?: number[];
  status?: EventStatus;
}

export type EventUpdatePayload = Partial<EventCreatePayload>;

interface Paged<T> {
  items: T[];
  total: number;
}

const qs = (params: Record<string, string | number | undefined | null>) => {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") q.append(k, String(v));
  });
  const s = q.toString();
  return s ? `?${s}` : "";
};

/** 客户端时区偏移（分钟，东八区 = 480），用于让后端把 UTC 时间落到本地日期格子。 */
export const localTzOffsetMinutes = () => -new Date().getTimezoneOffset();

// ---------------------------------------------------------------------------
// 公开
// ---------------------------------------------------------------------------
export const getUpcomingEvents = (params?: {
  page?: number;
  pageSize?: number;
  eventType?: EventType;
  city?: string;
}) => request<Paged<EventSummary>>(`/api/events/upcoming${qs(params ?? {})}`);

export const getEventReviews = (params?: { page?: number; pageSize?: number }) =>
  request<Paged<EventSummary>>(`/api/events/reviews${qs(params ?? {})}`);

export const getEventCalendar = (month: string) =>
  request<EventCalendarResponse>(
    `/api/events/calendar${qs({ month, tzOffset: localTzOffsetMinutes() })}`,
  );

export const getEventsForMap = (params?: {
  range?: "week" | "month" | "quarter";
  eventType?: EventType;
}) => request<{ items: EventMapItem[] }>(`/api/events/map${qs(params ?? {})}`);

export const getEventDetail = (eventId: number) =>
  request<EventDetail>(`/api/events/${eventId}`);

// ---------------------------------------------------------------------------
// 用户
// ---------------------------------------------------------------------------
export const toggleEventFavorite = (eventId: number) =>
  request<{ isFavorited: boolean; favoriteCount: number }>(
    `/api/events/${eventId}/favorite`,
    { method: "POST", retries: 0 },
  );

export const toggleEventReservation = (eventId: number) =>
  request<{ isReserved: boolean; reservationCount: number }>(
    `/api/events/${eventId}/reserve`,
    { method: "POST", retries: 0 },
  );

export const getMyFavoriteEvents = (params?: { page?: number; pageSize?: number }) =>
  request<Paged<EventSummary>>(`/api/events/me/favorites${qs(params ?? {})}`);

export const getMyReservedEvents = (params?: { page?: number; pageSize?: number }) =>
  request<Paged<EventSummary>>(`/api/events/me/reservations${qs(params ?? {})}`);

export const getEventComments = (
  eventId: number,
  params?: { page?: number; pageSize?: number },
) => request<Paged<EventComment>>(`/api/events/${eventId}/comments${qs(params ?? {})}`);

export const createEventComment = (
  eventId: number,
  body: { content: string; rating?: number | null; images?: string[]; archiveItemId?: number | null },
) =>
  request<EventComment>(`/api/events/${eventId}/comments`, {
    method: "POST",
    body: JSON.stringify(body),
    retries: 0,
  });

export const deleteEventComment = (eventId: number, commentId: number) =>
  request<null>(`/api/events/${eventId}/comments/${commentId}`, { method: "DELETE", retries: 0 });

// ---------------------------------------------------------------------------
// 管理员
// ---------------------------------------------------------------------------
export const adminListEvents = (params?: {
  page?: number;
  pageSize?: number;
  status?: EventStatus;
  keyword?: string;
}) => request<Paged<EventSummary>>(`/api/events/admin/list${qs(params ?? {})}`);

export const adminGetEvent = (eventId: number) =>
  request<EventDetail>(`/api/events/admin/${eventId}`);

export const adminCreateEvent = (body: EventCreatePayload) =>
  request<EventDetail>("/api/events/admin", {
    method: "POST",
    body: JSON.stringify(body),
    retries: 0,
  });

export const adminUpdateEvent = (eventId: number, body: EventUpdatePayload) =>
  request<EventDetail>(`/api/events/admin/${eventId}`, {
    method: "PUT",
    body: JSON.stringify(body),
    retries: 0,
  });

export const adminDeleteEvent = (eventId: number) =>
  request<null>(`/api/events/admin/${eventId}`, { method: "DELETE", retries: 0 });

// ---------------------------------------------------------------------------
// 工具
// ---------------------------------------------------------------------------
export const isEventEnded = (e: Pick<EventSummary, "status" | "endAt">) =>
  e.status === "ENDED" || new Date(e.endAt).getTime() < Date.now();

const pad = (n: number) => String(n).padStart(2, "0");

/** 本地日期 → YYYY-MM-DD */
export const toDateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** 本地日期 → YYYY-MM */
export const toMonthKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

/**
 * 活动时间的展示文案：同日 → "05.18 (周六) 11:00–20:00"；跨日 → "05.18 – 05.25"。
 * 语言文案由调用方拼接周几，这里只处理数字部分。
 */
export const formatEventTimeRange = (startAt: string, endAt: string) => {
  const s = new Date(startAt);
  const e = new Date(endAt);
  const sameDay = toDateKey(s) === toDateKey(e);
  const md = (d: Date) => `${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
  const hm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (sameDay) {
    return { date: md(s), time: `${hm(s)} – ${hm(e)}`, sameDay: true as const };
  }
  return { date: `${md(s)} – ${md(e)}`, time: `${hm(s)}`, sameDay: false as const };
};
