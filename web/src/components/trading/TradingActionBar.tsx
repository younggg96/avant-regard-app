"use client";

/**
 * 商品详情页的交易操作栏：出价 + 立即购买。
 *
 * 对齐移动端 `frontend/src/components/TradingActionBar.tsx`。移动端是吸底 bar，
 * web 上放在商品信息列里随页面滚动——桌面视口下吸底反而会遮挡内容。
 *
 * 商品不可售（非上架状态）时整条禁用；未登录时点击引导去登录并带上 next。
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import useSWR from "swr";

import { OfferDialog } from "@/components/trading/OfferDialog";
import { useAuthStore } from "@/lib/auth/store";
import { offerService } from "@/lib/services/order";
import {
  formatPriceCents,
  isProductPurchasable,
  type StoreProduct,
} from "@/lib/services/store-product";
import { formatOfferStatus } from "@/lib/services/order";

export function TradingActionBar({ product }: { product: StoreProduct }) {
  const { t } = useTranslation();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [offerOpen, setOfferOpen] = useState(false);

  // 后端 acquire_hold 只放行 active 的单品，这里先拦一道，避免点了才报错。
  const isOwnListing =
    product.sellerUserId != null && product.sellerUserId === user?.userId;
  const purchasable = isProductPurchasable(product.status) && !isOwnListing;
  const canOffer = product.acceptOffer !== false;

  // 已登录用户看得到自己在这件商品上的议价进度。
  const { data: thread, mutate: mutateThread } = useSWR(
    user && purchasable ? ["product-offers", product.id] : null,
    () => offerService.listProductOffers(product.id),
  );

  const requireLogin = () => {
    const next = encodeURIComponent(window.location.pathname);
    router.push(`/auth/login?next=${next}`);
  };

  const onBuyNow = () => {
    if (!user) return requireLogin();
    router.push(`/checkout/${product.id}`);
  };

  const onMakeOffer = () => {
    if (!user) return requireLogin();
    setOfferOpen(true);
  };

  if (!purchasable) return null;

  const currentOffer = thread?.current;

  return (
    <div className="mt-6 border-t border-[var(--border)] pt-6">
      {currentOffer && (
        <p className="mb-3 font-label text-[12px] text-[color:var(--ink-muted)]">
          {t("trading.offerPrice")}{" "}
          <span className="text-[var(--ink)]">
            {formatPriceCents(currentOffer.priceCents, currentOffer.currency)}
          </span>
          {" · "}
          {formatOfferStatus(currentOffer.status, t)}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        {canOffer && (
          <button
            onClick={onMakeOffer}
            className="flex-1 rounded border border-[var(--ink)] px-5 py-2.5 font-label text-[13px] text-[var(--ink)] transition-colors hover:bg-[var(--canvas-raised)]"
          >
            {t("trading.makeOffer")}
          </button>
        )}
        <button
          onClick={onBuyNow}
          className="flex-1 rounded bg-[var(--ink)] px-5 py-2.5 font-label text-[13px] text-[var(--canvas)] transition-opacity hover:opacity-80"
        >
          {t("trading.buyNow")}
        </button>
      </div>

      <OfferDialog
        open={offerOpen}
        productId={product.id}
        listingPriceCents={product.priceCents}
        currency={product.currency}
        onClose={() => setOfferOpen(false)}
        onSubmitted={() => mutateThread()}
      />
    </div>
  );
}
