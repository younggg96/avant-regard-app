"use client";

import { useEffect, useState, useCallback } from "react";
import { reportsApi, type AdminReport } from "@/lib/services/admin";
import {
  PageHeader,
  FilterChips,
  StatusBadge,
  Pagination,
  EmptyState,
  LoadingState,
  Button,
} from "@/components/admin/ui";


const STATUS_OPTIONS = [
  { value: "PENDING" as const, label: "待处理" },
  { value: "RESOLVED" as const, label: "已解决" },
  { value: "DISMISSED" as const, label: "已驳回" },
];

type ReportStatus = (typeof STATUS_OPTIONS)[number]["value"];

const TARGET_LABELS: Record<string, string> = {
  POST: "帖子",
  COMMENT: "评论",
  MESSAGE: "私信",
  USER: "用户",
};

const STATUS_VARIANTS: Record<string, "warning" | "success" | "muted" | "info"> = {
  PENDING: "warning",
  REVIEWED: "info",
  RESOLVED: "success",
  DISMISSED: "muted",
};

export default function ReportsPage() {
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<ReportStatus>();
  const [acting, setActing] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await reportsApi.getAll(statusFilter, page, 20);
      setReports(data.reports);
      setTotal(data.total);
      setTotalPages(Math.ceil(data.total / 20));
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [statusFilter]);

  const handleStatus = async (id: number, status: string) => {
    setActing(id);
    try {
      await reportsApi.updateStatus(id, status);
      load();
    } finally {
      setActing(null);
    }
  };

  return (
    <div>
      <PageHeader title="举报管理" description={`共 ${total} 条举报记录`} />

      <div className="mb-4">
        <FilterChips options={STATUS_OPTIONS} value={statusFilter} onChange={setStatusFilter} allLabel="全部" />
      </div>

      {loading ? (
        <LoadingState />
      ) : reports.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
            <table className="w-full font-label text-[13px]">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--canvas-soft)]">
                  <th className="px-4 py-2.5 text-left text-[11px] tracking-wider text-[color:var(--ink-muted)]">举报人</th>
                  <th className="px-4 py-2.5 text-left text-[11px] tracking-wider text-[color:var(--ink-muted)]">目标</th>
                  <th className="px-4 py-2.5 text-left text-[11px] tracking-wider text-[color:var(--ink-muted)]">原因</th>
                  <th className="px-4 py-2.5 text-left text-[11px] tracking-wider text-[color:var(--ink-muted)]">描述</th>
                  <th className="px-4 py-2.5 text-left text-[11px] tracking-wider text-[color:var(--ink-muted)]">状态</th>
                  <th className="px-4 py-2.5 text-left text-[11px] tracking-wider text-[color:var(--ink-muted)]">时间</th>
                  <th className="px-4 py-2.5 text-right text-[11px] tracking-wider text-[color:var(--ink-muted)]">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {reports.map((r) => (
                  <tr key={r.id} className="hover:bg-[var(--canvas-soft)] transition-colors">
                    <td className="px-4 py-3">@{r.reporterName}</td>
                    <td className="px-4 py-3">
                      <StatusBadge variant="info">{TARGET_LABELS[r.targetType] || r.targetType}</StatusBadge>
                      <span className="ml-1 text-[color:var(--ink-muted)]">#{r.targetId}</span>
                    </td>
                    <td className="px-4 py-3 text-[color:var(--ink-muted)]">{r.reason}</td>
                    <td className="px-4 py-3 max-w-[200px]">
                      <div className="truncate text-[color:var(--ink-muted)]">{r.description || "—"}</div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge variant={STATUS_VARIANTS[r.status] || "muted"}>
                        {r.status === "PENDING" ? "待处理" :
                         r.status === "RESOLVED" ? "已解决" :
                         r.status === "DISMISSED" ? "已驳回" : r.status}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[color:var(--ink-muted)]">
                      {new Date(r.createdAt).toLocaleDateString("zh-CN")}
                    </td>
                    <td className="px-4 py-3">
                      {r.status === "PENDING" && (
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleStatus(r.id, "RESOLVED")}
                            disabled={acting === r.id}
                          >
                            解决
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleStatus(r.id, "DISMISSED")}
                            disabled={acting === r.id}
                          >
                            驳回
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </>
      )}
    </div>
  );
}
