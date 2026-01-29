/**
 * Banner 轮播图服务 - 处理 Banner 相关的 API 调用
 */

import { useAuthStore } from "../store/authStore";
import { config } from "../config/env";

const EXPO_PUBLIC_API_BASE_URL = config.EXPO_PUBLIC_API_BASE_URL;

// Banner 类型定义
export interface Banner {
  id: number;
  title: string;
  subtitle?: string;
  imageUrl: string;
  linkType: "NONE" | "POST" | "BRAND" | "EXTERNAL" | "SHOW";
  linkValue?: string;
  sortOrder: number;
  isActive: boolean;
  startTime?: string;
  endTime?: string;
  createdBy?: number;
  createdAt: string;
  updatedAt: string;
}

// 创建 Banner 请求类型
export interface CreateBannerRequest {
  title: string;
  subtitle?: string;
  image_url: string;
  link_type?: string;
  link_value?: string;
  sort_order?: number;
  is_active?: boolean;
  start_time?: string;
  end_time?: string;
}

// 更新 Banner 请求类型
export interface UpdateBannerRequest {
  title?: string;
  subtitle?: string;
  image_url?: string;
  link_type?: string;
  link_value?: string;
  sort_order?: number;
  is_active?: boolean;
  start_time?: string;
  end_time?: string;
}

// API 响应包装类型
interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

// 通用请求方法
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

  // 自动添加 Authorization header（如果已登录）
  const token = useAuthStore.getState().getAccessToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const config: RequestInit = {
    ...options,
    headers,
  };

  try {
    const response = await fetch(url, config);
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

      // 处理包装的 API 响应格式 { code, message, data }
      if (
        jsonResponse &&
        typeof jsonResponse === "object" &&
        "code" in jsonResponse
      ) {
        const apiResponse = jsonResponse as ApiResponse<T>;

        // 检查业务错误码
        if (apiResponse.code !== 0) {
          throw new Error(apiResponse.message || "请求失败");
        }

        // 返回 data 字段（如果存在）
        if ("data" in apiResponse) {
          return apiResponse.data;
        }
      }

      // 如果不是包装格式，直接返回
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

// ==================== 公开接口 ====================

/**
 * 获取当前有效的 Banner 列表（前端展示用）
 * GET /api/banners/active
 */
export async function getActiveBanners(): Promise<Banner[]> {
  return request<Banner[]>("/api/banners/active", {
    method: "GET",
  });
}

// ==================== 管理员接口 ====================

/**
 * 获取所有 Banner 列表（管理员用）
 * GET /api/banners/admin/list
 */
export async function getAllBanners(): Promise<Banner[]> {
  return request<Banner[]>("/api/banners/admin/list", {
    method: "GET",
  });
}

/**
 * 获取单个 Banner 详情
 * GET /api/banners/admin/{bannerId}
 */
export async function getBanner(bannerId: number): Promise<Banner> {
  return request<Banner>(`/api/banners/admin/${bannerId}`, {
    method: "GET",
  });
}

/**
 * 创建 Banner
 * POST /api/banners/admin
 */
export async function createBanner(data: CreateBannerRequest): Promise<Banner> {
  return request<Banner>("/api/banners/admin", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * 更新 Banner
 * PUT /api/banners/admin/{bannerId}
 */
export async function updateBanner(
  bannerId: number,
  data: UpdateBannerRequest
): Promise<Banner> {
  return request<Banner>(`/api/banners/admin/${bannerId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

/**
 * 删除 Banner
 * DELETE /api/banners/admin/{bannerId}
 */
export async function deleteBanner(bannerId: number): Promise<void> {
  return request<void>(`/api/banners/admin/${bannerId}`, {
    method: "DELETE",
  });
}

/**
 * 切换 Banner 启用状态
 * POST /api/banners/admin/{bannerId}/toggle
 */
export async function toggleBannerStatus(bannerId: number): Promise<Banner> {
  return request<Banner>(`/api/banners/admin/${bannerId}/toggle`, {
    method: "POST",
  });
}

/**
 * 重新排序 Banner
 * POST /api/banners/admin/reorder
 */
export async function reorderBanners(bannerIds: number[]): Promise<void> {
  return request<void>("/api/banners/admin/reorder", {
    method: "POST",
    body: JSON.stringify({ banner_ids: bannerIds }),
  });
}

// 导出 bannerService 对象
export const bannerService = {
  // 公开接口
  getActiveBanners,
  // 管理员接口
  getAllBanners,
  getBanner,
  createBanner,
  updateBanner,
  deleteBanner,
  toggleBannerStatus,
  reorderBanners,
};

export default bannerService;
