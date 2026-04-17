import type { Metadata } from "next";
import Link from "next/link";
import { PostCard } from "@/components/PostCard";
import { getFeed } from "@/lib/api";
import type { Post } from "@/lib/types";

export const metadata: Metadata = {
  title: "发现 · Discover",
  description:
    "浏览社区最新的先锋穿搭、单品测评与日常分享，发现设计师品牌与秀场档案。",
  alternates: { canonical: "/discover" },
};

// Re-fetch at most every minute so the feed stays fresh without
// hammering the backend during traffic spikes.
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
      <header className="mb-12 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <span className="chip">Discover</span>
          <h1 className="mt-4 font-serif text-display">
            先锋穿搭
            <br />
            正在发生。
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-ink/60">
            这里是社区最新发布的穿搭、单品测评与日常分享。
            在 app 内可以点赞、收藏、私信作者，并关注你喜爱的穿搭者。
          </p>
        </div>
        <Link href="/download" className="btn-primary whitespace-nowrap">
          下载 App 互动
        </Link>
      </header>

      {error && (
        <div className="rounded-xl border border-ink/10 bg-ink-100 p-8 text-sm text-ink/60">
          暂时无法加载社区内容（{error}）。请稍后重试，或直接{" "}
          <Link href="/download" className="link-muted underline">
            下载 app
          </Link>{" "}
          查看最新动态。
        </div>
      )}

      {!error && posts.length === 0 && (
        <div className="rounded-xl border border-ink/10 bg-ink-100 p-8 text-sm text-ink/60">
          暂无内容。社区正在成长中，欢迎下载 app 成为第一批分享者。
        </div>
      )}

      {posts.length > 0 && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {posts.map((post, index) => (
            <PostCard key={post.id} post={post} priority={index < 4} />
          ))}
        </div>
      )}

      <div className="mt-16 flex items-center justify-center border-t border-ink/5 pt-12 text-sm text-ink/50">
        想看更多？
        <Link href="/download" className="ml-2 link-muted underline">
          在 App 中继续浏览 →
        </Link>
      </div>
    </section>
  );
}
