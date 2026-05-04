/**
 * 统一 HTTP 请求入口
 *
 * 设计目标：
 * 1. DRY —— 各 service 不再各自复制一份 `request`。只需调用 `request(...)` 并做领域层编排。
 * 2. 弹性 —— 上游 502/503/504 或网络层错误（超时/连接断开）做指数退避重试，把
 *    Supabase/后端偶发抖动挡在 UI 外。
 * 3. Token 刷新 —— 401 自动尝试刷新一次 access token 后重放请求，避免业务层散落
 *    重复的 401 处理逻辑。
 * 4. 响应信封 —— 识别后端统一响应 `{code, message, data}`：`code === 0` 解包返回
 *    `data`；非 0 抛出 `ApiError`，业务层可根据 `code` 区分分支。
 *
 * 业务层使用示例::
 *
 *     import { request } from "./http";
 *     export const getAllCountries = () =>
 *       request<{ countries: string[] }>("/api/buyer-stores/countries").then(r => r.countries);
 *
 *     // 可选：覆盖默认行为
 *     request<Store[]>("/api/...", { method: "POST", body: "...", retries: 0 });
 */

import { useAuthStore } from "../store/authStore";
import { config } from "../config/env";

const API_BASE_URL = config.EXPO_PUBLIC_API_BASE_URL;

// 上游瞬时故障状态码：nginx / gateway 典型的 5xx。4xx 不在此列（是业务错误，重试无意义）。
const TRANSIENT_STATUSES = new Set([502, 503, 504]);

/** 默认重试次数（不含首次）。2 = 最多 3 次尝试，总退避 ~1.2s。 */
const DEFAULT_RETRIES = 2;
/** 首次重试等待毫秒数，之后指数翻倍（400 → 800 → 1600 ...）。 */
const DEFAULT_RETRY_DELAY_MS = 400;
/** 单次请求超时（毫秒）。 */
const DEFAULT_TIMEOUT_MS = 15000;

export interface RequestOptions extends RequestInit {
  /** 不含首次的重试次数，默认 2。设为 0 完全禁用重试。 */
  retries?: number;
  /** 首次重试延迟（ms），默认 400，之后指数翻倍。 */
  retryDelayMs?: number;
  /** 单次 fetch 超时（ms），默认 15000。到期会 abort 并走网络错误分支（可被重试）。 */
  timeoutMs?: number;
  /**
   * 不做日志打印。默认每次发起请求会 `console.log("request", url)`，与历史各
   * service 对齐；某些高频接口可关掉避免刷屏。
   */
  silent?: boolean;
}

/** 业务层可以 catch 的错误类型，带上 HTTP 状态码和响应 code。 */
export class ApiError extends Error {
  /** HTTP 状态码；网络错误/超时时为 0。 */
  status: number;
  /** 后端响应信封里的 code；无信封时为 undefined。 */
  code?: number;
  /** 标识：是否属于"上游瞬时故障"（5xx / 网络层），业务层可据此决定是否展示"重试"按钮。 */
  transient: boolean;

  constructor(
    message: string,
    opts: { status: number; code?: number; transient?: boolean }
  ) {
    super(message);
    this.name = "ApiError";
    this.status = opts.status;
    this.code = opts.code;
    this.transient = Boolean(opts.transient);
  }
}

interface ApiEnvelope<T> {
  code: number;
  message?: string;
  data?: T;
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * 发起一次 API 请求。外层循环只管"是否重试"，单次执行细节在 `executeOnce`。
 *
 * 重试规则：
 * - fetch 抛异常（网络层错误、超时 abort）→ 可重试
 * - HTTP 响应状态码 ∈ {502, 503, 504} → 可重试
 * - 其它 HTTP 错误（4xx、500 等非瞬时 5xx、响应信封 code !== 0）→ 直接抛出
 *
 * 401 刷新 token 走独立路径（不走这里的退避循环），见 `executeOnce`。
 */
export async function request<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const {
    retries = DEFAULT_RETRIES,
    retryDelayMs = DEFAULT_RETRY_DELAY_MS,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    silent = false,
    ...fetchInit
  } = options;

  const url = `${API_BASE_URL}${endpoint}`;
  if (!silent) {
    console.log("request", url, { method: fetchInit.method || "GET" });
  }

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await executeOnce<T>(url, fetchInit, timeoutMs);
    } catch (err) {
      lastError = err;
      const retryable = err instanceof ApiError && err.transient;
      if (!retryable || attempt === retries) {
        throw err;
      }
      const delay = retryDelayMs * Math.pow(2, attempt);
      if (!silent) {
        console.log(
          `[http] transient ${(err as ApiError).status} on ${url}; ` +
            `retry ${attempt + 1}/${retries} in ${delay}ms`
        );
      }
      await sleep(delay);
    }
  }

  // 理论上不会到这里：要么 return 要么 throw。
  throw lastError instanceof Error
    ? lastError
    : new Error("request: unreachable");
}

/**
 * 单次请求执行：
 *  1. 注入/刷新 Authorization header
 *  2. 发 fetch（带超时 abort）
 *  3. 处理 401（一次性刷新 token 后重放，不走外层重试循环）
 *  4. 处理 HTTP 错误（区分瞬时 / 非瞬时）
 *  5. 处理响应信封 `{code, message, data}`
 */
async function executeOnce<T>(
  url: string,
  fetchInit: RequestInit,
  timeoutMs: number,
  isAuthRetry = false
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "*/*",
    ...((fetchInit.headers as Record<string, string>) || {}),
  };

  // Proactive token refresh：token 即将过期时先刷新再发。与原有 postService 行为一致。
  const authStore = useAuthStore.getState();
  let token = authStore.getAccessToken();
  if (
    token &&
    authStore.isTokenExpiringSoon &&
    authStore.isTokenExpiringSoon()
  ) {
    await authStore.refreshTokens();
    token = authStore.getAccessToken();
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const externalSignal = fetchInit.signal;
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener("abort", () => controller.abort());
  }
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      ...fetchInit,
      headers,
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    // 网络错误 / 超时 abort：作为可重试的"瞬时错误"抛出。status=0 约定为网络层。
    const msg =
      err instanceof Error
        ? err.name === "AbortError"
          ? `请求超时 (${timeoutMs}ms)`
          : err.message || "网络请求失败"
        : "网络请求失败";
    throw new ApiError(msg, { status: 0, transient: true });
  }
  clearTimeout(timeoutId);

  const contentType = response.headers.get("content-type");

  if (!response.ok) {
    // 401：尝试刷新 token 后重放一次。只尝试一次，避免循环。
    if (
      response.status === 401 &&
      !isAuthRetry &&
      authStore.tokens?.refreshToken
    ) {
      const ok = await authStore.refreshTokens();
      if (ok) {
        return executeOnce<T>(url, fetchInit, timeoutMs, true);
      }
    }

    const message = await readErrorMessage(response, contentType);
    const transient = TRANSIENT_STATUSES.has(response.status);
    throw new ApiError(message, { status: response.status, transient });
  }

  if (contentType?.includes("application/json")) {
    const json = (await response.json()) as ApiEnvelope<T> | T;

    // 后端统一响应信封 {code, message, data}
    if (
      json !== null &&
      typeof json === "object" &&
      "code" in (json as object)
    ) {
      const env = json as ApiEnvelope<T>;
      if (env.code !== 0) {
        throw new ApiError(env.message || "请求失败", {
          status: response.status,
          code: env.code,
          // 后端会把上游 5xx 统一映射成 code=502；前端也视为瞬时，允许上层重试。
          transient: env.code === 502 || env.code === 503 || env.code === 504,
        });
      }
      if ("data" in env) {
        return env.data as T;
      }
    }

    return json as T;
  }

  const text = await response.text();
  return text as unknown as T;
}

async function readErrorMessage(
  response: Response,
  contentType: string | null
): Promise<string> {
  const fallback = `HTTP ${response.status}`;
  if (contentType?.includes("application/json")) {
    try {
      const data = await response.json();
      return extractMessage(data) ?? fallback;
    } catch {
      return fallback;
    }
  }
  try {
    const text = await response.text();
    return text || fallback;
  } catch {
    return fallback;
  }
}

/**
 * 从后端错误响应里抽出可读字符串。
 *
 * FastAPI 业务异常约定 (ai-post 等):
 *     `raise HTTPException(status_code=502, detail={"code": "LLM_FAILED",
 *                                                    "message": "...",
 *                                                    "log_id": 123})`
 * 序列化成 `{"detail": {"code": "...", "message": "...", ...}}`。
 *
 * 早期实现里直接 `return data?.detail`,detail 是对象时 JS 会按 `String(obj)`
 * 强转成 `"[object Object]"`,把真实错误吞掉。这里递归从常见键 (message /
 * detail / error) 中拿字符串,优先级: 顶层 -> detail 嵌套对象 -> error 嵌套
 * 对象。命中字符串就返回,否则返回 null 让上层走 fallback。
 */
function extractMessage(data: unknown): string | undefined {
  if (typeof data === "string") return data;
  if (data == null || typeof data !== "object") return undefined;
  const obj = data as Record<string, unknown>;

  if (typeof obj.message === "string") return obj.message;
  if (typeof obj.error === "string") return obj.error;
  if (typeof obj.detail === "string") return obj.detail;

  // detail 是嵌套对象 (FastAPI HTTPException(detail={...}) 的标准形态)
  if (obj.detail && typeof obj.detail === "object") {
    const nested = extractMessage(obj.detail);
    if (nested) return nested;
  }
  if (obj.error && typeof obj.error === "object") {
    const nested = extractMessage(obj.error);
    if (nested) return nested;
  }
  return undefined;
}
