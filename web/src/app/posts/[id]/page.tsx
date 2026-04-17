import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DownloadCTAs } from "@/components/DownloadCTAs";
import { FadeImage } from "@/components/FadeImage";
import { VideoPlayer } from "@/components/VideoPlayer";
import { ApiError, getPost } from "@/lib/api";
import { formatCount, formatRelativeTime, postTypeLabel } from "@/lib/format";
import { isVideoUrl } from "@/lib/media";

export const revalidate = 60;

interface PageProps {
  params: { id: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  try {
    const post = await getPost(params.id);
    const description =
      post.contentText?.slice(0, 140) ||
      `${post.username} 分享的${postTypeLabel(post.postType)}内容。`;
    const ogImage = post.imageUrls?.find((u) => !isVideoUrl(u));
    return {
      title: post.title || `${post.username} 的${postTypeLabel(post.postType)}`,
      description,
      alternates: { canonical: `/posts/${post.id}` },
      openGraph: {
        type: "article",
        title: post.title,
        description,
        images: ogImage ? [{ url: ogImage }] : undefined,
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
        <nav className="mb-10 font-label text-sm">
          <Link href="/discover" className="link-muted">
            ← 返回 Discover
          </Link>
        </nav>

        <header className="space-y-5">
          <div className="flex items-center gap-3 font-label text-xs uppercase tracking-[0.18em] text-black/40 dark:text-white/35">
            <span>{postTypeLabel(post.postType)}</span>
            <span className="h-1 w-1 rounded-full bg-black/20 dark:bg-white/20" />
            <time>{formatRelativeTime(post.createdAt)}</time>
          </div>
          <h1 className="font-serif text-4xl leading-tight text-black dark:text-white md:text-5xl">
            {post.title || "未命名帖子"}
          </h1>
          <Link
            href={`/users/${post.userId}`}
            className="inline-flex items-center gap-3 font-serif text-sm transition-opacity hover:opacity-60
                       text-black/70 dark:text-white/60"
          >
            <span className="relative inline-block h-10 w-10 overflow-hidden rounded-full bg-[#f0f0f0] dark:bg-[#2a2a2a]">
              {post.avatarUrl && (
                <Image
                  src={post.avatarUrl}
                  alt={post.username}
                  fill
                  sizes="40px"
                  quality={75}
                  className="object-cover"
                />
              )}
            </span>
            <span>
              <span className="block font-medium text-black dark:text-white">@{post.username}</span>
              <span className="font-label text-xs text-black/40 dark:text-white/30">查看主页</span>
            </span>
          </Link>
        </header>

        {images.length > 0 && (
          <div className="mt-12 space-y-4">
            {images.map((src, index) => (
              <div
                key={`${src}-${index}`}
                className="relative w-full overflow-hidden rounded bg-[#f0f0f0] dark:bg-[#1a1a1a]"
              >
                {isVideoUrl(src) ? (
                  <VideoPlayer
                    src={src}
                    label={`${post.title || "post"} video ${index + 1}`}
                    className="h-auto w-full"
                    priority={index === 0}
                  />
                ) : (
                  <FadeImage
                    src={src}
                    alt={`${post.title || "post"} image ${index + 1}`}
                    width={1600}
                    height={2000}
                    quality={90}
                    className="h-auto w-full object-cover"
                    sizes="(max-width: 768px) 100vw, 720px"
                    priority={index === 0}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {post.contentText && (
          <div className="mt-10 whitespace-pre-wrap font-serif text-lg leading-relaxed text-black/80 dark:text-white/75">
            {post.contentText}
          </div>
        )}

        {(post.brandName || post.productName || post.rating) && (
          <section className="mt-12 rounded border p-6
                              border-black/[0.08] bg-[#f9f9f9]
                              dark:border-white/[0.08] dark:bg-[#141414]">
            <h2 className="font-label text-xs uppercase tracking-[0.18em] text-black/40 dark:text-white/35">
              单品信息
            </h2>
            <dl className="mt-4 space-y-2 font-serif text-sm text-black/70 dark:text-white/60">
              {post.brandName  && <Row label="品牌" value={post.brandName} />}
              {post.productName && <Row label="单品" value={post.productName} />}
              {post.rating != null && <Row label="评分" value={`${post.rating}/5`} />}
            </dl>
          </section>
        )}

        <footer className="mt-14 flex flex-wrap items-center justify-between gap-6 border-t pt-8
                           border-black/[0.06] dark:border-white/[0.08]
                           font-label text-sm text-black/50 dark:text-white/35">
          <div className="flex items-center gap-6">
            <span>♥ {formatCount(post.likeCount)}</span>
            <span>✦ {formatCount(post.favoriteCount)}</span>
            <span>💬 {formatCount(post.commentCount)}</span>
          </div>
          <Link href="/download" className="btn-primary">
            在 App 中点赞 / 评论
          </Link>
        </footer>

        <section className="mt-20 rounded bg-black p-10 text-white dark:bg-[#1a1a1a]">
          <h2 className="font-serif text-2xl leading-snug">
            在 Avant Regard 中
            <br />
            继续探索。
          </h2>
          <p className="mt-3 font-serif text-sm text-white/60">
            下载 App 加入社区，点赞、收藏、关注你喜爱的穿搭者。
          </p>
          <div className="mt-6">
            <DownloadCTAs variant="inverted" />
          </div>
        </section>
      </article>
    );
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-4">
      <dt className="w-16 font-label text-xs uppercase tracking-widest text-black/40 dark:text-white/35">
        {label}
      </dt>
      <dd className="flex-1 text-black/80 dark:text-white/70">{value}</dd>
    </div>
  );
}
