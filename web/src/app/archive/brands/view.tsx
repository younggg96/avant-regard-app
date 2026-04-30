"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { FadeImage } from "@/components/FadeImage";
import { isRenderableImage } from "@/lib/isRenderableImage";
import type { Brand } from "@/lib/api";

function firstLetter(name: string): string {
  const c = name.trim().charAt(0).toUpperCase();
  return /[A-Z]/.test(c) ? c : "#";
}

interface BrandsViewProps {
  brands: Brand[];
  total: number;
}

export default function BrandsView({ brands, total }: BrandsViewProps) {
  const { t } = useTranslation();

  const sorted = brands.slice().sort((a, b) => a.name.localeCompare(b.name));

  const groups = new Map<string, Brand[]>();
  for (const b of sorted) {
    const k = firstLetter(b.name);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(b);
  }
  const letters = Array.from(groups.keys()).sort((a, b) => {
    if (a === "#") return 1;
    if (b === "#") return -1;
    return a.localeCompare(b);
  });

  return (
    <section className="mx-auto max-w-content px-6 py-12 md:py-16">
      <header className="mb-8">
        <nav className="mb-4 font-label text-sm">
          <Link href="/" className="link-muted">
            {t("archiveBrands.backHome")}
          </Link>
        </nav>
        <h1 className="font-serif text-4xl tracking-tight text-black dark:text-white md:text-5xl">
          {t("archiveBrands.pageTitle")}
        </h1>
        <p className="mt-3 max-w-xl font-serif text-[15px] leading-relaxed text-black/60 dark:text-white/50">
          {t("archiveBrands.countLabel", { count: total })}
        </p>
      </header>

      <nav
        aria-label={t("archiveBrands.letterIndexLabel")}
        className="sticky top-14 z-20 -mx-6 border-y border-[var(--border)] bg-[var(--canvas)]/95 px-6 py-2 backdrop-blur"
      >
        <ul className="flex flex-wrap gap-2 font-label text-[12px]">
          {letters.map((l) => (
            <li key={l}>
              <a
                href={`#letter-${l}`}
                className="rounded px-2 py-1 text-[color:var(--ink-muted)] hover:bg-[var(--canvas-raised)] hover:text-[var(--ink)]"
              >
                {l}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-10 space-y-12">
        {letters.map((l) => (
          <section key={l} id={`letter-${l}`} className="scroll-mt-28">
            <h2 className="mb-5 font-serif text-2xl text-black dark:text-white">
              {l}
            </h2>
            <ul className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
              {groups.get(l)!.map((b) => (
                <li key={b.id}>
                  <Link
                    href={`/archive/brands/${b.id}`}
                    className="flex items-center gap-3 rounded border border-transparent px-2 py-1.5 font-serif text-[15px] text-black/80 transition-colors hover:border-[var(--border)] hover:bg-[var(--canvas-raised)] dark:text-white/70"
                  >
                    <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-[var(--canvas-raised)]">
                      {isRenderableImage(b.coverImage) && (
                        <FadeImage
                          src={b.coverImage}
                          alt={b.name}
                          fill
                          sizes="36px"
                          className="object-cover"
                        />
                      )}
                    </div>
                    <span className="truncate">{b.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </section>
  );
}
