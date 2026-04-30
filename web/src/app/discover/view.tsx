"use client";

import { useTranslation } from "react-i18next";
import { AnimateIn } from "@/components/AnimateIn";
import { DiscoverFeed } from "@/components/discover/DiscoverFeed";
import type { FeedItem } from "@/lib/types";

export function DiscoverPageView({
  initialItems,
  initialError,
}: {
  initialItems: FeedItem[];
  initialError: string | null;
}) {
  const { t } = useTranslation();

  return (
    <section className="mx-auto max-w-content px-6 py-16 md:py-24">
      <AnimateIn>
        <header className="mb-14">
          <div className="max-w-2xl">
            <span className="chip">Discover</span>
            <h1 className="mt-4 font-serif text-display text-black dark:text-white whitespace-pre-line">
              {t("discoverPage.heading")}
            </h1>
            <p className="mt-4 font-serif text-sm leading-relaxed text-black/50 dark:text-white/40">
              {t("discoverPage.subheading")}
            </p>
          </div>
        </header>
      </AnimateIn>

      <DiscoverFeed
        initialItems={initialItems}
        initialError={initialError}
      />
    </section>
  );
}
