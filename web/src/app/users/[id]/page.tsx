import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PostCard } from "@/components/PostCard";
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

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
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
        <nav className="mb-10 text-sm text-ink/50">
          <Link href="/discover" className="link-muted">
            ← 返回 Discover
          </Link>
        </nav>

        <header className="overflow-hidden rounded-3xl border border-ink/5 bg-ink-100">
          <div className="relative h-40 w-full bg-ink-200 md:h-56">
            {user.coverUrl && (
              <Image
                src={user.coverUrl}
                alt={`${user.username} cover`}
                fill
                sizes="100vw"
                className="object-cover"
                priority
                unoptimized
              />
            )}
          </div>

          <div className="relative px-6 pb-8 pt-0 md:px-10">
            <div className="relative -mt-12 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div className="flex flex-col items-start gap-4 md:flex-row md:items-end">
                <div className="relative h-24 w-24 overflow-hidden rounded-full border-4 border-white bg-ink-200 shadow-card">
                  {user.avatarUrl && (
                    <Image
                      src={user.avatarUrl}
                      alt={user.username}
                      fill
                      sizes="96px"
                      className="object-cover"
                      unoptimized
                    />
                  )}
                </div>
                <div className="pb-2">
                  <h1 className="font-serif text-3xl">@{user.username}</h1>
                  {user.bio && (
                    <p className="mt-2 max-w-lg text-sm leading-relaxed text-ink/60">
                      {user.bio}
                    </p>
                  )}
                  {user.location && (
                    <p className="mt-1 text-xs uppercase tracking-widest text-ink/40">
                      {user.location}
                    </p>
                  )}
                </div>
              </div>

              <Link href="/download" className="btn-primary self-start md:self-end">
                在 App 中关注
              </Link>
            </div>

            <dl className="mt-8 grid grid-cols-3 gap-4 border-t border-ink/5 pt-6 md:max-w-md">
              <Stat label="帖子" value={formatCount(posts.length)} />
              <Stat label="关注者" value={formatCount(followerCount)} />
              <Stat label="关注中" value={formatCount(followingCount)} />
            </dl>
          </div>
        </header>

        <section className="mt-14">
          <h2 className="mb-8 font-serif text-2xl">发布</h2>
          {posts.length === 0 ? (
            <div className="rounded-xl border border-ink/10 bg-ink-100 p-8 text-sm text-ink/60">
              该用户还没有公开发布的内容。
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {posts.map((post, index) => (
                <PostCard key={post.id} post={post} priority={index < 4} />
              ))}
            </div>
          )}
        </section>
      </section>
    );
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      notFound();
    }
    throw err;
  }
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-serif text-2xl">{value}</div>
      <div className="text-xs uppercase tracking-widest text-ink/40">{label}</div>
    </div>
  );
}
