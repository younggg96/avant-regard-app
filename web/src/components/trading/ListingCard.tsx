"use client";

/**
 * 单品网格卡片。
 *
 * 交易大厅、策展位、详情页的「相关单品」「TA 的其他单品」共用一张卡，
 * 保证同一件单品在任何位置的视觉与信息密度一致。
 *
 * 链接一律指向 `/listings/[id]`：C2C 单品没有 storeId，走不了
 * `/stores/[id]/products/[productId]`。
 */

import Link from "next/link";
import { useTranslation } from "react-i18next";

import type { Listing } from "@/lib/services/listing";
import {
  formatPriceCents,
  normalizeProductStatus,
} from "@/lib/services/store-product";

export function ListingCard({ listing }: { listing: Listing }) {
  const { t } = useTranslation();
  const status = normalizeProductStatus(listing.status);
  const sold = status === "sold";

  return (
    <Link href={`/listings/${listing.id}`} className="group block">
      <div className="relative aspect-[3/4] overflow-hidden rounded bg-[var(--canvas-raised)]">
        {listing.images?.[0] && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={listing.images[0]}
            alt={listing.title}
            className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        )}
        {sold && (
          <div className="absolute inset-0 grid place-items-center bg-black/45">
            <span className="font-label text-[12px] uppercase tracking-[0.2em] text-white">
              {t("trading.soldOut")}
            </span>
          </div>
        )}
        {!sold && listing.isNew && (
          <span className="absolute left-2 top-2 rounded bg-[var(--ink)] px-2 py-0.5 font-label text-[10px] uppercase tracking-widest text-[var(--canvas)]">
            NEW
          </span>
        )}
      </div>

      {listing.brand && (
        <p className="mt-2 truncate font-label text-[11px] uppercase tracking-widest text-[color:var(--ink-muted)]">
          {listing.brand}
        </p>
      )}
      <p className="mt-0.5 truncate font-label text-[13px] text-[var(--ink)]">
        {listing.title}
      </p>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="font-serif text-[14px] font-semibold text-[var(--ink)]">
          {formatPriceCents(listing.priceCents, listing.currency)}
        </span>
        {listing.size && (
          <span className="font-label text-[11px] text-[color:var(--ink-muted)]">
            {listing.size}
          </span>
        )}
      </div>
    </Link>
  );
}
