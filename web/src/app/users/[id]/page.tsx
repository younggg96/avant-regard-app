import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PostCard } from "@/components/PostCard";
import { FadeImage } from "@/components/FadeImage";
import { FollowButton } from "@/components/user/FollowButton";
import {
  ApiError,
  getUserFollowerCount,
  getUserFollowingCount,
  getUserInfo,
  getUserPosts,
} from "@/lib/api";
import { formatCount } from "@/lib/format";

export const revalidate = 120;

interface PageProps {
  params: { id: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  try {
    const user = await getUserInfo(params.id);
    return {
      title: `@${user.username}`,
      description: user.bio || `${user.username} 的 Avant Regard 主页。`,
      alternates: { canonical: `/users/${user.userId}` },
      openGraph: {
        type: "profile",
        title: `@${user.username} · Avant Regard`,
        description: user.bio || undefined,
        images: user.avatarUrl ? [{ url: user.avatarUrl }] : undefined,
      },
    };
  } catch {
    return { title: "用户主页" };
  }
}

export default async function UserProfilePage({ params }: PageProps) {
  try {
    const [user, posts, followerCount, followingCount] = await Promise.all([
      getUserInfo(params.id),
      getUserPosts(params.id).catch(() => []),
      getUserFollowerCount(params.id).catch(() => 0),
      getUserFollowingCount(params.id).catch(() => 0),
    ]);

    return (
      <section className="mx-auto max-w-content px-6 py-12 md:py-16">
        <nav className="mb-10 font-label text-sm">
          <Link href="/discover" className="link-muted">
            ← 返回 Discover
          </Link>
        </nav>

        <header className="overflow-hidden rounded border border-black/[0.06] bg-[#f9f9f9]
                           dark:border-white/[0.08] dark:bg-[#111]">
          {/* Cover — hero, stays clean with no overlapping text. */}
          <div className="relative h-44 w-full bg-[#e8e8e8] dark:bg-[#1a1a1a] md:h-64">
            {user.coverUrl && (
              <FadeImage
                src={user.coverUrl}
                alt={`${user.username} cover`}
                fill
                sizes="(max-width: 768px) 100vw, 1200px"
                quality={85}
                className="object-cover"
                priority
              />
            )}
          </div>

          <div className="px-6 pb-8 md:px-10">
            {/* Avatar overlaps cover by half; follow button sits on the far right. */}
            <div className="-mt-14 mb-6 flex items-end justify-between gap-4 md:-mt-16">
              <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-full border-4 shadow-card
                              bg-[#e8e8e8] border-[#f9f9f9] dark:bg-[#2a2a2a] dark:border-[#111]
                              md:h-32 md:w-32">
                {user.avatarUrl && (
                  <Image
                    src={user.avatarUrl}
                    alt={user.username}
                    fill
                    sizes="128px"
                    quality={80}
                    className="object-cover"
                    priority
                  />
                )}
              </div>
              <div className="pb-1">
                <FollowButton targetUserId={user.userId} />
              </div>
            </div>

            {/* Identity block — readable column, no cramping around the avatar. */}
            <div className="max-w-2xl">
              <h1 className="font-serif text-3xl leading-tight text-black dark:text-white md:text-4xl">
                @{user.username}
              </h1>
              {user.bio && (
                <p className="mt-3 font-serif text-[15px] leading-relaxed text-black/65 dark:text-white/55">
                  {user.bio}
                </p>
              )}
              {user.location && (
                <p className="mt-3 font-label text-[11px] uppercase tracking-widest text-black/45 dark:text-white/35">
                  {user.location}
                </p>
              )}
            </div>

            <dl className="mt-8 grid grid-cols-3 gap-4 border-t border-black/[0.06] pt-6 dark:border-white/[0.08] md:max-w-md">
              <Stat label="帖子"  value={formatCount(posts.length)} />
              <Stat label="关注者" value={formatCount(followerCount)} />
              <Stat label="关注中" value={formatCount(followingCount)} />
            </dl>
          </div>
        </header>

        <section className="mt-14">
          <h2 className="mb-8 font-serif text-2xl text-black dark:text-white">发布</h2>
          {posts.length === 0 ? (
            <div className="rounded border p-8 font-serif text-sm
                            border-black/[0.08] bg-[#f9f9f9] text-black/55
                            dark:border-white/[0.08] dark:bg-[#111] dark:text-white/40">
              该用户还没有公开发布的内容。
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {posts.map((post, index) => (
                <PostCard key={post.id} post={post} priority={index < 4} />
              ))}
            </div>
          )}
        </section>
      </section>
    );
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-serif text-2xl text-black dark:text-white">{value}</div>
      <div className="font-label text-xs uppercase tracking-widest text-black/40 dark:text-white/30">
        {label}
      </div>
    </div>
  );
}
