"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { AnimateIn } from "@/components/AnimateIn";
import { config } from "@/lib/config";

const ICON_APPLE = (
  <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.665 17.316c-.315.726-.69 1.394-1.128 2.008-.595.84-1.082 1.42-1.458 1.742-.582.523-1.206.79-1.876.808-.48 0-1.058-.137-1.732-.412-.678-.275-1.3-.412-1.87-.412-.596 0-1.236.137-1.923.412-.688.275-1.243.42-1.666.436-.645.028-1.288-.246-1.925-.823-.41-.358-.917-.956-1.518-1.795-.65-.89-1.182-1.927-1.598-3.114C.564 14.941.25 13.627.25 12.347c0-1.485.32-2.767.962-3.84A5.63 5.63 0 0 1 3.23 6.39a5.43 5.43 0 0 1 2.73-.78c.517 0 1.195.16 2.037.473.842.314 1.383.474 1.62.474.178 0 .776-.186 1.79-.559 1.005-.345 1.854-.487 2.55-.427 1.874.151 3.283.89 4.218 2.22-1.676 1.015-2.506 2.438-2.49 4.265.017 1.423.533 2.608 1.547 3.546.459.434.97.77 1.54 1.007-.124.36-.254.706-.392 1.045zM14.998 2c0 .96-.355 1.857-1.061 2.688-.854.988-1.885 1.559-3.005 1.468a3.075 3.075 0 0 1-.022-.365c0-.921.406-1.907 1.125-2.713.358-.41.813-.75 1.364-1.022C13.948 1.787 14.467 1.637 14.956 1.6c.028.134.042.268.042.4z" />
  </svg>
);

interface AppStoreButtonProps {
  variant?: "default" | "inverted";
  className?: string;
}

function AppStoreButton({ variant = "default", className = "" }: AppStoreButtonProps) {
  const base =
    "inline-flex items-center gap-3 rounded px-5 py-3 font-label text-sm font-medium transition-all duration-200 active:scale-[0.98]";
  const style =
    variant === "inverted"
      ? "border border-white/15 bg-white text-black hover:bg-[#e8e8e8]"
      : "bg-black text-white hover:bg-[#222] dark:bg-white dark:text-black dark:hover:bg-[#e0e0e0]";
  return (
    <Link
      href={config.appStoreUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`${base} ${style} ${className}`}
    >
      <span className="opacity-75">{ICON_APPLE}</span>
      <span className="flex flex-col items-start leading-tight">
        <span className="text-[9px] uppercase tracking-[0.18em] opacity-55">
          Download on the
        </span>
        <span className="text-sm tracking-wide">App Store</span>
      </span>
    </Link>
  );
}

const FEATURES_KEYS = ["01", "02", "03", "04"] as const;
const AUDIENCE_KEYS = ["1", "2", "3", "4", "5"] as const;
const WHATS_NEW_KEYS = ["1", "2", "3", "4", "5"] as const;

const APP_INFO_KEYS = [
  "infoCategory",
  "infoPrice",
  "infoVersion",
  "infoSize",
  "infoRequirements",
  "infoLanguage",
  "infoRating",
  "infoAge",
  "infoDeveloper",
] as const;

const APP_INFO_VALUES: ReadonlyArray<string> = [
  "Social Networking",
  "Free",
  "1.1",
  "126.8 MB",
  "iOS 13.4+ · iPadOS 13.4+",
  "English",
  "5.0 / 5 · 3 Ratings",
  "16+",
  "Shanghai Nanteke Industrial Co., Ltd.",
];

export default function AppLandingView() {
  const { t } = useTranslation();

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-black/[0.06] dark:border-white/[0.08]">
        <div className="mx-auto grid max-w-content gap-16 px-6 py-20 md:grid-cols-[1.35fr,1fr] md:py-32">
          <div className="flex flex-col justify-center">
            <div className="animate-fade-in">
              <span className="chip w-fit">iOS App · v1.1</span>
            </div>

            <h1
              className="mt-6 animate-slide-up whitespace-pre-line font-serif text-hero font-semibold text-black dark:text-white"
              style={{ animationDelay: "120ms" }}
            >
              {t("appPage.heroTitle")}
            </h1>

            <p
              className="mt-6 max-w-xl animate-slide-up font-serif text-base leading-relaxed text-black/55 dark:text-white/50 md:text-lg"
              style={{ animationDelay: "240ms" }}
            >
              {t("appPage.heroBody")}
            </p>

            <div
              className="mt-10 flex animate-slide-up flex-wrap items-center gap-3"
              style={{ animationDelay: "360ms" }}
            >
              <AppStoreButton />
              <Link href="#features" className="btn-secondary px-5 py-3 text-sm">
                {t("appPage.ctaLearnMore")}
              </Link>
            </div>

            <div
              className="mt-6 flex animate-fade-in flex-wrap items-center gap-x-5 gap-y-2 font-label text-xs text-black/35 dark:text-white/30"
              style={{ animationDelay: "520ms" }}
            >
              <span className="uppercase tracking-wider">Free</span>
              <span className="h-1 w-1 rounded-full bg-black/15 dark:bg-white/15" />
              <span className="uppercase tracking-wider">iOS 13.4+</span>
              <span className="h-1 w-1 rounded-full bg-black/15 dark:bg-white/15" />
              <span className="uppercase tracking-wider">★ 5.0 · 3 Ratings</span>
            </div>
          </div>

          {/* App icon mock */}
          <div
            className="relative mx-auto flex w-full max-w-[268px] animate-scale-in items-center justify-center"
            style={{ animationDelay: "180ms" }}
          >
            <div
              aria-hidden
              className="absolute inset-0 -z-10 translate-y-6 scale-95 rounded-[56px] bg-black/5 blur-md dark:bg-white/5"
            />
            <div
              className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-[56px] border shadow-elevated
                         border-black/[0.08] bg-black dark:border-white/[0.08]"
            >
              <div className="flex flex-col items-center justify-center text-center">
                <div className="font-serif text-[1.6rem] leading-none tracking-[0.04em] text-white">
                  Avant
                </div>
                <div className="mt-1 font-serif italic text-[1.6rem] leading-none tracking-[0.02em] text-white">
                  Regard
                </div>
                <div className="mt-4 font-label text-[9px] uppercase tracking-[0.3em] text-white/40">
                  Archive
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tagline */}
      <section className="border-b border-black/[0.06] py-6 dark:border-white/[0.08]">
        <AnimateIn className="mx-auto max-w-content px-6">
          <p className="text-center font-label text-xs uppercase tracking-[0.28em] text-black/40 dark:text-white/30 md:text-sm">
            {t("appPage.tagline")}
          </p>
        </AnimateIn>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-content px-6 py-24 md:py-32">
        <AnimateIn>
          <div className="max-w-2xl">
            <span className="chip">Features</span>
            <h2 className="mt-4 whitespace-pre-line font-serif text-display text-black dark:text-white">
              {t("appPage.featuresHeading")}
            </h2>
          </div>
        </AnimateIn>

        <div className="mt-14 grid gap-px overflow-hidden rounded bg-black/[0.05] dark:bg-white/[0.06] md:grid-cols-2">
          {FEATURES_KEYS.map((key, index) => (
            <AnimateIn key={key} delay={index * 70} className="h-full">
              <article
                className="group flex h-full flex-col gap-4 p-8 transition-colors duration-300 md:p-10
                           bg-white hover:bg-[#f9f9f9]
                           dark:bg-[#0a0a0a] dark:hover:bg-[#111]"
              >
                <div
                  className="font-serif text-[4.5rem] font-bold leading-none transition-colors duration-300
                             text-black/[0.05] group-hover:text-black/[0.08]
                             dark:text-white/[0.05] dark:group-hover:text-white/[0.08]"
                >
                  {key}
                </div>
                <h3 className="font-serif text-2xl leading-snug text-black dark:text-white">
                  {t(`appPage.feature${key}Title`)}
                </h3>
                <p className="font-serif text-sm leading-relaxed text-black/50 dark:text-white/40">
                  {t(`appPage.feature${key}Body`)}
                </p>
              </article>
            </AnimateIn>
          ))}
        </div>
      </section>

      {/* Audience */}
      <section className="border-t py-24 md:py-32
                          border-black/[0.06] bg-[#f9f9f9]
                          dark:border-white/[0.08] dark:bg-[#111]">
        <div className="mx-auto max-w-content px-6">
          <AnimateIn>
            <div className="max-w-2xl">
              <span className="chip">Who it&apos;s for</span>
              <h2 className="mt-4 whitespace-pre-line font-serif text-display text-black dark:text-white">
                {t("appPage.audienceHeading")}
              </h2>
            </div>
          </AnimateIn>

          <ul className="mt-12 grid gap-px overflow-hidden rounded bg-black/[0.05] dark:bg-white/[0.06] md:grid-cols-2">
            {AUDIENCE_KEYS.map((key, index) => (
              <AnimateIn key={key} delay={index * 60}>
                <li
                  className="flex items-start gap-5 p-7 font-serif text-base leading-relaxed
                             bg-white text-black/75
                             dark:bg-[#0a0a0a] dark:text-white/65"
                >
                  <span className="font-label text-xs uppercase tracking-[0.22em] text-black/30 dark:text-white/25">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span>{t(`appPage.audience${key}`)}</span>
                </li>
              </AnimateIn>
            ))}
          </ul>

          <AnimateIn>
            <p className="mt-12 max-w-xl font-serif text-sm leading-relaxed text-black/45 dark:text-white/35">
              {t("appPage.audienceFooter")}
            </p>
          </AnimateIn>
        </div>
      </section>

      {/* What's New */}
      <section className="mx-auto max-w-content px-6 py-24 md:py-32">
        <AnimateIn>
          <div className="max-w-2xl">
            <span className="chip">What&apos;s New · v1.1</span>
            <h2 className="mt-4 whitespace-pre-line font-serif text-display text-black dark:text-white">
              {t("appPage.whatsNewHeading")}
            </h2>
          </div>
        </AnimateIn>

        <ol className="mt-14 space-y-px overflow-hidden rounded bg-black/[0.05] dark:bg-white/[0.06]">
          {WHATS_NEW_KEYS.map((key, index) => (
            <AnimateIn key={key} delay={index * 50}>
              <li
                className="grid gap-4 p-7 md:grid-cols-[auto,1fr,2fr] md:items-start md:gap-8 md:p-9
                           bg-white dark:bg-[#0a0a0a]"
              >
                <div className="font-serif text-3xl leading-none text-black/15 dark:text-white/15">
                  {String(index + 1).padStart(2, "0")}
                </div>
                <h3 className="font-serif text-xl leading-snug text-black dark:text-white md:text-2xl">
                  {t(`appPage.whatsNew${key}Title`)}
                </h3>
                <p className="font-serif text-sm leading-relaxed text-black/55 dark:text-white/45">
                  {t(`appPage.whatsNew${key}Body`)}
                </p>
              </li>
            </AnimateIn>
          ))}
        </ol>
      </section>

      {/* App Info */}
      <section className="border-t py-24 md:py-32
                          border-black/[0.06] bg-[#f9f9f9]
                          dark:border-white/[0.08] dark:bg-[#111]">
        <div className="mx-auto max-w-content px-6">
          <AnimateIn>
            <div className="max-w-2xl">
              <span className="chip">Information</span>
              <h2 className="mt-4 font-serif text-display text-black dark:text-white">
                {t("appPage.infoTitle")}
              </h2>
            </div>
          </AnimateIn>

          <AnimateIn>
            <dl
              className="mt-12 grid gap-x-10 gap-y-6 font-serif text-sm md:grid-cols-2 md:gap-y-7"
            >
              {APP_INFO_KEYS.map((key, idx) => (
                <div
                  key={key}
                  className="flex items-baseline justify-between gap-6 border-b pb-4
                             border-black/[0.06] dark:border-white/[0.08]"
                >
                  <dt className="font-label text-xs uppercase tracking-[0.18em] text-black/40 dark:text-white/30">
                    {t(`appPage.${key}`)}
                  </dt>
                  <dd className="text-right text-black/75 dark:text-white/65">
                    {APP_INFO_VALUES[idx]}
                  </dd>
                </div>
              ))}
            </dl>
          </AnimateIn>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative overflow-hidden bg-black dark:bg-[#111]">
        <div className="mx-auto max-w-content px-6 py-24 text-center md:py-32">
          <AnimateIn>
            <span className="inline-flex items-center gap-1.5 rounded border border-white/10 bg-white/[0.05] px-2.5 py-0.5 font-label text-[10px] uppercase tracking-[0.18em] text-white/40">
              Get the app
            </span>
            <h2 className="mt-5 whitespace-pre-line font-serif text-display text-white">
              {t("appPage.ctaHeading")}
            </h2>
            <p className="mx-auto mt-6 max-w-xl font-serif text-sm leading-relaxed text-white/45 md:text-base">
              {t("appPage.ctaBody")}
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <AppStoreButton variant="inverted" />
              <Link
                href="/"
                className="font-label text-sm tracking-wide text-white/55 underline-offset-4 transition-colors hover:text-white hover:underline"
              >
                {t("appPage.backToHome")}
              </Link>
            </div>
          </AnimateIn>
        </div>
      </section>
    </>
  );
}
