"use client";

/**
 * /me/follows — followers / following tabs.
 *
 * Active tab lives in `?tab=following|followers` so deep-link from the
 * overview stat cards works. Empty states are optimistic: we hide the tab
 * content when the user has no relations, not when the request is pending.
 */

import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/lib/auth/store";
import { followService, type FollowingUser } from "@/lib/services/follow";
import { isRenderableImage } from "@/lib/isRenderableImage";

type Tab = "following" | "followers";

// `useSearchParams()` needs a <Suspense> boundary so `next build` can
// prerender the outer shell; inner component owns the hooks.
function MyFollowsPageInner() {
  const { t } = useTranslation();
  const router = useRouter();
  const sp = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const userId = user?.userId;

  const tab = (sp.get("tab") === "followers" ? "followers" : "following") as Tab;

  const { data, isLoading } = useSWR<FollowingUser[]>(
    userId ? [`follows-${tab}`, userId] : null,
    () =>
      tab === "following"
        ? followService.getFollowingUsers(userId!)
        : followService.getFollowers(userId!),
  );

  const onTab = (next: Tab) => {
    const qs = new URLSearchParams(sp.toString());
    qs.set("tab", next);
    router.replace(`/me/follows?${qs.toString()}`);
  };

  return (
    <section className="min-w-0">
      <header className="mb-6 border-b border-[var(--border)] pb-5">
        <h1 className="font-serif text-3xl text-black dark:text-white md:text-4xl">
          {t("follows.title")}
        </h1>
      </header>

      <div className="mb-6 inline-flex gap-2 rounded-full bg-[var(--canvas-raised)] p-1">
        <TabBtn active={tab === "following"} onClick={() => onTab("following")}>
          {t("follows.following")}
        </TabBtn>
        <TabBtn active={tab === "followers"} onClick={() => onTab("followers")}>
          {t("follows.followers")}
        </TabBtn>
      </div>

      {isLoading && (
        <div className="font-label text-[12px] uppercase tracking-widest text-[color:var(--ink-muted)]">
          {t("common.loading")}
        </div>
      )}

      {!isLoading && (!data || data.length === 0) && (
        <div className="rounded border border-[var(--border)] bg-[var(--canvas-soft)] p-8 font-serif text-sm text-[color:var(--ink-muted)]">
          {tab === "following" ? t("follows.noFollowing") : t("follows.noFollowers")}
        </div>
      )}

      {data && data.length > 0 && (
        <ul className="divide-y divide-[var(--border)] rounded border border-[var(--border)] bg-[var(--canvas)]">
          {data.map((u) => (
            <li key={u.userId}>
              <Link
                href={`/users/${u.userId}`}
                className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-[var(--canvas-raised)]"
              >
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-[var(--canvas-raised)]">
                  {isRenderableImage(u.avatar) && (
                    <Image
                      src={u.avatar}
                      alt={u.username}
                      fill
                      sizes="48px"
                      className="object-cover"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-serif text-[15px] text-black dark:text-white">
                    @{u.username}
                  </div>
                  {u.bio && (
                    <div className="truncate font-label text-[12px] text-[color:var(--ink-muted)]">
                      {u.bio}
                    </div>
                  )}
                </div>
                {u.location && (
                  <span className="shrink-0 font-label text-[11px] uppercase tracking-widest text-[color:var(--ink-muted)]">
                    {u.location}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-1.5 font-label text-[12px] transition-colors ${
        active
          ? "bg-[var(--ink)] text-[var(--canvas)]"
          : "text-[color:var(--ink-muted)] hover:text-[var(--ink)]"
      }`}
    >
      {children}
    </button>
  );
}

export default function MyFollowsPage() {
  return (
    <Suspense fallback={null}>
      <MyFollowsPageInner />
    </Suspense>
  );
}
