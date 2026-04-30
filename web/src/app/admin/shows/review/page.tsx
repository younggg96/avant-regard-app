"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { useTranslation } from "react-i18next";
import { showsApi, type AdminShow } from "@/lib/services/admin";
import {
  PageHeader,
  EmptyState,
  LoadingState,
  PromptDialog,
  Button,
} from "@/components/admin/ui";


export default function ShowReviewPage() {
  const { t } = useTranslation();
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
      <PageHeader title={t("admin.showReview")} description={t("admin.showReviewDesc", { count: shows.length })} />

      {loading ? (
        <LoadingState />
      ) : shows.length === 0 ? (
        <EmptyState message={t("admin.noPendingShows")} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shows.map((s) => (
            <div key={s.id} className="rounded-lg border border-[var(--border)] overflow-hidden">
              {s.coverImage && (
                <div className="relative h-36 w-full">
                  <Image
                    src={s.coverImage}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                </div>
              )}
              <div className="p-4 font-label">
                <h3 className="text-[14px] font-semibold">{s.brandName}</h3>
                <div className="mt-1 text-[12px] text-[color:var(--ink-muted)]">
                  <div>{t("admin.seasonLabel", { season: s.season })}</div>
                  {s.category && <div>{t("admin.categoryLabel", { category: s.category })}</div>}
                  {s.submitterName && <div>{t("admin.submitter", { name: s.submitterName })}</div>}
                  <div>{t("admin.imageCount", { count: s.imageCount ?? 0 })}</div>
                </div>
                <div className="mt-3 flex gap-2 border-t border-[var(--border)] pt-3">
                  <Button size="sm" onClick={() => handleApprove(s.id)} loading={acting === s.id}>
                    {t("admin.approve")}
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setRejectTarget(s)}>
                    {t("admin.reject")}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <PromptDialog
        open={!!rejectTarget}
        title={t("admin.rejectReason")}
        placeholder={t("admin.rejectReasonPlaceholder")}
        confirmLabel={t("admin.reject")}
        loading={!!acting}
        onConfirm={(reason) => rejectTarget && handleReject(rejectTarget.id, reason)}
        onCancel={() => setRejectTarget(null)}
      />
    </div>
  );
}
