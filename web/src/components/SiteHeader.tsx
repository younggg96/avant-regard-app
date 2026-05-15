"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserMenu } from "@/components/auth/UserMenu";

export function SiteHeader() {
  const { t } = useTranslation();

  const NAV_LINKS: ReadonlyArray<{ href: string; label: string }> = [
    { href: "/discover", label: t("nav.discover") },
    { href: "/communities", label: t("nav.forum") },
    { href: "/archive/brands", label: t("nav.archive") },
    { href: "/stores", label: t("nav.stores") },
    { href: "/atlas", label: t("nav.atlas") },
  ];
  return (
    <header className="sticky top-0 z-40 border-b bg-white/92 backdrop-blur-md transition-shadow
                       border-black/[0.06] dark:bg-[#0a0a0a]/92 dark:border-white/[0.08]">
      <div className="mx-auto flex h-14 max-w-content items-center justify-between px-6">
        <Link
          href="/"
          className="flex items-center gap-2 transition-opacity duration-200 hover:opacity-40"
        >
          <Image
            src="/logo.jpg"
            alt="Avant Regard"
            width={32}
            height={32}
            className="rounded-sm dark:invert"
          />
          <span className="font-serif text-[1.05rem] tracking-[0.06em] text-black dark:text-white">
            Avant Regard
          </span>
        </Link>

        <nav className="hidden items-center gap-7 font-label text-[13px] tracking-wide md:flex">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="link-underline">
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
