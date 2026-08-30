"use client";

/**
 * /listings/[id] —— C2C 单品详情 view.
 *
 * 对齐移动端 `StoreProductDetailScreen` 的富详情形态：
 *   - 图片轮播 + 价格 / 成色 / 尺码 / 颜色 / 发货地
 *   - 交易操作条（立即购买 / 出价 / 想要）
 *   - 卖家卡（等级 / 好评率 / 成交数 / 在售数）
 *   - 关联秀场、履历、价格基准
 *   - TA 的其他单品、相关推荐、双盲评价、评论
 *
 * 首屏商品从 SSR 传入；富数据（卖家 / 秀场 / 推荐 / 评价）在客户端再取一次，
 * 任一子块失败都不影响主体渲染——后端本身就是「子查询失败回退空值」的约定。
 */

import { useCallback, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Eye, Heart, MessageCircle, Star } from "lucide-react";
import useSWR from "swr";

import { ListingCard } from "@/components/trading/ListingCard";
import { PriceBenchmark } from "@/components/trading/PriceBenchmark";
import { ProductComments } from "@/components/trading/ProductComments";
import { TradingActionBar } from "@/components/trading/TradingActionBar";
import { useAuthStore } from "@/lib/auth/store";
import type { Listing } from "@/lib/services/listing";
import {
  getListingRichDetail,
  type ProductDetailReviewItem,
  type ProductDetailSeller,
} from "@/lib/services/marketplace";
import {
  formatPriceCents,
  storeProductService,
} from "@/lib/services/store-product";
import {
  formatProvenanceEvent,
  getProductProvenance,
} from "@/lib/services/trading-extras";
import { MARKETPLACE_CONDITIONS } from "@/lib/trading/taxonomy";

export function ListingDetailView({
  initialListing,
}: {
  initialListing: Listing;
}) {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [activeImage, setActiveImage] = useState(0);

  const { data: rich } = useSWR(
    ["listing-rich-detail", initialListing.id],
    () => getListingRichDetail(initialListing.id),
    { revalidateOnFocus: false },
  );

  const { data: provenance = [] } = useSWR(
    ["listing-provenance", initialListing.id],
    () => getProductProvenance(initialListing.id),
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );

  const listing = rich?.product ?? initialListing;
  const images = listing.images ?? [];
  const safeIdx = Math.min(activeImage, Math.max(0, images.length - 1));
  const currentImage = images[safeIdx];

  const next = useCallback(() => {
    if (images.length === 0) return;
    setActiveImage((i) => (i + 1) % images.length);
  }, [images.length]);
  const prev = useCallback(() => {
    if (images.length === 0) return;
    setActiveImage((i) => (i - 1 + images.length) % images.length);
  }, [images.length]);

  // ── 点赞（乐观更新，失败回滚） ──
  const [liked, setLiked] = useState<boolean | null>(null);
  const [likeDelta, setLikeDelta] = useState(0);
  const [liking, setLiking] = useState(false);
  const likedByMe = liked ?? listing.likedByMe ?? false;

  const onToggleLike = async () => {
    if (!user) {
      window.location.href = "/auth/login";
      return;
    }
    if (liking) return;
    setLiking(true);
    const wasLiked = likedByMe;
    setLiked(!wasLiked);
    setLikeDelta((d) => d + (wasLiked ? -1 : 1));
    try {
      if (wasLiked) await storeProductService.unlikeProduct(listing.id);
      else await storeProductService.likeProduct(listing.id);
    } catch {
      setLiked(wasLiked);
      setLikeDelta((d) => d - (wasLiked ? -1 : 1));
    } finally {
      setLiking(false);
    }
  };

  const conditionLabel = MARKETPLACE_CONDITIONS.find(
    (c) => c.value === listing.condition,
  )?.labelKey;

  const shipFrom = [
    listing.shipFromCity,
    listing.shipFromState,
    listing.shipFromCountry,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="mx-auto max-w-content px-6 py-8 md:py-10">
      <nav className="mb-6 flex items-center gap-3 font-label text-[12px] text-[color:var(--ink-muted)]">
        <Link href="/marketplace" className="hover:text-[var(--ink)]">
          {t("trading.marketplace.title")}
        </Link>
        <span>/</span>
        <span className="truncate text-[var(--ink)]">{listing.title}</span>
      </nav>

      <div className="grid gap-8 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        {/* 左：图片 */}
        <div>
          <div className="relative aspect-[3/4] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--canvas-raised)]">
            {currentImage ? (
              // 本页的 LCP 元素，priority 让它跳过懒加载、直接进预加载队列。
              <Image
                src={currentImage}
                alt={listing.title}
                fill
                priority
                sizes="(min-width: 768px) 55vw, 100vw"
                className="object-cover"
              />
            ) : (
              <div className="grid h-full place-items-center font-label text-[12px] text-[color:var(--ink-muted)]">
                {t("product.noImage")}
              </div>
            )}
            {images.length > 1 && (
              <>
                <button
                  type="button"
                  aria-label={t("common.previousPage")}
                  onClick={prev}
                  className="absolute left-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
                >
                  ‹
                </button>
                <button
                  type="button"
                  aria-label={t("common.nextPage")}
                  onClick={next}
                  className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
                >
                  ›
                </button>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-2 py-0.5 font-label text-[11px] text-white backdrop-blur-sm">
                  {safeIdx + 1} / {images.length}
                </div>
              </>
            )}
          </div>

          {images.length > 1 && (
            <div className="mt-3 grid grid-cols-6 gap-2">
              {images.map((src, i) => (
                <button
                  key={`${src}-${i}`}
                  onClick={() => setActiveImage(i)}
                  className={`relative aspect-square overflow-hidden rounded border transition-colors ${
                    i === safeIdx
                      ? "border-[var(--ink)]"
                      : "border-[var(--border)] hover:border-[var(--ink-muted)]"
                  }`}
                >
                  <Image
                    src={src}
                    alt=""
                    fill
                    sizes="(min-width: 768px) 10vw, 17vw"
                    className="object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 右：信息 + 操作 */}
        <div className="flex flex-col gap-5">
          <div>
            {listing.categoryKind && (
              <div className="font-label text-[11px] uppercase tracking-widest text-[color:var(--ink-muted)]">
                {listing.categoryKind}
              </div>
            )}
            <h1 className="mt-1 font-serif text-[26px] leading-tight text-[var(--ink)]">
              {listing.title}
            </h1>
            {listing.brand && (
              <div className="mt-1 font-serif text-[15px] text-[color:var(--ink-muted)]">
                {listing.brand}
              </div>
            )}
          </div>

          <div className="font-serif text-[26px] font-semibold text-[var(--ink)]">
            {formatPriceCents(listing.priceCents, listing.currency)}
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 font-label text-[12px]">
            {conditionLabel && (
              <Spec label={t("trading.publish.condition")} value={t(conditionLabel)} />
            )}
            {listing.size && (
              <Spec label={t("trading.publish.size")} value={listing.size} />
            )}
            {listing.color && (
              <Spec
                label={t("trading.publish.color")}
                value={t(`trading.taxonomy.color${cap(listing.color)}`, {
                  defaultValue: listing.color,
                })}
              />
            )}
            {shipFrom && (
              <Spec label={t("trading.publish.shipFrom")} value={shipFrom} />
            )}
          </dl>

          {listing.conditionNote && (
            <p className="rounded border border-[var(--border)] bg-[var(--canvas-soft)] px-3 py-2 font-label text-[12px] text-[color:var(--ink-muted)]">
              {listing.conditionNote}
            </p>
          )}

          <TradingActionBar product={listing} />

          <div className="flex items-center gap-3">
            <button
              onClick={onToggleLike}
              disabled={liking}
              className={`flex items-center gap-1.5 rounded-full border px-4 py-1.5 font-label text-[13px] transition-colors ${
                likedByMe
                  ? "border-red-600 bg-red-50 text-red-600 dark:bg-red-950/30"
                  : "border-[var(--border)] bg-[var(--canvas)] text-[var(--ink)] hover:border-[var(--ink)]"
              } disabled:opacity-50`}
            >
              <Heart
                className="size-4 shrink-0"
                fill={likedByMe ? "currentColor" : "none"}
                strokeWidth={2}
                aria-hidden
              />
              <span>{Math.max(0, listing.likeCount + likeDelta)}</span>
            </button>
            <span className="inline-flex items-center gap-1 font-label text-[12px] text-[color:var(--ink-muted)]">
              <MessageCircle className="size-3.5" strokeWidth={2} aria-hidden />
              {listing.commentCount}
            </span>
            <span className="inline-flex items-center gap-1 font-label text-[12px] text-[color:var(--ink-muted)]">
              <Eye className="size-3.5" strokeWidth={2} aria-hidden />
              {listing.viewCount}
            </span>
          </div>

          {listing.description && (
            <div>
              <h2 className="mb-2 font-label text-[11px] uppercase tracking-widest text-[color:var(--ink-muted)]">
                {t("product.detail")}
              </h2>
              <p className="whitespace-pre-wrap font-serif text-[14px] leading-relaxed text-[var(--ink)]">
                {listing.description}
              </p>
            </div>
          )}

          {listing.accessoriesNote && (
            <div>
              <h2 className="mb-2 font-label text-[11px] uppercase tracking-widest text-[color:var(--ink-muted)]">
                {t("trading.publish.accessories")}
              </h2>
              <p className="font-serif text-[14px] text-[var(--ink)]">
                {listing.accessoriesNote}
              </p>
            </div>
          )}

          {rich?.seller && <SellerCard seller={rich.seller} />}

          {rich?.show && (
            <Link
              href={`/archive/shows/${rich.show.id}`}
              className="flex items-center gap-3 rounded border border-[var(--border)] p-3 transition-colors hover:border-[var(--ink)]"
            >
              {rich.show.coverImage && (
                <Image
                  src={rich.show.coverImage}
                  alt=""
                  width={56}
                  height={56}
                  className="size-14 shrink-0 rounded object-cover"
                />
              )}
              <span className="min-w-0">
                <span className="block font-label text-[11px] uppercase tracking-widest text-[color:var(--ink-muted)]">
                  {t("trading.listing.originalShow")}
                </span>
                <span className="mt-0.5 block truncate font-serif text-[14px] text-[var(--ink)]">
                  {rich.show.title ||
                    [rich.show.brandName, rich.show.season, rich.show.year]
                      .filter(Boolean)
                      .join(" ")}
                </span>
              </span>
            </Link>
          )}
        </div>
      </div>

      {listing.brand && (
        <PriceBenchmark
          brand={listing.brand}
          currency={listing.currency}
          currentPriceCents={listing.priceCents}
        />
      )}

      {provenance.length > 0 && (
        <section className="mt-12 border-t border-[var(--border)] pt-8">
          <h2 className="mb-4 font-serif text-[20px] text-[var(--ink)]">
            {t("trading.listing.provenance")}
          </h2>
          <ol className="space-y-3">
            {provenance.map((e) => (
              <li key={e.id} className="flex gap-3">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--ink-muted)]" />
                <div className="min-w-0">
                  <p className="font-label text-[13px] text-[var(--ink)]">
                    {formatProvenanceEvent(e.eventType, t)}
                  </p>
                  {e.description && (
                    <p className="mt-0.5 font-label text-[12px] text-[color:var(--ink-muted)]">
                      {e.description}
                    </p>
                  )}
                  {e.occurredAt && (
                    <p className="mt-0.5 font-label text-[11px] text-[color:var(--ink-muted)]">
                      {new Date(e.occurredAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {rich?.relatedBrands && rich.relatedBrands.length > 0 && (
        <section className="mt-12 border-t border-[var(--border)] pt-8">
          <h2 className="mb-4 font-serif text-[20px] text-[var(--ink)]">
            {t("trading.listing.relatedBrands")}
          </h2>
          <div className="flex flex-wrap gap-2">
            {rich.relatedBrands.map((b) => (
              <Link
                key={b.name}
                href={`/marketplace?q=${encodeURIComponent(b.name)}`}
                className="rounded-full border border-[var(--border)] px-3 py-1 font-label text-[12px] text-[var(--ink)] transition-colors hover:border-[var(--ink)]"
              >
                {b.name}
                <span className="ml-1 text-[color:var(--ink-muted)]">
                  {b.listingCount}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <ProductGrid
        title={t("trading.listing.sellerOtherItems")}
        items={rich?.sellerOtherProducts ?? []}
      />
      <ProductGrid
        title={t("trading.listing.relatedItems")}
        items={rich?.relatedProducts ?? []}
      />

      {rich?.reviews && rich.reviews.total > 0 && (
        <section className="mt-12 border-t border-[var(--border)] pt-8">
          <h2 className="mb-4 font-serif text-[20px] text-[var(--ink)]">
            {t("trading.listing.sellerReviews")}{" "}
            <span className="text-[color:var(--ink-muted)]">
              ({rich.reviews.total})
            </span>
          </h2>
          <ul className="divide-y divide-[var(--border)]">
            {rich.reviews.items.map((r) => (
              <ReviewRow key={r.id} review={r} />
            ))}
          </ul>
        </section>
      )}

      <section className="mt-12 border-t border-[var(--border)] pt-8">
        <h2 className="mb-4 font-serif text-[20px] text-[var(--ink)]">
          {t("product.comments")}{" "}
          <span className="text-[color:var(--ink-muted)]">
            ({listing.commentCount})
          </span>
        </h2>
        <ProductComments
          productId={listing.id}
          currentUserId={user?.userId ?? null}
          onCountChange={() => {}}
        />
      </section>
    </article>
  );
}

// ───────────────────────── 子组件 ─────────────────────────

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[color:var(--ink-muted)]">{label}</dt>
      <dd className="mt-0.5 text-[var(--ink)]">{value}</dd>
    </div>
  );
}

function SellerCard({ seller }: { seller: ProductDetailSeller }) {
  const { t } = useTranslation();
  return (
    <Link
      href={`/users/${seller.userId}`}
      className="flex items-center gap-3 rounded border border-[var(--border)] p-3 transition-colors hover:border-[var(--ink)]"
    >
      <span className="size-11 shrink-0 overflow-hidden rounded-full bg-[var(--canvas-raised)]">
        {seller.avatarUrl && (
          <Image
            src={seller.avatarUrl}
            alt=""
            width={44}
            height={44}
            className="size-full object-cover"
          />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate font-label text-[14px] text-[var(--ink)]">
            {seller.username}
          </span>
          <span className="shrink-0 rounded bg-[var(--canvas-raised)] px-1.5 font-label text-[10px] text-[color:var(--ink-muted)]">
            Lv.{seller.level}
          </span>
        </span>
        <span className="mt-0.5 block font-label text-[11px] text-[color:var(--ink-muted)]">
          {seller.positiveRate != null &&
            `${t("trading.listing.positiveRate")} ${Math.round(seller.positiveRate * 100)}% · `}
          {t("trading.listing.totalSales", { count: seller.totalSales })} ·{" "}
          {t("trading.listing.onSale", { count: seller.listingCount })}
        </span>
      </span>
    </Link>
  );
}

function ProductGrid({ title, items }: { title: string; items: Listing[] }) {
  if (items.length === 0) return null;
  return (
    <section className="mt-12 border-t border-[var(--border)] pt-8">
      <h2 className="mb-4 font-serif text-[20px] text-[var(--ink)]">{title}</h2>
      <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 xl:grid-cols-5">
        {items.map((p) => (
          <ListingCard key={p.id} listing={p} />
        ))}
      </div>
    </section>
  );
}

function ReviewRow({ review }: { review: ProductDetailReviewItem }) {
  const { t } = useTranslation();
  return (
    <li className="flex gap-3 py-4">
      <span className="size-8 shrink-0 overflow-hidden rounded-full bg-[var(--canvas-raised)]">
        {review.reviewerAvatar && (
          <Image
            src={review.reviewerAvatar}
            alt=""
            width={32}
            height={32}
            className="size-full object-cover"
          />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 font-label text-[12px]">
          <span className="text-[var(--ink)]">
            {review.reviewerUsername ||
              t("product.userPrefix", { id: review.reviewerUserId ?? "—" })}
          </span>
          <span className="flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={`size-3 ${
                  i < review.rating
                    ? "text-[var(--ink)]"
                    : "text-[color:var(--ink-muted)] opacity-40"
                }`}
                fill={i < review.rating ? "currentColor" : "none"}
                aria-hidden
              />
            ))}
          </span>
          {review.submittedAt && (
            <span className="text-[color:var(--ink-muted)]">
              {new Date(review.submittedAt).toLocaleDateString()}
            </span>
          )}
        </div>
        {review.comment && (
          <p className="mt-1 whitespace-pre-wrap font-serif text-[14px] text-[var(--ink)]">
            {review.comment}
          </p>
        )}
      </div>
    </li>
  );
}
