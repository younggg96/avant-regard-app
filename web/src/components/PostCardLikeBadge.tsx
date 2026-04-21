"use client";

/**
 * Hover-reveal like badge for PostCard.
 *
 * Positioned absolutely in the card's top-right corner. Visible only on
 * hover/focus of the parent card group. Clicking it likes/unlikes without
 * navigating (event.preventDefault + stopPropagation).
 *
 * Unauthenticated users fall back to a login redirect on click, which is
 * consistent with the rest of the interaction surfaces.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth/store";
import { postService } from "@/lib/services/post";

export function PostCardLikeBadge({
  postId,
  initialLiked = false,
}: {
  postId: number;
  initialLiked?: boolean;
}) {
  const router = useRouter();
  const isAuthed = useAuthStore((s) => s.isAuthenticated);
  const userId = useAuthStore((s) => s.user?.userId);
  const [liked, setLiked] = useState(initialLiked);
  const [busy, setBusy] = useState(false);

  const onClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthed || !userId) {
      const next =
        typeof window !== "undefined" ? window.location.pathname : "/";
      router.push(`/auth/login?next=${encodeURIComponent(next)}`);
      return;
    }
    if (busy) return;
    const prev = liked;
    setLiked(!prev);
    try {
      setBusy(true);
      if (prev) await postService.unlikePost(postId, userId);
      else await postService.likePost(postId, userId);
    } catch {
      setLiked(prev);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={liked ? "取消点赞" : "点赞"}
      aria-pressed={liked}
      className={`absolute right-2.5 top-2.5 z-10 flex h-7 w-7 items-center justify-center rounded-full backdrop-blur transition-all duration-300
        ${
          liked
            ? "bg-red-500 text-white opacity-100"
            : "bg-white/85 text-black/70 opacity-0 group-hover:opacity-100 hover:bg-white dark:bg-black/60 dark:text-white/80"
        }
        ${busy ? "pointer-events-none" : ""}`}
    >
      <HeartIcon filled={liked} />
    </button>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="block"
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

