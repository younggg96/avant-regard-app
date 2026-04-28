"use client";

/**
 * Feed post card.
 *
 * Two layout modes:
 *  - Default (fixed 3/4 cover) — used by uniform grids such as user profiles
 *    and community pages, where all thumbnails line up in a rectangular grid.
 *  - `masonry` — cover follows the media's natural aspect ratio clamped to
 *    [3/4, 16/9], mirroring the mobile `frontend/src/components/PostCard.tsx`
 *    behaviour. Pair this with a CSS `columns` parent to get a true waterfall
 *    feed (see `web/src/components/discover/DiscoverFeed.tsx`).
 *
 * The clamp window is identical to mobile so tall portrait covers stay tall
 * and landscape covers stay wide, but neither extreme blows up the column.
 */

import { useState, type CSSProperties } from "react";
import Link from "next/link";
import { FadeImage } from "@/components/FadeImage";
import { VideoCover, VideoBadge } from "@/components/VideoCover";
import { PostCardLikeBadge } from "@/components/PostCardLikeBadge";
import { isVideoUrl } from "@/lib/media";
import { isRenderableImage } from "@/lib/isRenderableImage";
import type { Post } from "@/lib/types";
import { formatCount, postTypeLabel } from "@/lib/format";

interface PostCardProps {
  post: Post;
  priority?: boolean;
  /**
   * When true, the cover box's aspect-ratio follows the loaded media
   * (clamped to [3/4, 16/9]). Defaults to a fixed 3/4 cover.
   */
  masonry?: boolean;
}

const MIN_ASPECT = 3 / 4;
const MAX_ASPECT = 16 / 9;

const clampAspect = (ratio: number) =>
  Math.min(Math.max(ratio, MIN_ASPECT), MAX_ASPECT);

export function PostCard({ post, priority = false, masonry = false }: PostCardProps) {
  const rawCover = post.imageUrls?.[0];
  const typeLabel = postTypeLabel(post.postType);
  const coverIsVideo = isVideoUrl(rawCover);
  // Guard: covers come from user-published posts; stray ImagePicker file://
  // URIs would otherwise crash next/image in SSR.
  const cover =
    coverIsVideo || isRenderableImage(rawCover) ? rawCover : undefined;

  // Waterfall feeds replace the fixed `aspect-[3/4]` with a per-card ratio
  // measured once the media has decoded. Start at MIN_ASPECT to reserve the
  // same vertical space as the default layout, then smoothly re-flow when the
  // real ratio comes in. Transition keeps the reflow from snapping.
  const [aspect, setAspect] = useState<number>(MIN_ASPECT);

  const handleImageLoad = (
    e: React.SyntheticEvent<HTMLImageElement, Event>,
  ) => {
    if (!masonry) return;
    const { naturalWidth, naturalHeight } = e.currentTarget;
    if (naturalWidth > 0 && naturalHeight > 0) {
      setAspect(clampAspect(naturalWidth / naturalHeight));
    }
  };

  const handleVideoAspect = (ratio: number) => {
    if (!masonry) return;
    setAspect(clampAspect(ratio));
  };

  const coverClass = masonry
    ? "relative w-full overflow-hidden bg-[#f0f0f0] dark:bg-[#252525]"
    : "relative aspect-[3/4] w-full overflow-hidden bg-[#f0f0f0] dark:bg-[#252525]";
  const coverStyle: CSSProperties | undefined = masonry
    ? { aspectRatio: String(aspect) }
    : undefined;

  return (
    <Link
      href={`/posts/${post.id}`}
      className="group block overflow-hidden rounded shadow-soft transition-shadow duration-300
                 bg-white hover:shadow-card
                 dark:bg-[#1a1a1a] dark:shadow-none dark:hover:shadow-none dark:ring-1 dark:ring-white/[0.06]"
    >
      <div className={coverClass} style={coverStyle}>
        {cover ? (
          coverIsVideo ? (
            <VideoCover
              src={cover}
              label={post.title || typeLabel}
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out will-change-transform group-hover:scale-[1.05]"
              onAspectRatio={handleVideoAspect}
            />
          ) : (
            <FadeImage
              src={cover}
              alt={post.title || typeLabel}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
              quality={85}
              className="object-cover transition-transform duration-700 ease-out will-change-transform group-hover:scale-[1.05]"
              priority={priority}
              onLoad={handleImageLoad}
            />
          )
        ) : (
          <div className="flex h-full items-center justify-center font-label text-[10px] uppercase tracking-[0.2em] text-black/20 dark:text-white/20">
            No image
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent opacity-0 transition-opacity duration-400 group-hover:opacity-100" />

        <span className="absolute left-2.5 top-2.5 rounded-sm px-2 py-0.5 font-label text-[9px] uppercase tracking-[0.12em] backdrop-blur transition-opacity duration-300 group-hover:opacity-0
                         bg-white/88 text-black/55 dark:bg-black/60 dark:text-white/60">
          {typeLabel}
        </span>

        {coverIsVideo && <VideoBadge />}

        <PostCardLikeBadge postId={post.id} initialLiked={!!post.likedByMe} />
      </div>

      <div className="space-y-0.5 px-3 py-2.5">
        <h3 className="line-clamp-1 font-serif text-[13px] leading-snug transition-opacity duration-200 group-hover:opacity-40
                       text-black dark:text-white">
          {post.title || post.contentText?.slice(0, 50) || "—"}
        </h3>
        <div className="flex items-center justify-between font-label text-[10px] text-black/35 dark:text-white/30">
          <span>@{post.username}</span>
          <span>♥ {formatCount(post.likeCount)}</span>
        </div>
      </div>
    </Link>
  );
}
