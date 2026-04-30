"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { useTranslation } from "react-i18next";
import { brandsApi, type AdminBrandImage } from "@/lib/services/admin";
import {
  PageHeader,
  EmptyState,
  LoadingState,
  ConfirmDialog,
} from "@/components/admin/ui";


export default function BrandImagesPage() {
  const { t } = useTranslation();
  const [images, setImages] = useState<AdminBrandImage[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<AdminBrandImage | null>(null);
  const [acting, setActing] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await brandsApi.getPendingImages();
      setImages(data.images);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (id: number) => {
    setActing(id);
    try {
      await brandsApi.approveImage(id);
      load();
    } finally {
      setActing(null);
    }
  };

  const handleReject = async (id: number) => {
    setActing(id);
    try {
      await brandsApi.rejectImage(id);
      load();
    } finally {
      setActing(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setActing(deleteTarget.id);
    try {
      await brandsApi.deleteImage(deleteTarget.id);
      setDeleteTarget(null);
      load();
    } finally {
      setActing(null);
    }
  };

  return (
    <div>
      <PageHeader title={t("admin.brandImagesTitle")} description={t("admin.brandImagesDesc", { count: total })} />

      {loading ? (
        <LoadingState />
      ) : images.length === 0 ? (
        <EmptyState message={t("admin.noPendingImages")} />
      ) : (
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {images.map((img) => (
            <div key={img.id} className="rounded-lg border border-[var(--border)] overflow-hidden">
              <div className="relative aspect-square w-full">
                <Image
                  src={img.imageUrl}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 20vw"
                />
              </div>
              <div className="p-3 font-label">
                <p className="truncate text-[12px] text-[color:var(--ink-muted)]">
                  {img.brandName || `Brand #${img.brandId}`}
                </p>
                <div className="mt-2 flex gap-1">
                  <button
                    onClick={() => handleApprove(img.id)}
                    disabled={acting === img.id}
                    className="flex-1 rounded border border-[var(--border)] py-1.5 text-center font-label text-[11px] text-[color:var(--ink-muted)] transition-colors hover:bg-[var(--canvas-raised)] hover:text-[var(--ink)] disabled:opacity-40"
                  >
                    {t("admin.approve")}
                  </button>
                  <button
                    onClick={() => handleReject(img.id)}
                    disabled={acting === img.id}
                    className="flex-1 rounded border border-[var(--border)] py-1.5 text-center font-label text-[11px] text-[color:var(--ink-muted)] transition-colors hover:bg-[var(--canvas-raised)] hover:text-[var(--ink)] disabled:opacity-40"
                  >
                    {t("admin.reject")}
                  </button>
                  <button
                    onClick={() => setDeleteTarget(img)}
                    disabled={acting === img.id}
                    className="flex-1 rounded border border-[var(--border)] py-1.5 text-center font-label text-[11px] text-[color:var(--ink-muted)] transition-colors hover:bg-[var(--canvas-raised)] hover:text-[var(--ink)] disabled:opacity-40"
                  >
                    {t("admin.delete")}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title={t("admin.confirmDeleteImage")}
        confirmLabel={t("admin.delete")}
        loading={!!acting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
