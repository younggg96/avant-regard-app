"use client";

/**
 * /checkout/[productId] — 结算页。
 *
 * 对齐移动端 `frontend/src/screens/Trading/CheckoutScreen.tsx`：
 * 商品摘要 + 收货地址 + 提交订单。提交成功后订单进入 pending_payment，
 * 库存被锁定 30 分钟，页面跳到订单详情由那里引导去 App 付款。
 */

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import useSWR from "swr";
import { ChevronRight, MapPin } from "lucide-react";

import { Button, LoadingState } from "@/components/admin/ui";
import { AddressPickerDialog } from "@/components/trading/AddressPickerDialog";
import {
  addressService,
  toShippingAddressSnapshot,
  type UserAddress,
} from "@/lib/services/address";
import { orderService } from "@/lib/services/order";
import {
  formatPriceCents,
  storeProductService,
} from "@/lib/services/store-product";

export default function CheckoutPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useParams<{ productId: string }>();
  const productId = Number(params.productId);

  const { data: product, isLoading } = useSWR(
    Number.isFinite(productId) ? ["checkout-product", productId] : null,
    () => storeProductService.getProduct(productId),
  );

  const { data: defaultAddress, isLoading: addressLoading } = useSWR(
    "my-default-address",
    () => addressService.getDefaultAddress(),
  );

  const [address, setAddress] = useState<UserAddress | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 默认地址到达后填入，但不覆盖用户已经手动选过的地址。
  useEffect(() => {
    setAddress((current) => current ?? defaultAddress ?? null);
  }, [defaultAddress]);

  if (isLoading || addressLoading) return <LoadingState />;
  if (!product) {
    return (
      <p className="font-label text-[13px] text-[color:var(--ink-muted)]">
        {t("common.loadFailed")}
      </p>
    );
  }

  // 后端 create_order_from_listing 只读 price_cents，不认 discount_price_cents，
  // 所以这里必须按原价展示——否则用户看到折扣价、实际被扣原价。
  const payableCents = product.priceCents;

  const onPlaceOrder = async () => {
    if (!address) {
      setError(t("trading.noAddressYet"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { order } = await orderService.buyNow(
        product.id,
        toShippingAddressSnapshot(address),
      );
      router.replace(`/me/orders/${order.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.failed"));
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h1 className="font-serif text-2xl text-[var(--ink)]">
        {t("trading.checkout")}
      </h1>

      {/* 收货地址 */}
      <section className="mt-6">
        <h2 className="font-label text-[12px] uppercase tracking-widest text-[color:var(--ink-muted)]">
          {t("trading.shippingAddressTitle")}
        </h2>
        <button
          onClick={() => setPickerOpen(true)}
          className="mt-2 flex w-full items-center gap-3 rounded border border-[var(--border)] bg-[var(--canvas-soft)] p-4 text-left transition-colors hover:bg-[var(--canvas-raised)]"
        >
          <MapPin size={16} className="shrink-0 text-[color:var(--ink-muted)]" />
          <span className="min-w-0 flex-1">
            {address ? (
              <>
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-label text-[13px] font-semibold text-[var(--ink)]">
                    {address.receiverName}
                  </span>
                  <span className="font-label text-[12px] text-[color:var(--ink-muted)]">
                    {address.phone}
                  </span>
                </span>
                <span className="mt-1 block font-label text-[12px] leading-relaxed text-[color:var(--ink-muted)]">
                  {address.fullText}
                </span>
              </>
            ) : (
              <span className="font-label text-[13px] text-[color:var(--ink-muted)]">
                {t("trading.noAddressYet")}
              </span>
            )}
          </span>
          <ChevronRight
            size={16}
            className="shrink-0 text-[color:var(--ink-muted)]"
          />
        </button>
      </section>

      {/* 商品摘要 */}
      <section className="mt-6">
        <h2 className="font-label text-[12px] uppercase tracking-widest text-[color:var(--ink-muted)]">
          {t("trading.orderSummary")}
        </h2>
        <div className="mt-2 flex gap-4 rounded border border-[var(--border)] bg-[var(--canvas-soft)] p-4">
          <div className="size-20 shrink-0 overflow-hidden rounded bg-[var(--canvas-raised)]">
            {product.images?.[0] && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.images[0]}
                alt={product.title}
                className="size-full object-cover"
              />
            )}
          </div>
          <div className="min-w-0 flex-1">
            {product.brand && (
              <p className="font-label text-[11px] uppercase tracking-widest text-[color:var(--ink-muted)]">
                {product.brand}
              </p>
            )}
            <p className="mt-0.5 font-label text-[13px] text-[var(--ink)]">
              {product.title}
            </p>
            <p className="mt-2 font-serif text-[16px] font-semibold text-[var(--ink)]">
              {formatPriceCents(payableCents, product.currency)}
            </p>
          </div>
        </div>
      </section>

      {/* 合计与提交 */}
      <section className="mt-6 rounded border border-[var(--border)] bg-[var(--canvas-soft)] p-4">
        <div className="flex items-center justify-between">
          <span className="font-label text-[13px] text-[color:var(--ink-muted)]">
            {t("trading.total")}
          </span>
          <span className="font-serif text-[20px] font-semibold text-[var(--ink)]">
            {formatPriceCents(payableCents, product.currency)}
          </span>
        </div>
      </section>

      {error && (
        <p className="mt-3 font-label text-[12px] text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="mt-6 flex justify-end">
        <Button onClick={onPlaceOrder} loading={submitting} disabled={!address}>
          {submitting ? t("trading.placingOrder") : t("trading.placeOrder")}
        </Button>
      </div>

      <AddressPickerDialog
        open={pickerOpen}
        selectedId={address?.id}
        onClose={() => setPickerOpen(false)}
        onSelect={(picked) => {
          setAddress(picked);
          setPickerOpen(false);
        }}
      />
    </div>
  );
}
