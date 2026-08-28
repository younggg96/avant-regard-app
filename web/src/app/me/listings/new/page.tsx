"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";

import { PageHeader } from "@/components/admin/ui";
import { ListingWizard } from "@/components/trading/ListingWizard";

export default function NewListingPage() {
  const { t } = useTranslation();

  return (
    <div>
      <Link
        href="/me/listings"
        className="font-label text-[12px] text-[color:var(--ink-muted)] transition-colors hover:text-[var(--ink)]"
      >
        ← {t("trading.myListings")}
      </Link>
      <div className="mt-4">
        <PageHeader
          title={t("trading.publishListing")}
          description={t("trading.publish.intro")}
        />
      </div>
      <ListingWizard />
    </div>
  );
}
