import { FadeImage } from "@/components/FadeImage";
import { VideoPlayer } from "@/components/VideoPlayer";
import { isVideoUrl } from "@/lib/media";
import { isRenderableImage } from "@/lib/isRenderableImage";

/**
 * Block-based article body renderer.
 *
 * ARTICLES posts (and any post authored in the block editor) store their body
 * as a JSON-encoded array of `ContentBlock`s in `Post.contentText`. Mirror of
 * `frontend/src/components/PostDetail/PostContentSection.tsx#parseContent` —
 * keep the block shape in sync with the mobile side.
 *
 * Shape example:
 *   [{ "id": "block_...", "type": "text",  "content": "..." },
 *    { "id": "block_...", "type": "image", "content": "https://.../a.jpg" },
 *    { "id": "block_...", "type": "video", "content": "https://.../b.mp4" }]
 *
 * Images and videos may both arrive as `type: "image"` with a video extension
 * in the URL (legacy drafts from before the `video` block type was added), so
 * we sniff the URL with `isVideoUrl` as a fallback.
 */

interface ContentBlock {
  id: string;
  type: "text" | "image" | "video";
  content: string;
}

export function parseArticleBlocks(raw: string | undefined | null): ContentBlock[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (
      Array.isArray(parsed) &&
      parsed.length > 0 &&
      parsed.every(
        (b) =>
          b &&
          typeof b === "object" &&
          typeof b.id === "string" &&
          typeof b.type === "string" &&
          typeof b.content === "string",
      )
    ) {
      return parsed as ContentBlock[];
    }
  } catch {
    // Not JSON — caller should fall back to plain-text rendering.
  }
  return null;
}

interface ArticleBodyProps {
  blocks: ContentBlock[];
  title?: string;
}

export function ArticleBody({ blocks, title }: ArticleBodyProps) {
  return (
    <div className="mt-10 space-y-6">
      {blocks.map((block, index) => {
        if (block.type === "text") {
          const text = block.content;
          if (!text.trim()) return null;
          return (
            <p
              key={block.id}
              className="whitespace-pre-wrap font-serif text-lg leading-relaxed text-black/80 dark:text-white/75"
            >
              {text}
            </p>
          );
        }

        const isVideo = block.type === "video" || isVideoUrl(block.content);
        // Skip image blocks with unrenderable srcs (e.g. leftover `file://`
        // URIs from a mobile draft) rather than letting them crash next/image.
        if (!isVideo && !isRenderableImage(block.content)) return null;
        const mediaLabel = `${title || "article"} media ${index + 1}`;

        return (
          <figure
            key={block.id}
            className="relative w-full overflow-hidden rounded bg-[#f0f0f0] dark:bg-[#1a1a1a]"
          >
            {isVideo ? (
              <VideoPlayer
                src={block.content}
                label={mediaLabel}
                className="h-auto w-full"
              />
            ) : (
              <FadeImage
                src={block.content}
                alt={mediaLabel}
                width={1600}
                height={2000}
                quality={90}
                className="h-auto w-full object-cover"
                sizes="(max-width: 768px) 100vw, 720px"
              />
            )}
          </figure>
        );
      })}
    </div>
  );
}
