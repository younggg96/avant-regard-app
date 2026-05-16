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
 * Quality notes — covers have TWO independent failure paths to "pixelation
 * after using the app for a while", and we have to close BOTH:
 *
 *   1) Backend proxy resize + on-device disk cache (`SDImageCache`).
 *      We tried every shade of "transform-with-cache" first — FEED_CARD/MEDIUM
 *      over a backend Pillow proxy — and every variant eventually started
 *      serving 8x8-macroblock bitmaps to a fraction of users that survived
 *      app restart and only cleared on uninstall, i.e. baked into the
 *      on-device `SDImageCache` disk. Mitigation: default `size` to
 *      `ImageSize.ORIGINAL`, which short-circuits `getOptimizedImageUrl`
 *      and pulls the raw Storage URL directly. Cost: ~50KB → 1–5MB per
 *      cover download (Wi-Fi imperceptible, 4G noticeable on first feed
 *      paint, free on cache hit).
 *
 *   2) `expo-image`'s `allowDownscaling=true` + `SDImageCache` *memory* cache.
 *      `expo-image` runs `processImage` (iOS `ImageView.swift`) every time
 *      a load completes and uses `frame.size` *at that instant* as the
 *      resize target. Inside `MasonryFlashList` a recycled cell often
 *      completes its load while its bounds are still in a transient
 *      (smaller) state during recycling, which permanently bakes a
 *      low-resolution bitmap into `SDImageCache`'s memory cache. Once
 *      iOS evicts that entry and re-decodes from disk, the small version
 *      is still what gets reinserted (the processed-image cache key
 *      includes the post-resize size). Visually this is the "feed covers
 *      gradually pixelate the longer the app session runs" bug.
 *      Mitigation: pass `allowDownscaling={false}` to `OptimizedImage`
 *      so the original bitmap is what's cached; the GPU does fit-to-cell
 *      minification with trilinear sampling on every paint (set in
 *      `ImageView.commonInit`), which never leaves a low-res copy behind.
 *      Memory cost is bounded because the original asset is already in
 *      a reasonable resolution from the uploader.
 *
 * Removing EITHER guard reproduces pixelation — they cover different
 * failure modes. (1) is about the *bytes* on disk being wrong; (2) is
 * about a correctly-decoded bitmap getting re-resized and the small
 * version winning eviction races. Both have historically been hit.
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
      allowDownscaling={false}
    />
  );
};

export const PostCoverMedia = React.memo(PostCoverMediaInner);
PostCoverMedia.displayName = "PostCoverMedia";

export default PostCoverMedia;
