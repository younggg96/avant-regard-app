/**
 * 设计师服务 - 处理设计师相关的 API 调用和数据缓存
 * 所有屏幕共享同一份缓存数据，避免重复请求
 */

import { useAuthStore } from "../store/authStore";

const API_BASE_URL = "http://42.193.122.67:8080";

// API 响应类型
interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

// API 返回的设计师数据结构
export interface ApiShowImage {
  id: number;
  imageUrl: string;
  imageType: string;
  sortOrder: number;
}

export interface ApiShow {
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
  images: ApiShowImage[];
}

export interface ApiDesigner {
  id: number;
  name: string;
  slug: string;
  designerUrl: string;
  shows: ApiShow[];
  followers: any[];
}

// 新增 API 响应接口
export interface DesignerShowSummary {
  id: number;
  category: string;
  season: string;
  imageCount: number;
  reviewAuthor: string | null;
  reviewText: string | null;
}

export interface DesignerImageSummary {
  id: number;
  imageUrl: string;
  likeCount: number;
  likedByMe: boolean;
}

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

export interface SingleShowImage {
  id: number;
  imageUrl: string;
  imageType: string;
  sortOrder: number;
}

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

// 缓存数据
let cachedDesigners: ApiDesigner[] | null = null;
let cacheTimestamp: number | null = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存

// 正在进行的请求 Promise，避免重复请求
let pendingRequest: Promise<ApiDesigner[]> | null = null;

// 通用请求方法
async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = useAuthStore.getState().getAccessToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "*/*",
    ...((options.headers as Record<string, string>) || {}),
  };

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

    // 统一处理 401 未授权情况
    if (response.status === 401) {
      console.warn("Received 401 Unauthorized, attempting to refresh token...");
      const refreshed = await useAuthStore.getState().refreshTokens();
      if (refreshed) {
        // Token 刷新成功，重试请求
        const newToken = useAuthStore.getState().getAccessToken();
        if (newToken) {
          headers["Authorization"] = `Bearer ${newToken}`;
          const newConfig = { ...config, headers };
          const newResponse = await fetch(url, newConfig);
          return handleResponse<T>(newResponse);
        }
      } else {
        // Token 刷新失败，通常 authStore 会处理登出
        throw new Error("登录已过期，请重新登录");
      }
    }

    return handleResponse<T>(response);
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("网络请求失败，请检查网络连接");
  }
}

// 提取响应处理逻辑
async function handleResponse<T>(response: Response): Promise<T> {
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
    const text = await response.text();
    let jsonResponse: any;

    try {
      jsonResponse = JSON.parse(text);
    } catch (parseError) {
      // 针对复杂 JSON 数据的特殊处理（如 fetchDesignersFromApi 中的逻辑）
      // 这里简化处理，如果是一般接口失败则抛出
      throw new Error("JSON parse error");
    }

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

      if ("data" in apiResponse) {
        return apiResponse.data;
      }
    }

    return jsonResponse as T;
  }

  const text = await response.text();
  return text as unknown as T;
}

/**
 * 获取所有设计师数据（带缓存）
 */
export async function getAllDesigners(): Promise<ApiDesigner[]> {
  // 如果缓存有效，直接返回
  if (
    cachedDesigners &&
    cacheTimestamp &&
    Date.now() - cacheTimestamp < CACHE_DURATION
  ) {
    return cachedDesigners;
  }

  // 如果有正在进行的请求，返回该请求
  if (pendingRequest) {
    return pendingRequest;
  }

  // 发起新请求
  pendingRequest = fetchDesignersFromApi();

  try {
    const data = await pendingRequest;
    return data;
  } finally {
    pendingRequest = null;
  }
}

/**
 * 递归简化数据，移除深度嵌套以避免 JSON 解析限制
 * 用于处理 "Maximum nesting level in JSON parser exceeded" 错误
 */
function simplifyJsonText(text: string): string {
  // 移除所有 followers 数组内容（支持嵌套括号）
  let result = text;

  // 使用多次替换来处理 followers 数组
  // 匹配 "followers":[ 开始，然后找到对应的结束 ]
  let prevResult = "";
  while (prevResult !== result) {
    prevResult = result;
    // 替换简单的空 followers 或只有基本元素的 followers
    result = result.replace(/"followers"\s*:\s*\[\s*\]/g, '"followers":[]');
    // 替换包含对象的 followers（不含嵌套数组）
    result = result.replace(
      /"followers"\s*:\s*\[\s*\{[^[\]]*\}\s*(,\s*\{[^[\]]*\}\s*)*\]/g,
      '"followers":[]'
    );
  }

  // 如果 followers 仍然很复杂，使用更激进的方法
  // 找到 "followers":[ 然后计数括号直到匹配
  const followersRegex = /"followers"\s*:\s*\[/g;
  let match;
  const replacements: { start: number; end: number }[] = [];

  while ((match = followersRegex.exec(result)) !== null) {
    const startIdx = match.index;
    const arrayStart = result.indexOf("[", startIdx);
    if (arrayStart === -1) continue;

    let depth = 1;
    let i = arrayStart + 1;
    while (i < result.length && depth > 0) {
      if (result[i] === "[") depth++;
      else if (result[i] === "]") depth--;
      i++;
    }

    if (depth === 0) {
      replacements.push({ start: arrayStart, end: i });
    }
  }

  // 从后往前替换，避免索引偏移
  for (let i = replacements.length - 1; i >= 0; i--) {
    const { start, end } = replacements[i];
    result = result.slice(0, start) + "[]" + result.slice(end);
  }

  return result;
}

/**
 * 从 API 获取设计师数据
 */
async function fetchDesignersFromApi(): Promise<ApiDesigner[]> {
  const token = useAuthStore.getState().getAccessToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "*/*",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}/api/designer/getAllData`, {
    method: "GET",
    headers,
  });

  // 处理 401 情况 - 这里手动处理，因为 fetchDesignersFromApi 有特殊的解析逻辑
  if (response.status === 401) {
    console.warn("fetchDesignersFromApi: 401, trying refresh");
    const refreshed = await useAuthStore.getState().refreshTokens();
    if (refreshed) {
      const newToken = useAuthStore.getState().getAccessToken();
      if (newToken) {
        headers["Authorization"] = `Bearer ${newToken}`;
        const newResponse = await fetch(
          `${API_BASE_URL}/api/designer/getAllData`,
          {
            method: "GET",
            headers,
          }
        );
        // 递归或继续处理 newResponse... 为简单起见，这里假设第二次成功，继续往下走逻辑
        // 注意：实际应该把下面解析逻辑抽取出来复用。
        // 由于这里逻辑比较特殊且紧密，简单的做法是直接复用下面的处理代码
        return processDesignerResponse(newResponse);
      }
    }
    throw new Error("登录已过期");
  }

  return processDesignerResponse(response);
}

async function processDesignerResponse(
  response: Response
): Promise<ApiDesigner[]> {
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  // 使用 text() 然后手动解析，避免嵌套层级过深的问题
  const text = await response.text();

  let result: ApiResponse<ApiDesigner[]>;
  try {
    result = JSON.parse(text);
  } catch (parseError) {
    console.error("JSON parse error, trying to simplify data...");
    // 如果解析失败，先简化数据再尝试解析
    try {
      const simplifiedText = simplifyJsonText(text);
      result = JSON.parse(simplifiedText);
    } catch (secondError) {
      console.error("Second JSON parse attempt failed:", secondError);
      // 最后尝试：只提取基本结构
      throw new Error("无法解析服务器返回的数据，数据结构过于复杂");
    }
  }

  if (result.code !== 0) {
    throw new Error(result.message || "获取数据失败");
  }

  // 简化数据，移除不需要的深度嵌套字段
  const simplifiedData = result.data.map((designer) => ({
    ...designer,
    followers: [], // 清空 followers 避免嵌套过深
    shows:
      designer.shows?.map((show) => ({
        ...show,
        images: show.images || [],
      })) || [],
  }));

  // 更新缓存
  cachedDesigners = simplifiedData;
  cacheTimestamp = Date.now();

  return simplifiedData;
}

/**
 * 根据 ID 获取单个设计师
 */
export async function getDesignerById(id: number): Promise<ApiDesigner | null> {
  const designers = await getAllDesigners();
  return designers.find((d) => d.id === id) || null;
}

/**
 * 根据名称查找设计师
 */
export async function getDesignerByName(
  name: string
): Promise<ApiDesigner | null> {
  const designers = await getAllDesigners();

  // 精确匹配
  let found = designers.find(
    (d) => d.name.toLowerCase() === name.toLowerCase()
  );

  // 部分匹配
  if (!found) {
    found = designers.find(
      (d) =>
        d.name.toLowerCase().includes(name.toLowerCase()) ||
        name.toLowerCase().includes(d.name.toLowerCase())
    );
  }

  // 品牌名匹配（括号前的部分）
  if (!found) {
    found = designers.find((d) => {
      const brandMatch = d.name.match(/^([^(]+?)(?:\s*\(|$)/);
      const brandName = brandMatch?.[1]?.trim();
      return (
        brandName &&
        (brandName.toLowerCase().includes(name.toLowerCase()) ||
          name.toLowerCase().includes(brandName.toLowerCase()))
      );
    });
  }

  return found || null;
}

/**
 * 获取所有 Look 数据（用于发布页面选择造型）
 */
export async function getAllLooks(): Promise<
  Array<{
    id: number;
    designer: string;
    designerId: number;
    season: string;
    imageUrl: string;
    showId: number;
  }>
> {
  const designers = await getAllDesigners();
  const looks: Array<{
    id: number;
    designer: string;
    designerId: number;
    season: string;
    imageUrl: string;
    showId: number;
  }> = [];

  designers.forEach((designer) => {
    designer.shows.forEach((show) => {
      if (show.images && show.images.length > 0) {
        show.images.forEach((img) => {
          if (img.imageType === "look") {
            looks.push({
              id: img.id,
              designer: designer.name,
              designerId: designer.id,
              season: show.season,
              imageUrl: img.imageUrl,
              showId: show.id,
            });
          }
        });
      }
    });
  });

  return looks;
}

/**
 * 根据设计师名称获取所有秀场
 */
export async function getShowsByDesignerName(
  designerName: string
): Promise<ApiShow[]> {
  const designer = await getDesignerByName(designerName);
  return designer?.shows || [];
}

/**
 * 清除缓存（用于强制刷新）
 */
export function clearCache(): void {
  cachedDesigners = null;
  cacheTimestamp = null;
}

/**
 * 预加载数据（可以在 App 启动时调用）
 */
export async function preloadDesigners(): Promise<void> {
  try {
    await getAllDesigners();
  } catch (error) {
    console.error("Failed to preload designers:", error);
  }
}

// ------------------------------------------------------------------
// 新增 API 方法
// ------------------------------------------------------------------

/**
 * 获取单个设计师 + 所有 Show + 所有造型图详情
 */
export async function getDesignerShowAndImages(
  designerId: number
): Promise<DesignerShowAndImageDetailDto> {
  return request<DesignerShowAndImageDetailDto>(
    `/api/designer/${designerId}/show-and-images`
  );
}

/**
 * 获取单场 show
 */
export async function getSingleShow(showId: number): Promise<SingleShowDto> {
  return request<SingleShowDto>(`/api/designer/getSingleShow?showId=${showId}`);
}

/**
 * 获取所有设计师的简要信息
 */
export async function getAllDesignerDetails(): Promise<DesignerDetailDto[]> {
  return request<DesignerDetailDto[]>("/api/designer/getAllDesignerDetail");
}

// 导出服务对象
export const designerService = {
  getAllDesigners,
  getDesignerById,
  getDesignerByName,
  getAllLooks,
  getShowsByDesignerName,
  clearCache,
  preloadDesigners,
  // 新增方法
  getDesignerShowAndImages,
  getSingleShow,
  getAllDesignerDetails,
};
