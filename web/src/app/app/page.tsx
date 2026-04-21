import type { Metadata } from "next";
import Link from "next/link";
import { AnimateIn } from "@/components/AnimateIn";
import { config } from "@/lib/config";

/**
 * Dedicated landing page for the Avant Regard iOS app.
 *
 * This is the ONE place on the web that markets the native app. The rest of
 * the site (home, discover, post/user pages) stays app-agnostic on purpose —
 * this page exists to be linked from external channels (QR codes, social bio,
 * press kits) that land visitors directly on a product brief.
 *
 * All factual claims (feature counts, version notes, compatibility, ratings)
 * are mirrored from the current App Store listing.
 */

export const metadata: Metadata = {
  title: "iOS App · Avant Regard",
  description:
    "Avant Regard 是为真正时装爱好者打造的 Archive 典藏 app：全球 400+ 买手店地图、200+ 设计师与 9000+ 秀场档案、专业 Archivist 社区。iOS 端免费下载。",
  alternates: { canonical: "/app" },
  openGraph: {
    type: "website",
    title: "Avant Regard iOS App",
    description:
      "发现 Archive · 连接买手店 · 移动时装档案。iOS 端免费下载。",
    url: `${config.siteUrl}/app`,
  },
};

const TAGLINE = "发现 Archive · 连接买手店 · 移动时装档案";

const FEATURES: ReadonlyArray<{
  eyebrow: string;
  title: string;
  body: string;
}> = [
  {
    eyebrow: "01",
    title: "全球 400+ Archive 买手店地图",
    body: "覆盖全球核心城市的专业 Archive 买手店——从巴黎、伦敦、东京到纽约，从隐秘买手空间到殿堂级典藏店铺。每一家都经过筛选，只收录真正做 Archive 的专业店铺，实时浏览、定位、收藏，再也不用靠零散信息寻找稀缺单品。",
  },
  {
    eyebrow: "02",
    title: "200+ 设计师 · 9000+ 秀场完整档案",
    body: "从经典大师到先锋流派，从黄金年代到当代标志性系列，完整收录设计师生涯脉络、秀场造型、系列故事与设计语言。无论入门爱好者还是资深藏家，都能建立系统的时装认知，看懂一件单品背后的历史价值。",
  },
  {
    eyebrow: "03",
    title: "真实 Archivist 社区",
    body: "对单品、买手店、秀场系列发布真实评价与体验，与全球 Archivist 交流观点、分享收藏、鉴定风格、讨论搭配。这里没有泛流量穿搭，只有同频、专业、深度的时装对话。",
  },
  {
    eyebrow: "04",
    title: "系统学习 Archive 文化",
    body: "Archive 不是古着，不是二手，而是时装史的可穿戴遗产。我们为你梳理流派、年代、标志性设计、面料工艺与收藏逻辑，让你从「买衣服」进阶到「理解时代」。",
  },
];

const AUDIENCE: ReadonlyArray<string> = [
  "时装爱好者、学习者、研究者",
  "买手、造型师、时尚行业从业者",
  "Vintage & Archive 藏家、玩家",
  "想建立高级审美与穿搭体系的人",
  "旅行中寻找专业买手店的人",
];

const WHATS_NEW: ReadonlyArray<{ title: string; body: string }> = [
  {
    title: "全新对话 & 社交功能",
    body: "正式上线陌生人对话互动，支持添加聊天好友，一键分享 Archive 帖子给朋友，社交与内容分享场景被重新串联。",
  },
  {
    title: "视觉与体验全面升级",
    body: "更精致的视觉呈现、更流畅的本地前端性能表现，整体交互质感进一步提升。",
  },
  {
    title: "创作者称号系统",
    body: "优秀内容创作者可获得专属荣誉称号，彰显创作价值，激励高质量内容的持续输出。",
  },
  {
    title: "通知能力优化",
    body: "消息通知更及时、触达更准确，不错过任何重要的互动与系统消息。",
  },
  {
    title: "买手店地图更新",
    body: "数据与功能全面更新：信息更完整、定位更精准、浏览更流畅，快速找到你喜欢的买手店。",
  },
];

const APP_INFO: ReadonlyArray<{ label: string; value: string }> = [
  { label: "类别",       value: "Social Networking" },
  { label: "价格",       value: "Free" },
  { label: "版本",       value: "1.1" },
  { label: "大小",       value: "126.8 MB" },
  { label: "系统要求",   value: "iOS 13.4+ · iPadOS 13.4+" },
  { label: "语言",       value: "English" },
  { label: "评分",       value: "5.0 / 5 · 3 Ratings" },
  { label: "年龄分级",   value: "16+" },
  { label: "开发者",     value: "Shanghai Nanteke Industrial Co., Ltd." },
  { label: "Copyright",  value: "© 2026 Avantregard" },
];

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

export default function AppLandingPage() {
  return (
    <>
      {/* --------------------------------------------------------------- Hero */}
      <section className="relative overflow-hidden border-b border-black/[0.06] dark:border-white/[0.08]">
        <div className="mx-auto grid max-w-content gap-16 px-6 py-20 md:grid-cols-[1.35fr,1fr] md:py-32">
          <div className="flex flex-col justify-center">
            <div className="animate-fade-in">
              <span className="chip w-fit">iOS App · v1.1</span>
            </div>

            <h1
              className="mt-6 animate-slide-up font-serif text-hero font-semibold text-black dark:text-white"
              style={{ animationDelay: "120ms" }}
            >
              Archive，
              <br />
              随身携带。
            </h1>

            <p
              className="mt-6 max-w-xl animate-slide-up font-serif text-base leading-relaxed text-black/55 dark:text-white/50 md:text-lg"
              style={{ animationDelay: "240ms" }}
            >
              Avant Regard Archive 是为真正时装爱好者打造的全球顶级 Archive 典藏平台。
              这里不追逐潮流，只收藏时代。
            </p>

            <div
              className="mt-10 flex animate-slide-up flex-wrap items-center gap-3"
              style={{ animationDelay: "360ms" }}
            >
              <AppStoreButton />
              <Link href="#features" className="btn-secondary px-5 py-3 text-sm">
                了解能力
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

      {/* ----------------------------------------------------------- Tagline */}
      <section className="border-b border-black/[0.06] py-6 dark:border-white/[0.08]">
        <AnimateIn className="mx-auto max-w-content px-6">
          <p className="text-center font-label text-xs uppercase tracking-[0.28em] text-black/40 dark:text-white/30 md:text-sm">
            {TAGLINE}
          </p>
        </AnimateIn>
      </section>

      {/* ---------------------------------------------------------- Features */}
      <section id="features" className="mx-auto max-w-content px-6 py-24 md:py-32">
        <AnimateIn>
          <div className="max-w-2xl">
            <span className="chip">Features</span>
            <h2 className="mt-4 font-serif text-display text-black dark:text-white">
              四件事，
              <br />
              让你拥有完整的 Archive 入口。
            </h2>
          </div>
        </AnimateIn>

        <div className="mt-14 grid gap-px overflow-hidden rounded bg-black/[0.05] dark:bg-white/[0.06] md:grid-cols-2">
          {FEATURES.map((feature, index) => (
            <AnimateIn key={feature.title} delay={index * 70} className="h-full">
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

      {/* ----------------------------------------------------------- Audience */}
      <section className="border-t py-24 md:py-32
                          border-black/[0.06] bg-[#f9f9f9]
                          dark:border-white/[0.08] dark:bg-[#111]">
        <div className="mx-auto max-w-content px-6">
          <AnimateIn>
            <div className="max-w-2xl">
              <span className="chip">Who it&apos;s for</span>
              <h2 className="mt-4 font-serif text-display text-black dark:text-white">
                如果你是这样的人，
                <br />
                这个 app 为你而生。
              </h2>
            </div>
          </AnimateIn>

          <ul className="mt-12 grid gap-px overflow-hidden rounded bg-black/[0.05] dark:bg-white/[0.06] md:grid-cols-2">
            {AUDIENCE.map((person, index) => (
              <AnimateIn key={person} delay={index * 60}>
                <li
                  className="flex items-start gap-5 p-7 font-serif text-base leading-relaxed
                             bg-white text-black/75
                             dark:bg-[#0a0a0a] dark:text-white/65"
                >
                  <span className="font-label text-xs uppercase tracking-[0.22em] text-black/30 dark:text-white/25">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span>{person}</span>
                </li>
              </AnimateIn>
            ))}
          </ul>

          <AnimateIn>
            <p className="mt-12 max-w-xl font-serif text-sm leading-relaxed text-black/45 dark:text-white/35">
              加入 Avantregard Archive，成为一名真正的 Archivist，拥有属于你的时装史入口。
            </p>
          </AnimateIn>
        </div>
      </section>

      {/* --------------------------------------------------------- What's New */}
      <section className="mx-auto max-w-content px-6 py-24 md:py-32">
        <AnimateIn>
          <div className="max-w-2xl">
            <span className="chip">What&apos;s New · v1.1</span>
            <h2 className="mt-4 font-serif text-display text-black dark:text-white">
              对话系统上线，
              <br />
              体验全面升级。
            </h2>
          </div>
        </AnimateIn>

        <ol className="mt-14 space-y-px overflow-hidden rounded bg-black/[0.05] dark:bg-white/[0.06]">
          {WHATS_NEW.map((item, index) => (
            <AnimateIn key={item.title} delay={index * 50}>
              <li
                className="grid gap-4 p-7 md:grid-cols-[auto,1fr,2fr] md:items-start md:gap-8 md:p-9
                           bg-white dark:bg-[#0a0a0a]"
              >
                <div className="font-serif text-3xl leading-none text-black/15 dark:text-white/15">
                  {String(index + 1).padStart(2, "0")}
                </div>
                <h3 className="font-serif text-xl leading-snug text-black dark:text-white md:text-2xl">
                  {item.title}
                </h3>
                <p className="font-serif text-sm leading-relaxed text-black/55 dark:text-white/45">
                  {item.body}
                </p>
              </li>
            </AnimateIn>
          ))}
        </ol>
      </section>

      {/* --------------------------------------------------------- App Info */}
      <section className="border-t py-24 md:py-32
                          border-black/[0.06] bg-[#f9f9f9]
                          dark:border-white/[0.08] dark:bg-[#111]">
        <div className="mx-auto max-w-content px-6">
          <AnimateIn>
            <div className="max-w-2xl">
              <span className="chip">Information</span>
              <h2 className="mt-4 font-serif text-display text-black dark:text-white">
                基本信息
              </h2>
            </div>
          </AnimateIn>

          <AnimateIn>
            <dl
              className="mt-12 grid gap-x-10 gap-y-6 font-serif text-sm md:grid-cols-2 md:gap-y-7"
            >
              {APP_INFO.map(({ label, value }) => (
                <div
                  key={label}
                  className="flex items-baseline justify-between gap-6 border-b pb-4
                             border-black/[0.06] dark:border-white/[0.08]"
                >
                  <dt className="font-label text-xs uppercase tracking-[0.18em] text-black/40 dark:text-white/30">
                    {label}
                  </dt>
                  <dd className="text-right text-black/75 dark:text-white/65">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </AnimateIn>
        </div>
      </section>

      {/* ----------------------------------------------------------- Final CTA */}
      <section className="relative overflow-hidden bg-black dark:bg-[#111]">
        <div className="mx-auto max-w-content px-6 py-24 text-center md:py-32">
          <AnimateIn>
            <span className="inline-flex items-center gap-1.5 rounded border border-white/10 bg-white/[0.05] px-2.5 py-0.5 font-label text-[10px] uppercase tracking-[0.18em] text-white/40">
              Get the app
            </span>
            <h2 className="mt-5 font-serif text-display text-white">
              拥有属于你的
              <br />
              时装史入口。
            </h2>
            <p className="mx-auto mt-6 max-w-xl font-serif text-sm leading-relaxed text-white/45 md:text-base">
              免费下载，iOS 13.4 及以上可用。成为一名真正的 Archivist，开始收藏时代。
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <AppStoreButton variant="inverted" />
              <Link
                href="/"
                className="font-label text-sm tracking-wide text-white/55 underline-offset-4 transition-colors hover:text-white hover:underline"
              >
                返回首页 →
              </Link>
            </div>
          </AnimateIn>
        </div>
      </section>
    </>
  );
}
