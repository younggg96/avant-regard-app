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
 * Independent immersive page: shares the SiteHeader from the root layout;
 * the footer is omitted so the globe fills the viewport. Uses a dedicated
 * dark editorial canvas in dark mode so marker glow and grid lines read
 * clearly; light mode keeps the plain site canvas.
 */
export default function AtlasPage() {
  return <AtlasView />;
}
