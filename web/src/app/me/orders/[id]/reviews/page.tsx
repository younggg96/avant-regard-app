"use client";

/**
 * /me/orders/[id]/reviews — 某笔订单的双方评价。
 *
 * 对齐移动端 `OrderReviewsScreen`。评价双盲：只有双方都提交（或到期自动公开）
 * 后接口才会返回对方那条，所以列表为空不代表没评，可能只是还没到公开时机。
 */

import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import useSWR from "swr";
import { Star } from "lucide-react";

import { EmptyState, LoadingState } from "@/components/admin/ui";
import { reviewService, type TradeReview } from "@/lib/services/aftersales";

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex gap-0.5 text-[var(--ink)]">
      {[1, 2, 3, 4, 5].map((value) => (
        <Star
          key={value}
          size={13}
          fill={value <= rating ? "currentColor" : "none"}
          strokeWidth={1.5}
        />
      ))}
    </span>
  );
}

function ReviewCard({ review }: { review: TradeReview }) {
  const { t } = useTranslation();
  return (
    <li className="rounded border border-[var(--border)] bg-[var(--canvas-soft)] p-4">
      <div className="flex items-center gap-2">
        <span className="font-label text-[13px] font-semibold text-[var(--ink)]">
          {review.reviewerRole === "buyer"
            ? t("trading.buyerReview")
            : t("trading.sellerReview")}
        </span>
        <Stars rating={review.rating} />
      </div>
      {review.comment && (
        <p className="mt-2 whitespace-pre-wrap font-label text-[13px] leading-relaxed text-[color:var(--ink-muted)]">
          {review.comment}
        </p>
      )}
    </li>
  );
}

export default function OrderReviewsPage() {
  const { t } = useTranslation();
  const params = useParams<{ id: string }>();
  const orderId = Number(params.id);

  const { data, isLoading } = useSWR(
    Number.isFinite(orderId) ? ["order-reviews", orderId] : null,
    () => reviewService.listOrderReviews(orderId),
  );

  const reviews = data ?? [];

  return (
    <div>
      <Link
        href={`/me/orders/${orderId}`}
        className="font-label text-[12px] text-[color:var(--ink-muted)] transition-colors hover:text-[var(--ink)]"
      >
        ← {t("trading.orderDetail")}
      </Link>

      <h1 className="mt-4 font-serif text-2xl text-[var(--ink)]">
        {t("trading.viewReviews")}
      </h1>

      <div className="mt-5">
        {isLoading ? (
          <LoadingState />
        ) : reviews.length === 0 ? (
          <EmptyState message={t("trading.reviewsHidden")} />
        ) : (
          <ul className="space-y-3">
            {reviews.map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
