"use client";

import { MyPostList } from "@/components/me/MyPostList";
import { postService } from "@/lib/services/post";

export default function MyWantsPage() {
  return (
    <MyPostList
      title="我的愿望单"
      description="标记为「想要」的物件，随时回来看。"
      emptyCopy="愿望单空空的——在帖子里点 ⤴ 就能加进来。"
      swrKey="my-wants"
      fetcher={(userId) => postService.getWantedPostsByUserId(userId)}
    />
  );
}
