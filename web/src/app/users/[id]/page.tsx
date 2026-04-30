import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  ApiError,
  getUserFollowerCount,
  getUserFollowingCount,
  getUserInfo,
  getUserLevel,
  getUserPosts,
} from "@/lib/api";
import { isRenderableImage } from "@/lib/isRenderableImage";
import { getServerT } from "@/lib/i18n/server";
import { UserProfileView } from "./view";

export const revalidate = 120;

interface PageProps {
  params: { id: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const t = getServerT();
  try {
    const user = await getUserInfo(params.id);
    return {
      title: `@${user.username}`,
      description: user.bio || t("userProfile.metaDescTemplate", { username: user.username }),
      alternates: { canonical: `/users/${user.userId}` },
      openGraph: {
        type: "profile",
        title: t("userProfile.ogTitleTemplate", { username: user.username }),
        description: user.bio || undefined,
        images: isRenderableImage(user.avatarUrl)
          ? [{ url: user.avatarUrl! }]
          : undefined,
      },
    };
  } catch {
    return { title: t("userProfile.fallbackTitle") };
  }
}

export default async function UserProfilePage({ params }: PageProps) {
  try {
    const [user, posts, followerCount, followingCount, currentLevel] =
      await Promise.all([
        getUserInfo(params.id),
        getUserPosts(params.id).catch(() => []),
        getUserFollowerCount(params.id).catch(() => 0),
        getUserFollowingCount(params.id).catch(() => 0),
        getUserLevel(params.id).catch(() => 0),
      ]);

    return (
      <UserProfileView
        user={user}
        posts={posts}
        followerCount={followerCount}
        followingCount={followingCount}
        currentLevel={currentLevel}
      />
    );
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
}
