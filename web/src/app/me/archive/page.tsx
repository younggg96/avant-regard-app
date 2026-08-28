"use client";

/**
 * /me/archive — My Archive 个人档案库。
 *
 * 对齐移动端 `frontend/src/screens/Trading/MyArchiveScreen.tsx`。
 *
 * 档案是「我拥有过的单品」台账：订单确认收货后可一键转入，也能手动补录
 * 站外购入的单品。转售时从档案直接生成 listing 草稿，省掉重复填写。
 *
 * 深度分析（总投入 / 均价 / 年份分布）是 Plus 权益，非会员只拿到 preview，
 * 所以这里按 Plus 状态决定拉哪个接口。
 */

import { useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import useSWR from "swr";

import {
  Button,
  EmptyState,
  FormDialog,
  FormField,
  LoadingState,
  Pagination,
  PageHeader,
  TextInput,
} from "@/components/admin/ui";
import { MultiImagePicker } from "@/components/merchant/shared";
import { archiveService, plusService } from "@/lib/services/archive";
import {
  formatPriceCents,
  parsePriceInputToCents,
} from "@/lib/services/store-product";

const PAGE_SIZE = 24;

export default function ArchivePage() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);

  const { data: plus } = useSWR("plus-status", () => plusService.getStatus());
  const isPlus = plus?.isActive ?? false;

  const { data, isLoading, mutate } = useSWR(["archive", page], () =>
    archiveService.list({ page, pageSize: PAGE_SIZE }),
  );

  const { data: analytics } = useSWR(
    isPlus ? "archive-analytics" : null,
    () => archiveService.getAnalytics(),
  );

  const { data: preview } = useSWR(
    isPlus ? null : "archive-analytics-preview",
    () => archiveService.getAnalyticsPreview(),
  );

  const items = data?.items ?? [];
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));

  return (
    <div>
      <PageHeader
        title={t("trading.archive.title")}
        description={t("trading.archive.desc")}
        actions={
          <Button onClick={() => setCreating(true)}>
            {t("trading.archive.addItem")}
          </Button>
        }
      />

      <section className="mb-8 rounded border border-[var(--border)] bg-[var(--canvas-soft)] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="font-label text-[12px] uppercase tracking-widest text-[color:var(--ink-muted)]">
            {t("trading.archive.analytics")}
          </h2>
          {!isPlus && (
            <Link
              href="/me/plus"
              className="font-label text-[12px] underline text-[color:var(--ink-muted)] hover:text-[var(--ink)]"
            >
              {t("trading.archive.unlockWithPlus")}
            </Link>
          )}
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-4 font-label text-[12px] sm:grid-cols-4">
          <Stat
            label={t("trading.archive.totalItems")}
            value={String(analytics?.totalItems ?? preview?.totalItems ?? 0)}
          />
          <Stat
            label={t("trading.archive.totalAcquired")}
            value={
              analytics
                ? formatPriceCents(analytics.totalAcquiredCents)
                : t("trading.archive.locked")
            }
          />
          <Stat
            label={t("trading.archive.avgPrice")}
            value={
              analytics
                ? formatPriceCents(analytics.avgPriceCents)
                : t("trading.archive.locked")
            }
          />
          <Stat
            label={t("trading.archive.brandCount")}
            value={String(
              Object.keys(
                analytics?.brandBreakdown ?? preview?.brandBreakdown ?? {},
              ).length,
            )}
          />
        </dl>
      </section>

      {isLoading ? (
        <LoadingState />
      ) : items.length === 0 ? (
        <EmptyState message={t("trading.archive.empty")} />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/me/archive/${item.id}`}
              className="group block"
            >
              <div className="aspect-square overflow-hidden rounded bg-[var(--canvas-raised)]">
                {item.photos?.[0] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.photos[0]}
                    alt={item.title ?? ""}
                    className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                )}
              </div>
              {item.brandName && (
                <p className="mt-2 font-label text-[11px] uppercase tracking-widest text-[color:var(--ink-muted)]">
                  {item.brandName}
                </p>
              )}
              <p className="mt-0.5 truncate font-label text-[13px] text-[var(--ink)]">
                {item.title ?? `#${item.id}`}
              </p>
              {item.acquiredPriceCents != null && (
                <p className="mt-0.5 font-serif text-[13px] text-[color:var(--ink-muted)]">
                  {formatPriceCents(item.acquiredPriceCents, item.currency)}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} onChange={setPage} />

      <AddArchiveDialog
        open={creating}
        onClose={() => setCreating(false)}
        onDone={() => mutate()}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[color:var(--ink-muted)]">{label}</dt>
      <dd className="mt-0.5 font-serif text-[15px] text-[var(--ink)]">
        {value}
      </dd>
    </div>
  );
}

function AddArchiveDialog({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [brandName, setBrandName] = useState("");
  const [size, setSize] = useState("");
  const [color, setColor] = useState("");
  const [priceInput, setPriceInput] = useState("");
  const [acquiredAt, setAcquiredAt] = useState("");
  const [storageLocation, setStorageLocation] = useState("");
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setTitle("");
    setBrandName("");
    setSize("");
    setColor("");
    setPriceInput("");
    setAcquiredAt("");
    setStorageLocation("");
    setNote("");
    setPhotos([]);
    setError(null);
    onClose();
  };

  const submit = async () => {
    if (!title.trim()) {
      setError(t("trading.archive.titleRequired"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await archiveService.create({
        title: title.trim(),
        brandName: brandName.trim() || undefined,
        size: size.trim() || undefined,
        color: color.trim() || undefined,
        acquiredPriceCents: parsePriceInputToCents(priceInput) ?? undefined,
        acquiredAt: acquiredAt || undefined,
        storageLocation: storageLocation.trim() || undefined,
        note: note.trim() || undefined,
        photos,
      });
      onDone();
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.failed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormDialog
      open={open}
      title={t("trading.archive.addItem")}
      onClose={close}
      wide
    >
      <div className="grid gap-4">
        <FormField label={t("trading.archive.photos")}>
          <MultiImagePicker
            value={photos}
            onChange={setPhotos}
            max={9}
            height={96}
          />
        </FormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t("trading.archive.itemTitle")} required>
            <TextInput value={title} onChange={setTitle} />
          </FormField>
          <FormField label={t("trading.publish.brand")}>
            <TextInput value={brandName} onChange={setBrandName} />
          </FormField>
          <FormField label={t("trading.publish.size")}>
            <TextInput value={size} onChange={setSize} />
          </FormField>
          <FormField label={t("trading.publish.color")}>
            <TextInput value={color} onChange={setColor} />
          </FormField>
          <FormField label={t("trading.archive.acquiredPrice")}>
            <TextInput value={priceInput} onChange={setPriceInput} />
          </FormField>
          <FormField label={t("trading.archive.acquiredAt")}>
            <TextInput value={acquiredAt} onChange={setAcquiredAt} type="date" />
          </FormField>
          <FormField label={t("trading.archive.storageLocation")}>
            <TextInput value={storageLocation} onChange={setStorageLocation} />
          </FormField>
        </div>

        <FormField label={t("trading.archive.note")}>
          <TextInput value={note} onChange={setNote} multiline rows={3} />
        </FormField>

        {error && (
          <p className="font-label text-[12px] text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={close} disabled={submitting}>
            {t("common.cancel")}
          </Button>
          <Button onClick={submit} loading={submitting}>
            {t("common.save")}
          </Button>
        </div>
      </div>
    </FormDialog>
  );
}
