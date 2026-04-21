import type { Metadata } from "next";
import { AnimateIn } from "@/components/AnimateIn";
import { DiscoverFeed } from "@/components/discover/DiscoverFeed";
import { getFeed } from "@/lib/api";
import type { FeedItem } from "@/lib/types";

export const metadata: Metadata = {
  title: "发现 · Discover",
  description:
    "浏览社区最新的先锋穿搭、单品测评与日常分享，发现设计师品牌与秀场档案。",
  alternates: { canonical: "/discover" },
};

export const revalidate = 60;

export default async function DiscoverPage() {
  let items: FeedItem[] = [];
  let error: string | null = null;

  // Prefetch the first page of `推荐` on the server so the default tab is
  // SEO-visible and paints without a client round-trip. We pass the full
  // `FeedItem[]` (posts + show cards) — DiscoverFeed renders posts but
  // keeps show IDs in the dedup window so the Feed v2.1 server never
  // re-serves them on subsequent pages (negative IDs encode shows).
  // The `关注` tab is authenticated and fetched client-side inside
  // DiscoverFeed.
  try {
    const feed = await getFeed({ limit: 30 });
    items = feed.items;
  } catch (err) {
    error = err instanceof Error ? err.message : "无法加载 Discover";
  }

  return (
    <section className="mx-auto max-w-content px-6 py-16 md:py-24">
      <AnimateIn>
        <header className="mb-14">
          <div className="max-w-2xl">
            <span className="chip">Discover</span>
            <h1 className="mt-4 font-serif text-display text-black dark:text-white">
              先锋穿搭
              <br />
              正在发生。
            </h1>
            <p className="mt-4 font-serif text-sm leading-relaxed text-black/50 dark:text-white/40">
              这里是社区最新发布的穿搭、单品测评与日常分享，关注设计师品牌、秀场与街头的每一次对话。
            </p>
          </div>
        </header>
      </AnimateIn>

      <DiscoverFeed initialItems={items} initialError={error} />
    </section>
  );
}
