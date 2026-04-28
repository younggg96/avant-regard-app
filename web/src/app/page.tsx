import Image from "next/image";
import Link from "next/link";
import { PostCard } from "@/components/PostCard";
import { Marquee } from "@/components/Marquee";
import { AnimateIn } from "@/components/AnimateIn";
import { RotatingHeadline } from "@/components/RotatingHeadline";
import { getFeed } from "@/lib/api";
import { isRenderableImage } from "@/lib/isRenderableImage";
import type { Post } from "@/lib/types";

export const revalidate = 60;

const FEATURES: ReadonlyArray<{ eyebrow: string; title: string; body: string }> = [
  {
    eyebrow: "01",
    title: "先锋品牌的全景入口",
    body: "从设计师品牌、秀场到买手店，算法与编辑双引擎把小众与前沿带到你面前。",
  },
  {
    eyebrow: "02",
    title: "穿搭、日常、单品测评",
    body: "三种原生内容形态，覆盖 OOTD、街拍到单品深度测评，每一次着装都值得被记录。",
  },
  {
    eyebrow: "03",
    title: "社区、私信与论坛",
    body: "关注志趣相投的穿搭者，加入以品牌与风格为核心的论坛，在私信里交换穿搭灵感。",
  },
  {
    eyebrow: "04",
    title: "附近的先锋集合店",
    body: "以位置为入口，发现附近独立买手店与快闪活动，线上浏览、线下亲身试穿。",
  },
];

async function loadLatestPosts(): Promise<Post[]> {
  try {
    const feed = await getFeed({ limit: 12 });
    return feed.items
      .filter((item) => item.type === "post")
      .map((item) => item.data as Post)
      .slice(0, 8);
  } catch {
    return [];
  }
}

export default async function LandingPage() {
  const posts = await loadLatestPosts();

  return (
    <>
      {/* ---------------------------------------------------------------- Hero */}
      <section className="relative overflow-hidden border-b border-black/[0.06] dark:border-white/[0.08]">
        <div className="mx-auto grid max-w-content gap-16 px-6 py-20 md:grid-cols-[1.35fr,1fr] md:py-32">
          <div className="flex flex-col justify-center">
            <div className="animate-fade-in">
              <span className="chip w-fit">先锋时装社区</span>
            </div>

            <RotatingHeadline
              className="mt-6 animate-slide-up font-serif text-hero font-semibold text-black dark:text-white"
              style={{ animationDelay: "120ms" }}
            />

            <p
              className="mt-6 max-w-xl animate-slide-up font-serif text-base leading-relaxed text-black/55 dark:text-white/50 md:text-lg"
              style={{ animationDelay: "240ms" }}
            >
              从 Rick Owens 到 Yohji Yamamoto，从买手店橱窗到街头 OOTD。
              Avant Regard 汇聚先锋穿搭、设计师品牌与秀场档案，
              让每一次着装选择都有迹可循。
            </p>

            <div
              className="mt-10 flex animate-slide-up flex-wrap items-center gap-3"
              style={{ animationDelay: "360ms" }}
            >
              <Link href="/discover" className="btn-primary px-5 py-3 text-sm">
                浏览 Discover
              </Link>
              <Link href="/#features" className="btn-secondary px-5 py-3 text-sm">
                了解功能
              </Link>
            </div>
          </div>

          {/* Phone mockup */}
          <div
            className="relative mx-auto flex w-full max-w-[268px] animate-scale-in items-center justify-center"
            style={{ animationDelay: "180ms" }}
          >
            <div
              aria-hidden
              className="absolute inset-0 -z-10 translate-y-6 scale-95 rounded-[48px] bg-black/5 blur-md dark:bg-white/5"
            />
            <div className="relative aspect-[9/19] w-full overflow-hidden rounded-[32px] border shadow-elevated
                            border-black/[0.08] bg-black dark:border-white/[0.08]">
              <div className="absolute inset-[2px] overflow-hidden rounded-[31px] bg-white dark:bg-[#111]">
                <HeroMockup posts={posts.slice(0, 3)} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------- Marquee */}
      <div className="border-b border-black/[0.06] py-3.5 dark:border-white/[0.08]">
        <Marquee />
      </div>

      {/* -------------------------------------------------------------- Features */}
      <section id="features" className="mx-auto max-w-content px-6 py-24 md:py-32">
        <AnimateIn>
          <div className="max-w-2xl">
            <span className="chip">功能</span>
            <h2 className="mt-4 font-serif text-display text-black dark:text-white">
              一处聚合
              <br />
              先锋时装的全部动线。
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

      {/* -------------------------------------------------------- Discover preview */}
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
                    正在社区里发生的事。
                  </h2>
                  <p className="mt-4 font-serif text-sm leading-relaxed text-black/50 dark:text-white/40">
                    用户刚刚分享的穿搭与单品测评，社区每天都在更新。
                  </p>
                </div>
                <Link href="/discover" className="btn-secondary whitespace-nowrap">
                  查看全部
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

      {/* ------------------------------------------------------------------- CTA */}
      <section id="about" className="relative overflow-hidden bg-black dark:bg-[#111]">
        <div className="mx-auto grid max-w-content gap-12 px-6 py-24 md:grid-cols-[1fr,auto] md:items-end md:py-32">
          <AnimateIn>
            <div>
              <span className="inline-flex items-center gap-1.5 rounded border border-white/10 bg-white/[0.05] px-2.5 py-0.5 font-label text-[10px] uppercase tracking-[0.18em] text-white/40">
                About
              </span>
              <h2 className="mt-5 font-serif text-display text-white">
                穿得先锋，
                <br />
                想得更远一点。
              </h2>
              <p className="mt-6 max-w-xl font-serif text-sm leading-relaxed text-white/45 md:text-base">
                Avant Regard 相信时装是一种表达方式。我们为穿着先锋的你搭建一个社区，
                汇聚品牌档案、穿搭灵感、秀场记录与买手店地图，一切以「穿得好」为目标。
              </p>
            </div>
          </AnimateIn>
          <Link
            href="/discover"
            className="inline-flex items-center gap-3 self-start rounded border border-white/15 bg-white px-5 py-3 font-label text-sm font-medium text-black transition-all duration-200 hover:bg-[#e8e8e8] active:scale-[0.98] md:self-end"
          >
            进入 Discover →
          </Link>
        </div>
      </section>
    </>
  );
}

function HeroMockup({ posts }: { posts: Post[] }) {
  if (posts.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
        <div className="font-label text-[10px] uppercase tracking-[0.25em] text-black/30 dark:text-white/30">
          Avant Regard
        </div>
        <div className="font-serif text-2xl leading-snug text-black dark:text-white">
          先锋时装，
          <br />
          随身可及。
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-5 py-3 font-label text-[10px] uppercase tracking-[0.2em]
                      border-black/[0.06] text-black/40 dark:border-white/[0.08] dark:text-white/35">
        <span>Discover</span>
        <span>FW26</span>
      </div>
      <div className="mx-4 my-3 flex h-9 items-center gap-2 rounded-sm px-3
                      bg-[#f5f5f5] dark:bg-[#1a1a1a]">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-black/30 dark:text-white/25">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
        <span className="font-serif text-[12px] text-black/30 dark:text-white/25">搜索品牌、穿搭…</span>
      </div>
      <div className="flex-1 space-y-2.5 overflow-hidden px-3 pb-3">
        {posts.map((post) => (
          <div key={post.id} className="flex gap-3 rounded p-2.5 shadow-soft
                                        bg-white dark:bg-[#1c1c1c] dark:shadow-none dark:ring-1 dark:ring-white/[0.06]">
            <div className="relative h-[68px] w-[68px] flex-shrink-0 overflow-hidden rounded-sm bg-[#f0f0f0] dark:bg-[#2a2a2a]">
              {isRenderableImage(post.imageUrls?.[0]) && (
                <Image
                  src={post.imageUrls[0]}
                  alt={post.title}
                  fill
                  sizes="68px"
                  quality={75}
                  className="object-cover"
                />
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
              <div className="line-clamp-2 font-serif text-[11px] leading-snug text-black dark:text-white">
                {post.title || post.contentText?.slice(0, 40) || "—"}
              </div>
              <div className="font-label text-[9px] text-black/35 dark:text-white/30">@{post.username}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
