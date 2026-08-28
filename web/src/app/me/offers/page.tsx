"use client";

/**
 * /me/offers — 出价中心。
 *
 * 对齐移动端 `frontend/src/screens/Trading/MyOffersScreen.tsx`：
 * 「我发出的 / 我收到的」两个 tab，卡片上按 allowedActions 出按钮。
 *
 * allowedActions 由后端算好（谁能接受、谁能还价随议价轮次交替），前端只负责
 * 渲染，不要在这里重算一套判断——两边算法漂移过一次就很难查。
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import useSWR from "swr";

import { Button, EmptyState, LoadingState, PageHeader } from "@/components/admin/ui";
import { OfferDialog } from "@/components/trading/OfferDialog";
import {
  formatOfferStatus,
  offerService,
  type OfferWithDetail,
} from "@/lib/services/order";
import { formatPriceCents } from "@/lib/services/store-product";

export default function MyOffersPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [tab, setTab] = useState<"outgoing" | "incoming">("outgoing");
  const [acting, setActing] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [counterTarget, setCounterTarget] = useState<OfferWithDetail | null>(
    null,
  );

  const { data, isLoading, mutate } = useSWR(["my-offers", tab], () =>
    tab === "outgoing"
      ? offerService.listMyOffers({ pageSize: 50 })
      : offerService.listIncomingOffers({ pageSize: 50 }),
  );

  const offers = data?.items ?? [];

  const runAction = async (
    offerId: number,
    action: () => Promise<unknown>,
    afterwards?: () => void,
  ) => {
    setActing(offerId);
    setError(null);
    try {
      await action();
      await mutate();
      afterwards?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.failed"));
    } finally {
      setActing(null);
    }
  };

  return (
    <div>
      <PageHeader title={t("meNav.offers")} />

      <div className="mb-4 flex gap-1 border-b border-[var(--border)]">
        {(["outgoing", "incoming"] as const).map((key) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`-mb-px border-b-2 px-3 pb-2 font-label text-[13px] transition-colors ${
              tab === key
                ? "border-[var(--ink)] text-[var(--ink)]"
                : "border-transparent text-[color:var(--ink-muted)] hover:text-[var(--ink)]"
            }`}
          >
            {key === "outgoing"
              ? t("trading.offersOutgoing")
              : t("trading.offersIncoming")}
          </button>
        ))}
      </div>

      {error && (
        <p className="mb-3 font-label text-[12px] text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {isLoading ? (
        <LoadingState />
      ) : offers.length === 0 ? (
        <EmptyState message={t("trading.emptyOffers")} />
      ) : (
        <ul className="space-y-3">
          {offers.map((offer) => {
            const allowed = offer.allowedActions ?? [];
            const busy = acting === offer.id;

            return (
              <li
                key={offer.id}
                className="rounded border border-[var(--border)] bg-[var(--canvas-soft)] p-4"
              >
                <div className="flex gap-3">
                  <div className="size-16 shrink-0 overflow-hidden rounded bg-[var(--canvas-raised)]">
                    {offer.product?.coverImage && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={offer.product.coverImage}
                        alt={offer.product.title ?? ""}
                        className="size-full object-cover"
                      />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    {offer.product?.brand && (
                      <p className="font-label text-[11px] uppercase tracking-widest text-[color:var(--ink-muted)]">
                        {offer.product.brand}
                      </p>
                    )}
                    <Link
                      href={`/listings/${offer.productId}`}
                      className="mt-0.5 block truncate font-label text-[13px] text-[var(--ink)] underline-offset-4 hover:underline"
                    >
                      {offer.product?.title ?? `#${offer.productId}`}
                    </Link>

                    <p className="mt-1.5 flex flex-wrap items-baseline gap-2">
                      <span className="font-serif text-[15px] font-semibold text-[var(--ink)]">
                        {formatPriceCents(offer.priceCents, offer.currency)}
                      </span>
                      {offer.product?.priceCents != null && (
                        <span className="font-label text-[11px] text-[color:var(--ink-muted)] line-through">
                          {formatPriceCents(
                            offer.product.priceCents,
                            offer.currency,
                          )}
                        </span>
                      )}
                      <span className="font-label text-[11px] text-[color:var(--ink-muted)]">
                        {formatOfferStatus(offer.status, t)}
                      </span>
                    </p>

                    {offer.message && (
                      <p className="mt-1.5 font-label text-[12px] leading-relaxed text-[color:var(--ink-muted)]">
                        {offer.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {allowed.includes("accept") && (
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() =>
                        runAction(
                          offer.id,
                          () => offerService.acceptOffer(offer.id),
                          () => router.push("/me/orders"),
                        )
                      }
                    >
                      {t("trading.acceptOffer")}
                    </Button>
                  )}
                  {allowed.includes("counter") && (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => setCounterTarget(offer)}
                    >
                      {t("trading.counterOffer")}
                    </Button>
                  )}
                  {allowed.includes("reject") && (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() =>
                        runAction(offer.id, () =>
                          offerService.rejectOffer(offer.id),
                        )
                      }
                    >
                      {t("trading.rejectOffer")}
                    </Button>
                  )}
                  {allowed.includes("withdraw") && (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() =>
                        runAction(offer.id, () =>
                          offerService.withdrawOffer(offer.id),
                        )
                      }
                    >
                      {t("trading.withdrawOffer")}
                    </Button>
                  )}

                </div>
              </li>
            );
          })}
        </ul>
      )}

      <OfferDialog
        open={counterTarget !== null}
        productId={counterTarget?.productId ?? 0}
        listingPriceCents={counterTarget?.product?.priceCents}
        currency={counterTarget?.currency}
        counterOfferId={counterTarget?.id}
        onClose={() => setCounterTarget(null)}
        onSubmitted={() => mutate()}
      />
    </div>
  );
}
