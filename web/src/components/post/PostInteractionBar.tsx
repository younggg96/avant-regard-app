"use client";

/**
 * Client island mounted on /posts/[id] that replaces the static counter row.
 *
 * Three actions share the exact same pattern:
 *   1. Read initial state from the server-rendered Post (likedByMe etc.)
 *   2. Optimistically toggle local state + counter
 *   3. Fire POST/DELETE via authenticated api-client
 *   4. On error, roll back + surface a toast-like error (inline)
 *   5. Anonymous users → redirect to /auth/login?next=<current>
 *
 * Kept generic via a sub-component to avoid repeating the three blocks.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth/store";
import { postService } from "@/lib/services/post";
import type { Post } from "@/lib/types";
import { formatCount } from "@/lib/format";

type ActionKey = "like" | "favorite" | "want";

interface ActionConfig {
  key: ActionKey;
  initialActive: boolean;
  initialCount: number;
  onIcon: string;
  offIcon: string;
  labelOn: string;
  labelOff: string;
  toggle: (postId: number, userId: number, active: boolean) => Promise<void>;
}

export function PostInteractionBar({
  post,
}: {
  post: Pick<
    Post,
    | "id"
    | "likeCount"
    | "favoriteCount"
    | "commentCount"
  > & {
    likedByMe?: boolean;
    favoritedByMe?: boolean;
    wantedByMe?: boolean;
    wantCount?: number;
  };
}) {
  const actions: ActionConfig[] = [
    {
      key: "like",
      initialActive: !!post.likedByMe,
      initialCount: post.likeCount ?? 0,
      onIcon: "♥",
      offIcon: "♡",
      labelOn: "已点赞",
      labelOff: "点赞",
      toggle: (id, uid, active) =>
        active
          ? postService.unlikePost(id, uid)
          : postService.likePost(id, uid),
    },
    {
      key: "favorite",
      initialActive: !!post.favoritedByMe,
      initialCount: post.favoriteCount ?? 0,
      onIcon: "★",
      offIcon: "☆",
      labelOn: "已收藏",
      labelOff: "收藏",
      toggle: (id, uid, active) =>
        active
          ? postService.unfavoritePost(id, uid)
          : postService.favoritePost(id, uid),
    },
    {
      key: "want",
      initialActive: !!post.wantedByMe,
      initialCount: post.wantCount ?? 0,
      onIcon: "✓",
      offIcon: "+",
      labelOn: "已想要",
      labelOff: "我想要",
      toggle: (id, uid, active) =>
        active
          ? postService.unwantPost(id, uid)
          : postService.wantPost(id, uid),
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-3">
      {actions.map((a) => (
        <ActionButton key={a.key} postId={post.id} config={a} />
      ))}
      <span className="font-label text-sm text-[color:var(--ink-muted)]">
        💬 {formatCount(post.commentCount ?? 0)} 评论
      </span>
    </div>
  );
}

function ActionButton({
  postId,
  config,
}: {
  postId: number;
  config: ActionConfig;
}) {
  const router = useRouter();
  const isAuthed = useAuthStore((s) => s.isAuthenticated);
  const userId = useAuthStore((s) => s.user?.userId);

  const [active, setActive] = useState(config.initialActive);
  const [count, setCount] = useState(config.initialCount);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onClick = () => {
    setError(null);
    if (!isAuthed || !userId) {
      const next =
        typeof window !== "undefined"
          ? window.location.pathname + window.location.search
          : "/";
      router.push(`/auth/login?next=${encodeURIComponent(next)}`);
      return;
    }

    const prevActive = active;
    const prevCount = count;
    setActive(!prevActive);
    setCount(prevCount + (prevActive ? -1 : 1));

    startTransition(() => {
      config
        .toggle(postId, userId, prevActive)
        .catch((err: unknown) => {
          setActive(prevActive);
          setCount(prevCount);
          setError(err instanceof Error ? err.message : "操作失败");
        });
    });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-pressed={active}
      title={error ?? undefined}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 font-label text-[13px] transition-all
        ${
          active
            ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--canvas)]"
            : "border-[var(--border)] bg-[var(--canvas)] text-[var(--ink)] hover:border-[var(--ink)]"
        }
        ${pending ? "opacity-70" : ""}`}
    >
      <span className="text-base leading-none">
        {active ? config.onIcon : config.offIcon}
      </span>
      <span>{formatCount(count)}</span>
      <span className="hidden sm:inline text-[11px] opacity-75">
        {active ? config.labelOn : config.labelOff}
      </span>
    </button>
  );
}
