import type { Metadata } from "next";
import { getServerT } from "@/lib/i18n/server";
import { config } from "@/lib/config";
import AppLandingView from "./view";

export async function generateMetadata(): Promise<Metadata> {
  const t = getServerT();
  return {
    title: t("appPage.metaTitle"),
    description: t("appPage.metaDescription"),
    alternates: { canonical: "/app" },
    openGraph: {
      type: "website",
      title: "Avant Regard iOS App",
      description: t("appPage.metaOgDescription"),
      url: `${config.siteUrl}/app`,
    },
  };
}

export default function AppLandingPage() {
  return <AppLandingView />;
}
