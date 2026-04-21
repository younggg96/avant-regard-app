import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FadeImage } from "@/components/FadeImage";
import { PostCard } from "@/components/PostCard";
import {
  ApiError,
  getCommunityBySlug,
  getCommunityPosts,
} from "@/lib/api";
import { formatCount } from "@/lib/format";

export const revalidate = 60;

interface PageProps {
  params: { slug: string };
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  try {
    const c = await getCommunityBySlug(params.slug);
    return {
      title: `${c.name} · 论坛`,
      description:
        c.description ||
        `${c.name} 社区：${formatCount(c.memberCount)} 成员 · ${formatCount(c.postCount)} 帖子。`,
      alternates: { canonical: `/communities/${c.slug}` },
      openGraph: {
        title: c.name,
        description: c.description,
        images: c.coverUrl ? [{ url: c.coverUrl }] : undefined,
      },
    };
  } catch {
    return { title: "社区" };
  }
}

export default async function CommunityPage({ params }: PageProps) {
  try {
    const community = await getCommunityBySlug(params.slug);
    const posts = await getCommunityPosts(community.id).catch(() => []);

    return (
      <article className="mx-auto max-w-content px-6 py-12 md:py-16">
        <nav className="mb-10 font-label text-sm">
          <Link href="/communities" className="link-muted">
            ← 所有社区
          </Link>
        </nav>

        <header className="overflow-hidden rounded border border-[var(--border)] bg-[var(--canvas-soft)]">
          <div className="relative aspect-[21/8] w-full overflow-hidden bg-[var(--canvas-raised)]">
            {community.coverUrl && (
              <FadeImage
                src={community.coverUrl}
                alt={community.name}
                fill
                sizes="(max-width: 1280px) 100vw, 1280px"
                className="object-cover"
                priority
              />
            )}
          </div>
          <div className="flex flex-col gap-4 px-6 py-6 md:flex-row md:items-center md:justify-between md:px-10">
            <div className="flex items-center gap-4">
              <div className="relative h-16 w-16 overflow-hidden rounded-md border border-[var(--border)] bg-[var(--canvas)]">
                {community.iconUrl && (
                  <FadeImage
                    src={community.iconUrl}
                    alt={community.name}
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                )}
              </div>
              <div>
                <h1 className="font-serif text-3xl tracking-tight text-black dark:text-white">
                  {community.name}
                </h1>
                {community.description && (
                  <p className="mt-1 max-w-xl font-serif text-[14px] text-black/60 dark:text-white/50">
                    {community.description}
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-6 font-label text-[12px] uppercase tracking-widest text-[color:var(--ink-muted)]">
              <div>
                <div className="font-serif text-xl text-black dark:text-white normal-case tracking-normal">
                  {formatCount(community.memberCount)}
                </div>
                成员
              </div>
              <div>
                <div className="font-serif text-xl text-black dark:text-white normal-case tracking-normal">
                  {formatCount(community.postCount)}
                </div>
                帖子
              </div>
            </div>
          </div>
        </header>

        <section className="mt-12">
          <h2 className="mb-6 font-label text-xs uppercase tracking-[0.18em] text-black/40 dark:text-white/35">
            Latest
          </h2>
          {posts.length === 0 ? (
            <p className="rounded border border-[var(--border)] bg-[var(--canvas-soft)] p-8 font-serif text-sm text-[color:var(--ink-muted)]">
              这个社区还没有帖子。
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {posts.map((p, i) => (
                <PostCard key={p.id} post={p} priority={i < 4} />
              ))}
            </div>
          )}
        </section>
      </article>
    );
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
}
