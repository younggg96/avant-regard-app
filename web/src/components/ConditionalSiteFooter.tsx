"use client";

import { usePathname } from "next/navigation";

import { SiteFooter } from "@/components/SiteFooter";

const FOOTER_HIDDEN_PREFIXES = ["/atlas"];

function shouldHideFooter(pathname: string | null): boolean {
  if (!pathname) return false;
  return FOOTER_HIDDEN_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** Renders {@link SiteFooter} everywhere except immersive full-bleed routes. */
export function ConditionalSiteFooter() {
  const pathname = usePathname();
  if (shouldHideFooter(pathname)) return null;
  return <SiteFooter />;
}
