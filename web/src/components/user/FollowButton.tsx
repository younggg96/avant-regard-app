"use client";

/**
 * Follow-user client island.
 *
 * Lives on /users/[id] next to the header avatar. Hides itself when viewing
 * own profile. Anonymous users get a "登录后关注" CTA that redirects to
 * /auth/login?next=<current>.
 *
 * Owns ONLY the button — the follower / following counts are rendered by the
 * parent page's stats row as the single source of truth, so we don't
 * duplicate numbers on the same screen. Follow state updates optimistically;
 * the count stays stale until the page revalidates, which is an acceptable
 * trade-off for not having two drifting counters.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth/store";
import { followService } from "@/lib/services/follow";

export function FollowButton({ targetUserId }: { targetUserId: number }) {
  const router = useRouter();
  const currentUserId = useAuthStore((s) => s.user?.userId);
  const isAuthed = useAuthStore((s) => s.isAuthenticated);
  const hydrated = useAuthStore((s) => s.hydrated);

  const [isFollowing, setIsFollowing] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!hydrated || !isAuthed || !currentUserId) return;
    if (currentUserId === targetUserId) return;
    followService
      .isFollowingUser(currentUserId, targetUserId)
      .then((v) => setIsFollowing(v))
      .catch(() => {});
  }, [hydrated, isAuthed, currentUserId, targetUserId]);

  if (currentUserId === targetUserId) return null;

  const onClick = async () => {
    if (!isAuthed || !currentUserId) {
      const next =
        typeof window !== "undefined" ? window.location.pathname : "/";
      router.push(`/auth/login?next=${encodeURIComponent(next)}`);
      return;
    }
    if (pending) return;

    const prev = isFollowing;
    setIsFollowing(!prev);

    try {
      setPending(true);
      if (prev) await followService.unfollowUser(currentUserId, targetUserId);
      else await followService.followUser(currentUserId, targetUserId);
    } catch {
      setIsFollowing(prev);
    } finally {
      setPending(false);
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className={`rounded px-5 py-2 font-label text-[13px] tracking-wide transition-colors disabled:opacity-60 ${
        isFollowing
          ? "border border-[var(--ink)] bg-transparent text-[var(--ink)] hover:bg-[var(--canvas-raised)]"
          : "bg-[var(--ink)] text-[var(--canvas)] hover:opacity-85"
      }`}
    >
      {isFollowing ? "已关注" : "+ 关注"}
    </button>
  );
}
