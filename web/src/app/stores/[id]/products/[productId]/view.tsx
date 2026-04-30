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

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import useSWR, { mutate as globalMutate } from "swr";
import {
  formatPriceCents,
  storeProductService,
  type ProductComment,
  type StoreProduct,
} from "@/lib/services/store-product";
import { useAuthStore } from "@/lib/auth/store";

interface Props {
  storeId: string;
  initialProduct: StoreProduct;
}

const CARD_COMMENT_PAGE_SIZE = 20;

export function ProductDetailView({ storeId, initialProduct }: Props) {
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
          买手店
        </Link>
        <span>/</span>
        <Link
          href={`/stores/${encodeURIComponent(storeId)}`}
          className="hover:text-[var(--ink)]"
        >
          店铺
        </Link>
        <span>/</span>
        <span className="truncate text-[var(--ink)]">{product.title}</span>
      </nav>

      <div className="grid gap-8 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        {/* 左：图片轮播 */}
        <div>
          <div className="relative aspect-[3/4] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--canvas-raised)]">
            {currentImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={currentImage}
                alt={product.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="grid h-full place-items-center font-label text-[12px] text-[color:var(--ink-muted)]">
                无图
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
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="h-full w-full object-cover" />
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
              <span>{likedByMe ? "♥" : "♡"}</span>
              <span>{product.likeCount}</span>
            </button>
            <span className="font-label text-[12px] text-[color:var(--ink-muted)]">
              💬 {product.commentCount}
            </span>
            <span className="font-label text-[12px] text-[color:var(--ink-muted)]">
              👁 {product.viewCount}
            </span>
          </div>

          {product.description && (
            <div>
              <h2 className="mb-2 font-label text-[11px] uppercase tracking-widest text-[color:var(--ink-muted)]">
                商品详情
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
          评论 <span className="text-[color:var(--ink-muted)]">({product.commentCount})</span>
        </h2>
        <CommentsSection
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

// ───────────────────────── 评论区 ─────────────────────────

function CommentsSection({
  productId,
  currentUserId,
  onCountChange,
}: {
  productId: number;
  currentUserId: number | null;
  onCountChange: (delta: number) => Promise<void>;
}) {
  const [items, setItems] = useState<ProductComment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchPage = useCallback(
    async (p: number, append: boolean) => {
      try {
        if (append) setLoadingMore(true);
        else setLoading(true);
        const res = await storeProductService.listProductComments(productId, {
          page: p,
          pageSize: CARD_COMMENT_PAGE_SIZE,
        });
        setItems((prev) => (append ? [...prev, ...res.comments] : res.comments));
        setTotal(res.total);
        setPage(p);
        setErr(null);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "加载失败");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [productId],
  );

  useEffect(() => {
    void fetchPage(1, false);
  }, [fetchPage]);

  const hasMore = items.length < total;

  const onSubmit = async () => {
    const content = draft.trim();
    if (!content) return;
    if (!currentUserId) {
      window.location.href = "/auth/login";
      return;
    }
    setSubmitting(true);
    try {
      const created = await storeProductService.createProductComment(productId, {
        content,
      });
      setItems((prev) => [created, ...prev]);
      setTotal((t) => t + 1);
      setDraft("");
      await onCountChange(1);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "发送失败");
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async (id: number) => {
    if (!confirm("确认删除这条评论？")) return;
    try {
      await storeProductService.deleteProductComment(id);
      setItems((prev) => prev.filter((c) => c.id !== id));
      setTotal((t) => Math.max(0, t - 1));
      await onCountChange(-1);
    } catch (e) {
      alert(e instanceof Error ? e.message : "删除失败");
    }
  };

  const onToggleLike = async (c: ProductComment) => {
    if (!currentUserId) {
      window.location.href = "/auth/login";
      return;
    }
    const prevLiked = c.likedByMe ?? false;
    const prevCount = c.likeCount;
    setItems((prev) =>
      prev.map((x) =>
        x.id === c.id
          ? {
              ...x,
              likedByMe: !prevLiked,
              likeCount: Math.max(0, prevCount + (prevLiked ? -1 : 1)),
            }
          : x,
      ),
    );
    try {
      if (prevLiked) await storeProductService.unlikeProductComment(c.id);
      else await storeProductService.likeProductComment(c.id);
    } catch {
      // 回滚
      setItems((prev) =>
        prev.map((x) =>
          x.id === c.id ? { ...x, likedByMe: prevLiked, likeCount: prevCount } : x,
        ),
      );
    }
  };

  return (
    <div>
      {/* 输入框 */}
      <div className="mb-6 rounded-lg border border-[var(--border)] bg-[var(--canvas-soft)] p-3">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          placeholder={currentUserId ? "写下你的评价…" : "登录后可以发表评论"}
          disabled={!currentUserId}
          className="w-full resize-y rounded bg-[var(--canvas)] px-3 py-2 font-label text-[13px] text-[var(--ink)] placeholder:text-[color:var(--ink-muted)] outline-none focus:ring-1 focus:ring-[var(--ink)] disabled:opacity-60"
        />
        <div className="mt-2 flex items-center justify-end gap-2 font-label text-[12px]">
          <span className="text-[color:var(--ink-muted)]">{draft.length}/500</span>
          <button
            onClick={onSubmit}
            disabled={!draft.trim() || submitting}
            className="rounded bg-[var(--ink)] px-4 py-1.5 text-[var(--canvas)] transition-opacity hover:opacity-80 disabled:opacity-50"
          >
            {submitting ? "发送中…" : "发送"}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-10 text-center font-label text-[13px] text-[color:var(--ink-muted)]">
          加载评论中…
        </div>
      ) : err && items.length === 0 ? (
        <div className="py-10 text-center font-label text-[13px] text-red-600">
          {err}
        </div>
      ) : items.length === 0 ? (
        <div className="py-10 text-center font-label text-[13px] text-[color:var(--ink-muted)]">
          还没有评论，快来抢沙发 🛋️
        </div>
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {items.map((c) => (
            <CommentRow
              key={c.id}
              comment={c}
              canDelete={c.userId != null && c.userId === currentUserId}
              onDelete={() => onDelete(c.id)}
              onToggleLike={() => onToggleLike(c)}
            />
          ))}
        </ul>
      )}

      {hasMore && (
        <div className="mt-6 flex justify-center">
          <button
            onClick={() => fetchPage(page + 1, true)}
            disabled={loadingMore}
            className="rounded border border-[var(--border)] px-4 py-1.5 font-label text-[12px] text-[var(--ink)] transition-colors hover:border-[var(--ink)] disabled:opacity-50"
          >
            {loadingMore ? "加载中…" : `加载更多（剩余 ${total - items.length}）`}
          </button>
        </div>
      )}
    </div>
  );
}

function CommentRow({
  comment,
  canDelete,
  onDelete,
  onToggleLike,
}: {
  comment: ProductComment;
  canDelete: boolean;
  onDelete: () => void;
  onToggleLike: () => void;
}) {
  const name = comment.username || `用户 #${comment.userId ?? "—"}`;
  const createdAt = useMemo(() => {
    if (!comment.createdAt) return "";
    const d = new Date(comment.createdAt);
    if (Number.isNaN(d.getTime())) return comment.createdAt;
    return d.toLocaleString("zh-CN", { hour12: false });
  }, [comment.createdAt]);

  return (
    <li className="flex gap-3 py-4">
      <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-[var(--canvas-raised)]">
        {comment.userAvatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={comment.userAvatar} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center font-serif text-[12px] text-[color:var(--ink-muted)]">
            {name.slice(0, 1)}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 font-label text-[12px]">
          <span className="text-[var(--ink)]">{name}</span>
          {createdAt && (
            <span className="text-[color:var(--ink-muted)]">{createdAt}</span>
          )}
        </div>
        <p className="mt-1 whitespace-pre-wrap font-serif text-[14px] text-[var(--ink)]">
          {comment.content}
        </p>
        <div className="mt-1.5 flex items-center gap-3 font-label text-[11px] text-[color:var(--ink-muted)]">
          <button
            onClick={onToggleLike}
            className={`transition-colors ${
              comment.likedByMe ? "text-red-600" : "hover:text-[var(--ink)]"
            }`}
          >
            {comment.likedByMe ? "♥" : "♡"} {comment.likeCount}
          </button>
          {canDelete && (
            <button
              onClick={onDelete}
              className="transition-colors hover:text-red-600"
            >
              删除
            </button>
          )}
        </div>
      </div>
    </li>
  );
}
