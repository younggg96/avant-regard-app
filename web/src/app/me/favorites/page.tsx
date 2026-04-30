"use client";

import { useTranslation } from "react-i18next";
import { MyPostList } from "@/components/me/MyPostList";
import { postService } from "@/lib/services/post";

export default function MyFavoritesPage() {
  const { t } = useTranslation();
  return (
    <MyPostList
      title={t("me.myFavorites")}
      description={t("me.myFavoritesDesc")}
      emptyCopy={t("me.myFavoritesEmpty")}
      swrKey="my-favorites"
      fetcher={(userId) => postService.getFavoritePostsByUserId(userId)}
    />
  );
}
