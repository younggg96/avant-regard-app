import type { Metadata } from "next";
import { ApiError, getCommunities } from "@/lib/api";
import { getServerT } from "@/lib/i18n/server";
import { CommunitiesView, CommunitiesErrorView } from "./view";

export const revalidate = 120;

export async function generateMetadata(): Promise<Metadata> {
  const t = getServerT();
  return {
    title: t("communitiesPage.metaTitle"),
    description: t("communitiesPage.metaDescription"),
    alternates: { canonical: "/communities" },
  };
}

export default async function CommunitiesPage() {
  const t = getServerT();
  try {
    const data = await getCommunities();
    return <CommunitiesView data={data} />;
  } catch (err) {
    if (err instanceof ApiError) {
      return (
        <CommunitiesErrorView
          message={t("communitiesPage.loadError", {
            status: String(err.status),
            message: err.message,
          })}
        />
      );
    }
    throw err;
  }
}
