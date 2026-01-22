/**
 * 商家入驻服务
 * 管理商家认证、公告、活动、折扣、Banner 相关功能
 */

import { useAuthStore } from "../store/authStore";
import { config } from "../config/env";

const EXPO_PUBLIC_API_BASE_URL = config.EXPO_PUBLIC_API_BASE_URL;

// API 响应包装类型
interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

// ==================== 类型定义 ====================

// 商家认证状态
export type MerchantStatus = "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";

// 商家等级
export type MerchantLevel = "BASIC" | "PREMIUM" | "VIP";

// 内容状态
export type ContentStatus = "DRAFT" | "PUBLISHED" | "HIDDEN" | "ENDED";

// 活动类型
export type ActivityType = "TRUNK_SHOW" | "POP_UP" | "SALE" | "EVENT" | "OTHER";

// 折扣类型
export type DiscountType = "PERCENTAGE" | "FIXED" | "SPECIAL";

// 链接类型
export type LinkType = "INTERNAL" | "EXTERNAL" | "NONE";

// 商家信息
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

// 商家申请参数
export interface StoreMerchantCreateParams {
  storeId: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  businessLicense?: string;
}

// 商家更新参数
export interface StoreMerchantUpdateParams {
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  businessLicense?: string;
}

// 公告
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

// 创建公告参数
export interface StoreAnnouncementCreateParams {
  title: string;
  content: string;
  isPinned?: boolean;
  status?: ContentStatus;
  startTime?: string;
  endTime?: string;
}

// 更新公告参数
export interface StoreAnnouncementUpdateParams {
  title?: string;
  content?: string;
  isPinned?: boolean;
  status?: ContentStatus;
  startTime?: string;
  endTime?: string;
}

// Banner
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

// 创建 Banner 参数
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

// 更新 Banner 参数
export interface StoreBannerUpdateParams {
  title?: string;
  imageUrl?: string;
  linkUrl?: string;
  linkType?: LinkType;
  sortOrder?: number;
  status?: ContentStatus;
  startTime?: string;
  endTime?: string;
}

// 活动
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

// 创建活动参数
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

// 更新活动参数
export interface StoreActivityUpdateParams {
  title?: string;
  description?: string;
  coverImage?: string;
  images?: string[];
  activityStartTime?: string;
  activityEndTime?: string;
  location?: string;
  activityType?: ActivityType;
  status?: ContentStatus;
  needRegistration?: boolean;
  registrationLimit?: number;
}

// 折扣
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

// 创建折扣参数
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

// 更新折扣参数
export interface StoreDiscountUpdateParams {
  title?: string;
  description?: string;
  coverImage?: string;
  discountType?: DiscountType;
  discountValue?: string;
  applicableBrands?: string[];
  applicableCategories?: string[];
  discountStartTime?: string;
  discountEndTime?: string;
  minPurchaseAmount?: number;
  termsAndConditions?: string;
  status?: ContentStatus;
  needCode?: boolean;
  discountCode?: string;
}

// 活动报名
export interface ActivityRegistration {
  id: number;
  activityId: number;
  userId: number;
  username?: string;
  userAvatar?: string;
  contactName?: string;
  contactPhone?: string;
  note?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

// 活动报名参数
export interface ActivityRegistrationParams {
  contactName?: string;
  contactPhone?: string;
  note?: string;
}

// 店铺商家内容汇总
export interface StoreMerchantContent {
  isMerchant: boolean;
  merchantInfo?: StoreMerchant;
  banners: StoreBanner[];
  announcements: StoreAnnouncement[];
  activities: StoreActivity[];
  discounts: StoreDiscount[];
}

// ==================== 通用请求方法 ====================

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${EXPO_PUBLIC_API_BASE_URL}${endpoint}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "*/*",
    ...((options.headers as Record<string, string>) || {}),
  };

  const token = useAuthStore.getState().getAccessToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const requestConfig: RequestInit = {
    ...options,
    headers,
  };

  try {
    const response = await fetch(url, requestConfig);
    const contentType = response.headers.get("content-type");

    if (!response.ok) {
      let errorMessage = "请求失败";
      if (contentType?.includes("application/json")) {
        const errorData = await response.json();
        errorMessage = errorData.message || errorData.error || errorMessage;
      } else {
        const text = await response.text();
        errorMessage = text || `HTTP ${response.status}`;
      }
      throw new Error(errorMessage);
    }

    if (contentType?.includes("application/json")) {
      const jsonResponse = await response.json();

      if (
        jsonResponse &&
        typeof jsonResponse === "object" &&
        "code" in jsonResponse
      ) {
        const apiResponse = jsonResponse as ApiResponse<T>;

        if (apiResponse.code !== 0) {
          throw new Error(apiResponse.message || "请求失败");
        }

        if ("data" in apiResponse) {
          return apiResponse.data;
        }
      }

      return jsonResponse as T;
    }

    const text = await response.text();
    return text as unknown as T;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("网络请求失败，请检查网络连接");
  }
}

// ==================== 商家认证 API ====================

/**
 * 申请成为商家
 */
export const applyMerchant = async (
  data: StoreMerchantCreateParams
): Promise<StoreMerchant> => {
  return request<StoreMerchant>(`/api/store-merchants/apply`, {
    method: "POST",
    body: JSON.stringify(data),
  });
};

/**
 * 获取我的商家列表
 */
export const getMyMerchants = async (
  page: number = 1,
  pageSize: number = 20
): Promise<{ merchants: StoreMerchant[]; total: number }> => {
  return request<{ merchants: StoreMerchant[]; total: number }>(
    `/api/store-merchants/my?page=${page}&pageSize=${pageSize}`,
    { method: "GET" }
  );
};

/**
 * 通过店铺ID获取商家信息
 */
export const getMerchantByStore = async (
  storeId: string
): Promise<StoreMerchant | null> => {
  return request<StoreMerchant | null>(
    `/api/store-merchants/by-store/${encodeURIComponent(storeId)}`,
    { method: "GET" }
  );
};

/**
 * 更新商家信息
 */
export const updateMerchant = async (
  merchantId: number,
  data: StoreMerchantUpdateParams
): Promise<StoreMerchant> => {
  return request<StoreMerchant>(`/api/store-merchants/${merchantId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
};

// ==================== 公告 API ====================

/**
 * 创建公告
 */
export const createAnnouncement = async (
  merchantId: number,
  data: StoreAnnouncementCreateParams
): Promise<StoreAnnouncement> => {
  return request<StoreAnnouncement>(
    `/api/store-merchants/${merchantId}/announcements`,
    {
      method: "POST",
      body: JSON.stringify(data),
    }
  );
};

/**
 * 更新公告
 */
export const updateAnnouncement = async (
  announcementId: number,
  data: StoreAnnouncementUpdateParams
): Promise<StoreAnnouncement> => {
  return request<StoreAnnouncement>(
    `/api/store-merchants/announcements/${announcementId}`,
    {
      method: "PUT",
      body: JSON.stringify(data),
    }
  );
};

/**
 * 删除公告
 */
export const deleteAnnouncement = async (
  announcementId: number
): Promise<void> => {
  return request<void>(
    `/api/store-merchants/announcements/${announcementId}`,
    { method: "DELETE" }
  );
};

/**
 * 获取商家的公告列表
 */
export const getMerchantAnnouncements = async (
  merchantId: number,
  page: number = 1,
  pageSize: number = 20
): Promise<{ announcements: StoreAnnouncement[]; total: number }> => {
  return request<{ announcements: StoreAnnouncement[]; total: number }>(
    `/api/store-merchants/${merchantId}/announcements?page=${page}&pageSize=${pageSize}`,
    { method: "GET" }
  );
};

/**
 * 获取店铺的公告列表（公开）
 */
export const getStoreAnnouncements = async (
  storeId: string
): Promise<{ announcements: StoreAnnouncement[]; total: number }> => {
  return request<{ announcements: StoreAnnouncement[]; total: number }>(
    `/api/store-merchants/store/${encodeURIComponent(storeId)}/announcements`,
    { method: "GET" }
  );
};

// ==================== Banner API ====================

/**
 * 创建 Banner
 */
export const createBanner = async (
  merchantId: number,
  data: StoreBannerCreateParams
): Promise<StoreBanner> => {
  return request<StoreBanner>(
    `/api/store-merchants/${merchantId}/banners`,
    {
      method: "POST",
      body: JSON.stringify(data),
    }
  );
};

/**
 * 更新 Banner
 */
export const updateBanner = async (
  bannerId: number,
  data: StoreBannerUpdateParams
): Promise<StoreBanner> => {
  return request<StoreBanner>(
    `/api/store-merchants/banners/${bannerId}`,
    {
      method: "PUT",
      body: JSON.stringify(data),
    }
  );
};

/**
 * 删除 Banner
 */
export const deleteBanner = async (bannerId: number): Promise<void> => {
  return request<void>(
    `/api/store-merchants/banners/${bannerId}`,
    { method: "DELETE" }
  );
};

/**
 * 获取商家的 Banner 列表
 */
export const getMerchantBanners = async (
  merchantId: number,
  page: number = 1,
  pageSize: number = 20
): Promise<{ banners: StoreBanner[]; total: number }> => {
  return request<{ banners: StoreBanner[]; total: number }>(
    `/api/store-merchants/${merchantId}/banners?page=${page}&pageSize=${pageSize}`,
    { method: "GET" }
  );
};

/**
 * 获取店铺的 Banner 列表（公开）
 */
export const getStoreBanners = async (
  storeId: string
): Promise<{ banners: StoreBanner[]; total: number }> => {
  return request<{ banners: StoreBanner[]; total: number }>(
    `/api/store-merchants/store/${encodeURIComponent(storeId)}/banners`,
    { method: "GET" }
  );
};

/**
 * 记录 Banner 点击
 */
export const recordBannerClick = async (bannerId: number): Promise<void> => {
  return request<void>(
    `/api/store-merchants/banners/${bannerId}/click`,
    { method: "POST" }
  );
};

// ==================== 活动 API ====================

/**
 * 创建活动
 */
export const createActivity = async (
  merchantId: number,
  data: StoreActivityCreateParams
): Promise<StoreActivity> => {
  return request<StoreActivity>(
    `/api/store-merchants/${merchantId}/activities`,
    {
      method: "POST",
      body: JSON.stringify(data),
    }
  );
};

/**
 * 更新活动
 */
export const updateActivity = async (
  activityId: number,
  data: StoreActivityUpdateParams
): Promise<StoreActivity> => {
  return request<StoreActivity>(
    `/api/store-merchants/activities/${activityId}`,
    {
      method: "PUT",
      body: JSON.stringify(data),
    }
  );
};

/**
 * 删除活动
 */
export const deleteActivity = async (activityId: number): Promise<void> => {
  return request<void>(
    `/api/store-merchants/activities/${activityId}`,
    { method: "DELETE" }
  );
};

/**
 * 获取商家的活动列表
 */
export const getMerchantActivities = async (
  merchantId: number,
  page: number = 1,
  pageSize: number = 20
): Promise<{ activities: StoreActivity[]; total: number }> => {
  return request<{ activities: StoreActivity[]; total: number }>(
    `/api/store-merchants/${merchantId}/activities?page=${page}&pageSize=${pageSize}`,
    { method: "GET" }
  );
};

/**
 * 获取店铺的活动列表（公开）
 */
export const getStoreActivities = async (
  storeId: string,
  includeEnded: boolean = false
): Promise<{ activities: StoreActivity[]; total: number }> => {
  return request<{ activities: StoreActivity[]; total: number }>(
    `/api/store-merchants/store/${encodeURIComponent(storeId)}/activities?includeEnded=${includeEnded}`,
    { method: "GET" }
  );
};

/**
 * 获取活动详情
 */
export const getActivityDetail = async (
  activityId: number
): Promise<StoreActivity> => {
  return request<StoreActivity>(
    `/api/store-merchants/activities/${activityId}`,
    { method: "GET" }
  );
};

/**
 * 报名活动
 */
export const registerActivity = async (
  activityId: number,
  data: ActivityRegistrationParams
): Promise<ActivityRegistration> => {
  return request<ActivityRegistration>(
    `/api/store-merchants/activities/${activityId}/register`,
    {
      method: "POST",
      body: JSON.stringify(data),
    }
  );
};

/**
 * 取消报名
 */
export const cancelActivityRegistration = async (
  activityId: number
): Promise<void> => {
  return request<void>(
    `/api/store-merchants/activities/${activityId}/register`,
    { method: "DELETE" }
  );
};

/**
 * 检查是否已报名
 */
export const checkActivityRegistration = async (
  activityId: number
): Promise<{ isRegistered: boolean }> => {
  return request<{ isRegistered: boolean }>(
    `/api/store-merchants/activities/${activityId}/check-registration`,
    { method: "GET" }
  );
};

/**
 * 获取活动报名列表
 */
export const getActivityRegistrations = async (
  activityId: number,
  page: number = 1,
  pageSize: number = 20
): Promise<{ registrations: ActivityRegistration[]; total: number }> => {
  return request<{ registrations: ActivityRegistration[]; total: number }>(
    `/api/store-merchants/activities/${activityId}/registrations?page=${page}&pageSize=${pageSize}`,
    { method: "GET" }
  );
};

// ==================== 折扣 API ====================

/**
 * 创建折扣
 */
export const createDiscount = async (
  merchantId: number,
  data: StoreDiscountCreateParams
): Promise<StoreDiscount> => {
  return request<StoreDiscount>(
    `/api/store-merchants/${merchantId}/discounts`,
    {
      method: "POST",
      body: JSON.stringify(data),
    }
  );
};

/**
 * 更新折扣
 */
export const updateDiscount = async (
  discountId: number,
  data: StoreDiscountUpdateParams
): Promise<StoreDiscount> => {
  return request<StoreDiscount>(
    `/api/store-merchants/discounts/${discountId}`,
    {
      method: "PUT",
      body: JSON.stringify(data),
    }
  );
};

/**
 * 删除折扣
 */
export const deleteDiscount = async (discountId: number): Promise<void> => {
  return request<void>(
    `/api/store-merchants/discounts/${discountId}`,
    { method: "DELETE" }
  );
};

/**
 * 获取商家的折扣列表
 */
export const getMerchantDiscounts = async (
  merchantId: number,
  page: number = 1,
  pageSize: number = 20
): Promise<{ discounts: StoreDiscount[]; total: number }> => {
  return request<{ discounts: StoreDiscount[]; total: number }>(
    `/api/store-merchants/${merchantId}/discounts?page=${page}&pageSize=${pageSize}`,
    { method: "GET" }
  );
};

/**
 * 获取店铺的折扣列表（公开）
 */
export const getStoreDiscounts = async (
  storeId: string,
  includeEnded: boolean = false
): Promise<{ discounts: StoreDiscount[]; total: number }> => {
  return request<{ discounts: StoreDiscount[]; total: number }>(
    `/api/store-merchants/store/${encodeURIComponent(storeId)}/discounts?includeEnded=${includeEnded}`,
    { method: "GET" }
  );
};

// ==================== 综合查询 API ====================

/**
 * 获取店铺的所有商家发布内容
 */
export const getStoreMerchantContent = async (
  storeId: string
): Promise<StoreMerchantContent> => {
  return request<StoreMerchantContent>(
    `/api/store-merchants/store/${encodeURIComponent(storeId)}/content`,
    { method: "GET" }
  );
};

// ==================== 管理员审核 API ====================

// 审核参数
export interface MerchantReviewParams {
  status: "APPROVED" | "REJECTED";
  rejectReason?: string;
}

// 管理员更新商家参数
export interface MerchantAdminUpdateParams {
  status?: "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";
  merchantLevel?: "BASIC" | "PREMIUM" | "VIP";
  canPostBanner?: boolean;
  canPostAnnouncement?: boolean;
  canPostActivity?: boolean;
  canPostDiscount?: boolean;
}

// 商家申请详情（包含店铺信息）
export interface MerchantApplicationDetail extends StoreMerchant {
  storeName?: string;
  storeAddress?: string;
  storeCity?: string;
  username?: string;
  userAvatar?: string;
}

/**
 * 获取待审核商家列表（管理员）
 */
export const getPendingMerchants = async (
  page: number = 1,
  pageSize: number = 20
): Promise<{ merchants: MerchantApplicationDetail[]; total: number }> => {
  return request<{ merchants: MerchantApplicationDetail[]; total: number }>(
    `/api/store-merchants/pending?page=${page}&pageSize=${pageSize}`,
    { method: "GET" }
  );
};

/**
 * 获取所有商家列表（管理员）
 */
export const getAllMerchants = async (
  status?: string,
  page: number = 1,
  pageSize: number = 20
): Promise<{ merchants: MerchantApplicationDetail[]; total: number }> => {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (status) {
    params.append("status", status);
  }
  return request<{ merchants: MerchantApplicationDetail[]; total: number }>(
    `/api/store-merchants/all?${params.toString()}`,
    { method: "GET" }
  );
};

/**
 * 审核商家申请（管理员）
 */
export const reviewMerchant = async (
  merchantId: number,
  data: MerchantReviewParams
): Promise<StoreMerchant> => {
  return request<StoreMerchant>(
    `/api/store-merchants/${merchantId}/review`,
    {
      method: "PUT",
      body: JSON.stringify(data),
    }
  );
};

/**
 * 管理员更新商家信息
 */
export const adminUpdateMerchant = async (
  merchantId: number,
  data: MerchantAdminUpdateParams
): Promise<StoreMerchant> => {
  return request<StoreMerchant>(
    `/api/store-merchants/${merchantId}/admin-update`,
    {
      method: "PUT",
      body: JSON.stringify(data),
    }
  );
};

// 导出服务对象
export const storeMerchantService = {
  // 商家认证
  applyMerchant,
  getMyMerchants,
  getMerchantByStore,
  updateMerchant,
  // 公告
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  getMerchantAnnouncements,
  getStoreAnnouncements,
  // Banner
  createBanner,
  updateBanner,
  deleteBanner,
  getMerchantBanners,
  getStoreBanners,
  recordBannerClick,
  // 活动
  createActivity,
  updateActivity,
  deleteActivity,
  getMerchantActivities,
  getStoreActivities,
  getActivityDetail,
  registerActivity,
  cancelActivityRegistration,
  checkActivityRegistration,
  getActivityRegistrations,
  // 折扣
  createDiscount,
  updateDiscount,
  deleteDiscount,
  getMerchantDiscounts,
  getStoreDiscounts,
  // 综合
  getStoreMerchantContent,
  // 管理员审核
  getPendingMerchants,
  reviewMerchant,
  // 管理员管理
  getAllMerchants,
  adminUpdateMerchant,
};
