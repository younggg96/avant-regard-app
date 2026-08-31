"use client";

/**
 * 单品评论区。
 *
 * 买手店商品详情（`/stores/[id]/products/[productId]`）和 C2C 单品详情
 * （`/listings/[id]`）共用——后端是同一张 `store_product_comments` 表，
 * 两边的交互（发/删/点赞/分页）也完全一致。
 *
 * 点赞与发布都做乐观更新，失败回滚；父级通过 `onCountChange` 同步商品卡上的
 * 计数，避免等一轮 SWR。
 */

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  storeProductService,
  type ProductComment,
} from "@/lib/services/store-product";

const PAGE_SIZE = 20;

export function ProductComments({
  productId,
  currentUserId,
  onCountChange,
}: {
  productId: number;
  currentUserId: number | null;
  onCountChange: (delta: number) => void | Promise<void>;
}) {
  const { t } = useTranslation();
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
          pageSize: PAGE_SIZE,
        });
        setItems((prev) => (append ? [...prev, ...res.comments] : res.comments));
        setTotal(res.total);
        setPage(p);
        setErr(null);
      } catch (e) {
        setErr(e instanceof Error ? e.message : t("common.loadFailed"));
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [productId, t],
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
      setTotal((n) => n + 1);
      setDraft("");
      await onCountChange(1);
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("product.sendFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async (id: number) => {
    if (!confirm(t("product.confirmDeleteComment"))) return;
    try {
      await storeProductService.deleteProductComment(id);
      setItems((prev) => prev.filter((c) => c.id !== id));
      setTotal((prev) => Math.max(0, prev - 1));
      await onCountChange(-1);
    } catch (e) {
      alert(e instanceof Error ? e.message : t("product.deleteFailed"));
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
      setItems((prev) =>
        prev.map((x) =>
          x.id === c.id ? { ...x, likedByMe: prevLiked, likeCount: prevCount } : x,
        ),
      );
    }
  };

  return (
    <div>
      <div className="mb-6 rounded-lg border border-[var(--border)] bg-[var(--canvas-soft)] p-3">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          placeholder={
            currentUserId
              ? t("product.commentPlaceholder")
              : t("product.commentLoginHint")
          }
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
            {submitting ? t("product.sending") : t("product.send")}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-10 text-center font-label text-[13px] text-[color:var(--ink-muted)]">
          {t("product.loadingComments")}
        </div>
      ) : err && items.length === 0 ? (
        <div className="py-10 text-center font-label text-[13px] text-red-600">
          {err}
        </div>
      ) : items.length === 0 ? (
        <div className="py-10 text-center font-label text-[13px] text-[color:var(--ink-muted)]">
          {t("product.noComments")}
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
            {loadingMore
              ? t("common.loadingEllipsis")
              : t("product.loadMore", { remaining: total - items.length })}
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
  const { t } = useTranslation();
  const name =
    comment.username || t("product.userPrefix", { id: comment.userId ?? "—" });
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
          <Image
            src={comment.userAvatar}
            alt=""
            width={32}
            height={32}
            className="h-full w-full object-cover"
          />
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
              {t("product.deleteComment")}
            </button>
          )}
        </div>
      </div>
    </li>
  );
}
