"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { PostCard } from "@/components/PostCard";
import { Marquee } from "@/components/Marquee";
import { AnimateIn } from "@/components/AnimateIn";
import { RotatingHeadline } from "@/components/RotatingHeadline";
import { SignatureWordmark } from "@/components/SignatureWordmark";
import { HeroShowcase } from "@/components/HeroShowcase";
import type { Post } from "@/lib/types";

export function HomeView({ posts }: { posts: Post[] }) {
  const { t } = useTranslation();

  const FEATURES = [
    { eyebrow: "01", title: t("homepage.feature01Title"), body: t("homepage.feature01Body") },
    { eyebrow: "02", title: t("homepage.feature02Title"), body: t("homepage.feature02Body") },
    { eyebrow: "03", title: t("homepage.feature03Title"), body: t("homepage.feature03Body") },
    { eyebrow: "04", title: t("homepage.feature04Title"), body: t("homepage.feature04Body") },
  ];

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-black/[0.06] dark:border-white/[0.08]">
        {/* Signature wordmark — cinematic shatter / assembly */}
        <div className="mx-auto max-w-content px-6 pt-16 md:pt-24">
          <SignatureWordmark
            text="AVANT REGARD"
            className="text-[clamp(1.25rem,11vw,9.5rem)]"
          />
          <div
            aria-hidden
            className="mx-auto mt-6 h-px w-12 origin-center bg-black/30 dark:bg-white/30"
            style={{
              animation:
                "signature-divider 900ms 1700ms cubic-bezier(0.2,0.8,0.25,1) both",
            }}
          />
          <p
            className="mx-auto mt-4 max-w-md text-center font-label text-[10px] uppercase tracking-[0.32em] text-black/40 dark:text-white/35"
            style={{
              animation: "fadeIn 700ms 2000ms ease-out both",
            }}
          >
            {t("homepage.chip")} — FW26
          </p>
        </div>

        <div className="mx-auto grid max-w-content items-center gap-12 px-6 py-14 md:grid-cols-[1.1fr,1fr] md:gap-16 md:py-20 lg:gap-20">
          {/* ─── LEFT: copy, CTAs, stats ─────────────────────────────────── */}
          <div className="flex flex-col">
            <RotatingHeadline
              className="animate-slide-up font-serif text-[clamp(2.5rem,7vw,5.5rem)] font-semibold tracking-[-0.02em] text-black dark:text-white"
              style={{ animationDelay: "800ms" }}
            />

            <p
              className="mt-7 max-w-[34rem] animate-slide-up font-serif text-base leading-relaxed text-black/55 dark:text-white/50 md:text-[17px]"
              style={{ animationDelay: "950ms" }}
            >
              {t("homepage.heroBody")}
            </p>

            <div
              className="mt-10 flex animate-slide-up flex-wrap items-center gap-3"
              style={{ animationDelay: "1100ms" }}
            >
              <Link
                href="/discover"
                className="btn-primary group px-6 py-3.5 text-[13px] tracking-[0.05em]"
              >
                {t("homepage.ctaDiscover")}
                <svg
                  width="14"
                  height="10"
                  viewBox="0 0 14 10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  className="ml-1 transition-transform duration-300 group-hover:translate-x-1"
                >
                  <path d="M0 5 H 12.5" />
                  <path d="M8.5 1 L 12.5 5 L 8.5 9" />
                </svg>
              </Link>
              <Link
                href="/#features"
                className="btn-secondary group px-6 py-3.5 text-[13px] tracking-[0.05em]"
              >
                {t("homepage.ctaFeatures")}
                <svg
                  width="14"
                  height="10"
                  viewBox="0 0 14 10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  className="ml-1 transition-transform duration-300 group-hover:translate-x-1"
                >
                  <path d="M0 5 H 12.5" />
                  <path d="M8.5 1 L 12.5 5 L 8.5 9" />
                </svg>
              </Link>
            </div>

            {/* Stats — Global community */}
            <div
              className="mt-14 animate-slide-up md:mt-16"
              style={{ animationDelay: "1300ms" }}
            >
              <div className="font-label text-[10px] tracking-[0.32em] text-black/40 dark:text-white/40">
                {t("homepage.heroStatsLabel")}
              </div>
              <div className="mt-4 grid max-w-md grid-cols-3 divide-x divide-black/[0.08] dark:divide-white/[0.08]">
                <Stat
                  value={t("homepage.heroStatUsersValue")}
                  label={t("homepage.heroStatUsersLabel")}
                  className="pr-4"
                />
                <Stat
                  value={t("homepage.heroStatOutfitsValue")}
                  label={t("homepage.heroStatOutfitsLabel")}
                  className="px-4"
                />
                <Stat
                  value={t("homepage.heroStatBrandsValue")}
                  label={t("homepage.heroStatBrandsLabel")}
                  className="pl-4"
                />
              </div>
            </div>
          </div>

          {/* ─── RIGHT: phone + floating cards ──────────────────────────── */}
          <div
            className="animate-scale-in"
            style={{ animationDelay: "1300ms" }}
          >
            <HeroShowcase posts={posts} />
          </div>
        </div>
      </section>

      {/* Marquee */}
      <div className="border-b border-black/[0.06] py-3.5 dark:border-white/[0.08]">
        <Marquee />
      </div>

      {/* Features */}
      <section id="features" className="mx-auto max-w-content px-6 py-24 md:py-32">
        <AnimateIn>
          <div className="max-w-2xl">
            <span className="chip">{t("homepage.featuresChip")}</span>
            <h2 className="mt-4 font-serif text-display text-black dark:text-white whitespace-pre-line">
              {t("homepage.featuresHeading")}
            </h2>
          </div>
        </AnimateIn>

        <div className="mt-14 grid gap-px overflow-hidden rounded bg-black/[0.05] dark:bg-white/[0.06] md:grid-cols-2">
          {FEATURES.map((feature, index) => (
            <AnimateIn key={feature.title} delay={index * 70} className="h-full">
              <article className="group flex h-full flex-col gap-4 p-8 transition-colors duration-300 md:p-10
                                  bg-white hover:bg-[#f9f9f9]
                                  dark:bg-[#0a0a0a] dark:hover:bg-[#111]">
                <div className="font-serif text-[4.5rem] font-bold leading-none transition-colors duration-300
                                text-black/[0.05] group-hover:text-black/[0.08]
                                dark:text-white/[0.05] dark:group-hover:text-white/[0.08]">
                  {feature.eyebrow}
                </div>
                <h3 className="font-serif text-2xl leading-snug text-black dark:text-white">
                  {feature.title}
                </h3>
                <p className="font-serif text-sm leading-relaxed text-black/50 dark:text-white/40">
                  {feature.body}
                </p>
              </article>
            </AnimateIn>
          ))}
        </div>
      </section>

      {/* Discover preview */}
      {posts.length > 0 && (
        <section className="border-t py-24 md:py-32
                            border-black/[0.06] bg-[#f9f9f9]
                            dark:border-white/[0.08] dark:bg-[#111]">
          <div className="mx-auto max-w-content px-6">
            <AnimateIn>
              <div className="flex items-end justify-between gap-6">
                <div className="max-w-xl">
                  <span className="chip">Discover</span>
                  <h2 className="mt-4 font-serif text-display text-black dark:text-white">
                    {t("homepage.discoverPreviewHeading")}
                  </h2>
                  <p className="mt-4 font-serif text-sm leading-relaxed text-black/50 dark:text-white/40">
                    {t("homepage.discoverPreviewBody")}
                  </p>
                </div>
                <Link href="/discover" className="btn-secondary whitespace-nowrap">
                  {t("homepage.viewAll")}
                </Link>
              </div>
            </AnimateIn>

            <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {posts.map((post, index) => (
                <AnimateIn key={post.id} delay={index * 50}>
                  <PostCard post={post} priority={index < 2} />
                </AnimateIn>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Avant-Garde Fashion World — atlas teaser */}
      <section className="relative overflow-hidden border-y border-black/[0.06] dark:border-white/[0.08]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.04] [background-image:linear-gradient(rgba(0,0,0,1)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,1)_1px,transparent_1px)] [background-size:84px_84px] dark:opacity-[0.06] dark:[background-image:linear-gradient(rgba(255,255,255,1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,1)_1px,transparent_1px)]"
        />
        <div className="relative mx-auto grid max-w-content gap-10 px-6 py-20 md:grid-cols-[1fr,auto] md:items-end md:py-24">
          <AnimateIn>
            <div>
              <span className="chip">{t("homepage.atlasChip")}</span>
              <h2 className="mt-5 font-serif text-display text-black dark:text-white whitespace-pre-line">
                {t("homepage.atlasHeading")}
              </h2>
              <p className="mt-5 max-w-xl font-serif text-sm leading-relaxed text-black/55 dark:text-white/45 md:text-base">
                {t("homepage.atlasBody")}
              </p>
            </div>
          </AnimateIn>
          <Link
            href="/atlas"
            className="btn-secondary self-start whitespace-nowrap md:self-end"
          >
            {t("homepage.atlasCta")} <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </section>

      {/* CTA */}
      <section id="about" className="relative overflow-hidden bg-black dark:bg-[#111]">
        <div className="mx-auto grid max-w-content gap-12 px-6 py-24 md:grid-cols-[1fr,auto] md:items-end md:py-32">
          <AnimateIn>
            <div>
              <span className="inline-flex items-center gap-1.5 rounded border border-white/10 bg-white/[0.05] px-2.5 py-0.5 font-label text-[10px] uppercase tracking-[0.18em] text-white/40">
                About
              </span>
              <h2 className="mt-5 font-serif text-display text-white whitespace-pre-line">
                {t("homepage.aboutHeading")}
              </h2>
              <p className="mt-6 max-w-xl font-serif text-sm leading-relaxed text-white/45 md:text-base">
                {t("homepage.aboutBody")}
              </p>
            </div>
          </AnimateIn>
          <Link
            href="/discover"
            className="inline-flex items-center gap-3 self-start rounded border border-white/15 bg-white px-5 py-3 font-label text-sm font-medium text-black transition-all duration-200 hover:bg-[#e8e8e8] active:scale-[0.98] md:self-end"
          >
            {t("homepage.enterDiscover")}
          </Link>
        </div>
      </section>
    </>
  );
}

function Stat({
  value,
  label,
  className = "",
}: {
  value: string;
  label: string;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <span className="font-serif text-[clamp(1.5rem,3vw,2.25rem)] font-semibold leading-none tracking-[-0.01em] text-black dark:text-white">
        {value}
      </span>
      <span className="font-label text-[10.5px] tracking-[0.14em] text-black/40 dark:text-white/40">
        {label}
      </span>
    </div>
  );
}
