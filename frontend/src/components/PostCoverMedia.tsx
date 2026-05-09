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
 * Quality note (`allowDownscaling=false`):
 *   `expo-image` defaults to `allowDownscaling=true`, which permanently
 *   resizes the decoded bitmap to the container's `frame.size` at the
 *   instant `imageLoadCompleted` fires (see iOS `ImageView.swift` →
 *   `processImage`). Inside `MasonryFlashList`, recycled cells routinely
 *   complete loads while their bounds are still in a transient (smaller)
 *   state, baking a low-resolution bitmap into `SDWebImage`'s memory
 *   cache. Once iOS evicts that entry the resized version is what stays,
 *   so feed covers gradually pixelate the longer the app session runs.
 *   We disable downscaling here so the GPU's trilinear minification
 *   handles fit-to-cell instead, keeping covers crisp across recycles.
 *   Memory cost is bounded — covers are already served at 640–800 px by
 *   the proxy, so the per-bitmap overhead is on the order of tens of KB.
 */
const PostCoverMediaInner: React.FC<PostCoverMediaProps> = ({
  uri,
  style,
  size = ImageSize.MEDIUM,
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
