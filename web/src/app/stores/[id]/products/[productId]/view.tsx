"use client";

/**
 * /stores/[id]/products/[productId] —— 商品详情 view.
 *
 * 对齐移动端 `StoreProductDetailScreen`：
 *   - 图片轮播（左右按钮 + 指示点）
 *   - 标题 / 品牌 / 分类 / 价格（含折扣划线）/ NEW / SALE 徽章
 *   - 标签 chips
 *   - 描述（whitespace-pre-wrap）
 *   - 评论区（拉公开评论；登录用户可发 / 删 / 点赞）
 *
 * 设计：
 *   - 初始商品从 SSR 传入；这里用 SWR 按 productId 做 revalidation，点赞
 *     乐观更新后 mutate() 兜底刷新真实数据.
 */

import { useCallback, useState } from "react";
import { Eye, Heart, MessageCircle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import useSWR, { mutate as globalMutate } from "swr";
import {
  formatPriceCents,
  storeProductService,
  type StoreProduct,
} from "@/lib/services/store-product";
import { useAuthStore } from "@/lib/auth/store";
import { TradingActionBar } from "@/components/trading/TradingActionBar";
import { ProductComments } from "@/components/trading/ProductComments";

interface Props {
  storeId: string;
  initialProduct: StoreProduct;
}

export function ProductDetailView({ storeId, initialProduct }: Props) {
  const { t } = useTranslation();
  const [activeImage, setActiveImage] = useState(0);
  const user = useAuthStore((s) => s.user);

  const { data: product = initialProduct, mutate: mutateProduct } = useSWR(
    ["store-product", initialProduct.id],
    () => storeProductService.getProduct(initialProduct.id),
    { fallbackData: initialProduct, revalidateOnFocus: false },
  );

  const images = product.images?.length ? product.images : [];
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

  // ── 点赞 ──
  const [liking, setLiking] = useState(false);
  const { data: likeStatus, mutate: mutateLike } = useSWR(
    user && product.likedByMe == null
      ? ["store-product-like", product.id]
      : null,
    () => storeProductService.checkProductLiked(product.id),
  );
  const likedByMe = product.likedByMe ?? likeStatus?.liked ?? false;

  const onToggleLike = async () => {
    if (!user) {
      window.location.href = "/auth/login";
      return;
    }
    if (liking) return;
    setLiking(true);
    const prevLiked = likedByMe;
    const prevCount = product.likeCount;
    // 乐观更新：先改本地，然后真正发请求；失败回滚.
    await mutateProduct(
      {
        ...product,
        likedByMe: !prevLiked,
        likeCount: Math.max(0, prevCount + (prevLiked ? -1 : 1)),
      },
      { revalidate: false },
    );
    try {
      if (prevLiked) await storeProductService.unlikeProduct(product.id);
      else await storeProductService.likeProduct(product.id);
      await mutateLike();
    } catch {
      // 失败回滚.
      await mutateProduct(
        { ...product, likedByMe: prevLiked, likeCount: prevCount },
        { revalidate: false },
      );
    } finally {
      setLiking(false);
    }
  };

  return (
    <article className="mx-auto max-w-content px-6 py-8 md:py-10">
      <nav className="mb-6 flex items-center gap-3 font-label text-[12px] text-[color:var(--ink-muted)]">
        <Link href="/stores" className="hover:text-[var(--ink)]">
          {t("nav.stores")}
        </Link>
        <span>/</span>
        <Link
          href={`/stores/${encodeURIComponent(storeId)}`}
          className="hover:text-[var(--ink)]"
        >
          {t("product.breadcrumbStore")}
        </Link>
        <span>/</span>
        <span className="truncate text-[var(--ink)]">{product.title}</span>
      </nav>

      <div className="grid gap-8 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        {/* 左：图片轮播 */}
        <div>
          <div className="relative aspect-[3/4] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--canvas-raised)]">
            {currentImage ? (
              // 本页的 LCP 元素。
              <Image
                src={currentImage}
                alt={product.title}
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
            {/* 徽章 */}
            <div className="absolute left-3 top-3 flex flex-wrap gap-1">
              {product.isNew && (
                <span className="rounded bg-[var(--ink)] px-2 py-0.5 font-label text-[11px] uppercase tracking-widest text-[var(--canvas)]">
                  NEW
                </span>
              )}
              {product.hasDiscount && (
                <span className="rounded bg-red-600 px-2 py-0.5 font-label text-[11px] uppercase tracking-widest text-white">
                  SALE
                </span>
              )}
            </div>
            {/* 左右切换 */}
            {images.length > 1 && (
              <>
                <button
                  type="button"
                  aria-label="上一张"
                  onClick={prev}
                  className="absolute left-2 top-1/2 -translate-y-1/2 grid h-9 w-9 place-items-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
                >
                  ‹
                </button>
                <button
                  type="button"
                  aria-label="下一张"
                  onClick={next}
                  className="absolute right-2 top-1/2 -translate-y-1/2 grid h-9 w-9 place-items-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
                >
                  ›
                </button>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-2 py-0.5 font-label text-[11px] text-white backdrop-blur-sm">
                  {safeIdx + 1} / {images.length}
                </div>
              </>
            )}
          </div>

          {/* 缩略图 */}
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

        {/* 右：文字信息 + 价格 + 操作 */}
        <div className="flex flex-col gap-5">
          <div>
            {product.categoryName && (
              <div className="font-label text-[11px] uppercase tracking-widest text-[color:var(--ink-muted)]">
                {product.categoryName}
              </div>
            )}
            <h1 className="mt-1 font-serif text-[26px] leading-tight text-[var(--ink)]">
              {product.title}
            </h1>
            {product.brand && (
              <div className="mt-1 font-serif text-[15px] text-[color:var(--ink-muted)]">
                {product.brand}
              </div>
            )}
          </div>

          <div className="flex items-baseline gap-3">
            {product.hasDiscount && product.discountPriceCents != null ? (
              <>
                <span className="font-serif text-[28px] font-semibold text-red-600">
                  {formatPriceCents(product.discountPriceCents, product.currency)}
                </span>
                <span className="font-label text-[14px] text-[color:var(--ink-muted)] line-through">
                  {formatPriceCents(product.priceCents, product.currency)}
                </span>
              </>
            ) : (
              <span className="font-serif text-[26px] font-semibold text-[var(--ink)]">
                {formatPriceCents(product.priceCents, product.currency)}
              </span>
            )}
          </div>

          {product.tags.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {product.tags.map((t) => (
                <li
                  key={t}
                  className="rounded-full border border-[var(--border)] px-2.5 py-0.5 font-label text-[12px] text-[var(--ink)]"
                >
                  {t}
                </li>
              ))}
            </ul>
          )}

          <TradingActionBar product={product} />

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
              <span>{product.likeCount}</span>
            </button>
            <span className="inline-flex items-center gap-1 font-label text-[12px] text-[color:var(--ink-muted)]">
              <MessageCircle className="size-3.5 shrink-0" strokeWidth={2} aria-hidden />
              {product.commentCount}
            </span>
            <span className="inline-flex items-center gap-1 font-label text-[12px] text-[color:var(--ink-muted)]">
              <Eye className="size-3.5 shrink-0" strokeWidth={2} aria-hidden />
              {product.viewCount}
            </span>
          </div>

          {product.description && (
            <div>
              <h2 className="mb-2 font-label text-[11px] uppercase tracking-widest text-[color:var(--ink-muted)]">
                {t("product.detail")}
              </h2>
              <p className="whitespace-pre-wrap font-serif text-[14px] leading-relaxed text-[color:var(--ink)]">
                {product.description}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 评论区 */}
      <section className="mt-12 border-t border-[var(--border)] pt-8">
        <h2 className="mb-4 font-serif text-[20px] text-[var(--ink)]">
          {t("product.comments")} <span className="text-[color:var(--ink-muted)]">({product.commentCount})</span>
        </h2>
        <ProductComments
          productId={product.id}
          currentUserId={user?.userId ?? null}
          onCountChange={async (delta) => {
            // 乐观更新商品卡片的 commentCount，避免等 SWR.
            await mutateProduct(
              { ...product, commentCount: Math.max(0, product.commentCount + delta) },
              { revalidate: false },
            );
            // 下一次 focus 回到列表时，列表的 SWR 会去 re-fetch 拿真实 count.
            void globalMutate(
              (k) => Array.isArray(k) && k[0] === "store-product" && k[1] === product.id,
            );
          }}
        />
      </section>
    </article>
  );
}
