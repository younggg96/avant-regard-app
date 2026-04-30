"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { FadeImage } from "@/components/FadeImage";
import { VideoPlayer } from "@/components/VideoPlayer";
import { PostInteractionBar } from "@/components/post/PostInteractionBar";
import { PostCommentSection } from "@/components/post/PostCommentSection";
import { ArticleBody, parseArticleBlocks } from "@/components/post/ArticleBody";
import { formatRelativeTime } from "@/lib/format";
import { isVideoUrl } from "@/lib/media";
import { isRenderableImage } from "@/lib/isRenderableImage";
import type { Post } from "@/lib/types";

interface PostDetailViewProps {
  post: Post;
}

const KNOWN_POST_TYPES = new Set(["OUTFIT", "DAILY_SHARE", "ITEM_REVIEW", "ARTICLES"]);

function postTypeI18nKey(postType?: string): string {
  return postType && KNOWN_POST_TYPES.has(postType) ? `postTypes.${postType}` : "postTypes.default";
}

export function PostDetailView({ post }: PostDetailViewProps) {
  const { t } = useTranslation();
  const articleBlocks = parseArticleBlocks(post.contentText);

  const images = (articleBlocks
    ? post.imageUrls?.slice(0, 1) ?? []
    : post.imageUrls ?? []
  ).filter((src) => isVideoUrl(src) || isRenderableImage(src));

  return (
    <article className="mx-auto max-w-3xl px-6 py-12 md:py-20">
      <nav className="mb-10 flex items-center gap-3 font-label text-sm">
        <Link href="/discover" className="link-muted">
          {t("postDetail.linkDiscover")}
        </Link>
        {post.communityName && post.communitySlug && (
          <>
            <span className="text-black/20 dark:text-white/20">/</span>
            <Link
              href={`/communities/${post.communitySlug}`}
              className="link-muted"
            >
              {post.communityName}
            </Link>
          </>
        )}
      </nav>

      <header className="space-y-5">
        <div className="flex items-center gap-3 font-label text-xs uppercase tracking-[0.18em] text-black/40 dark:text-white/35">
          <span>{t(postTypeI18nKey(post.postType))}</span>
          <span className="h-1 w-1 rounded-full bg-black/20 dark:bg-white/20" />
          <time>{formatRelativeTime(post.createdAt, t)}</time>
        </div>
        <h1 className="font-serif text-4xl leading-tight text-black dark:text-white md:text-5xl">
          {post.title || t("postDetail.untitledPost")}
        </h1>
        <Link
          href={`/users/${post.userId}`}
          className="inline-flex items-center gap-3 font-serif text-sm transition-opacity hover:opacity-60
                     text-black/70 dark:text-white/60"
        >
          <span className="relative inline-block h-10 w-10 overflow-hidden rounded-full bg-[#f0f0f0] dark:bg-[#2a2a2a]">
            {isRenderableImage(post.avatarUrl) && (
              <Image
                src={post.avatarUrl!}
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
            <span className="font-label text-xs text-black/40 dark:text-white/30">{t("postDetail.viewProfile")}</span>
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

      {articleBlocks ? (
        <ArticleBody blocks={articleBlocks} title={post.title} />
      ) : (
        post.contentText && (
          <div className="mt-10 whitespace-pre-wrap font-serif text-lg leading-relaxed text-black/80 dark:text-white/75">
            {post.contentText}
          </div>
        )
      )}

      {(post.brandName || post.productName || post.rating) && (
        <section className="mt-12 rounded border p-6
                            border-black/[0.08] bg-[#f9f9f9]
                            dark:border-white/[0.08] dark:bg-[#141414]">
          <h2 className="font-label text-xs uppercase tracking-[0.18em] text-black/40 dark:text-white/35">
            {t("postDetail.productInfo")}
          </h2>
          <dl className="mt-4 space-y-2 font-serif text-sm text-black/70 dark:text-white/60">
            {post.brandName  && <Row label={t("postDetail.brand")} value={post.brandName} />}
            {post.productName && <Row label={t("postDetail.product")} value={post.productName} />}
            {post.rating != null && <Row label={t("postDetail.rating")} value={`${post.rating}/5`} />}
          </dl>
        </section>
      )}

      <div className="mt-14 border-t pt-8 border-black/[0.06] dark:border-white/[0.08]">
        <PostInteractionBar post={post} />
      </div>

      <PostCommentSection postId={post.id} />

      <footer className="mt-14 border-t pt-8 border-black/[0.06] dark:border-white/[0.08]
                         font-label text-sm text-black/50 dark:text-white/35">
        <Link href="/discover" className="link-underline">
          {t("postDetail.backDiscover")}
        </Link>
      </footer>
    </article>
  );
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
