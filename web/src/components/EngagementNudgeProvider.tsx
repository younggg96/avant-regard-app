"use client";

/**
 * 网站端引导弹窗（与 iOS App AppNavigator 中的 engagement nudge 对齐）。
 *
 * 触发条件（满足任一）：
 *   - 累计可见使用时长 ≥ 3 分钟
 *   - 累计「行为路由」访问次数 ≥ 3 次
 *
 * 阶段（每弹一次都会推进，无论用户点 CTA 或稍后）：
 *   1. aiPost      → AI 发帖目前只在 iOS App，CTA 跳到 `/app` 落地页
 *   2. forumFollow → CTA 跳到 `/communities`（论坛索引）
 *   3. done        → 不再弹
 *
 * 持久化：
 *   - 状态写入 localStorage（按 userId 分桶），刷新/重开浏览器保持。
 *   - 未登录用户不参与，仅在登录态下统计。
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/lib/auth/store";

type Stage = "aiPost" | "forumFollow" | "done";

interface NudgeState {
  stage: Stage;
  accumulatedMs: number;
  behaviorCount: number;
}

const USAGE_THRESHOLD_MS = 3 * 60 * 1000;
const BEHAVIOR_THRESHOLD = 3;
const TICK_MS = 15_000;
const KEY_PREFIX = "engagement_nudge_state_";

const DEFAULT_STATE: NudgeState = {
  stage: "aiPost",
  accumulatedMs: 0,
  behaviorCount: 0,
};

const isBehaviorPath = (pathname: string | null): boolean => {
  if (!pathname) return false;
  if (pathname.startsWith("/posts/")) return true;
  if (pathname.startsWith("/users/")) return true;
  if (pathname.startsWith("/communities/")) {
    const sub = pathname.slice("/communities/".length);
    return sub.length > 0;
  }
  return false;
};

const isValidStage = (s: unknown): s is Stage =>
  s === "aiPost" || s === "forumFollow" || s === "done";

function loadFromStorage(userId: number): NudgeState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + userId);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<NudgeState>;
    if (!isValidStage(parsed.stage)) return DEFAULT_STATE;
    return {
      stage: parsed.stage,
      accumulatedMs: Number(parsed.accumulatedMs) || 0,
      behaviorCount: Number(parsed.behaviorCount) || 0,
    };
  } catch {
    return DEFAULT_STATE;
  }
}

function saveToStorage(userId: number, state: NudgeState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY_PREFIX + userId, JSON.stringify(state));
  } catch {
    /* quota / privacy mode — ignore */
  }
}

export function EngagementNudgeProvider() {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const userId = useAuthStore((s) => s.user?.userId);
  const hydrated = useAuthStore((s) => s.hydrated);

  const [state, setState] = useState<NudgeState | null>(null);
  const [active, setActive] = useState<Stage | null>(null);

  const activeRef = useRef<Stage | null>(null);
  activeRef.current = active;
  const lastPathRef = useRef<string | null>(null);

  // 1) 登录 / 切账号 / 登出 时加载或清理状态
  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated || !userId) {
      setState(null);
      setActive(null);
      lastPathRef.current = null;
      return;
    }
    setState(loadFromStorage(userId));
  }, [hydrated, isAuthenticated, userId]);

  // 2) 任何状态写入都同步落盘
  useEffect(() => {
    if (!userId || !state) return;
    saveToStorage(userId, state);
  }, [userId, state]);

  const updateState = useCallback(
    (patcher: (prev: NudgeState) => NudgeState) => {
      setState((prev) => (prev ? patcher(prev) : prev));
    },
    [],
  );

  // 3) 行为埋点：路径变化 → +1 behaviorCount
  //    首次挂载时 lastPathRef 为 null，会把当前路径写进 ref 但不计数，
  //    避免把「打开页面」这件事重复算成行为。
  useEffect(() => {
    if (!isAuthenticated || !state || state.stage === "done" || active) {
      lastPathRef.current = pathname;
      return;
    }
    if (lastPathRef.current === pathname) return;
    const previous = lastPathRef.current;
    lastPathRef.current = pathname;
    if (previous === null) return; // 初次记录，不计数
    if (!isBehaviorPath(pathname)) return;
    updateState((prev) => ({
      ...prev,
      behaviorCount: prev.behaviorCount + 1,
    }));
  }, [pathname, isAuthenticated, state, active, updateState]);

  // 4) 使用时长 tick：仅在 tab 可见、没有弹窗时累计
  useEffect(() => {
    if (!isAuthenticated || !state || state.stage === "done") return;

    const tick = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      if (activeRef.current) return;
      updateState((prev) => ({
        ...prev,
        accumulatedMs: prev.accumulatedMs + TICK_MS,
      }));
    };

    const timer = window.setInterval(tick, TICK_MS);
    return () => window.clearInterval(timer);
  }, [isAuthenticated, state?.stage, updateState]);

  // 5) 阈值触发 → 打开弹窗
  useEffect(() => {
    if (!state || state.stage === "done" || active) return;
    const reachedTime = state.accumulatedMs >= USAGE_THRESHOLD_MS;
    const reachedBehavior = state.behaviorCount >= BEHAVIOR_THRESHOLD;
    if (reachedTime || reachedBehavior) {
      setActive(state.stage);
    }
  }, [state, active]);

  const closeAndAdvance = useCallback(() => {
    setActive(null);
    updateState((prev) => ({
      stage: prev.stage === "aiPost" ? "forumFollow" : "done",
      accumulatedMs: 0,
      behaviorCount: 0,
    }));
  }, [updateState]);

  const handleCta = useCallback(() => {
    const stage = activeRef.current;
    closeAndAdvance();
    if (stage === "aiPost") {
      router.push("/app");
    } else if (stage === "forumFollow") {
      router.push("/communities");
    }
  }, [router, closeAndAdvance]);

  // ESC 关闭
  useEffect(() => {
    if (!active) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAndAdvance();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [active, closeAndAdvance]);

  if (!active) return null;

  const isAi = active === "aiPost";
  const title = isAi
    ? t("engagementNudge.aiPost.title")
    : t("engagementNudge.forumFollow.title");
  const message = isAi
    ? t("engagementNudge.aiPost.message")
    : t("engagementNudge.forumFollow.message");
  const ctaLabel = isAi
    ? t("engagementNudge.aiPost.cta")
    : t("engagementNudge.forumFollow.cta");
  const laterLabel = isAi
    ? t("engagementNudge.aiPost.later")
    : t("engagementNudge.forumFollow.later");

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="engagement-nudge-title"
      className="fixed inset-0 z-[60] flex items-center justify-center px-4"
    >
      <div
        className="absolute inset-0 bg-black/45 backdrop-blur-[1px]"
        onClick={closeAndAdvance}
        aria-hidden
      />
      <div className="relative w-full max-w-sm rounded-lg border border-black/[0.08] bg-white p-6 shadow-2xl dark:border-white/[0.08] dark:bg-[#111]">
        <h3
          id="engagement-nudge-title"
          className="font-serif text-lg font-medium text-black dark:text-white"
        >
          {title}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-black/65 dark:text-white/55">
          {message}
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            onClick={handleCta}
            className="rounded bg-black px-4 py-2.5 font-label text-sm font-medium text-white transition-colors hover:bg-[#222] dark:bg-white dark:text-black dark:hover:bg-[#e5e5e5]"
          >
            {ctaLabel}
          </button>
          <button
            type="button"
            onClick={closeAndAdvance}
            className="rounded border border-black/[0.12] bg-transparent px-4 py-2.5 font-label text-sm font-medium text-black/70 transition-colors hover:bg-black/[0.04] dark:border-white/[0.16] dark:text-white/70 dark:hover:bg-white/[0.04]"
          >
            {laterLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
