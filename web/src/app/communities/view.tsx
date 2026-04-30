"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { FadeImage } from "@/components/FadeImage";
import { formatCount } from "@/lib/format";
import type { Community, CommunityListResponse } from "@/lib/api";

interface CommunitiesViewProps {
  data: CommunityListResponse;
}

const CATEGORY_KEY: Record<string, string> = {
  GENERAL: "communitiesPage.categoryGeneral",
  FASHION: "communitiesPage.categoryFashion",
  LIFESTYLE: "communitiesPage.categoryLifestyle",
  BEAUTY: "communitiesPage.categoryBeauty",
  CULTURE: "communitiesPage.categoryCulture",
};

export function CommunitiesView({ data }: CommunitiesViewProps) {
  const { t } = useTranslation();
  const communities = data.all.filter((c) => c.isActive);

  return (
    <section className="mx-auto max-w-content px-6 py-12 md:py-16">
      <header className="mb-12">
        <h1 className="font-serif text-4xl tracking-tight text-black dark:text-white md:text-5xl">
          {t("communitiesPage.pageTitle")}
        </h1>
        <p className="mt-3 max-w-xl font-serif text-[15px] leading-relaxed text-black/60 dark:text-white/50">
          {t("communitiesPage.subtitle")}
        </p>
      </header>

      {data.popular.length > 0 && (
        <section className="mb-12">
          <h2 className="mb-5 font-label text-xs uppercase tracking-[0.18em] text-black/40 dark:text-white/35">
            Popular
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.popular.slice(0, 6).map((c) => (
              <CommunityHeroCard key={c.id} c={c} />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-5 font-label text-xs uppercase tracking-[0.18em] text-black/40 dark:text-white/35">
          All Communities
        </h2>
        <ul className="divide-y divide-[var(--border)] rounded border border-[var(--border)]">
          {communities.map((c) => (
            <li key={c.id}>
              <Link
                href={`/communities/${c.slug}`}
                className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-[var(--canvas-raised)]"
              >
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-[var(--canvas-raised)]">
                  {c.iconUrl && (
                    <FadeImage
                      src={c.iconUrl}
                      alt={c.name}
                      fill
                      sizes="48px"
                      className="object-cover"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-serif text-[16px] text-black dark:text-white">
                      {c.name}
                    </h3>
                    {c.isOfficial && (
                      <span className="chip">Official</span>
                    )}
                  </div>
                  <p className="mt-0.5 line-clamp-1 font-label text-[12px] text-[color:var(--ink-muted)]">
                    {c.description || t(CATEGORY_KEY[c.category] ?? "") || ""}
                  </p>
                </div>
                <div className="hidden shrink-0 text-right font-label text-[11px] uppercase tracking-widest text-[color:var(--ink-muted)] md:block">
                  <div>{formatCount(c.memberCount)} {t("communitiesPage.members")}</div>
                  <div>{formatCount(c.postCount)} {t("communitiesPage.posts")}</div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}

export function CommunitiesErrorView({ message }: { message: string }) {
  return (
    <div className="mx-auto max-w-content px-6 py-24 text-center">
      <p className="font-serif text-[15px] text-[color:var(--ink-muted)]">
        {message}
      </p>
    </div>
  );
}

function CommunityHeroCard({ c }: { c: Community }) {
  const { t } = useTranslation();
  return (
    <Link
      href={`/communities/${c.slug}`}
      className="group relative block overflow-hidden rounded border border-[var(--border)] bg-[var(--canvas-soft)]"
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-[var(--canvas-raised)]">
        {c.coverUrl && (
          <FadeImage
            src={c.coverUrl}
            alt={c.name}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        )}
      </div>
      <div className="p-4">
        <h3 className="font-serif text-[17px] text-black dark:text-white">
          {c.name}
        </h3>
        <p className="mt-1 line-clamp-2 font-label text-[12px] text-[color:var(--ink-muted)]">
          {c.description || "—"}
        </p>
        <div className="mt-3 font-label text-[11px] uppercase tracking-widest text-[color:var(--ink-muted)]">
          {formatCount(c.memberCount)} {t("communitiesPage.members")} · {formatCount(c.postCount)} {t("communitiesPage.posts")}
        </div>
      </div>
    </Link>
  );
}
