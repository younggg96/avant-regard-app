import React from "react";
import { View, StyleProp, ViewStyle, ImageStyle } from "react-native";

import { OptimizedImage } from "./ui/OptimizedImage";
import { VideoThumbnailView } from "./VideoThumbnailView";
import { isVideoUrl } from "../services/postService";
import { ImageSize } from "../utils/imageUtils";

// Feed callers typically build a layout style object with `width`,
// `aspectRatio`, and `backgroundColor` — all valid in both ViewStyle and
// ImageStyle. Using the intersection keeps the prop permissive for both
// the `<View>` wrapper branch (video) and `<OptimizedImage>` branch.
type PostCoverStyle = StyleProp<ViewStyle & ImageStyle>;

interface PostCoverMediaProps {
  uri: string;
  style?: PostCoverStyle;
  size?: ImageSize;
  contentFit?: "cover" | "contain";
  showPlaceholder?: boolean;
  transition?: number;
  /**
   * Optional priority override. Leave undefined to keep the default
   * "normal" priority that's correct for feed covers. Set to "high" only
   * for single-cover, full-screen contexts (e.g. post detail hero).
   */
  priority?: "low" | "normal" | "high";
}

/**
 * Unified cover renderer for a post's first media URI.
 *
 * `OptimizedImage` cannot decode `.mp4` URIs, so feeds that rendered video
 * posts with it directly (BrandDetail posts grid, legacy screens, etc.)
 * ended up showing a gray placeholder. This component encapsulates the
 * image-vs-video branch so callers only deal with a single URI + style
 * and every feed shares the same video-thumbnail pipeline (with its
 * aspect-ratio cache).
 *
 * Priority note:
 *   Cover images are the primary visual payload of a feed card, so this
 *   component intentionally does NOT set `lazy={true}` on the underlying
 *   `OptimizedImage`. Earlier versions did, which made expo-image schedule
 *   covers behind avatars and icons — manifesting as a grid of gray
 *   placeholders while a single image loaded at a time. If a caller has
 *   an off-screen / low-priority use case, pass `priority="low"`
 *   explicitly rather than bringing back the `lazy` knob.
 *
 * Memoization:
 *   `React.memo` + shallow-equal props is the primary reason `PostCard` can
 *   prevent the expo-image layer from re-committing on every feed mutation.
 *   `style` must therefore be a stable reference at the call site
 *   (`PostCard.coverStyle` via `useMemo`); changing `style` identity per
 *   render would defeat this memo and re-enter `expo-image`'s reconciliation
 *   path for every card on screen during a scroll. Other props are
 *   primitives (uri / size / contentFit / priority / transition / showPlaceholder)
 *   so shallow-compare handles them correctly.
 *
 * Quality note (covers bypass the proxy):
 *   Post covers default to `ImageSize.ORIGINAL`, which short-circuits
 *   `getOptimizedImageUrl` and pulls the raw Storage URL directly. We
 *   tried every shade of "transform-with-cache" first — FEED_CARD/MEDIUM
 *   over a backend Pillow proxy — and every variant eventually started
 *   serving 8x8-macroblock bitmaps to a fraction of users that survived
 *   app restart and only cleared on uninstall, i.e. baked into the
 *   on-device `SDImageCache` disk. Going straight to the original
 *   uploaded asset removes the entire mutation surface (proxy resize +
 *   re-encode + disk-cached transformed bytes) and lets us trust the
 *   uploader's quality. `expo-image`'s default `allowDownscaling=true`
 *   does the only "shrink" step left, at GPU decode time, where the
 *   sampling math is lossless and disposable per-frame — it never
 *   leaves a low-res copy behind for SDWebImage to re-serve later.
 *   Cost: ~50KB → 1–5MB per cover download (Wi-Fi imperceptible, 4G
 *   noticeable on first feed paint, free on cache hit).
 */
const PostCoverMediaInner: React.FC<PostCoverMediaProps> = ({
  uri,
  style,
  size = ImageSize.ORIGINAL,
  contentFit = "cover",
  showPlaceholder = true,
  transition,
  priority,
}) => {
  if (isVideoUrl(uri)) {
    return (
      <View style={style as StyleProp<ViewStyle>}>
        <VideoThumbnailView
          uri={uri}
          style={{ width: "100%", height: "100%" }}
        />
      </View>
    );
  }

  return (
    <OptimizedImage
      uri={uri}
      size={size}
      style={style as StyleProp<ImageStyle>}
      contentFit={contentFit}
      showPlaceholder={showPlaceholder}
      transition={transition}
      priority={priority}
    />
  );
};

export const PostCoverMedia = React.memo(PostCoverMediaInner);
PostCoverMedia.displayName = "PostCoverMedia";

export default PostCoverMedia;
