"use client";

import type { BuyerStore } from "@/lib/services/buyer-store";
import type { StoreProfileConfig } from "@/lib/services/store-product";

interface Props {
  store: BuyerStore;
  profile: StoreProfileConfig | null | undefined;
}

export function StoreBrandStoryCard({ store, profile }: Props) {
  const longDesc =
    profile?.longDescription ||
    (store.description
      ? store.description.split(/\n+/).slice(1).join("\n").trim() || null
      : null);
  const tags = profile?.tags ?? [];

  if (!longDesc) return null;

  return (
    <section className="mb-10 border-y border-[var(--border)] py-10 md:py-14">
      <div className="mx-auto max-w-[640px] text-center">
        {/* Store name as subtle label */}
        <div className="font-label text-[11px] uppercase tracking-[0.2em] text-[color:var(--ink-muted)]">
          {store.name}
        </div>

        {/* Brand story body */}
        <p className="mt-5 whitespace-pre-wrap font-serif text-[16px] leading-[1.9] text-[var(--ink)] opacity-85 md:text-[18px]">
          {longDesc}
        </p>

        {/* Tags */}
        {tags.length > 0 && (
          <ul className="mt-6 flex flex-wrap justify-center gap-2">
            {tags.slice(0, 6).map((t) => (
              <li
                key={t}
                className="rounded-full border border-[var(--border)] px-3 py-1 font-label text-[11px] text-[color:var(--ink-muted)]"
              >
                {t}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
