"use client";

/**
 * /settings/reports — my submitted reports.
 *
 * Read-only list. Shows type · target · reason · status badge · created time.
 * Pagination uses `?page=N` in the URL to mirror the /archive/shows pattern.
 */

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import useSWR from "swr";
import {
  moderationService,
  type MyReportsResponse,
} from "@/lib/services/moderation";

const STATUS_COPY: Record<string, { label: string; tone: string }> = {
  PENDING: { label: "审核中", tone: "text-amber-600 dark:text-amber-400" },
  REVIEWED: { label: "已审核", tone: "text-[color:var(--ink-muted)]" },
  RESOLVED: { label: "已处理", tone: "text-green-700 dark:text-green-400" },
  DISMISSED: { label: "已驳回", tone: "text-red-600 dark:text-red-400" },
};

const TARGET_LABEL: Record<string, string> = {
  POST: "帖子",
  COMMENT: "评论",
  MESSAGE: "私信",
  USER: "用户",
};

const PAGE_SIZE = 20;

// `useSearchParams()` needs a <Suspense> boundary for `next build` to
// prerender this route without falling back to full CSR.
function MyReportsPageInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const page = Math.max(1, Number(sp.get("page") || 1));

  const { data, isLoading, error } = useSWR<MyReportsResponse>(
    ["my-reports", page],
    () => moderationService.getMyReports(page, PAGE_SIZE),
  );

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  const goPage = (p: number) => {
    const qs = new URLSearchParams(sp.toString());
    qs.set("page", String(p));
    router.replace(`/settings/reports?${qs.toString()}`);
  };

  return (
    <section className="min-w-0">
      <header className="mb-8 border-b border-[var(--border)] pb-5">
        <h1 className="font-serif text-3xl text-black dark:text-white md:text-4xl">
          我的举报
        </h1>
        <p className="mt-2 font-serif text-[14px] text-[color:var(--ink-muted)]">
          你提交的所有举报和当前处理状态。
        </p>
      </header>

      {isLoading && (
        <div className="font-label text-[12px] uppercase tracking-widest text-[color:var(--ink-muted)]">
          加载中…
        </div>
      )}
      {error && (
        <div className="rounded border border-red-500/20 bg-red-500/5 p-4 font-serif text-sm text-red-600 dark:text-red-400">
          加载失败：{(error as Error).message}
        </div>
      )}

      {!isLoading && !error && data && data.reports.length === 0 && (
        <div className="rounded border border-[var(--border)] bg-[var(--canvas-soft)] p-8 font-serif text-sm text-[color:var(--ink-muted)]">
          还没有任何举报记录。
        </div>
      )}

      {data && data.reports.length > 0 && (
        <>
          <ul className="divide-y divide-[var(--border)] rounded border border-[var(--border)] bg-[var(--canvas)]">
            {data.reports.map((r) => {
              const status = STATUS_COPY[r.status] ?? {
                label: r.status,
                tone: "text-[color:var(--ink-muted)]",
              };
              const time = new Date(r.createdAt).toLocaleString("zh-CN", {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              });

              return (
                <li key={r.id} className="flex items-start gap-4 px-4 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-[var(--canvas-raised)] px-2 py-0.5 font-label text-[11px] uppercase text-[color:var(--ink-muted)]">
                        {TARGET_LABEL[r.targetType] ?? r.targetType}
                      </span>
                      <span className="font-serif text-[15px] text-black dark:text-white">
                        {r.targetInfo?.title || r.targetInfo?.username || `#${r.targetId}`}
                      </span>
                      <span className={`ml-auto font-label text-[11px] uppercase tracking-widest ${status.tone}`}>
                        {status.label}
                      </span>
                    </div>
                    <div className="mt-1 font-label text-[12px] text-[color:var(--ink-muted)]">
                      原因：{r.reason}
                      {r.description ? ` · ${r.description}` : ""}
                    </div>
                    <div className="mt-1 font-label text-[11px] uppercase tracking-widest text-[color:var(--ink-muted)]">
                      {time}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2 font-label text-[12px]">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => goPage(page - 1)}
                className="rounded border border-[var(--border)] px-3 py-1.5 text-[var(--ink)] disabled:opacity-40"
              >
                上一页
              </button>
              <span className="text-[color:var(--ink-muted)]">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => goPage(page + 1)}
                className="rounded border border-[var(--border)] px-3 py-1.5 text-[var(--ink)] disabled:opacity-40"
              >
                下一页
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default function MyReportsPage() {
  return (
    <Suspense fallback={null}>
      <MyReportsPageInner />
    </Suspense>
  );
}
