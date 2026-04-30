"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
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


export default function ReportsPage() {
  const { t } = useTranslation();

  const STATUS_OPTIONS = [
    { value: "PENDING" as const, label: t("admin.statusPendingReport") },
    { value: "RESOLVED" as const, label: t("admin.statusResolved") },
    { value: "DISMISSED" as const, label: t("admin.statusDismissed") },
  ];

  const TARGET_LABELS: Record<string, string> = {
    POST: t("admin.targetPost"),
    COMMENT: t("admin.targetComment"),
    MESSAGE: t("admin.targetMessage"),
    USER: t("admin.targetUser"),
  };

  const STATUS_LABEL: Record<string, string> = {
    PENDING: t("admin.statusPendingReport"),
    RESOLVED: t("admin.statusResolved"),
    DISMISSED: t("admin.statusDismissed"),
  };

  type ReportStatus = (typeof STATUS_OPTIONS)[number]["value"];

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
      <PageHeader title={t("admin.reports")} description={t("admin.reportTotal", { count: total })} />

      <div className="mb-4">
        <FilterChips options={STATUS_OPTIONS} value={statusFilter} onChange={setStatusFilter} allLabel={t("admin.all")} />
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
                  <th className="px-4 py-2.5 text-left text-[11px] tracking-wider text-[color:var(--ink-muted)]">{t("admin.colReporter")}</th>
                  <th className="px-4 py-2.5 text-left text-[11px] tracking-wider text-[color:var(--ink-muted)]">{t("admin.colTarget")}</th>
                  <th className="px-4 py-2.5 text-left text-[11px] tracking-wider text-[color:var(--ink-muted)]">{t("admin.colReason")}</th>
                  <th className="px-4 py-2.5 text-left text-[11px] tracking-wider text-[color:var(--ink-muted)]">{t("admin.colDescription")}</th>
                  <th className="px-4 py-2.5 text-left text-[11px] tracking-wider text-[color:var(--ink-muted)]">{t("admin.colStatus")}</th>
                  <th className="px-4 py-2.5 text-left text-[11px] tracking-wider text-[color:var(--ink-muted)]">{t("admin.colTime")}</th>
                  <th className="px-4 py-2.5 text-right text-[11px] tracking-wider text-[color:var(--ink-muted)]">{t("admin.colActions")}</th>
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
                      <StatusBadge active={r.status === "PENDING"}>
                        {STATUS_LABEL[r.status] || r.status}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[color:var(--ink-muted)]">
                      {new Date(r.createdAt).toLocaleDateString()}
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
                            {t("admin.resolve")}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleStatus(r.id, "DISMISSED")}
                            disabled={acting === r.id}
                          >
                            {t("admin.dismiss")}
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
