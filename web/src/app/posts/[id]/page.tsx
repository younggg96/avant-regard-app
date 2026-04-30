import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { parseArticleBlocks } from "@/components/post/ArticleBody";
import { ApiError, getPost } from "@/lib/api";
import { isVideoUrl } from "@/lib/media";
import { isRenderableImage } from "@/lib/isRenderableImage";
import { getServerT } from "@/lib/i18n/server";
import { PostDetailView } from "./view";

export const revalidate = 60;

interface PageProps {
  params: { id: string };
}

const POST_TYPE_KEYS = new Set(["OUTFIT", "DAILY_SHARE", "ITEM_REVIEW", "ARTICLES"]);

function postTypeKey(postType?: string): string {
  return postType && POST_TYPE_KEYS.has(postType) ? `postTypes.${postType}` : "postTypes.default";
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const t = getServerT();
  try {
    const post = await getPost(params.id);
    const articleBlocks = parseArticleBlocks(post.contentText);
    const plainText = articleBlocks
      ? articleBlocks
          .filter((b) => b.type === "text")
          .map((b) => b.content)
          .join(" ")
          .trim()
      : post.contentText;
    const typeLabel = t(postTypeKey(post.postType));
    const description =
      plainText?.slice(0, 140) ||
      t("postDetail.metaDescFallback", { username: post.username, type: typeLabel });
    const ogImage = post.imageUrls?.find(
      (u) => !isVideoUrl(u) && isRenderableImage(u),
    );
    return {
      title:
        post.title ||
        t("postDetail.metaTitleTemplate", { username: post.username, type: typeLabel }),
      description,
      alternates: { canonical: `/posts/${post.id}` },
      openGraph: {
        type: "article",
        title: post.title,
        description,
        images: ogImage ? [{ url: ogImage }] : undefined,
      },
    };
  } catch {
    return { title: t("postDetail.fallbackTitle") };
  }
}

export default async function PostDetailPage({ params }: PageProps) {
  try {
    const post = await getPost(params.id);
    return <PostDetailView post={post} />;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
}
