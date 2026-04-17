import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PostCard } from "@/components/PostCard";
import { FadeImage } from "@/components/FadeImage";
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
      alternates: { canonical: `/users/${user.id}` },
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

        <header className="overflow-hidden rounded border
                           border-black/[0.06] bg-[#f9f9f9]
                           dark:border-white/[0.08] dark:bg-[#111]">
          <div className="relative h-40 w-full bg-[#e8e8e8] dark:bg-[#1a1a1a] md:h-56">
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

          <div className="relative px-6 pb-8 pt-0 md:px-10">
            <div className="relative -mt-12 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div className="flex flex-col items-start gap-4 md:flex-row md:items-end">
                <div className="relative h-24 w-24 overflow-hidden rounded-full border-4 shadow-card
                                bg-[#e8e8e8] border-white dark:bg-[#2a2a2a] dark:border-[#0a0a0a]">
                  {user.avatarUrl && (
                    <Image
                      src={user.avatarUrl}
                      alt={user.username}
                      fill
                      sizes="96px"
                      quality={80}
                      className="object-cover"
                      priority
                    />
                  )}
                </div>
                <div className="pb-2">
                  <h1 className="font-serif text-3xl text-black dark:text-white">
                    @{user.username}
                  </h1>
                  {user.bio && (
                    <p className="mt-2 max-w-lg font-serif text-sm leading-relaxed text-black/60 dark:text-white/50">
                      {user.bio}
                    </p>
                  )}
                  {user.location && (
                    <p className="mt-1 font-label text-xs uppercase tracking-widest text-black/40 dark:text-white/30">
                      {user.location}
                    </p>
                  )}
                </div>
              </div>

              <Link href="/download" className="btn-primary self-start md:self-end">
                在 App 中关注
              </Link>
            </div>

            <dl className="mt-8 grid grid-cols-3 gap-4 border-t pt-6 md:max-w-md
                           border-black/[0.06] dark:border-white/[0.08]">
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
