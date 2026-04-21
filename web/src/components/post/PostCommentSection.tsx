"use client";

/**
 * Comment section for /posts/[id].
 *
 *  - CommentComposer:  top-level or nested reply input. Requires auth;
 *    anonymous users get a "登录后评论" CTA.
 *  - CommentList:      SWR-driven feed, grouped by parent with collapsible
 *    replies. Optimistic add on submit; real result replaces via `mutate`.
 *  - Comment like:     optimistic toggle, rolled back on error.
 *
 * Deliberately un-fancy — no rich-text, no @mentions autocomplete. Parity with
 * the mobile feed comment UX is intentional.
 */

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import useSWR from "swr";
import { useAuthStore } from "@/lib/auth/store";
import {
  commentService,
  type PostComment,
  type CommentReply,
} from "@/lib/services/comment";
import { formatRelativeTime } from "@/lib/format";

interface Props {
  postId: number;
}

export function PostCommentSection({ postId }: Props) {
  const userId = useAuthStore((s) => s.user?.userId);
  const key = ["post-comments", postId, userId] as const;
  const {
    data: comments,
    error,
    isLoading,
    mutate,
  } = useSWR<PostComment[]>(key, () =>
    commentService.getPostComments(postId, userId),
  );

  return (
    <section className="mt-14 border-t pt-10 border-black/[0.06] dark:border-white/[0.08]">
      <h2 className="font-label text-xs uppercase tracking-[0.18em] text-black/40 dark:text-white/35">
        评论 {comments ? `· ${comments.length}` : ""}
      </h2>

      <div className="mt-6">
        <CommentComposer
          postId={postId}
          onSubmitted={() => mutate()}
        />
      </div>

      <div className="mt-10 space-y-8">
        {isLoading && (
          <p className="font-label text-sm text-[color:var(--ink-muted)]">
            加载中…
          </p>
        )}
        {error && (
          <p className="font-label text-sm text-red-500">评论加载失败</p>
        )}
        {comments?.length === 0 && !isLoading && (
          <p className="font-label text-sm text-[color:var(--ink-muted)]">
            暂无评论，做第一个。
          </p>
        )}
        {comments?.map((c) => (
          <CommentItem
            key={c.id}
            comment={c}
            postId={postId}
            onMutated={() => mutate()}
          />
        ))}
      </div>
    </section>
  );
}

/* ------------------------------ Composer ------------------------------ */

function CommentComposer({
  postId,
  parentId,
  replyToUserId,
  replyToUsername,
  onSubmitted,
  autoFocus,
  onCancel,
}: {
  postId: number;
  parentId?: number;
  replyToUserId?: number;
  replyToUsername?: string;
  onSubmitted: () => void;
  autoFocus?: boolean;
  onCancel?: () => void;
}) {
  const isAuthed = useAuthStore((s) => s.isAuthenticated);
  const userId = useAuthStore((s) => s.user?.userId);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isAuthed || !userId) {
    const next =
      typeof window !== "undefined"
        ? window.location.pathname + window.location.search
        : "/";
    return (
      <div className="rounded-md border border-[var(--border)] bg-[var(--canvas-soft)] px-4 py-3 font-label text-[13px] text-[color:var(--ink-muted)]">
        想参与讨论？{" "}
        <Link
          href={`/auth/login?next=${encodeURIComponent(next)}`}
          className="text-[var(--ink)] underline-offset-4 hover:underline"
        >
          登录
        </Link>{" "}
        或{" "}
        <Link
          href={`/auth/register?next=${encodeURIComponent(next)}`}
          className="text-[var(--ink)] underline-offset-4 hover:underline"
        >
          注册
        </Link>
        。
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const content = text.trim();
    if (!content) return;
    try {
      setSubmitting(true);
      await commentService.createComment(postId, {
        userId,
        content,
        parentId,
        replyToUserId,
      });
      setText("");
      onSubmitted();
      onCancel?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "评论失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-2">
      <div className="rounded-md border border-[var(--border)] focus-within:border-[var(--ink)]">
        <textarea
          autoFocus={autoFocus}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            replyToUsername ? `回复 @${replyToUsername}` : "友善发言，共建社区"
          }
          rows={parentId ? 2 : 3}
          maxLength={1000}
          className="w-full resize-none bg-transparent px-3 py-2.5 font-serif text-[15px] leading-relaxed text-[var(--ink)] placeholder:text-[color:var(--ink-muted)] focus:outline-none"
        />
      </div>
      <div className="flex items-center justify-between">
        <span className="font-label text-[11px] text-[color:var(--ink-muted)]">
          {text.length} / 1000
        </span>
        <div className="flex items-center gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded px-3 py-1.5 font-label text-[12px] text-[color:var(--ink-muted)] hover:bg-[var(--canvas-raised)]"
            >
              取消
            </button>
          )}
          <button
            type="submit"
            disabled={submitting || !text.trim()}
            className="btn-primary px-4 py-1.5 text-[12px] disabled:opacity-60"
          >
            {submitting ? "发布中…" : "发布"}
          </button>
        </div>
      </div>
      {error && (
        <p className="font-label text-[12px] text-red-500">{error}</p>
      )}
    </form>
  );
}

/* ----------------------------- Comment item ----------------------------- */

function CommentItem({
  comment,
  postId,
  onMutated,
}: {
  comment: PostComment;
  postId: number;
  onMutated: () => void;
}) {
  const [showReply, setShowReply] = useState(false);
  const [showReplies, setShowReplies] = useState(comment.replyCount <= 2);

  return (
    <article className="space-y-3">
      <Header
        avatar={comment.userAvatar}
        username={comment.username}
        userId={comment.userId}
        createdAt={comment.createdAt}
      />
      <p className="whitespace-pre-wrap font-serif text-[15px] leading-relaxed text-[var(--ink)]">
        {comment.content}
      </p>
      <div className="flex items-center gap-4 font-label text-[12px] text-[color:var(--ink-muted)]">
        <LikeToggle
          commentId={comment.id}
          initialLiked={comment.isLiked}
          initialCount={comment.likeCount}
        />
        <button
          type="button"
          onClick={() => setShowReply((v) => !v)}
          className="hover:text-[var(--ink)]"
        >
          回复
        </button>
        {comment.replyCount > 0 && (
          <button
            type="button"
            onClick={() => setShowReplies((v) => !v)}
            className="hover:text-[var(--ink)]"
          >
            {showReplies ? "收起" : `展开 ${comment.replyCount} 条回复`}
          </button>
        )}
      </div>

      {showReply && (
        <div className="pl-4">
          <CommentComposer
            postId={postId}
            parentId={comment.id}
            replyToUserId={comment.userId}
            replyToUsername={comment.username}
            onSubmitted={onMutated}
            onCancel={() => setShowReply(false)}
            autoFocus
          />
        </div>
      )}

      {showReplies && comment.replies?.length > 0 && (
        <ul className="mt-2 space-y-4 border-l border-[var(--border)] pl-4">
          {comment.replies.map((r) => (
            <li key={r.id}>
              <ReplyItem reply={r} />
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

function ReplyItem({ reply }: { reply: CommentReply }) {
  return (
    <div className="space-y-2">
      <Header
        small
        avatar={reply.userAvatar}
        username={reply.username}
        userId={reply.userId}
        createdAt={reply.createdAt}
      />
      <p className="whitespace-pre-wrap font-serif text-[14px] leading-relaxed text-[var(--ink)]">
        {reply.replyToUsername && (
          <span className="text-[color:var(--ink-muted)]">
            回复 @{reply.replyToUsername}：
          </span>
        )}
        {reply.content}
      </p>
      <div className="flex items-center gap-4 font-label text-[11px] text-[color:var(--ink-muted)]">
        <LikeToggle
          commentId={reply.id}
          initialLiked={reply.isLiked}
          initialCount={reply.likeCount}
        />
      </div>
    </div>
  );
}

function Header({
  avatar,
  username,
  userId,
  createdAt,
  small,
}: {
  avatar?: string;
  username: string;
  userId: number;
  createdAt: string;
  small?: boolean;
}) {
  const size = small ? 28 : 36;
  return (
    <div className="flex items-center gap-3">
      <Link
        href={`/users/${userId}`}
        className="relative inline-block overflow-hidden rounded-full bg-[var(--canvas-raised)]"
        style={{ width: size, height: size }}
      >
        {avatar ? (
          <Image
            src={avatar}
            alt={username}
            fill
            sizes={`${size}px`}
            className="object-cover"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center font-label text-[11px] text-[color:var(--ink-muted)]">
            {username.charAt(0).toUpperCase()}
          </span>
        )}
      </Link>
      <div className="flex flex-col">
        <Link
          href={`/users/${userId}`}
          className="font-serif text-[14px] text-[var(--ink)] hover:opacity-70"
        >
          @{username}
        </Link>
        <time className="font-label text-[11px] text-[color:var(--ink-muted)]">
          {formatRelativeTime(createdAt)}
        </time>
      </div>
    </div>
  );
}

function LikeToggle({
  commentId,
  initialLiked,
  initialCount,
}: {
  commentId: number;
  initialLiked: boolean;
  initialCount: number;
}) {
  const isAuthed = useAuthStore((s) => s.isAuthenticated);
  const userId = useAuthStore((s) => s.user?.userId);
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);

  const onClick = async () => {
    if (!isAuthed || !userId) {
      const next =
        typeof window !== "undefined"
          ? window.location.pathname
          : "/";
      window.location.href = `/auth/login?next=${encodeURIComponent(next)}`;
      return;
    }
    if (busy) return;
    const prevLiked = liked;
    const prevCount = count;
    setLiked(!prevLiked);
    setCount(prevCount + (prevLiked ? -1 : 1));
    try {
      setBusy(true);
      if (prevLiked) {
        await commentService.unlikeComment(commentId, userId);
      } else {
        await commentService.likeComment(commentId, userId);
      }
    } catch {
      setLiked(prevLiked);
      setCount(prevCount);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 transition-colors ${
        liked ? "text-red-500" : "hover:text-[var(--ink)]"
      }`}
    >
      <span className="text-[13px]">{liked ? "♥" : "♡"}</span>
      <span>{count}</span>
    </button>
  );
}
