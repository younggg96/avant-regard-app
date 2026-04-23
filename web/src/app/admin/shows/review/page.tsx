"use client";

import { useEffect, useState, useCallback } from "react";
import { showsApi, type AdminShow } from "@/lib/services/admin";
import {
  PageHeader,
  StatusBadge,
  EmptyState,
  LoadingState,
  PromptDialog,
  Button,
} from "@/components/admin/ui";


export default function ShowReviewPage() {
  const [shows, setShows] = useState<AdminShow[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectTarget, setRejectTarget] = useState<AdminShow | null>(null);
  const [acting, setActing] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setShows((await showsApi.getPending()).shows);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (id: number) => {
    setActing(id);
    try {
      await showsApi.approve(id);
      load();
    } finally {
      setActing(null);
    }
  };

  const handleReject = async (id: number, reason: string) => {
    setActing(id);
    try {
      await showsApi.reject(id, reason || undefined);
      setRejectTarget(null);
      load();
    } finally {
      setActing(null);
    }
  };

  return (
    <div>
      <PageHeader title="秀场审核" description={`${shows.length} 场待审核`} />

      {loading ? (
        <LoadingState />
      ) : shows.length === 0 ? (
        <EmptyState message="暂无待审核秀场" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shows.map((s) => (
            <div key={s.id} className="rounded-lg border border-[var(--border)] overflow-hidden">
              {s.coverImage && <img src={s.coverImage} alt="" className="h-36 w-full object-cover" />}
              <div className="p-4 font-label">
                <h3 className="text-[14px] font-semibold">{s.brandName}</h3>
                <div className="mt-1 text-[12px] text-[color:var(--ink-muted)]">
                  <div>季节: {s.season}</div>
                  {s.category && <div>分类: {s.category}</div>}
                  {s.submitterName && <div>提交人: @{s.submitterName}</div>}
                  <div>图片: {s.imageCount ?? 0} 张</div>
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
