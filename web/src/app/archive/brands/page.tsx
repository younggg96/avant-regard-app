import type { Metadata } from "next";
import { ApiError, getAllBrands } from "@/lib/api";
import { getServerT } from "@/lib/i18n/server";
import BrandsView from "./view";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const t = getServerT();
  return {
    title: t("archiveBrands.metaTitle"),
    description: t("archiveBrands.metaDescription"),
    alternates: { canonical: "/archive/brands" },
  };
}

export default async function BrandsPage() {
  try {
    const res = await getAllBrands();
    return <BrandsView brands={res.brands} total={res.total} />;
  } catch (err) {
    if (err instanceof ApiError) {
      const t = getServerT();
      return (
        <p className="mx-auto max-w-content px-6 py-24 text-center font-serif text-[color:var(--ink-muted)]">
          {t("archiveBrands.loadError", { message: err.message })}
        </p>
      );
    }
    throw err;
  }
}
