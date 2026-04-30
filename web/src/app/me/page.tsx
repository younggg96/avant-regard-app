"use client";

/**
 * /me — personal overview.
 *
 * Pulls the authenticated user's profile + follower/following/unread counts in
 * parallel via SWR, renders a compact summary card with quick-action tiles.
 *
 * Unlike the public `/users/[id]` page (SSR, static for SEO), /me is
 * client-rendered: the data is user-specific and authenticated.
 */

import Link from "next/link";
import Image from "next/image";
import useSWR from "swr";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/lib/auth/store";
import { apiClient } from "@/lib/api-client";
import { followService } from "@/lib/services/follow";
import { notificationService } from "@/lib/services/notification";
import { chatService } from "@/lib/services/chat";
import { postService } from "@/lib/services/post";
import { storeMerchantService } from "@/lib/services/store-merchant";
import { formatCount } from "@/lib/format";
import { isRenderableImage } from "@/lib/isRenderableImage";
import type { UserInfo } from "@/lib/types";

export default function MeOverviewPage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const userId = user?.userId;

  const { data: profile } = useSWR(
    userId ? ["user-info", userId] : null,
    () => apiClient.get<UserInfo>(`/api/user-info/${userId}`),
  );

  const { data: followerCount } = useSWR(
    userId ? ["followers-count", userId] : null,
    () => followService.getFollowersCount(userId!),
  );

  const { data: followingCount } = useSWR(
    userId ? ["following-count", userId] : null,
    () => followService.getFollowingCount(userId!),
  );

  const { data: unreadMsgs } = useSWR(
    userId ? ["chat-unread"] : null,
    () => chatService.getUnreadCount().then((d) => d.count ?? 0),
    { refreshInterval: 30_000 },
  );

  const { data: unreadNotifs } = useSWR(
    userId ? ["notif-unread"] : null,
    () => notificationService.getUnreadCount(),
    { refreshInterval: 30_000 },
  );

  const { data: myPosts } = useSWR(
    userId ? ["my-posts", userId] : null,
    () => postService.getUserPosts(userId!).catch(() => []),
  );

  const { data: merchantSummary } = useSWR(
    userId ? ["my-merchants-summary", userId] : null,
    () =>
      storeMerchantService
        .getMyMerchants(1, 50)
        .catch(() => ({ merchants: [], total: 0 })),
  );
  const merchantCount = merchantSummary?.merchants.length ?? 0;
  const approvedMerchantCount = (merchantSummary?.merchants ?? []).filter(
    (m) => m.status === "APPROVED",
  ).length;
  const merchantDesc = merchantCount
    ? t("me.storeDescCount", { count: merchantCount, approved: approvedMerchantCount })
    : t("me.storeDescDefault");

  const displayName = profile?.username || user?.username || t("me.fallbackName");
  const avatar = profile?.avatarUrl || user?.avatar;

  return (
    <section className="min-w-0">
      <header className="mb-10 flex flex-col gap-6 rounded border border-[var(--border)] bg-[var(--canvas-soft)] p-6 md:flex-row md:items-center">
        <div className="relative h-20 w-20 overflow-hidden rounded-full border-2 border-white bg-[var(--canvas-raised)] dark:border-[#0a0a0a]">
          {isRenderableImage(avatar) && (
            <Image
              src={avatar}
              alt={displayName}
              fill
              sizes="80px"
              className="object-cover"
            />
          )}
        </div>
        <div className="flex-1">
          <h1 className="font-serif text-2xl text-black dark:text-white md:text-3xl">
            @{displayName}
          </h1>
          {profile?.bio && (
            <p className="mt-1 font-serif text-[14px] text-[color:var(--ink-muted)]">
              {profile.bio}
            </p>
          )}
          {profile?.location && (
            <p className="mt-1 font-label text-[11px] uppercase tracking-widest text-[color:var(--ink-muted)]">
              {profile.location}
            </p>
          )}
        </div>
        <Link
          href={`/users/${userId ?? ""}`}
          className="inline-flex items-center gap-1 font-label text-[13px] text-[var(--ink)] underline-offset-4 hover:underline"
        >
          {t("me.viewPublicProfile")}
        </Link>
      </header>

      <dl className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label={t("me.published")} value={formatCount(myPosts?.length ?? 0)} href="/me" />
        <Stat
          label={t("me.followingLabel")}
          value={formatCount(followingCount ?? 0)}
          href="/me/follows?tab=following"
        />
        <Stat
          label={t("me.fans")}
          value={formatCount(followerCount ?? 0)}
          href="/me/follows?tab=followers"
        />
        <Stat
          label={t("me.unread")}
          value={formatCount((unreadMsgs ?? 0) + (unreadNotifs ?? 0))}
          href="/me/notifications"
        />
      </dl>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Tile
          href="/me/level"
          title={t("me.myLevel")}
          desc={t("me.levelDesc")}
        />
        <Tile
          href="/me/likes"
          title={t("me.likes")}
          desc={t("me.likesDesc")}
        />
        <Tile href="/me/favorites" title={t("me.favorites")} desc={t("me.favoritesDesc")} />
        <Tile href="/me/wants" title={t("me.wants")} desc={t("me.wantsDesc")} />
        <Tile
          href="/me/follows"
          title={t("me.followsAndFans")}
          desc={t("me.followsDesc")}
        />
        <Tile
          href="/me/merchant"
          title={t("me.myStore")}
          desc={merchantDesc}
        />
        <Tile
          href="/me/chats"
          title={t("me.messages")}
          desc={unreadMsgs ? t("me.messagesUnread", { count: unreadMsgs }) : t("me.messagesDefault")}
        />
        <Tile
          href="/me/notifications"
          title={t("me.notifications")}
          desc={unreadNotifs ? t("me.notifsUnread", { count: unreadNotifs }) : t("me.notifsDefault")}
        />
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded border border-[var(--border)] px-4 py-4 transition-colors hover:bg-[var(--canvas-raised)]"
    >
      <div className="font-serif text-2xl text-black dark:text-white">{value}</div>
      <div className="mt-1 font-label text-[11px] uppercase tracking-widest text-[color:var(--ink-muted)]">
        {label}
      </div>
    </Link>
  );
}

function Tile({
  href,
  title,
  desc,
}: {
  href: string;
  title: string;
  desc: string;
}) {
  const { t } = useTranslation();
  return (
    <Link
      href={href}
      className="group flex flex-col gap-2 rounded border border-[var(--border)] p-5 transition-colors hover:bg-[var(--canvas-raised)]"
    >
      <div className="font-serif text-[17px] text-black dark:text-white">
        {title}
      </div>
      <div className="font-label text-[12px] text-[color:var(--ink-muted)]">
        {desc}
      </div>
      <div className="mt-auto font-label text-[11px] text-[color:var(--ink)] opacity-0 transition-opacity group-hover:opacity-100">
        {t("common.open")}
      </div>
    </Link>
  );
}
