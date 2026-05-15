import type { Metadata } from "next";
import { getServerT } from "@/lib/i18n/server";
import { AtlasView } from "./AtlasView";

export function generateMetadata(): Metadata {
  const t = getServerT();
  return {
    title: t("atlas.metaTitle"),
    description: t("atlas.metaDescription"),
    openGraph: {
      title: t("atlas.metaTitle"),
      description: t("atlas.metaDescription"),
      type: "website",
    },
  };
}

/**
 * /atlas — Avant-Garde Fashion World.
 *
 * Independent immersive page: shares the SiteHeader / SiteFooter from the
 * root layout but uses a dedicated dark editorial canvas for the globe so
 * the marker glow and grid lines read clearly. Light mode users still get
 * the unified header / footer chrome.
 */
export default function AtlasPage() {
  return <AtlasView />;
}
