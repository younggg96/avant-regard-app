/**
 * Web 端 商家入驻 API 客户端.
 *
 * 1:1 对齐 frontend/src/services/storeMerchantService.ts —— 三端共用同一套
 * 后端契约 (`/api/store-merchants/*`):
 *   - 商家认证 (apply / my / by-store / update)
 *   - 公告 / Banner / 活动 / 折扣 CRUD
 *   - 商家侧店铺详情 (get / update buyer-store)
 *
 * 全部走 `apiClient`, 所以 401 刷新、envelope 解包、`Authorization` 注入
 * 都统一在一处. 这里只负责 URL / 参数 / 类型.
 */

import { apiClient } from "../api-client";

// ==================== 枚举类型 ====================

export type MerchantStatus = "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";
export type MerchantLevel = "BASIC" | "PREMIUM" | "VIP";
export type ContentStatus = "DRAFT" | "PUBLISHED" | "HIDDEN" | "ENDED";
export type ActivityType =
  | "TRUNK_SHOW"
  | "POP_UP"
  | "SALE"
  | "EVENT"
  | "OTHER";
export type DiscountType = "PERCENTAGE" | "FIXED" | "SPECIAL";
export type LinkType = "INTERNAL" | "EXTERNAL" | "NONE";

// ==================== 商家 ====================

export interface StoreMerchant {
  id: number;
  storeId: string;
  userId: number;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  businessLicense?: string;
  status: MerchantStatus;
  rejectReason?: string;
  reviewedBy?: number;
  reviewedAt?: string;
  merchantLevel: MerchantLevel;
  canPostBanner: boolean;
  canPostAnnouncement: boolean;
  canPostActivity: boolean;
  canPostDiscount: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StoreMerchantUpdateParams {
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  businessLicense?: string;
}

// ==================== 公告 ====================

export interface StoreAnnouncement {
  id: number;
  storeId: string;
  merchantId: number;
  title: string;
  content: string;
  isPinned: boolean;
  status: ContentStatus;
  startTime?: string;
  endTime?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoreAnnouncementCreateParams {
  title: string;
  content: string;
  isPinned?: boolean;
  status?: ContentStatus;
  startTime?: string;
  endTime?: string;
}

export type StoreAnnouncementUpdateParams = Partial<
  StoreAnnouncementCreateParams
>;

// ==================== Banner ====================

export interface StoreBanner {
  id: number;
  storeId: string;
  merchantId: number;
  title?: string;
  imageUrl: string;
  linkUrl?: string;
  linkType: LinkType;
  sortOrder: number;
  status: ContentStatus;
  startTime?: string;
  endTime?: string;
  clickCount: number;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface StoreBannerCreateParams {
  title?: string;
  imageUrl: string;
  linkUrl?: string;
  linkType?: LinkType;
  sortOrder?: number;
  status?: ContentStatus;
  startTime?: string;
  endTime?: string;
}

export type StoreBannerUpdateParams = Partial<StoreBannerCreateParams>;

// ==================== 活动 ====================

export interface StoreActivity {
  id: number;
  storeId: string;
  merchantId: number;
  title: string;
  description?: string;
  coverImage?: string;
  images: string[];
  activityStartTime: string;
  activityEndTime: string;
  location?: string;
  activityType: ActivityType;
  status: ContentStatus;
  needRegistration: boolean;
  registrationLimit?: number;
  registrationCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface StoreActivityCreateParams {
  title: string;
  description?: string;
  coverImage?: string;
  images?: string[];
  activityStartTime: string;
  activityEndTime: string;
  location?: string;
  activityType?: ActivityType;
  status?: ContentStatus;
  needRegistration?: boolean;
  registrationLimit?: number;
}

export type StoreActivityUpdateParams = Partial<StoreActivityCreateParams>;

// ==================== 折扣 ====================

export interface StoreDiscount {
  id: number;
  storeId: string;
  merchantId: number;
  title: string;
  description?: string;
  coverImage?: string;
  discountType: DiscountType;
  discountValue?: string;
  applicableBrands: string[];
  applicableCategories: string[];
  discountStartTime: string;
  discountEndTime: string;
  minPurchaseAmount?: number;
  termsAndConditions?: string;
  status: ContentStatus;
  needCode: boolean;
  discountCode?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoreDiscountCreateParams {
  title: string;
  description?: string;
  coverImage?: string;
  discountType: DiscountType;
  discountValue?: string;
  applicableBrands?: string[];
  applicableCategories?: string[];
  discountStartTime: string;
  discountEndTime: string;
  minPurchaseAmount?: number;
  termsAndConditions?: string;
  status?: ContentStatus;
  needCode?: boolean;
  discountCode?: string;
}

export type StoreDiscountUpdateParams = Partial<StoreDiscountCreateParams>;

// ==================== 店铺信息 (商家视角) ====================
//
// 注意: 后端 /api/store-merchants/buyer-store/{id} 返回的是扁平的 latitude /
// longitude (老接口), 而 `/api/buyer-stores/*` 返回的是嵌套 coordinates.
// 为了不破坏 Web 其它地方对 `BuyerStore` (coordinates 嵌套) 的约定, 单独给
// 这个商家端视图起个名字.

export interface MerchantBuyerStore {
  id: string;
  name: string;
  address: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  brands: string[];
  style: string[];
  isOpen: boolean;
  phone: string[];
  hours?: string;
  rating?: number;
  description?: string;
  images: string[];
  rest?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface MerchantBuyerStoreUpdateParams {
  name?: string;
  address?: string;
  phone?: string[];
  hours?: string;
  description?: string;
  images?: string[];
  rest?: string;
  brands?: string[];
  style?: string[];
}

// ==================== 列表响应类型 ====================

interface MyMerchantsResponse {
  merchants: StoreMerchant[];
  total: number;
  page?: number;
  pageSize?: number;
}

interface AnnouncementListResponse {
  announcements: StoreAnnouncement[];
  total: number;
}

interface BannerListResponse {
  banners: StoreBanner[];
  total: number;
}

interface ActivityListResponse {
  activities: StoreActivity[];
  total: number;
}

interface DiscountListResponse {
  discounts: StoreDiscount[];
  total: number;
}

// ==================== API ====================

export const storeMerchantService = {
  // ── 商家认证 ─────────────────────────────────────────────────────────
  getMyMerchants: (page = 1, pageSize = 20) =>
    apiClient.get<MyMerchantsResponse>("/api/store-merchants/my", {
      page,
      pageSize,
    }),

  updateMerchant: (merchantId: number, data: StoreMerchantUpdateParams) =>
    apiClient.put<StoreMerchant>(`/api/store-merchants/${merchantId}`, data),

  // ── 店铺信息 (商家视角) ─────────────────────────────────────────────
  getBuyerStore: (storeId: string) =>
    apiClient.get<MerchantBuyerStore>(
      `/api/store-merchants/buyer-store/${encodeURIComponent(storeId)}`,
    ),

  updateBuyerStore: (storeId: string, data: MerchantBuyerStoreUpdateParams) =>
    apiClient.put<MerchantBuyerStore>(
      `/api/store-merchants/buyer-store/${encodeURIComponent(storeId)}`,
      data,
    ),

  // ── 公告 ─────────────────────────────────────────────────────────────
  getMerchantAnnouncements: (merchantId: number, page = 1, pageSize = 20) =>
    apiClient.get<AnnouncementListResponse>(
      `/api/store-merchants/${merchantId}/announcements`,
      { page, pageSize },
    ),

  createAnnouncement: (
    merchantId: number,
    data: StoreAnnouncementCreateParams,
  ) =>
    apiClient.post<StoreAnnouncement>(
      `/api/store-merchants/${merchantId}/announcements`,
      data,
    ),

  updateAnnouncement: (
    announcementId: number,
    data: StoreAnnouncementUpdateParams,
  ) =>
    apiClient.put<StoreAnnouncement>(
      `/api/store-merchants/announcements/${announcementId}`,
      data,
    ),

  deleteAnnouncement: (announcementId: number) =>
    apiClient.delete<void>(
      `/api/store-merchants/announcements/${announcementId}`,
    ),

  // ── Banner ──────────────────────────────────────────────────────────
  getMerchantBanners: (merchantId: number, page = 1, pageSize = 20) =>
    apiClient.get<BannerListResponse>(
      `/api/store-merchants/${merchantId}/banners`,
      { page, pageSize },
    ),

  createBanner: (merchantId: number, data: StoreBannerCreateParams) =>
    apiClient.post<StoreBanner>(
      `/api/store-merchants/${merchantId}/banners`,
      data,
    ),

  updateBanner: (bannerId: number, data: StoreBannerUpdateParams) =>
    apiClient.put<StoreBanner>(`/api/store-merchants/banners/${bannerId}`, data),

  deleteBanner: (bannerId: number) =>
    apiClient.delete<void>(`/api/store-merchants/banners/${bannerId}`),

  // ── 活动 ─────────────────────────────────────────────────────────────
  getMerchantActivities: (merchantId: number, page = 1, pageSize = 20) =>
    apiClient.get<ActivityListResponse>(
      `/api/store-merchants/${merchantId}/activities`,
      { page, pageSize },
    ),

  createActivity: (merchantId: number, data: StoreActivityCreateParams) =>
    apiClient.post<StoreActivity>(
      `/api/store-merchants/${merchantId}/activities`,
      data,
    ),

  updateActivity: (activityId: number, data: StoreActivityUpdateParams) =>
    apiClient.put<StoreActivity>(
      `/api/store-merchants/activities/${activityId}`,
      data,
    ),

  deleteActivity: (activityId: number) =>
    apiClient.delete<void>(`/api/store-merchants/activities/${activityId}`),

  // ── 折扣 ─────────────────────────────────────────────────────────────
  getMerchantDiscounts: (merchantId: number, page = 1, pageSize = 20) =>
    apiClient.get<DiscountListResponse>(
      `/api/store-merchants/${merchantId}/discounts`,
      { page, pageSize },
    ),

  createDiscount: (merchantId: number, data: StoreDiscountCreateParams) =>
    apiClient.post<StoreDiscount>(
      `/api/store-merchants/${merchantId}/discounts`,
      data,
    ),

  updateDiscount: (discountId: number, data: StoreDiscountUpdateParams) =>
    apiClient.put<StoreDiscount>(
      `/api/store-merchants/discounts/${discountId}`,
      data,
    ),

  deleteDiscount: (discountId: number) =>
    apiClient.delete<void>(`/api/store-merchants/discounts/${discountId}`),
};

// ==================== 状态 / 枚举常量 ====================

export const MERCHANT_STATUS_LABEL: Record<MerchantStatus, string> = {
  PENDING: "审核中",
  APPROVED: "已认证",
  REJECTED: "已拒绝",
  SUSPENDED: "已暂停",
};

export const ACTIVITY_TYPE_LABEL: Record<ActivityType, string> = {
  TRUNK_SHOW: "Trunk Show",
  POP_UP: "快闪店",
  SALE: "特卖会",
  EVENT: "活动",
  OTHER: "其他",
};

export const DISCOUNT_TYPE_LABEL: Record<DiscountType, string> = {
  PERCENTAGE: "折扣比例",
  FIXED: "满减优惠",
  SPECIAL: "特别优惠",
};

export const CONTENT_STATUS_LABEL: Record<ContentStatus, string> = {
  DRAFT: "草稿",
  PUBLISHED: "已发布",
  HIDDEN: "已隐藏",
  ENDED: "已结束",
};
