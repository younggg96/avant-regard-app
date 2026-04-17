import Image from "next/image";
import Link from "next/link";
import type { Post } from "@/lib/types";
import { formatCount, postTypeLabel } from "@/lib/format";

/**
 * Web-side equivalent of frontend/src/components/PostCard.tsx.
 * Read-only; links through to /posts/[id] for the detail view.
 */
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
      className="group block overflow-hidden rounded-xl bg-white shadow-soft transition hover:shadow-card"
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-ink-200">
        {cover ? (
          <Image
            src={cover}
            alt={post.title || typeLabel}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 280px"
            className="object-cover transition duration-500 group-hover:scale-[1.03]"
            priority={priority}
            unoptimized
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs uppercase tracking-widest text-ink/30">
            No image
          </div>
        )}

        <span className="absolute left-3 top-3 rounded-full bg-white/85 px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-ink/70 backdrop-blur">
          {typeLabel}
        </span>
      </div>

      <div className="space-y-2 p-4">
        <h3 className="line-clamp-2 font-serif text-base leading-snug tracking-tight text-ink group-hover:underline">
          {post.title || post.contentText?.slice(0, 60) || "未命名帖子"}
        </h3>

        <div className="flex items-center justify-between text-xs text-ink/50">
          <span className="truncate">@{post.username}</span>
          <span className="flex items-center gap-3">
            <span>♥ {formatCount(post.likeCount)}</span>
            <span>✦ {formatCount(post.favoriteCount)}</span>
          </span>
        </div>
      </div>
    </Link>
  );
}
