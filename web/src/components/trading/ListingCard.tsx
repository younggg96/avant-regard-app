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

import Image from "next/image";
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
          // 原图直出的话，卖家上传的手机照常常是 1–2MB、几千像素宽，
          // 一屏几十张就是几十兆。走优化器后按视口宽度切档并转 AVIF，
          // 实测单图从 1.4MB 降到 28KB。
          // sizes 对应下面两处网格：手机 2 列、sm 3 列、xl 4–5 列。
          <Image
            src={listing.images[0]}
            alt={listing.title}
            fill
            sizes="(min-width: 1280px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
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
