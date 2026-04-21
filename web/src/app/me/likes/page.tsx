"use client";

import { MyPostList } from "@/components/me/MyPostList";
import { postService } from "@/lib/services/post";

export default function MyLikesPage() {
  return (
    <MyPostList
      title="我的点赞"
      description="我点过赞的所有帖子，按最近互动排序。"
      emptyCopy="还没有点过赞的帖子——去 Discover 看看吧。"
      swrKey="my-likes"
      fetcher={(userId) => postService.getLikedPostsByUserId(userId)}
    />
  );
}
