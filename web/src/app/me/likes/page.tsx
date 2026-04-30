"use client";

import { useTranslation } from "react-i18next";
import { MyPostList } from "@/components/me/MyPostList";
import { postService } from "@/lib/services/post";

export default function MyLikesPage() {
  const { t } = useTranslation();
  return (
    <MyPostList
      title={t("me.myLikes")}
      description={t("me.myLikesDesc")}
      emptyCopy={t("me.myLikesEmpty")}
      swrKey="my-likes"
      fetcher={(userId) => postService.getLikedPostsByUserId(userId)}
    />
  );
}
