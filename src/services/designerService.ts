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

// 缓存数据
let cachedDesigners: ApiDesigner[] | null = null;
let cacheTimestamp: number | null = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存

// 正在进行的请求 Promise，避免重复请求
let pendingRequest: Promise<ApiDesigner[]> | null = null;

/**
 * 获取所有设计师数据（带缓存）
 */
export async function getAllDesigners(): Promise<ApiDesigner[]> {
  // 如果缓存有效，直接返回
  if (cachedDesigners && cacheTimestamp && Date.now() - cacheTimestamp < CACHE_DURATION) {
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
    result = result.replace(/"followers"\s*:\s*\[\s*\{[^[\]]*\}\s*(,\s*\{[^[\]]*\}\s*)*\]/g, '"followers":[]');
  }
  
  // 如果 followers 仍然很复杂，使用更激进的方法
  // 找到 "followers":[ 然后计数括号直到匹配
  const followersRegex = /"followers"\s*:\s*\[/g;
  let match;
  const replacements: { start: number; end: number }[] = [];
  
  while ((match = followersRegex.exec(result)) !== null) {
    const startIdx = match.index;
    const arrayStart = result.indexOf('[', startIdx);
    if (arrayStart === -1) continue;
    
    let depth = 1;
    let i = arrayStart + 1;
    while (i < result.length && depth > 0) {
      if (result[i] === '[') depth++;
      else if (result[i] === ']') depth--;
      i++;
    }
    
    if (depth === 0) {
      replacements.push({ start: arrayStart, end: i });
    }
  }
  
  // 从后往前替换，避免索引偏移
  for (let i = replacements.length - 1; i >= 0; i--) {
    const { start, end } = replacements[i];
    result = result.slice(0, start) + '[]' + result.slice(end);
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
    shows: designer.shows?.map((show) => ({
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
export async function getDesignerByName(name: string): Promise<ApiDesigner | null> {
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
export async function getAllLooks(): Promise<Array<{
  id: number;
  designer: string;
  designerId: number;
  season: string;
  imageUrl: string;
  showId: number;
}>> {
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
export async function getShowsByDesignerName(designerName: string): Promise<ApiShow[]> {
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

// 导出服务对象
export const designerService = {
  getAllDesigners,
  getDesignerById,
  getDesignerByName,
  getAllLooks,
  getShowsByDesignerName,
  clearCache,
  preloadDesigners,
};

