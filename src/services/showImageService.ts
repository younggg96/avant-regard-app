/**
 * 造型评论服务 - 处理 show-image-controller 相关的 API 调用
 */

import { useAuthStore } from "../store/authStore";
import { config } from "../config/env";

const API_BASE_URL = config.API_BASE_URL;

// API 响应包装类型
interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

// 造型评论类型
export interface ImageReview {
  id: number;
  userId: number;
  username: string;
  imageId: number;
  rating: number;
  content: string;
  createdAt: string;
  updatedAt: string;
}

// 创建评论请求参数
export interface CreateImageReviewParams {
  userId: number;
  rating: number;
  content: string;
}

// 通用请求方法
async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "*/*",
    ...((options.headers as Record<string, string>) || {}),
  };

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
      if (jsonResponse && typeof jsonResponse === 'object' && 'code' in jsonResponse) {
        const apiResponse = jsonResponse as ApiResponse<T>;
        
        if (apiResponse.code !== 0) {
          throw new Error(apiResponse.message || "请求失败");
        }
        
        if ('data' in apiResponse) {
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

/**
 * 获取单个造型的全部评论
 * GET /api/show-images/{imageId}/reviews
 */
export async function getImageReviews(imageId: number): Promise<ImageReview[]> {
  return request<ImageReview[]>(`/api/show-images/${imageId}/reviews`, {
    method: "GET",
  });
}

/**
 * 评论造型
 * POST /api/show-images/{imageId}/reviews
 */
export async function createImageReview(
  imageId: number,
  params: CreateImageReviewParams
): Promise<ImageReview> {
  return request<ImageReview>(`/api/show-images/${imageId}/reviews`, {
    method: "POST",
    body: JSON.stringify(params),
  });
}

/**
 * 获取特定用户对所有造型的评论集合
 * GET /api/show-images/users/{userId}/image-reviews
 */
export async function getUserImageReviews(
  userId: number
): Promise<ImageReview[]> {
  return request<ImageReview[]>(
    `/api/show-images/users/${userId}/image-reviews`,
    {
      method: "GET",
    }
  );
}

/**
 * 删除评论
 * DELETE /api/show-images/reviews/{reviewId}
 */
export async function deleteImageReview(reviewId: number): Promise<void> {
  return request<void>(`/api/show-images/reviews/${reviewId}`, {
    method: "DELETE",
  });
}

// 导出 showImageService 对象
export const showImageService = {
  getImageReviews,
  createImageReview,
  getUserImageReviews,
  deleteImageReview,
};

export default showImageService;





