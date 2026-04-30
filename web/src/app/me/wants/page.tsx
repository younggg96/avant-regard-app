"use client";

import { useTranslation } from "react-i18next";
import { MyPostList } from "@/components/me/MyPostList";
import { postService } from "@/lib/services/post";

export default function MyWantsPage() {
  const { t } = useTranslation();
  return (
    <MyPostList
      title={t("me.myWants")}
      description={t("me.myWantsDesc")}
      emptyCopy={t("me.myWantsEmpty")}
      swrKey="my-wants"
      fetcher={(userId) => postService.getWantedPostsByUserId(userId)}
    />
  );
}
