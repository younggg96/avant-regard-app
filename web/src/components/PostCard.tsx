import Image from "next/image";
import Link from "next/link";
import { FadeImage } from "@/components/FadeImage";
import type { Post } from "@/lib/types";
import { formatCount, postTypeLabel } from "@/lib/format";

interface PostCardProps {
  post: Post;
  priority?: boolean;
}

export function PostCard({ post, priority = false }: PostCardProps) {
  const cover = post.imageUrls?.[0];
  const typeLabel = postTypeLabel(post.postType);

  return (
    <Link
      href={`/posts/${post.id}`}
      className="group block overflow-hidden rounded shadow-soft transition-shadow duration-300
                 bg-white hover:shadow-card
                 dark:bg-[#1a1a1a] dark:shadow-none dark:hover:shadow-none dark:ring-1 dark:ring-white/[0.06]"
    >
      {/* Image */}
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-[#f0f0f0] dark:bg-[#252525]">
        {cover ? (
          <FadeImage
            src={cover}
            alt={post.title || typeLabel}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 25vw, 280px"
            quality={85}
            className="object-cover transition-transform duration-700 ease-out will-change-transform group-hover:scale-[1.05]"
            priority={priority}
          />
        ) : (
          <div className="flex h-full items-center justify-center font-label text-[10px] uppercase tracking-[0.2em] text-black/20 dark:text-white/20">
            No image
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent opacity-0 transition-opacity duration-400 group-hover:opacity-100" />

        {/* Type badge */}
        <span className="absolute left-2.5 top-2.5 rounded-sm px-2 py-0.5 font-label text-[9px] uppercase tracking-[0.12em] backdrop-blur transition-opacity duration-300 group-hover:opacity-0
                         bg-white/88 text-black/55 dark:bg-black/60 dark:text-white/60">
          {typeLabel}
        </span>

        {/* Hover info overlay */}
        <div className="absolute inset-x-0 bottom-0 translate-y-1.5 p-3.5 opacity-0 transition-all duration-400 ease-out group-hover:translate-y-0 group-hover:opacity-100">
          <h3 className="line-clamp-2 font-serif text-[13px] leading-snug text-white">
            {post.title || post.contentText?.slice(0, 60) || "—"}
          </h3>
          <div className="mt-1 flex items-center justify-between font-label text-[10px] text-white/55">
            <span>@{post.username}</span>
            <span>♥ {formatCount(post.likeCount)}</span>
          </div>
        </div>
      </div>

      {/* Caption */}
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
