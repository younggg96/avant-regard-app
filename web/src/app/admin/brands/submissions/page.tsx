"use client";

import { useEffect, useState, useCallback } from "react";
import { brandSubmissionsApi, type AdminBrandSubmission } from "@/lib/services/admin";
import {
  PageHeader,
  StatusBadge,
  EmptyState,
  LoadingState,
  PromptDialog,
  Button,
} from "@/components/admin/ui";


export default function BrandSubmissionsPage() {
  const [submissions, setSubmissions] = useState<AdminBrandSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectTarget, setRejectTarget] = useState<AdminBrandSubmission | null>(null);
  const [acting, setActing] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSubmissions(await brandSubmissionsApi.getPending());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (id: number) => {
    setActing(id);
    try {
      await brandSubmissionsApi.approve(id);
      load();
    } finally {
      setActing(null);
    }
  };

  const handleReject = async (id: number, reason: string) => {
    setActing(id);
    try {
      await brandSubmissionsApi.reject(id, reason || undefined);
      setRejectTarget(null);
      load();
    } finally {
      setActing(null);
    }
  };

  return (
    <div>
      <PageHeader title="品牌审核" description={`${submissions.length} 条待审核`} />

      {loading ? (
        <LoadingState />
      ) : submissions.length === 0 ? (
        <EmptyState message="暂无待审核品牌提交" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {submissions.map((s) => (
            <div key={s.id} className="rounded-lg border border-[var(--border)] overflow-hidden">
              {s.coverImage && (
                <img src={s.coverImage} alt="" className="h-32 w-full object-cover" />
              )}
              <div className="p-4 font-label">
                <h3 className="text-[14px] font-semibold">{s.name}</h3>
                <div className="mt-1 space-y-0.5 text-[12px] text-[color:var(--ink-muted)]">
                  <div>提交人: @{s.username}</div>
                  {s.category && <div>分类: {s.category}</div>}
                  {s.country && <div>国家: {s.country}</div>}
                  {s.founder && <div>创始人: {s.founder}</div>}
                  {s.foundedYear && <div>创立: {s.foundedYear}</div>}
                </div>
                <div className="mt-3 flex gap-2 border-t border-[var(--border)] pt-3">
                  <Button size="sm" onClick={() => handleApprove(s.id)} loading={acting === s.id}>
                    通过
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setRejectTarget(s)}>
                    拒绝
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <PromptDialog
        open={!!rejectTarget}
        title="拒绝原因"
        placeholder="请输入拒绝原因（可选）"
        confirmLabel="拒绝"
        loading={!!acting}
        onConfirm={(reason) => rejectTarget && handleReject(rejectTarget.id, reason)}
        onCancel={() => setRejectTarget(null)}
      />
    </div>
  );
}
