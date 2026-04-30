import { getFeed } from "@/lib/api";
import type { Post } from "@/lib/types";
import { HomeView } from "./HomeView";

export const revalidate = 60;

async function loadLatestPosts(): Promise<Post[]> {
  try {
    const feed = await getFeed({ limit: 12 });
    return feed.items
      .filter((item) => item.type === "post")
      .map((item) => item.data as Post)
      .slice(0, 8);
  } catch {
    return [];
  }
}

export default async function LandingPage() {
  const posts = await loadLatestPosts();
  return <HomeView posts={posts} />;
}
