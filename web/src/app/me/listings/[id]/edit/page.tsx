"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import useSWR from "swr";

import { LoadingState, PageHeader } from "@/components/admin/ui";
import { ListingWizard } from "@/components/trading/ListingWizard";
import { listingService } from "@/lib/services/listing";

export default function EditListingPage() {
  const { t } = useTranslation();
  const params = useParams<{ id: string }>();
  const listingId = Number(params.id);

  const { data: listing, isLoading } = useSWR(
    Number.isFinite(listingId) ? ["listing", listingId] : null,
    () => listingService.get(listingId),
  );

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
          title={t("trading.editListing")}
          description={t("trading.publish.intro")}
        />
      </div>

      {isLoading ? (
        <LoadingState />
      ) : listing ? (
        <ListingWizard listing={listing} />
      ) : (
        <p className="font-label text-[13px] text-[color:var(--ink-muted)]">
          {t("common.loadFailed")}
        </p>
      )}
    </div>
  );
}
