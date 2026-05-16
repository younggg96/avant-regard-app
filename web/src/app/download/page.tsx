import type { Metadata } from "next";
import { getServerT } from "@/lib/i18n/server";
import { config } from "@/lib/config";
import AppLandingView from "../app/view";

/**
 * Dedicated “download” URL for marketing — renders the same experience as
 * `/app` but with download-oriented metadata and canonical `/download`.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = getServerT();
  return {
    title: t("downloadPage.metaTitle"),
    description: t("downloadPage.metaDescription"),
    alternates: { canonical: "/download" },
    openGraph: {
      type: "website",
      title: t("downloadPage.ogTitle"),
      description: t("downloadPage.metaOgDescription"),
      url: `${config.siteUrl}/download`,
    },
  };
}

export default function DownloadPage() {
  return <AppLandingView />;
}
