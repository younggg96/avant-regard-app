import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DownloadCTAs } from "@/components/DownloadCTAs";
import { ApiError, getPost } from "@/lib/api";
import { formatCount, formatRelativeTime, postTypeLabel } from "@/lib/format";

export const revalidate = 60;

interface PageProps {
  params: { id: string };
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  try {
    const post = await getPost(params.id);
    const description =
      post.contentText?.slice(0, 140) ||
      `${post.username} 分享的${postTypeLabel(post.postType)}内容。`;
    return {
      title: post.title || `${post.username} 的${postTypeLabel(post.postType)}`,
      description,
      alternates: { canonical: `/posts/${post.id}` },
      openGraph: {
        type: "article",
        title: post.title,
        description,
        images: post.imageUrls?.[0] ? [{ url: post.imageUrls[0] }] : undefined,
      },
    };
  } catch {
    return { title: "帖子" };
  }
}

export default async function PostDetailPage({ params }: PageProps) {
  try {
    const post = await getPost(params.id);
    const images = post.imageUrls ?? [];

    return (
      <article className="mx-auto max-w-3xl px-6 py-12 md:py-20">
        <nav className="mb-10 text-sm text-ink/50">
          <Link href="/discover" className="link-muted">
            ← 返回 Discover
          </Link>
        </nav>

        <header className="space-y-5">
          <div className="flex items-center gap-3 text-xs uppercase tracking-[0.18em] text-ink/40">
            <span>{postTypeLabel(post.postType)}</span>
            <span className="h-1 w-1 rounded-full bg-ink/20" />
            <time>{formatRelativeTime(post.createdAt)}</time>
          </div>
          <h1 className="font-serif text-4xl leading-tight md:text-5xl">
            {post.title || "未命名帖子"}
          </h1>
          <Link
            href={`/users/${post.userId}`}
            className="inline-flex items-center gap-3 text-sm text-ink/70 transition hover:text-ink"
          >
            <span className="relative inline-block h-10 w-10 overflow-hidden rounded-full bg-ink-200">
              {post.avatarUrl && (
                <Image
                  src={post.avatarUrl}
                  alt={post.username}
                  fill
                  sizes="40px"
                  className="object-cover"
                  unoptimized
                />
              )}
            </span>
            <span>
              <span className="block font-medium text-ink">@{post.username}</span>
              <span className="text-xs text-ink/40">查看主页</span>
            </span>
          </Link>
        </header>

        {images.length > 0 && (
          <div className="mt-12 space-y-4">
            {images.map((src, index) => (
              <div
                key={`${src}-${index}`}
                className="relative w-full overflow-hidden rounded-xl bg-ink-200"
              >
                <Image
                  src={src}
                  alt={`${post.title || "post"} image ${index + 1}`}
                  width={1600}
                  height={2000}
                  className="h-auto w-full object-cover"
                  sizes="(max-width: 768px) 100vw, 768px"
                  priority={index === 0}
                  unoptimized
                />
              </div>
            ))}
          </div>
        )}

        {post.contentText && (
          <div className="mt-10 whitespace-pre-wrap font-serif text-lg leading-relaxed text-ink/80">
            {post.contentText}
          </div>
        )}

        {(post.brandName || post.productName || post.rating) && (
          <section className="mt-12 rounded-2xl border border-ink/10 bg-ink-100 p-6">
            <h2 className="text-xs uppercase tracking-[0.18em] text-ink/40">
              单品信息
            </h2>
            <dl className="mt-4 space-y-2 text-sm text-ink/70">
              {post.brandName && (
                <Row label="品牌" value={post.brandName} />
              )}
              {post.productName && (
                <Row label="单品" value={post.productName} />
              )}
              {post.rating != null && (
                <Row label="评分" value={`${post.rating}/5`} />
              )}
            </dl>
          </section>
        )}

        <footer className="mt-14 flex flex-wrap items-center justify-between gap-6 border-t border-ink/5 pt-8 text-sm text-ink/50">
          <div className="flex items-center gap-6">
            <span>♥ {formatCount(post.likeCount)}</span>
            <span>✦ {formatCount(post.favoriteCount)}</span>
            <span>💬 {formatCount(post.commentCount)}</span>
          </div>
          <Link href="/download" className="btn-primary">
            在 App 中点赞 / 评论
          </Link>
        </footer>

        <section className="mt-20 rounded-2xl bg-ink p-10 text-white">
          <h2 className="font-serif text-2xl leading-snug">
            在 Avant Regard 中
            <br />
            继续探索。
          </h2>
          <p className="mt-3 text-sm text-white/60">
            下载 App 加入社区，点赞、收藏、关注你喜爱的穿搭者。
          </p>
          <div className="mt-6">
            <DownloadCTAs variant="inverted" />
          </div>
        </section>
      </article>
    );
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      notFound();
    }
    throw err;
  }
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-4">
      <dt className="w-16 text-xs uppercase tracking-widest text-ink/40">
        {label}
      </dt>
      <dd className="flex-1 text-ink/80">{value}</dd>
    </div>
  );
}
