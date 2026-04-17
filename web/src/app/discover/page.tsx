import type { Metadata } from "next";
import Link from "next/link";
import { AnimateIn } from "@/components/AnimateIn";
import { PostCard } from "@/components/PostCard";
import { getFeed } from "@/lib/api";
import type { Post } from "@/lib/types";

export const metadata: Metadata = {
  title: "发现 · Discover",
  description:
    "浏览社区最新的先锋穿搭、单品测评与日常分享，发现设计师品牌与秀场档案。",
  alternates: { canonical: "/discover" },
};

export const revalidate = 60;

export default async function DiscoverPage() {
  let posts: Post[] = [];
  let error: string | null = null;

  try {
    const feed = await getFeed({ limit: 40 });
    posts = feed.items
      .filter((item) => item.type === "post")
      .map((item) => item.data as Post);
  } catch (err) {
    error = err instanceof Error ? err.message : "无法加载 Discover";
  }

  return (
    <section className="mx-auto max-w-content px-6 py-16 md:py-24">
      <AnimateIn>
        <header className="mb-14 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <span className="chip">Discover</span>
            <h1 className="mt-4 font-serif text-display text-black dark:text-white">
              先锋穿搭
              <br />
              正在发生。
            </h1>
            <p className="mt-4 max-w-xl font-serif text-sm leading-relaxed text-black/50 dark:text-white/40">
              这里是社区最新发布的穿搭、单品测评与日常分享。
              在 app 内可以点赞、收藏、私信作者，并关注你喜爱的穿搭者。
            </p>
          </div>
          <Link href="/download" className="btn-primary whitespace-nowrap self-start md:self-end">
            下载 App 互动
          </Link>
        </header>
      </AnimateIn>

      {error && (
        <AnimateIn>
          <div className="rounded border p-8 font-serif text-sm
                          border-black/[0.08] bg-[#f9f9f9] text-black/50
                          dark:border-white/[0.08] dark:bg-[#111] dark:text-white/40">
            暂时无法加载社区内容（{error}）。请稍后重试，或直接{" "}
            <Link href="/download" className="link-muted underline">
              下载 app
            </Link>{" "}
            查看最新动态。
          </div>
        </AnimateIn>
      )}

      {!error && posts.length === 0 && (
        <AnimateIn>
          <div className="rounded border p-8 font-serif text-sm
                          border-black/[0.08] bg-[#f9f9f9] text-black/50
                          dark:border-white/[0.08] dark:bg-[#111] dark:text-white/40">
            暂无内容。社区正在成长中，欢迎下载 app 成为第一批分享者。
          </div>
        </AnimateIn>
      )}

      {posts.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {posts.map((post, index) => (
            <AnimateIn key={post.id} delay={Math.min(index * 40, 400)}>
              <PostCard post={post} priority={index < 4} />
            </AnimateIn>
          ))}
        </div>
      )}

      <AnimateIn>
        <div className="mt-16 flex items-center justify-center border-t pt-12 font-label text-sm
                        border-black/[0.06] text-black/40
                        dark:border-white/[0.08] dark:text-white/30">
          想看更多？
          <Link href="/download" className="ml-2 link-underline font-label text-sm">
            在 App 中继续浏览 →
          </Link>
        </div>
      </AnimateIn>
    </section>
  );
}
