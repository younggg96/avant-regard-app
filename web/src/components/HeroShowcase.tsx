"use client";

/**
 * HeroShowcase — the right-side "content universe" composition for the
 * redesigned homepage Hero.
 *
 * Layout (absolute-positioned canvas, 4/5 aspect on mobile, fixed height
 * on tablet+):
 *
 *   ┌──────────────────────────────────────────────────────┐
 *   │  ┌───────────┐                                       │
 *   │  │ Designer  │     ┌─────────────┐         ┌───────┐ │
 *   │  └───────────┘     │             │         │ ARCHV │ │
 *   │                    │             │         └───────┘ │
 *   │                    │   PHONE     │                   │
 *   │   ┌────────┐       │             │       ┌────────┐  │
 *   │   │ Store  │       │             │       │ Commty │  │
 *   │   └────────┘       └─────────────┘       └────────┘  │
 *   │                                                      │
 *   └──────────────────────────────────────────────────────┘
 *
 * All imagery is sourced from the homepage feed (`posts`) when available,
 * with deterministic CSS-gradient fallbacks so the composition still reads
 * with an empty / failing feed.  Replace the gradient stubs by swapping the
 * `image` props on the floating cards once first-party imagery exists.
 *
 * Animation: each layer has a small, low-amplitude vertical float driven by
 * a CSS @keyframe declared in `globals.css` (`hero-float-a/b/c/d/phone`).
 * `prefers-reduced-motion` is honoured globally.
 */

import Image from "next/image";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { formatCount } from "@/lib/format";
import { isRenderableImage } from "@/lib/isRenderableImage";
import type { Post } from "@/lib/types";

export interface HeroShowcaseProps {
  posts: Post[];
}

function pickImage(posts: Post[], index: number): string | undefined {
  const url = posts[index]?.imageUrls?.[0];
  return isRenderableImage(url) ? url : undefined;
}

export function HeroShowcase({ posts }: HeroShowcaseProps) {
  const { t } = useTranslation();

  const designerImg = pickImage(posts, 3);
  const storeImg = pickImage(posts, 4);
  const archiveImg = pickImage(posts, 5);

  return (
    <div
      className="
        relative mx-auto w-full
        h-[560px] max-w-[440px]
        sm:h-[620px] sm:max-w-[520px]
        md:h-[680px] md:max-w-none
        lg:h-[760px]
      "
      style={{ perspective: "1400px" }}
    >
      {/* Soft ambient glow behind the phone */}
      <div
        aria-hidden
        className="
          absolute left-1/2 top-1/2 -z-10 h-[80%] w-[78%]
          -translate-x-1/2 -translate-y-1/2 rounded-full
          blur-2xl opacity-70 dark:opacity-50
        "
        style={{
          background:
            "radial-gradient(closest-side, rgba(0,0,0,0.06), rgba(0,0,0,0.02) 60%, transparent 80%)",
        }}
      />

      {/* ─── Floating cards (behind & beside the phone) ───────────────────── */}

      {/* Designer — top-left, dark, slightly behind phone */}
      <FloatLayer
        anim="hero-float-a"
        duration="7s"
        delay="0s"
        className="
          absolute z-20
          left-[2%] top-[4%]
          w-[140px] sm:w-[160px] md:w-[180px] lg:w-[200px]
        "
        rotate="-2.5deg"
      >
        <DesignerCard image={designerImg} archivesLabel={t("homepage.heroDesignerArchives")} />
      </FloatLayer>

      {/* Store — bottom-left, white */}
      <FloatLayer
        anim="hero-float-b"
        duration="8s"
        delay="0.6s"
        className="
          absolute z-20
          left-[-2%] bottom-[14%]
          w-[180px] sm:w-[200px] md:w-[220px] lg:w-[240px]
          hidden sm:block
        "
        rotate="2deg"
      >
        <StoreCard image={storeImg} />
      </FloatLayer>

      {/* Archive — right-mid, semi-transparent */}
      <FloatLayer
        anim="hero-float-c"
        duration="6.5s"
        delay="1.2s"
        className="
          absolute z-20
          right-[6%] top-[24%]
          w-[160px] md:w-[180px] lg:w-[200px]
          hidden md:block
        "
        rotate="3deg"
      >
        <ArchiveCard image={archiveImg} />
      </FloatLayer>

      {/* Community — bottom-right, minimal */}
      <FloatLayer
        anim="hero-float-d"
        duration="7.5s"
        delay="0.3s"
        className="
          absolute z-20
          right-[2%] bottom-[10%]
          w-[180px] sm:w-[200px] md:w-[220px] lg:w-[240px]
        "
        rotate="-2deg"
      >
        <CommunityCard
          headlineLine1={t("homepage.heroCommunityLine1")}
          headlineLine2={t("homepage.heroCommunityLine2")}
        />
      </FloatLayer>

      {/* ─── Phone — visual centerpiece ──────────────────────────────────── */}
      <FloatLayer
        anim="hero-float-phone"
        duration="9s"
        delay="0s"
        className="
          absolute left-1/2 top-1/2 z-10
          -translate-x-1/2 -translate-y-1/2
          w-[230px] sm:w-[260px] md:w-[280px] lg:w-[300px]
        "
        rotate="-1.5deg"
      >
        <PhoneMockup feedPosts={posts.slice(0, 4)} />
      </FloatLayer>

      {/* ─── Editorial side rail (vertical labels) ───────────────────────── */}
      <div
        aria-hidden
        className="
          pointer-events-none absolute right-[-4px] top-0 z-30
          hidden h-full flex-col justify-between py-10
          lg:flex
        "
      >
        <SideRailLabel label="ARCHIVE" index="01" />
        <SideRailLabel label="STORES" index="02" />
        <SideRailLabel label="COMMUNITY" index="03" />
      </div>

      {/* Pagination dots */}
      <div
        aria-hidden
        className="
          absolute bottom-2 left-1/2 z-30 hidden -translate-x-1/2
          items-center gap-2 font-label text-[10px] tracking-[0.32em]
          text-black/40 dark:text-white/40
          md:flex
        "
      >
        <span>01</span>
        <span className="block h-px w-3 bg-current/40" />
        <span className="block h-1 w-1 rounded-full bg-current/30" />
        <span className="block h-1 w-1 rounded-full bg-current/30" />
        <span className="block h-px w-3 bg-current/40" />
        <span>03</span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  FloatLayer — wraps a card so the float keyframe (transform on outer)      */
/*  doesn't collide with the static rotate (transform on inner).              */
/* -------------------------------------------------------------------------- */

function FloatLayer({
  children,
  className,
  anim,
  rotate,
  duration = "7s",
  delay = "0s",
}: {
  children: React.ReactNode;
  className: string;
  anim: string;
  rotate: string;
  duration?: string;
  delay?: string;
}) {
  return (
    <div
      className={className}
      style={{ animation: `${anim} ${duration} ease-in-out ${delay} infinite` }}
    >
      <div style={{ transform: `rotate(${rotate})` }} className="will-change-transform">
        {children}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  PhoneMockup — mirrors the real iOS Discover home (header + 4 tabs + feed) */
/* -------------------------------------------------------------------------- */

function PhoneMockup({ feedPosts }: { feedPosts: readonly Post[] }) {
  const { t } = useTranslation();
  const slots: (Post | undefined)[] = [0, 1, 2, 3].map((i) => feedPosts[i]);

  return (
    <div
      className="
        relative aspect-[9/19.5] w-full overflow-hidden
        rounded-[36px] border border-black/[0.08]
        bg-black shadow-[0_30px_60px_-20px_rgba(0,0,0,0.35),0_15px_30px_-15px_rgba(0,0,0,0.25)]
        dark:border-white/[0.08] dark:shadow-[0_30px_60px_-20px_rgba(0,0,0,0.7)]
      "
    >
      <div className="absolute inset-[3px] flex flex-col overflow-hidden rounded-[33px] bg-white dark:bg-[#0f0f0f]">
        {/* Status bar + Dynamic Island */}
        <div className="relative flex h-7 shrink-0 items-center justify-between px-4 pt-1.5 font-label text-[9px] font-medium text-black dark:text-white">
          <span>9:41</span>
          <div
            aria-hidden
            className="absolute left-1/2 top-1.5 h-4 w-16 -translate-x-1/2 rounded-full bg-black dark:bg-[#2a2a2a]"
          />
          <div className="flex items-center gap-1">
            <SignalIcon />
            <WifiIcon />
            <BatteryIcon />
          </div>
        </div>

        {/* App bar — logo wordmark + notification + avatar (matches DiscoverHeader) */}
        <div className="mt-1.5 flex shrink-0 items-center justify-between px-3">
          <span className="font-serif text-[9px] font-semibold tracking-[0.14em] text-black dark:text-white">
            {t("homepage.heroPhoneBrand")}
          </span>
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="flex h-6 w-6 items-center justify-center text-black/70 dark:text-white/70"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </span>
            <span
              aria-hidden
              className="h-6 w-6 rounded-full border border-black/15 bg-[#e8e8e8] dark:border-white/20 dark:bg-[#333]"
            />
          </div>
        </div>

        {/* Search — same placeholder intent as app `discover.searchPlaceholder` */}
        <div className="mx-3 mt-2 flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-[#f5f5f5] px-2.5 dark:bg-[#1c1c1c]">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="shrink-0 text-black/35 dark:text-white/30"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <span className="truncate font-serif text-[10px] text-black/40 dark:text-white/35">
            {t("homepage.heroPhoneSearch")}
          </span>
        </div>

        {/* Tabs: 论坛 · 推荐 · 买手店 · 关注 — 推荐 active */}
        <div className="mt-2.5 flex shrink-0 items-center justify-between px-3 font-label text-[9px] tracking-[0.06em] text-black dark:text-white">
          {[
            { key: "forum", label: t("homepage.heroPhoneTabForum"), active: false },
            { key: "rec", label: t("homepage.heroPhoneTabRecommend"), active: true },
            { key: "buyer", label: t("homepage.heroPhoneTabBuyer"), active: false },
            { key: "fol", label: t("homepage.heroPhoneTabFollow"), active: false },
          ].map((tab) => (
            <span
              key={tab.key}
              className={`relative pb-1 ${
                tab.active
                  ? "font-medium text-black dark:text-white"
                  : "text-black/45 dark:text-white/40"
              }`}
            >
              {tab.label}
              {tab.active && (
                <span className="absolute inset-x-0 -bottom-px mx-auto block h-[2px] w-[18px] rounded-full bg-black dark:bg-white" />
              )}
            </span>
          ))}
        </div>

        <div className="mx-3 mt-1 h-px shrink-0 bg-black/[0.06] dark:bg-white/[0.08]" />

        {/* Two-column feed (masonry-style preview) */}
        <div className="mx-3 mt-2 grid min-h-0 shrink grid-cols-2 gap-2 overflow-y-auto pb-1">
          {slots.map((post, i) => (
            <HeroFeedMiniCard key={post?.id ?? `slot-${i}`} post={post} />
          ))}
        </div>

        <div className="flex-1 min-h-0" />

        {/* Bottom tab bar — 首页 / Archive / + / 地图 / 我 */}
        <PhoneBottomNav />
      </div>
    </div>
  );
}

function HeroFeedMiniCard({ post }: { post?: Post }) {
  const cover =
    post && isRenderableImage(post.imageUrls?.[0]) ? post.imageUrls[0] : undefined;
  const title = post?.title || post?.contentText?.slice(0, 28) || "—";
  const user = post?.username ?? "—";

  return (
    <div className="flex flex-col gap-1">
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-md bg-[#f0f0f0] dark:bg-[#252525]">
        {cover ? (
          <Image
            src={cover}
            alt={title}
            fill
            sizes="120px"
            quality={70}
            className="object-cover"
          />
        ) : (
          <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-[#e4e4e4] to-[#c8c8c8] dark:from-[#2a2a2a] dark:to-[#1a1a1a]" />
        )}
      </div>
      <div className="px-0.5">
        <p className="line-clamp-2 font-serif text-[8px] leading-snug text-black dark:text-white">
          {title}
        </p>
        <div className="mt-1 flex items-center justify-between gap-1">
          <div className="flex min-w-0 flex-1 items-center gap-1">
            <span
              aria-hidden
              className="h-3 w-3 shrink-0 rounded-full border border-black/10 bg-[#ddd] dark:border-white/15 dark:bg-[#444]"
            />
            <span className="truncate font-label text-[7px] text-black/45 dark:text-white/40">
              @{user}
            </span>
          </div>
          <span className="flex shrink-0 items-center gap-0.5 font-label text-[7px] text-[#e11d48]">
            ♥ {post ? formatCount(post.likeCount) : "—"}
          </span>
        </div>
      </div>
    </div>
  );
}

function PhoneBottomNav() {
  const { t } = useTranslation();
  return (
    <div className="shrink-0 border-t border-black/[0.06] bg-white dark:border-white/[0.08] dark:bg-[#0f0f0f]">
      <div className="flex items-end justify-between px-1 pb-2 pt-1.5">
        <PhoneDockItem
          label={t("homepage.heroPhoneNavHome")}
          active
          icon={<IconHome />}
        />
        <PhoneDockItem
          label={t("homepage.heroPhoneNavArchive")}
          icon={<IconArchive />}
        />
        <div
          aria-hidden
          className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-black text-lg font-light leading-none text-white shadow-md dark:bg-white dark:text-black"
        >
          +
        </div>
        <PhoneDockItem label={t("homepage.heroPhoneNavMap")} icon={<IconMap />} />
        <PhoneDockItem label={t("homepage.heroPhoneNavMe")} icon={<IconUser />} />
      </div>
    </div>
  );
}

function PhoneDockItem({
  label,
  icon,
  active = false,
}: {
  label: string;
  icon: ReactNode;
  active?: boolean;
}) {
  return (
    <div
      className={`flex w-[18%] max-w-[52px] flex-col items-center gap-0.5 ${
        active ? "text-black dark:text-white" : "text-black/35 dark:text-white/35"
      }`}
    >
      <span className="flex h-5 items-center justify-center [&_svg]:h-[18px] [&_svg]:w-[18px]">
        {icon}
      </span>
      <span className="text-center font-label text-[6.5px] leading-tight tracking-[0.04em]">
        {label}
      </span>
    </div>
  );
}

function IconHome() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M4 10.5 12 4l8 3.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" />
    </svg>
  );
}

function IconArchive() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M4 19.5V8l4-4h8l4 4v11.5A1.5 1.5 0 0 1 18.5 21h-13A1.5 1.5 0 0 1 4 19.5z" />
      <path d="M8 4v3m8-3v3M8 21v-9h8v9" />
    </svg>
  );
}

function IconMap() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M9 19l-4 2V5l4-2 6 3 4-2v16l-4 2-6-3z" />
      <path d="m9 5 6 3v12" />
    </svg>
  );
}

function IconUser() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20v-1.5C5 15.8 8 14 12 14s7 1.8 7 4.5V20" />
    </svg>
  );
}

/* ── Tiny status-bar icons (pure SVG, ~10px) ──────────────────────────── */

function SignalIcon() {
  return (
    <svg width="11" height="7" viewBox="0 0 11 7" fill="currentColor">
      <rect x="0" y="5" width="1.5" height="2" rx="0.4" />
      <rect x="2.5" y="3.5" width="1.5" height="3.5" rx="0.4" />
      <rect x="5" y="2" width="1.5" height="5" rx="0.4" />
      <rect x="7.5" y="0" width="1.5" height="7" rx="0.4" />
    </svg>
  );
}

function WifiIcon() {
  return (
    <svg width="9" height="7" viewBox="0 0 9 7" fill="none" stroke="currentColor" strokeWidth="0.8">
      <path d="M0.5 2.4 A 6 6 0 0 1 8.5 2.4" />
      <path d="M2 4 A 4 4 0 0 1 7 4" />
      <circle cx="4.5" cy="6" r="0.6" fill="currentColor" />
    </svg>
  );
}

function BatteryIcon() {
  return (
    <svg width="14" height="7" viewBox="0 0 14 7" fill="none">
      <rect
        x="0.5"
        y="0.5"
        width="11"
        height="6"
        rx="1.2"
        stroke="currentColor"
        strokeOpacity="0.6"
        strokeWidth="0.6"
      />
      <rect x="12" y="2.2" width="1.2" height="2.6" rx="0.4" fill="currentColor" fillOpacity="0.6" />
      <rect x="1.6" y="1.5" width="8.5" height="4" rx="0.6" fill="currentColor" />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/*  Floating cards                                                            */
/* -------------------------------------------------------------------------- */

function DesignerCard({
  image,
  archivesLabel,
}: {
  image?: string;
  archivesLabel: string;
}) {
  return (
    <article
      className="
        group relative overflow-hidden rounded-lg
        bg-black p-3 text-white
        ring-1 ring-white/[0.06]
        shadow-[0_18px_40px_-18px_rgba(0,0,0,0.5)]
        transition-transform duration-500
        hover:-translate-y-0.5
      "
    >
      {/* Background portrait (low opacity) */}
      <div aria-hidden className="absolute inset-0">
        {image ? (
          <Image
            src={image}
            alt=""
            fill
            sizes="200px"
            quality={60}
            className="object-cover opacity-30 mix-blend-luminosity"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#1d1d1d] via-[#0a0a0a] to-black" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
      </div>

      <div className="relative space-y-1.5">
        <span className="inline-block font-label text-[8.5px] tracking-[0.22em] text-white/55">
          DESIGNER
        </span>
        <div className="font-serif text-[15px] font-semibold leading-tight">
          Yohji
          <br />
          Yamamoto
        </div>
        <div className="font-serif text-[10px] italic text-white/55">山本耀司</div>
        <div className="pt-2 font-label text-[8.5px] tracking-[0.16em] text-white/45">
          {archivesLabel}
        </div>
      </div>
    </article>
  );
}

function StoreCard({ image }: { image?: string }) {
  return (
    <article
      className="
        group relative overflow-hidden rounded-lg
        border border-black/[0.06]
        bg-white text-black
        shadow-[0_18px_40px_-22px_rgba(0,0,0,0.25)]
        transition-transform duration-500
        hover:-translate-y-0.5
        dark:border-white/[0.08] dark:bg-[#141414] dark:text-white
      "
    >
      {/* Cover image strip (top) */}
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-gradient-to-br from-[#d8d8d8] via-[#c0c0c0] to-[#9c9c9c] dark:from-[#2a2a2a] dark:via-[#1a1a1a] dark:to-[#0a0a0a]">
        {image ? (
          <Image
            src={image}
            alt="Dover Street Market Ginza"
            fill
            sizes="240px"
            quality={70}
            className="object-cover"
          />
        ) : (
          <BuildingPlaceholder />
        )}
      </div>

      <div className="space-y-1 p-3">
        <span className="inline-block font-label text-[8.5px] tracking-[0.22em] text-black/45 dark:text-white/45">
          STORE
        </span>
        <div className="font-serif text-[12.5px] font-semibold leading-tight">
          Dover Street Market Ginza
        </div>
        <div className="flex items-center justify-between pt-0.5">
          <span className="font-label text-[9px] tracking-[0.1em] text-black/45 dark:text-white/40">
            Tokyo, Japan
          </span>
          <ArrowGlyph className="text-black/40 dark:text-white/40" />
        </div>
      </div>
    </article>
  );
}

function ArchiveCard({ image }: { image?: string }) {
  return (
    <article
      className="
        group relative overflow-hidden rounded-lg
        border border-black/[0.06]
        bg-white/85 text-black backdrop-blur-md
        shadow-[0_18px_40px_-22px_rgba(0,0,0,0.25)]
        transition-transform duration-500
        hover:-translate-y-0.5
        dark:border-white/[0.10] dark:bg-[#141414]/85 dark:text-white
      "
    >
      <div className="flex">
        <div className="flex-1 space-y-1 p-3">
          <span className="inline-block font-label text-[8.5px] tracking-[0.22em] text-black/45 dark:text-white/45">
            ARCHIVE
          </span>
          <div className="font-serif text-[12.5px] font-semibold leading-tight">
            Runway
            <br />
            Archive
          </div>
          <div className="pt-0.5 font-label text-[9px] tracking-[0.12em] text-black/45 dark:text-white/40">
            1998 – 2024
          </div>
        </div>
        <div className="relative w-[42%] overflow-hidden bg-gradient-to-br from-[#e8e8e8] to-[#a8a8a8] dark:from-[#262626] dark:to-[#0a0a0a]">
          {image ? (
            <Image
              src={image}
              alt=""
              fill
              sizes="100px"
              quality={65}
              className="object-cover"
            />
          ) : (
            <RunwayPlaceholder />
          )}
        </div>
      </div>
    </article>
  );
}

function CommunityCard({
  headlineLine1,
  headlineLine2,
}: {
  headlineLine1: string;
  headlineLine2: string;
}) {
  return (
    <article
      className="
        group relative overflow-hidden rounded-lg
        border border-black/[0.06]
        bg-white text-black
        shadow-[0_18px_40px_-22px_rgba(0,0,0,0.22)]
        transition-transform duration-500
        hover:-translate-y-0.5
        dark:border-white/[0.08] dark:bg-[#141414] dark:text-white
      "
    >
      <div className="space-y-2 p-3">
        <span className="inline-block font-label text-[8.5px] tracking-[0.22em] text-black/45 dark:text-white/45">
          COMMUNITY
        </span>
        <div className="font-serif text-[13px] font-semibold leading-snug">
          {headlineLine1}
          <br />
          {headlineLine2}
        </div>
        <div className="flex items-center gap-2 pt-1">
          <div className="flex -space-x-1.5">
            {[
              "from-[#444] to-[#111]",
              "from-[#bdbdbd] to-[#7c7c7c]",
              "from-[#5a5a5a] to-[#1f1f1f]",
              "from-[#9a9a9a] to-[#404040]",
            ].map((g, i) => (
              <span
                key={i}
                aria-hidden
                className={`h-5 w-5 rounded-full bg-gradient-to-br ${g} ring-2 ring-white dark:ring-[#141414]`}
              />
            ))}
          </div>
          <span className="font-label text-[9px] tracking-[0.14em] text-black/55 dark:text-white/45">
            +50K
          </span>
        </div>
      </div>
    </article>
  );
}

/* -------------------------------------------------------------------------- */
/*  Side-rail label  (vertical "ARCHIVE / 01")                                */
/* -------------------------------------------------------------------------- */

function SideRailLabel({ label, index }: { label: string; index: string }) {
  return (
    <div
      className="flex items-center gap-2 font-label text-[9px] tracking-[0.32em] text-black/40 dark:text-white/40"
      style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
    >
      <span>{label}</span>
      <span className="block h-3 w-px bg-current/40" />
      <span className="font-mono">{index}</span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Inline placeholders for the floating-card images                          */
/* -------------------------------------------------------------------------- */

function BuildingPlaceholder() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 100 56"
      preserveAspectRatio="xMidYMid slice"
      className="h-full w-full"
    >
      <defs>
        <linearGradient id="bld-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(0,0,0,0.04)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.20)" />
        </linearGradient>
      </defs>
      <rect width="100" height="56" fill="url(#bld-grad)" />
      <g fill="rgba(0,0,0,0.35)">
        <rect x="20" y="14" width="22" height="42" />
        <rect x="44" y="6" width="18" height="50" />
        <rect x="64" y="20" width="16" height="36" />
      </g>
      <g fill="rgba(255,255,255,0.5)">
        <rect x="22" y="18" width="3" height="3" />
        <rect x="28" y="18" width="3" height="3" />
        <rect x="22" y="26" width="3" height="3" />
        <rect x="28" y="26" width="3" height="3" />
        <rect x="46" y="10" width="3" height="3" />
        <rect x="52" y="10" width="3" height="3" />
        <rect x="46" y="18" width="3" height="3" />
        <rect x="52" y="18" width="3" height="3" />
      </g>
    </svg>
  );
}

function RunwayPlaceholder() {
  return (
    <svg aria-hidden viewBox="0 0 60 100" preserveAspectRatio="xMidYMid slice" className="h-full w-full">
      <rect width="60" height="100" fill="rgba(0,0,0,0.05)" />
      <ellipse cx="30" cy="55" rx="12" ry="34" fill="rgba(0,0,0,0.45)" />
      <ellipse cx="30" cy="22" rx="6" ry="6" fill="rgba(0,0,0,0.55)" />
      <path d="M0,90 L60,90 L60,100 L0,100 Z" fill="rgba(0,0,0,0.12)" />
    </svg>
  );
}

function ArrowGlyph({ className = "" }: { className?: string }) {
  return (
    <svg
      width="14"
      height="10"
      viewBox="0 0 14 10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      className={`transition-transform duration-300 group-hover:translate-x-0.5 ${className}`}
    >
      <path d="M0 5 H 13" />
      <path d="M9 1 L 13 5 L 9 9" />
    </svg>
  );
}
