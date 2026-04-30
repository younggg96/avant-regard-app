"use client";

import { useState } from "react";
import type { BuyerStore } from "@/lib/services/buyer-store";
import type { StoreProfileConfig } from "@/lib/services/store-product";
import { useStoreFavorites } from "@/lib/hooks/useStoreFavorites";

interface Props {
  store: BuyerStore;
  profile: StoreProfileConfig | null | undefined;
}

export function StoreProfileBlock({ store, profile }: Props) {
  const { isLoggedIn, isFavorited, toggleFavorite, getFavoriteCount } =
    useStoreFavorites();

  const favorited = isFavorited(store.id);
  const favoriteCount =
    getFavoriteCount(store.id) || store.favoriteCount || 0;

  const logo = profile?.logoImage || store.images?.[0];
  const cover = profile?.coverImage || store.images?.[0];
  const shortDesc =
    profile?.shortDescription ||
    (store.description ? store.description.split(/\n+/)[0] : null);

  const [busy, setBusy] = useState(false);
  const onToggle = async () => {
    if (!isLoggedIn) {
      window.location.href = "/auth/login";
      return;
    }
    setBusy(true);
    await toggleFavorite(store.id);
    setBusy(false);
  };

  return (
    <section className="mb-10">
      {/* Hero cover banner */}
      <div className="relative aspect-[21/9] w-full overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--canvas-raised)]">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt={store.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="grid h-full w-full place-items-center font-label text-[12px] uppercase tracking-widest text-[color:var(--ink-muted)]">
            {store.name}
          </div>
        )}
      </div>

      {/* Profile strip below cover */}
      <div className="mt-5 flex items-start gap-5">
        {/* Logo */}
        <div className="-mt-10 relative h-[88px] w-[88px] shrink-0 overflow-hidden rounded-full border-[3px] border-[var(--canvas)] bg-[var(--canvas-raised)] shadow-sm md:h-[100px] md:w-[100px]">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logo}
              alt={store.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="grid h-full w-full place-items-center font-serif text-[18px] text-[var(--ink)]">
              {store.name.slice(0, 2)}
            </div>
          )}
        </div>

        {/* Meta */}
        <div className="min-w-0 flex-1 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-serif text-[24px] leading-tight text-[var(--ink)] md:text-[28px]">
              {store.name}
            </h1>
            {store.hasMerchant && (
              <span
                className="grid h-5 w-5 place-items-center rounded-full bg-[var(--ink)] text-[10px] text-[var(--canvas)]"
                title="官方认证商家"
              >
                ✓
              </span>
            )}
          </div>

          {shortDesc && (
            <p className="mt-1.5 max-w-[560px] font-serif text-[14px] leading-relaxed text-[var(--ink)] opacity-80">
              {shortDesc}
            </p>
          )}

          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-label text-[11px] text-[color:var(--ink-muted)]">
            {(store.country || store.city) && (
              <span>
                {[store.country, store.city].filter(Boolean).join(" · ")}
              </span>
            )}
            {store.hasMerchant && <span>官方认证</span>}
          </div>

          {/* Stats row */}
          <dl className="mt-4 flex gap-6">
            <StatCell label="关注" value={formatK(favoriteCount)} />
            <StatCell label="粉丝" value="—" />
            <StatCell label="获赞与收藏" value="—" />
          </dl>
        </div>

        {/* Follow button */}
        <div className="shrink-0 pt-1">
          <button
            type="button"
            onClick={onToggle}
            disabled={busy}
            className={`rounded-full px-5 py-2 font-label text-[12px] transition-colors ${
              favorited
                ? "border border-[var(--border)] bg-[var(--canvas)] text-[var(--ink-muted)] hover:border-[var(--ink)] hover:text-[var(--ink)]"
                : "bg-[var(--ink)] text-[var(--canvas)] hover:opacity-80"
            } disabled:opacity-60`}
          >
            {favorited ? "已关注" : "+ 关注"}
          </button>
        </div>
      </div>
    </section>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dd className="font-serif text-[20px] leading-tight text-[var(--ink)]">
        {value}
      </dd>
      <dt className="mt-0.5 font-label text-[10px] text-[color:var(--ink-muted)]">
        {label}
      </dt>
    </div>
  );
}

function formatK(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10_000) return `${(n / 1000).toFixed(1)}k`;
  return `${(n / 10_000).toFixed(1)}w`;
}
