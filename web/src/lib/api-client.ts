/**
 * Shared API client for web client components.
 *
 * Responsibilities:
 *  1. Prepend `config.apiBaseUrl`.
 *  2. Attach `Authorization: Bearer <token>` if logged in.
 *  3. Unwrap the FastAPI envelope `{ code, message, data }`.
 *  4. On 401, call the auth store's `refreshTokens()` once and retry.
 *  5. On repeated 401 or refresh failure, log the user out.
 *
 * Intentionally synchronous wrt. the store: reads tokens from `useAuthStore`
 * every call so we never stale-cache between refreshes.
 *
 * Use from client components only. Server components should hit the backend
 * directly with `fetch` (see [data-fetching.ts](./data-fetching.ts)).
 */

import { config } from "./config";
import { useAuthStore } from "./auth/store";

interface ApiEnvelope<T> {
  code: number;
  message?: string;
  data: T;
}

export class ApiError extends Error {
  status: number;
  code?: number;

  constructor(message: string, status: number, code?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export interface ApiRequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** If true, send request without bearer even when authenticated. */
  anonymous?: boolean;
  /** Internal: set during 401-retry to avoid infinite loop. */
  _isRetry?: boolean;
}

async function buildUrl(path: string, query?: Record<string, unknown>) {
  let url = path.startsWith("http") ? path : `${config.apiBaseUrl}${path}`;
  if (query) {
    const qs = new URLSearchParams();
    Object.entries(query).forEach(([k, v]) => {
      if (v === undefined || v === null) return;
      if (Array.isArray(v)) {
        v.forEach((item) => qs.append(k, String(item)));
      } else {
        qs.set(k, String(v));
      }
    });
    const str = qs.toString();
    if (str) url += `${url.includes("?") ? "&" : "?"}${str}`;
  }
  return url;
}

export async function apiRequest<T = unknown>(
  path: string,
  options: ApiRequestOptions = {},
  query?: Record<string, unknown>,
): Promise<T> {
  const url = await buildUrl(path, query);
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };

  const hasBody = options.body !== undefined && options.body !== null;
  if (hasBody && !(options.body instanceof FormData)) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
  }

  if (!options.anonymous) {
    const token = useAuthStore.getState().getAccessToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const init: RequestInit = {
    method: options.method || (hasBody ? "POST" : "GET"),
    cache: options.cache,
    signal: options.signal,
    credentials: options.credentials,
    headers,
  };

  if (hasBody) {
    init.body =
      options.body instanceof FormData
        ? (options.body as BodyInit)
        : JSON.stringify(options.body);
  }

  const res = await fetch(url, init);

  // 401 → try refresh once, then retry.
  if (res.status === 401 && !options._isRetry && !options.anonymous) {
    const store = useAuthStore.getState();
    if (store.tokens?.refreshToken) {
      const refreshed = await store.refreshTokens();
      if (refreshed) {
        return apiRequest<T>(path, { ...options, _isRetry: true }, query);
      }
    }
    store.logout();
    throw new ApiError("未登录或登录已过期", 401);
  }

  const contentType = res.headers.get("content-type") || "";

  if (!res.ok) {
    let message = `请求失败 (HTTP ${res.status})`;
    let code: number | undefined;
    if (contentType.includes("application/json")) {
      try {
        const err = (await res.json()) as {
          detail?: string;
          message?: string;
          code?: number;
        };
        message = err.detail || err.message || message;
        code = err.code;
      } catch {
        /* ignore */
      }
    }
    throw new ApiError(message, res.status, code);
  }

  if (res.status === 204 || !contentType) {
    return undefined as T;
  }

  if (contentType.includes("application/json")) {
    const json = (await res.json()) as unknown;
    if (
      json &&
      typeof json === "object" &&
      "code" in (json as Record<string, unknown>)
    ) {
      const env = json as ApiEnvelope<T>;
      if (env.code !== 0) {
        throw new ApiError(env.message || "请求失败", res.status, env.code);
      }
      return env.data;
    }
    return json as T;
  }

  return (await res.text()) as unknown as T;
}

export const apiClient = {
  get: <T = unknown>(
    path: string,
    query?: Record<string, unknown>,
    options: ApiRequestOptions = {},
  ) => apiRequest<T>(path, { ...options, method: "GET" }, query),

  post: <T = unknown>(
    path: string,
    body?: unknown,
    options: ApiRequestOptions = {},
  ) => apiRequest<T>(path, { ...options, method: "POST", body }),

  put: <T = unknown>(
    path: string,
    body?: unknown,
    options: ApiRequestOptions = {},
  ) => apiRequest<T>(path, { ...options, method: "PUT", body }),

  patch: <T = unknown>(
    path: string,
    body?: unknown,
    options: ApiRequestOptions = {},
  ) => apiRequest<T>(path, { ...options, method: "PATCH", body }),

  delete: <T = unknown>(path: string, options: ApiRequestOptions = {}) =>
    apiRequest<T>(path, { ...options, method: "DELETE" }),
};

/**
 * SWR fetcher — pass a path or a `[path, query]` tuple as the key.
 */
export const swrFetcher = <T = unknown>(
  key: string | [string, Record<string, unknown>],
): Promise<T> => {
  if (Array.isArray(key)) {
    return apiClient.get<T>(key[0], key[1]);
  }
  return apiClient.get<T>(key);
};
