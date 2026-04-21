"use client";

import { MyPostList } from "@/components/me/MyPostList";
import { postService } from "@/lib/services/post";

export default function MyFavoritesPage() {
  return (
    <MyPostList
      title="我的收藏"
      description="我收藏的帖子，作为个人 Archive。"
      emptyCopy="还没有收藏——打开一篇帖子，点击 ✦ 把它加入你的 Archive。"
      swrKey="my-favorites"
      fetcher={(userId) => postService.getFavoritePostsByUserId(userId)}
    />
  );
}
