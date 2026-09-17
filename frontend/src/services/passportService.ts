/**
 * 数字护照 — 前端 service。
 *
 * 与后端 `backend/app/api/routes/passport.py` 一一对应:
 *   POST /api/passport/three-view
 *   GET  /api/passport/three-view/quota
 *
 * 错误处理 (读 ApiError.status,不要只看 message):
 *   - 429 配额用完 → 提示「今日次数已用完」
 *   - 400 源图不合法 (不在 Storage 白名单 / 下载失败 / 无法解码)
 *   - 503 后端没配 OPENAI_API_KEY,是运维问题
 *   - 502 三张图全部生成失败
 */

import { request } from "./http";

/**
 * 三张图并发生成,实测整体 ~20s,慢的时候到 40s+。
 * http.ts 默认超时 15s,这里必须显式放大,否则请求一定被 abort。
 */
const THREE_VIEW_TIMEOUT_MS = 120_000;

export type ThreeViewSlug = "front" | "side" | "back";

export interface ThreeViewItem {
  slug: ThreeViewSlug;
  /** 「正视图」/「侧视图」/「背视图」,后端已给中文,前端直接渲染。 */
  label: string;
  /** 生成成功时的图片 URL；该视图失败时为 null。 */
  url: string | null;
  /** 该视图单独失败的原因；成功时为 null。 */
  error: string | null;
}

export interface ThreeViewResult {
  sourceUrl: string;
  views: ThreeViewItem[];
  model: string;
  tokensUsed: number;
  quotaUsed: number;
  quotaLimit: number;
}

export interface ThreeViewQuota {
  used: number;
  limit: number;
}

/**
 * 由一张单品照生成正 / 侧 / 背三视图。
 *
 * `imageUrl` 必须是已经上传到自家 Storage 的公开地址（先走
 * `uploadImageFromUri`），后端按白名单校验，不接受任意外链。
 *
 * 注意返回值可能是**部分成功**：某一张失败时该项的 `url` 为 null、
 * `error` 有值，整体仍然是 200。调用方要按 view 逐个判断。
 */
export async function generateThreeView(
  imageUrl: string,
): Promise<ThreeViewResult> {
  return request<ThreeViewResult>("/api/passport/three-view", {
    method: "POST",
    body: JSON.stringify({ imageUrl }),
    timeoutMs: THREE_VIEW_TIMEOUT_MS,
    // 一次生成 = 三次真实计费 + 扣一次配额。502 在 http.ts 里属于「瞬时错误」
    // 会被自动重试,放任不管等于用户点一次扣三次,必须关掉。
    retries: 0,
  });
}

export async function getThreeViewQuota(): Promise<ThreeViewQuota> {
  return request<ThreeViewQuota>("/api/passport/three-view/quota", {
    silent: true,
  });
}

/** 历史里的单张视图。失败的那张 url 为 null，errorMessage 说明原因。 */
export interface ThreeViewHistoryView {
  id: number;
  slug: string;
  url: string | null;
  /** success | failed | disabled */
  status: string;
  errorMessage: string | null;
}

/** 一次生成 = 一批（正 / 侧 / 背 三张）。 */
export interface ThreeViewHistoryBatch {
  createdAt: string;
  sourceImageUrl: string;
  model: string | null;
  imageSize: string | null;
  archiveItemId: number | null;
  views: ThreeViewHistoryView[];
  okCount: number;
  totalCount: number;
  /** success = 三张全成，partial = 部分成功，failed = 全失败 */
  status: "success" | "partial" | "failed";
}

export interface ThreeViewHistoryPage {
  items: ThreeViewHistoryBatch[];
  /** 总批数（不是总张数）。 */
  total: number;
}

/**
 * 自己的三视图生成记录，成功和失败都会返回。
 *
 * 失败的记录同样重要 —— 用户点过一次没拿到图，要能在这里看到原因，
 * 而不是只能猜「是不是白扣了一次」。
 */
export async function getThreeViewHistory(
  page = 1,
  pageSize = 20,
): Promise<ThreeViewHistoryPage> {
  return request<ThreeViewHistoryPage>(
    `/api/passport/three-view/history?page=${page}&pageSize=${pageSize}`,
    { silent: true },
  );
}

// =====================================================
// 5.2 / 5.3 · AI 识别、用户确认与入库
// =====================================================

/** 识别要跑 1-4 次视觉模型调用，比普通接口慢得多。 */
const ATTRIBUTE_TIMEOUT_MS = 90_000;

export interface ValidityInfo {
  isFashionItem: boolean;
  /** 未通过时说明图里看到的是什么，直接展示给用户。 */
  rejectReason: string | null;
  category: string | null;
  categoryZh: string | null;
  confidence: number;
}

export interface AttributionCandidate {
  brandId: number;
  brandName: string;
  showId: string | null;
  season: string | null;
  year: number | null;
  title: string | null;
  /** 匹配证据。matchSource 决定这句话该怎么措辞展示。 */
  evidence: string;
  /**
   * 仅当 matchSource === "reference_images" 时非空。
   * 参照图库目前是空的，所以现阶段这两个字段恒为 null，
   * 前端不要无条件渲染「N 张中 M 张一致」。
   */
  matchedRefs: number | null;
  totalRefs: number | null;
  confidence: number;
  /** brand_only | show_metadata | reference_images */
  matchSource: string;
}

export interface AttributionResult {
  attributionId: number;
  validity: ValidityInfo;
  /** 可能是空数组：认不出来是正常结果，此时直接让用户手填。 */
  candidates: AttributionCandidate[];
  visualSummary: string | null;
  yearRange: number[] | null;
  quotaUsed: number;
  quotaLimit: number;
}

export type UserAction = "accepted" | "edited" | "none_of_above";

export interface ConfirmPayload {
  attributionId: number;
  title: string;
  /** 二选一：brandId 来自品牌列表，pendingBrandName 表示新品牌待审核。 */
  brandId?: number | null;
  pendingBrandName?: string | null;
  showId?: string | null;
  releaseYear?: number | null;
  userAction: UserAction;
  size?: string;
  color?: string;
  condition?: string;
  acquiredAt?: string;
  acquiredPriceCents?: number;
  note?: string;
  storageLocation?: string;
  photos?: string[];
}

/**
 * 有效性检查 + 品牌 / 系列 / 年份候选。
 *
 * 图片没过有效性闸门时抛 ApiError(status 422)，`err.message` 里是
 * 「图里看到的是什么」，可以直接展示给用户让他重拍。
 */
export async function attributeItem(
  photos: string[],
  userHint?: string,
): Promise<AttributionResult> {
  return request<AttributionResult>("/api/passport/attribute", {
    method: "POST",
    body: JSON.stringify({ photos, userHint }),
    timeoutMs: ATTRIBUTE_TIMEOUT_MS,
    // 每次调用都真实消耗配额和 token，502 自动重试等于按一次扣三次。
    retries: 0,
  });
}

/** 用户确认（或修改）归因结果并写入 MY ARCHIVE。 */
export async function confirmPassport(payload: ConfirmPayload): Promise<any> {
  return request<any>("/api/passport/confirm", {
    method: "POST",
    body: JSON.stringify(payload),
    retries: 0,
  });
}

export async function getAttributeQuota(): Promise<ThreeViewQuota> {
  return request<ThreeViewQuota>("/api/passport/attribute/quota", {
    silent: true,
  });
}
