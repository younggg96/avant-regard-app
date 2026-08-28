"use client";

/**
 * /me/listings — 个人卖家的单品库存。
 *
 * 对齐移动端 `frontend/src/screens/SellerListingsScreen.tsx`。
 * 与 `/me/merchant/[id]/products`（买手店商品）是两条线：这里走
 * `/api/sellers/me/listings` + `/api/listings/*`，个人卖家也能用。
 *
 * 状态机决定了可做什么：
 *   draft / rejected → 继续编辑、删除
 *   active           → 下架
 *   offline          → 重新上架（走 transition，后端会重新校验）
 *   reviewing / frozen / sold → 只读
 */

import { useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import useSWR from "swr";

import {
  Button,
  ConfirmDialog,
  EmptyState,
  LoadingState,
  Pagination,
  PageHeader,
  StatusBadge,
} from "@/components/admin/ui";
import {
  calculateExpectedPayout,
  listingService,
  type Listing,
} from "@/lib/services/listing";
import {
  formatPriceCents,
  normalizeProductStatus,
  type CanonicalProductStatus,
} from "@/lib/services/store-product";

const PAGE_SIZE = 20;

/** Tab 顺序按卖家的关注度排：在售最常看，草稿次之，售出最后。 */
const STATUS_TABS: Array<CanonicalProductStatus | ""> = [
  "",
  "active",
  "draft",
  "reviewing",
  "offline",
  "rejected",
  "sold",
];

const STATUS_I18N_KEY: Record<CanonicalProductStatus, string> = {
  draft: "merchant.statusDraft",
  reviewing: "merchant.statusReviewing",
  active: "merchant.statusPublished",
  frozen: "merchant.statusFrozen",
  sold: "merchant.statusSoldOut",
  rejected: "merchant.statusRejected",
  offline: "merchant.statusHidden",
};

export default function MyListingsPage() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<CanonicalProductStatus | "">("");
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<Listing | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: summary, mutate: mutateSummary } = useSWR(
    "listings-summary",
    () => listingService.getMySummary(),
  );

  const { data, isLoading, mutate } = useSWR(
    ["my-listings", status || "all", page],
    () => listingService.listMine({ status, page, pageSize: PAGE_SIZE }),
  );

  const items = data?.products ?? [];
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));

  const refresh = async () => {
    await Promise.all([mutate(), mutateSummary()]);
  };

  const runAction = async (id: number, action: () => Promise<unknown>) => {
    setBusyId(id);
    setError(null);
    try {
      await action();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.failed"));
    } finally {
      setBusyId(null);
    }
  };

  const countFor = (s: CanonicalProductStatus | "") => {
    if (!summary) return null;
    if (!s) return Object.values(summary).reduce((a, b) => a + b, 0);
    return summary[s as keyof typeof summary] ?? 0;
  };

  return (
    <div>
      <PageHeader
        title={t("trading.myListings")}
        description={t("trading.myListingsDesc")}
        actions={
          <Link
            href="/me/listings/new"
            className="inline-flex items-center justify-center rounded bg-[var(--ink)] px-4 py-2 font-label text-[13px] text-[var(--canvas)] transition-opacity hover:opacity-80"
          >
            {t("trading.publishListing")}
          </Link>
        }
      />

      <div className="mb-5 flex flex-wrap gap-1.5 font-label text-[12px]">
        {STATUS_TABS.map((s) => {
          const count = countFor(s);
          const label = s ? t(STATUS_I18N_KEY[s]) : t("trading.filterAll");
          return (
            <button
              key={s || "all"}
              onClick={() => {
                setStatus(s);
                setPage(1);
              }}
              className={`rounded-full border px-3 py-1 transition-colors ${
                status === s
                  ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--canvas)]"
                  : "border-[var(--border)] text-[color:var(--ink-muted)] hover:border-[var(--ink-muted)]"
              }`}
            >
              {label}
              {count != null && count > 0 && ` ${count}`}
            </button>
          );
        })}
      </div>

      {error && (
        <p className="mb-4 font-label text-[12px] text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {isLoading ? (
        <LoadingState />
      ) : items.length === 0 ? (
        <EmptyState message={t("trading.emptyListings")} />
      ) : (
        <div className="space-y-3">
          {items.map((listing) => (
            <ListingRow
              key={listing.id}
              listing={listing}
              busy={busyId === listing.id}
              onTransition={(target) =>
                runAction(listing.id, () =>
                  listingService.transition(listing.id, target),
                )
              }
              onSubmit={() =>
                runAction(listing.id, () =>
                  listingService.submitForReview(listing.id),
                )
              }
              onDelete={() => setDeleteTarget(listing)}
            />
          ))}
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} onChange={setPage} />

      <ConfirmDialog
        open={!!deleteTarget}
        title={t("trading.confirmDeleteListing")}
        message={deleteTarget?.title}
        loading={busyId === deleteTarget?.id}
        onConfirm={() => {
          const target = deleteTarget;
          if (!target) return;
          runAction(target.id, () =>
            listingService.batchDelete([target.id]),
          ).then(() => setDeleteTarget(null));
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function ListingRow({
  listing,
  busy,
  onTransition,
  onSubmit,
  onDelete,
}: {
  listing: Listing;
  busy: boolean;
  onTransition: (target: CanonicalProductStatus) => void;
  onSubmit: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const status = normalizeProductStatus(listing.status);
  const editable = status === "draft" || status === "rejected";

  return (
    <article className="flex gap-4 rounded border border-[var(--border)] bg-[var(--canvas-soft)] p-4">
      <div className="size-20 shrink-0 overflow-hidden rounded bg-[var(--canvas-raised)]">
        {listing.images?.[0] && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={listing.images[0]}
            alt={listing.title}
            className="size-full object-cover"
          />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {listing.brand && (
              <p className="font-label text-[11px] uppercase tracking-widest text-[color:var(--ink-muted)]">
                {listing.brand}
              </p>
            )}
            <p className="mt-0.5 truncate font-label text-[13px] text-[var(--ink)]">
              {listing.title}
            </p>
          </div>
          <StatusBadge active={status === "active"}>
            {t(STATUS_I18N_KEY[status])}
          </StatusBadge>
        </div>

        <p className="mt-2 font-serif text-[15px] font-semibold text-[var(--ink)]">
          {formatPriceCents(listing.priceCents, listing.currency)}
        </p>
        <p className="mt-0.5 font-label text-[11px] text-[color:var(--ink-muted)]">
          {t("trading.expectedPayout", {
            price: formatPriceCents(
              calculateExpectedPayout(
                listing.priceCents,
                listing.commissionRateBps,
              ),
              listing.currency,
            ),
          })}
        </p>

        {status === "rejected" && listing.rejectedReason && (
          <p className="mt-2 font-label text-[11px] text-red-600 dark:text-red-400">
            {listing.rejectedReason}
          </p>
        )}

        <div className="mt-3 flex flex-wrap justify-end gap-2">
          {(status === "active" || status === "sold") && (
            <Link
              href={`/listings/${listing.id}`}
              className="inline-flex items-center justify-center rounded border border-[var(--border)] px-3 py-1.5 font-label text-[12px] text-[color:var(--ink-muted)] transition-colors hover:text-[var(--ink)]"
            >
              {t("trading.viewListing")}
            </Link>
          )}
          {editable && (
            <Link
              href={`/me/listings/${listing.id}/edit`}
              className="inline-flex items-center justify-center rounded border border-[var(--border)] px-3 py-1.5 font-label text-[12px] text-[color:var(--ink-muted)] transition-colors hover:text-[var(--ink)]"
            >
              {t("common.edit")}
            </Link>
          )}
          {editable && (
            <Button size="sm" onClick={onSubmit} disabled={busy}>
              {t("trading.submitForReview")}
            </Button>
          )}
          {status === "active" && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onTransition("offline")}
              disabled={busy}
            >
              {t("trading.takeOffline")}
            </Button>
          )}
          {status === "offline" && (
            <Button
              size="sm"
              onClick={() => onTransition("active")}
              disabled={busy}
            >
              {t("trading.putOnline")}
            </Button>
          )}
          {editable && (
            <Button
              size="sm"
              variant="danger"
              onClick={onDelete}
              disabled={busy}
            >
              {t("common.delete")}
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
