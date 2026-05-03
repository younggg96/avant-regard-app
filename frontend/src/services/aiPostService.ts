/**
 * AI 发帖助手 (V3 #25) — 前端 service。
 *
 * 与后端 `backend/app/api/routes/ai_post.py` 一一对应:
 *   GET  /api/ai-post/options/styles
 *   GET  /api/ai-post/options/designers?style_id
 *   GET  /api/ai-post/options/shows?designer_id
 *   GET  /api/ai-post/options/looks?show_id
 *   GET  /api/ai-post/options/perspectives
 *   POST /api/ai-post/generate
 *   POST /api/ai-post/regenerate
 *   GET  /api/ai-post/quota
 *
 * 错误处理:
 *   - 配额超限: ApiError.status === 429, error 消息含 quota 字段
 *   - 图片审核拦截: ApiError.status === 422 + code "IMAGE_BLOCKED"
 *   - LLM 失败: ApiError.status === 502 + code "LLM_FAILED"
 *   - 图片审核未配置: ApiError.status === 503 (运维问题, 给用户友好提示)
 *
 * 调用方应在 catch 里读 `err.status`,而不是只看 message。
 */

import { ApiError, request } from "./http";

// =====================================================
// Types (与后端 schemas/ai_post.py 对齐)
// =====================================================

export type AIPostMode = "QA_TEXT" | "IMAGE_BRIEF";

export type AIPostPerspective =
  | "OUTFIT"
  | "COLLECTION"
  | "REVIEW"
  | "RANT"
  | "INSPIRATION";

export type ImageBriefChip =
  | "RECENT_BUY"
  | "FAVORITE_ITEM"
  | "LOOK_APPRECIATION"
  | "CUSTOM";

export interface OptionCard {
  id: number;
  slug?: string | null;
  name: string;
  name_zh?: string | null;
  cover_url?: string | null;
  subtitle?: string | null;
}

export interface OptionListResponse {
  options: OptionCard[];
  has_fallback: boolean;
}

export interface QuotaInfo {
  daily_generate_used: number;
  daily_generate_limit: number;
  daily_regen_used: number;
  daily_regen_limit: number;
}

export interface SuggestedCommunity {
  id: number;
  name: string;
  slug?: string | null;
}

export interface QAAnswers {
  style_id?: number;
  designer_id?: number;
  show_id?: number;
  look_id?: number | null;
  look_fallback_text?: string | null;
  perspective?: AIPostPerspective;
}

export interface ImageBriefAnswers {
  prompt_chip: ImageBriefChip;
  user_note?: string | null;
}

export interface GenerateRequest {
  mode: AIPostMode;
  answers: QAAnswers | ImageBriefAnswers | Record<string, unknown>;
  image_urls?: string[];
  context?: Record<string, unknown>;
}

export interface GenerateResponse {
  log_id: number;
  generated_text: string;
  suggested_tags: string[];
  suggested_communities: SuggestedCommunity[];
  /**
   * 用户预览页确认发布时,需要原样塞进 createPost 的 generationMetadata。
   * 后端会校验 metadata.log_id 必填。
   */
  metadata: Record<string, unknown>;
  quota: QuotaInfo;
}

// =====================================================
// 业务错误码 (与后端 detail.code 对齐)
// =====================================================

export const AIPostErrorCode = {
  QUOTA_EXCEEDED: "QUOTA_EXCEEDED",
  IMAGE_BLOCKED: "IMAGE_BLOCKED",
  LLM_FAILED: "LLM_FAILED",
} as const;

// =====================================================
// API
// =====================================================

const BASE = "/api/ai-post";

export async function getStylesOptions(): Promise<OptionListResponse> {
  return request<OptionListResponse>(`${BASE}/options/styles`);
}

export async function getDesignersOptions(
  styleId: number,
): Promise<OptionListResponse> {
  return request<OptionListResponse>(
    `${BASE}/options/designers?style_id=${styleId}`,
  );
}

export async function getShowsOptions(
  designerId: number,
): Promise<OptionListResponse> {
  return request<OptionListResponse>(
    `${BASE}/options/shows?designer_id=${designerId}`,
  );
}

export async function getLooksOptions(
  showId: number,
): Promise<OptionListResponse> {
  return request<OptionListResponse>(
    `${BASE}/options/looks?show_id=${showId}`,
  );
}

export async function getPerspectivesOptions(): Promise<OptionListResponse> {
  return request<OptionListResponse>(`${BASE}/options/perspectives`);
}

export async function generate(
  payload: GenerateRequest,
): Promise<GenerateResponse> {
  // generate 比普通接口耗时 (LLM 3-8s + 视觉模式 + 6s 图片审核),
  // 单独把超时拉长,且不要在瞬时 5xx 上重试 (重试只会浪费 token)。
  return request<GenerateResponse>(`${BASE}/generate`, {
    method: "POST",
    body: JSON.stringify(payload),
    timeoutMs: 30000,
    retries: 0,
  });
}

export async function regenerate(logId: number): Promise<GenerateResponse> {
  return request<GenerateResponse>(`${BASE}/regenerate`, {
    method: "POST",
    body: JSON.stringify({ log_id: logId }),
    timeoutMs: 30000,
    retries: 0,
  });
}

export async function getQuota(): Promise<{ quota: QuotaInfo }> {
  return request<{ quota: QuotaInfo }>(`${BASE}/quota`);
}

// =====================================================
// 工具函数: 把 ApiError 翻译为前端可读错误
// =====================================================

export interface AIPostFriendlyError {
  code: string;
  message: string;
  status: number;
  /** IMAGE_BLOCKED 时为被拦截图片的下标 */
  blockedIndices?: number[];
  /** QUOTA_EXCEEDED 时附带的配额信息 (从后端 detail.quota 解析) */
  quota?: QuotaInfo;
}

/**
 * 不抛错, 把 ApiError 翻译成前端 UI 可直接消费的结构。
 * 调用方:
 *   try { ... } catch (err) {
 *     const friendly = translateAIPostError(err);
 *     if (friendly.code === "IMAGE_BLOCKED") { ... }
 *   }
 */
export function translateAIPostError(err: unknown): AIPostFriendlyError {
  if (err instanceof ApiError) {
    // detail.code 不是 ApiError 标准字段, 但 http.ts 已经把 message 取自
    // detail/message。后端 generate/regenerate 失败时 detail 是个 dict,
    // 这里 message 会是 dict 的 str() 表示;前端最稳的是按 status 区分。
    if (err.status === 429) {
      return {
        code: AIPostErrorCode.QUOTA_EXCEEDED,
        message: err.message || "今日配额已用完",
        status: 429,
      };
    }
    if (err.status === 422) {
      return {
        code: AIPostErrorCode.IMAGE_BLOCKED,
        message: err.message || "部分图片未通过审核",
        status: 422,
      };
    }
    if (err.status === 502) {
      return {
        code: AIPostErrorCode.LLM_FAILED,
        message: err.message || "AI 模型暂时不可用,请稍后重试",
        status: 502,
      };
    }
    return {
      code: "UNKNOWN",
      message: err.message,
      status: err.status,
    };
  }
  return {
    code: "UNKNOWN",
    message: err instanceof Error ? err.message : "未知错误",
    status: 0,
  };
}
