import Image from "next/image";
import Link from "next/link";
import { DownloadCTAs } from "@/components/DownloadCTAs";
import { PostCard } from "@/components/PostCard";
import { getFeed } from "@/lib/api";
import type { Post } from "@/lib/types";

export const revalidate = 60;

const FEATURES: ReadonlyArray<{
  eyebrow: string;
  title: string;
  body: string;
}> = [
  {
    eyebrow: "01 · 发现",
    title: "先锋品牌的全景入口",
    body: "从设计师品牌、秀场到买手店，Avant Regard 用算法与编辑双引擎把小众与前沿带到你面前。",
  },
  {
    eyebrow: "02 · 分享",
    title: "穿搭、日常、单品测评",
    body: "三种原生内容形态，覆盖从 OOTD、街拍到单品深度测评，让每一次着装都值得被记录。",
  },
  {
    eyebrow: "03 · 连接",
    title: "社区、私信与论坛",
    body: "关注志趣相投的穿搭者，加入以品牌与风格为核心的论坛，在私信里交换穿搭灵感。",
  },
  {
    eyebrow: "04 · 买手店地图",
    title: "附近的先锋集合店",
    body: "以位置为入口，发现附近的独立买手店与快闪活动，线上浏览、线下亲身试穿。",
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
      {/* -------------------------------------------------------------- Hero */}
      <section className="relative overflow-hidden border-b border-ink/5">
        <div className="mx-auto grid max-w-content gap-16 px-6 py-20 md:grid-cols-[1.2fr,1fr] md:py-28">
          <div className="flex flex-col justify-center">
            <span className="chip w-fit">Avant Regard · 先锋时装社区</span>
            <h1 className="mt-6 font-serif text-hero font-semibold">
              为先锋时装
              <br />
              而生的社区。
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-ink/60 md:text-lg">
              从 Rick Owens 到 Yohji Yamamoto，从买手店橱窗到街头 OOTD。
              Avant Regard 汇聚先锋穿搭、设计师品牌与秀场档案，
              让每一次着装选择都有迹可循。
            </p>
            <div className="mt-10">
              <DownloadCTAs />
            </div>
            <div className="mt-6 flex items-center gap-6 text-xs text-ink/40">
              <span>iOS 15+ · Android 10+</span>
              <span className="h-1 w-1 rounded-full bg-ink/20" />
              <Link href="/discover" className="link-muted underline-offset-4 hover:underline">
                先在网页上逛逛 →
              </Link>
            </div>
          </div>

          <div className="relative mx-auto flex w-full max-w-md items-center justify-center">
            <div
              aria-hidden
              className="absolute inset-0 -z-10 translate-y-8 scale-95 rounded-[48px] bg-ink-200"
            />
            <div className="relative aspect-[9/19] w-full overflow-hidden rounded-[40px] border border-ink/10 bg-ink shadow-float">
              <div className="absolute inset-[3px] overflow-hidden rounded-[38px] bg-white">
                <HeroMockup posts={posts.slice(0, 3)} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- Features */}
      <section
        id="features"
        className="mx-auto max-w-content px-6 py-24 md:py-32"
      >
        <div className="max-w-2xl">
          <span className="chip">功能</span>
          <h2 className="mt-4 font-serif text-display">
            一个 app，涵盖
            <br />
            先锋时装的全部动线。
          </h2>
        </div>

        <div className="mt-16 grid gap-px overflow-hidden rounded-2xl border border-ink/5 bg-ink/5 md:grid-cols-2">
          {FEATURES.map((feature) => (
            <article
              key={feature.title}
              className="flex flex-col gap-4 bg-white p-8 md:p-10"
            >
              <div className="text-xs uppercase tracking-[0.18em] text-ink/40">
                {feature.eyebrow}
              </div>
              <h3 className="font-serif text-2xl leading-tight">
                {feature.title}
              </h3>
              <p className="text-sm leading-relaxed text-ink/60">
                {feature.body}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* -------------------------------------------------------- Discover preview */}
      {posts.length > 0 && (
        <section className="border-t border-ink/5 bg-ink-100 py-24 md:py-32">
          <div className="mx-auto max-w-content px-6">
            <div className="flex items-end justify-between gap-6">
              <div className="max-w-xl">
                <span className="chip">Discover</span>
                <h2 className="mt-4 font-serif text-display">
                  正在社区里发生的事。
                </h2>
                <p className="mt-4 text-sm leading-relaxed text-ink/60">
                  以下是用户刚刚分享的穿搭与单品测评。打开 app 即可点赞、评论与关注。
                </p>
              </div>
              <Link href="/discover" className="btn-secondary whitespace-nowrap">
                查看全部
              </Link>
            </div>

            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {posts.map((post, index) => (
                <PostCard key={post.id} post={post} priority={index < 2} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* --------------------------------------------------------------- CTA */}
      <section
        id="about"
        className="relative overflow-hidden bg-ink text-white"
      >
        <div className="mx-auto grid max-w-content gap-12 px-6 py-24 md:grid-cols-[1fr,auto] md:items-end md:py-32">
          <div>
            <span className="chip border-white/20 bg-white/10 text-white/80">
              About
            </span>
            <h2 className="mt-4 font-serif text-display text-white">
              穿得先锋，
              <br />
              想得更远一点。
            </h2>
            <p className="mt-6 max-w-xl text-sm leading-relaxed text-white/60 md:text-base">
              Avant Regard 相信时装是一种表达方式。我们为穿着先锋的你搭建一个社区，
              汇聚品牌档案、穿搭灵感、秀场记录与买手店地图，一切以「穿得好」为目标。
            </p>
          </div>
          <DownloadCTAs variant="inverted" />
        </div>
      </section>
    </>
  );
}

/**
 * Minimal "phone screen" preview – just three stacked cards, no client JS.
 */
function HeroMockup({ posts }: { posts: Post[] }) {
  if (posts.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-10 text-center">
        <div className="text-xs uppercase tracking-[0.2em] text-ink/40">
          Avant Regard
        </div>
        <div className="font-serif text-2xl leading-snug">
          先锋时装，
          <br />
          随身可及。
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-ink/5 px-6 py-4 text-[11px] uppercase tracking-widest text-ink/50">
        <span>Discover</span>
        <span>FW26</span>
      </div>
      <div className="flex-1 space-y-4 overflow-hidden p-4">
        {posts.map((post) => (
          <div
            key={post.id}
            className="flex gap-3 rounded-xl border border-ink/5 bg-white p-3 shadow-soft"
          >
            <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-ink-200">
              {post.imageUrls?.[0] && (
                <Image
                  src={post.imageUrls[0]}
                  alt={post.title}
                  fill
                  sizes="80px"
                  className="object-cover"
                  unoptimized
                />
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
              <div className="line-clamp-2 text-[13px] leading-snug">
                {post.title || post.contentText?.slice(0, 40) || "—"}
              </div>
              <div className="text-[11px] text-ink/40">@{post.username}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
