/**
 * 设计师服务 - 处理设计师相关的 API 调用
 */

import { useAuthStore } from "../store/authStore";
import { config } from "../config/env";

const EXPO_PUBLIC_API_BASE_URL = config.EXPO_PUBLIC_API_BASE_URL;

// API 响应类型
interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

// ------------------------------------------------------------------
// 接口定义
// ------------------------------------------------------------------

/**
 * 设计师简要信息 (getAllDesignerDetail 返回)
 */
export interface DesignerDetailDto {
  id: number;
  name: string;
  slug: string;
  designerUrl: string;
  showCount: number;
  totalImages: number;
  latestSeason: string;
  followerCount: number;
  following: boolean;
}

/**
 * Show 摘要 (show-and-images 返回的 shows 数组元素)
 */
export interface DesignerShowSummary {
  id: number;
  category: string;
  season: string;
  imageCount: number;
  reviewAuthor: string | null;
  reviewText: string | null;
}

/**
 * 图片摘要 (show-and-images 返回的 images 数组元素)
 */
export interface DesignerImageSummary {
  id: number;
  imageUrl: string;
  likeCount: number;
  likedByMe: boolean;
}

/**
 * 设计师详情 + Shows + Images (show-and-images 返回)
 */
export interface DesignerShowAndImageDetailDto {
  id: number;
  name: string;
  slug: string;
  designerUrl: string;
  showCount: number;
  totalImages: number;
  followerCount: number;
  following: boolean;
  shows: DesignerShowSummary[];
  images: DesignerImageSummary[];
}

/**
 * 单场 Show 的图片 (getSingleShow 返回的 images 数组元素)
 */
export interface SingleShowImage {
  id: number;
  imageUrl: string;
  imageType: string;
  sortOrder: number;
}

/**
 * 单场 Show 详情 (getSingleShow 返回)
 */
export interface SingleShowDto {
  id: number;
  showUrl: string;
  season: string;
  category: string;
  city: string | null;
  collectionTs: string;
  originalOffset: string | null;
  reviewTitle: string | null;
  reviewAuthor: string | null;
  reviewText: string | null;
  images: SingleShowImage[];
}

// ------------------------------------------------------------------
// 通用请求方法
// ------------------------------------------------------------------

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${EXPO_PUBLIC_API_BASE_URL}${endpoint}`;
  const token = useAuthStore.getState().getAccessToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "*/*",
    ...(options.headers as Record<string, string>),
  };

  // 添加认证 token
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

    // 处理 JSON 响应
    if (contentType?.includes("application/json")) {
      const jsonResponse = await response.json();

      // 处理包装的 API 响应格式 { code, message, data }
      if (
        jsonResponse &&
        typeof jsonResponse === "object" &&
        "code" in jsonResponse
      ) {
        const apiResponse = jsonResponse as ApiResponse<T>;

        if (apiResponse.code !== 0) {
          throw new Error(apiResponse.message || "请求失败");
        }

        return apiResponse.data;
      }

      return jsonResponse as T;
    }

    // 纯文本响应
    const text = await response.text();
    return text as unknown as T;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("网络请求失败，请检查网络连接");
  }
}

// ------------------------------------------------------------------
// API 方法
// ------------------------------------------------------------------

/**
 * 获取所有设计师的简要信息列表
 * GET /api/designer/getAllDesignerDetail
 */
export async function getAllDesignerDetails(): Promise<DesignerDetailDto[]> {
  return request<DesignerDetailDto[]>("/api/designer/getAllDesignerDetail");
}

/**
 * 获取单个设计师 + 所有 Show + 所有造型图详情
 * GET /api/designer/{designerId}/show-and-images
 */
export async function getDesignerShowAndImages(
  designerId: number
): Promise<DesignerShowAndImageDetailDto> {
  return request<DesignerShowAndImageDetailDto>(
    `/api/designer/${designerId}/show-and-images`
  );
}

/**
 * 获取单场 show 详情（包含所有造型图）
 * GET /api/designer/getSingleShow?showId={showId}
 */
export async function getSingleShow(showId: number): Promise<SingleShowDto> {
  return request<SingleShowDto>(`/api/designer/getSingleShow?showId=${showId}`);
}

// ------------------------------------------------------------------
// 导出服务对象
// ------------------------------------------------------------------

export const designerService = {
  getAllDesignerDetails,
  getDesignerShowAndImages,
  getSingleShow,
};
