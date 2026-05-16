/**
 * Optimized image component using expo-image.
 * Minimizes state updates during scroll for better FlatList/FlashList perf.
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Text,
  LayoutChangeEvent,
  PixelRatio,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Image, ImageProps, ImageSource, ImageLoadEventData } from 'expo-image';
import { theme, useThemedStyles, type AppTheme } from '../../theme';
import { getOptimizedImageUrl, ImageSize } from '../../utils/imageUtils';

/**
 * Diagnostic flag — set to `true` to print, in DEV builds only, the actual
 * decoded bitmap dimensions, cache type, and container size for every image
 * load. We use this to chase down "feed images gradually pixelate after
 * scrolling" — the logs let us tell apart:
 *   - bad bytes from the backend (loaded width far below container px)
 *   - SDWebImage memory cache returning a stale tiny variant (cacheType=memory
 *     paired with a small `width`)
 *   - container size briefly collapsing at recycle (`container` ≪ `loaded`)
 *
 * Default OFF so steady-state DEV logs aren't spammed; flip on while
 * reproducing the bug.
 */
const DEBUG_IMAGE_QUALITY = false;

type ImagePriority = 'low' | 'normal' | 'high';

interface OptimizedImageProps extends Omit<ImageProps, 'source' | 'contentFit' | 'priority'> {
  uri: string;
  size?: ImageSize;
  showPlaceholder?: boolean;
  /**
   * Hint for downloader scheduling.
   *
   * Historically this component derived `priority` from `lazy`, which
   * meant every caller that passed `lazy={true}` — including the primary
   * feed cover (`PostCoverMedia`) — got silently downgraded to `low`.
   * That produced the "gray placeholder storm" seen in the Discover
   * tab: the most visually important asset on screen was scheduled
   * after secondary UI chrome.
   *
   * We now separate the two concerns:
   *   `priority` controls the expo-image scheduler (download order).
   *   `lazy`     is purely an author hint for secondary assets (avatars,
   *              off-screen thumbnails). It only affects priority when
   *              no explicit `priority` prop is given, and even then it
   *              only lowers — it cannot accidentally escalate.
   */
  priority?: ImagePriority;
  lazy?: boolean;
  placeholderColor?: string;
  errorColor?: string;
  contentFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  /**
   * When true, suppresses the "加载中…" text even on large containers.
   * Useful for cases where the spinner alone is sufficient (e.g. full-
   * bleed hero media where text would compete with editorial content).
   */
  hideLoadingLabel?: boolean;
  /**
   * Forwarded to `expo-image`. Defaults to `true` (matching upstream) to
   * keep avatars / icons memory-frugal — the bitmap is permanently
   * resized to match the container's pixel size before being cached.
   *
   * Pass `false` for assets where quality must survive list recycling:
   * `expo-image` runs `processImage` (iOS `ImageView.swift`) every time a
   * load completes and uses `frame.size` *at that instant* as the resize
   * target. Inside `MasonryFlashList` the cell may finish loading while
   * its bounds are still in a transient (smaller) state during recycling,
   * which permanently bakes a low-resolution bitmap into `SDWebImage`'s
   * memory cache. Once iOS evicts and re-decodes that entry, the smaller
   * version is what stays — visually manifesting as the "feed images
   * gradually pixelate after using the app for a while" bug.
   *
   * Disabling downscaling lets the GPU minify the original bitmap with
   * `trilinear` filtering (set in `ImageView.commonInit`) on every paint
   * instead, so quality never drifts. Memory cost is bounded because we
   * already serve covers at width 640–800 px from the proxy.
   */
  allowDownscaling?: boolean;
}

// Any container shorter than this (in dp) renders spinner-only; the text
// would otherwise crowd small thumbnails (avatars, tag icons, etc).
const LOADING_LABEL_MIN_HEIGHT = 96;

const OptimizedImageInner = ({
  uri,
  size = ImageSize.MEDIUM,
  showPlaceholder = true,
  priority,
  lazy = false,
  // 之前默认是 `theme.colors.black`,但走 proxy 时:
  // light → #000000 (黑色) / dark → #FFFFFF (白色),会在两边都呈现高对比"硬"色块。
  // 改成 `skeleton` 给一个跟正文区一致的低对比加载底色,深浅模式下都不刺眼。
  placeholderColor = theme.colors.skeleton,
  errorColor = theme.colors.gray200,
  contentFit = 'cover',
  hideLoadingLabel = false,
  allowDownscaling = true,
  style,
  ...props
}: OptimizedImageProps) => {
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const containerHeightRef = useRef(0);

  const optimizedUri = React.useMemo(() => {
    if (!uri) return '';
    return getOptimizedImageUrl(uri, size);
  }, [uri, size]);

  const imageSource: ImageSource = React.useMemo(() => {
    if (!optimizedUri) return { uri: '' };
    return { uri: optimizedUri };
  }, [optimizedUri]);

  // Explicit `priority` wins; otherwise `lazy` degrades to `low`; default
  // is `normal`. This preserves the old "lazy⇒low" behaviour for callers
  // that never set `priority`, while letting feed covers opt into
  // `normal` / `high` without twiddling the misleading `lazy` flag.
  //
  // Memoized so the value identity is stable across scroll re-renders — not
  // because it's expensive to compute, but because several call sites pass
  // this down into further memoized children and we don't want priority's
  // identity to invalidate them.
  const resolvedPriority: ImagePriority = React.useMemo(
    () => priority ?? (lazy ? 'low' : 'normal'),
    [priority, lazy]
  );

  // Recycling key includes the size preset so a recycled FlashList cell
  // never re-uses a bitmap that was decoded against a different target
  // resolution — the previous implementation keyed on the raw `uri` only,
  // which let `SDWebImage` keep showing a stale, smaller bitmap after a
  // cell flipped from THUMBNAIL → FEED_CARD (or vice versa). Combined
  // with `allowDownscaling=false` on cover-sized callers this guarantees
  // the masonry feed never drifts to a low-res cached variant.
  const recyclingKey = React.useMemo(
    () => (uri ? `${uri}|${size}` : undefined),
    [uri, size]
  );

  // Reset load state when the underlying uri changes so recycled cells
  // show the spinner again instead of a stale "loaded" flag.
  //
  // `setHasError` uses a functional updater to stay a true no-op when the
  // state is already `false` — React will bail out without scheduling a
  // re-render. This matters during MasonryFlashList scroll where every
  // cell recycle hits this effect; the old unconditional `setHasError(false)`
  // was a write that React had to reconcile before bailing out.
  React.useEffect(() => {
    if (showPlaceholder) {
      setIsLoaded(false);
    }
    setHasError((prev) => (prev ? false : prev));
  }, [optimizedUri, showPlaceholder]);

  const handleError = useCallback(() => {
    setHasError(true);
    setIsLoaded(true);
  }, []);

  // Latest measured container width (in dp) — fed by `onLayout` and used
  // both to gate the loading-label and to calculate the px-vs-source ratio
  // in DEV diagnostics.
  const containerWidthRef = useRef(0);

  const handleLoad = useCallback(
    (event: ImageLoadEventData) => {
      if (__DEV__ && DEBUG_IMAGE_QUALITY && uri) {
        // Compare the actual decoded bitmap to the container's physical
        // pixel dimensions. A healthy ratio is `loaded / containerPx ≥ 1`.
        // Anything notably below 1 means the displayed bitmap is being
        // upscaled — the visible "pixelation" pattern.
        const dpr = PixelRatio.get();
        const containerPxW = Math.round(containerWidthRef.current * dpr);
        const containerPxH = Math.round(containerHeightRef.current * dpr);
        const loadedW = Math.round(event.source?.width ?? 0);
        const loadedH = Math.round(event.source?.height ?? 0);
        const ratio = containerPxW > 0 ? (loadedW / containerPxW).toFixed(2) : "?";
        const tag = uri.length > 60 ? `…${uri.slice(-50)}` : uri;
        // eslint-disable-next-line no-console
        console.log(
          `[OptimizedImage] size=${size} cache=${event.cacheType} ` +
            `loaded=${loadedW}×${loadedH} container=${containerPxW}×${containerPxH}px ` +
            `ratio=${ratio} uri=${tag}`
        );
      }
      if (!showPlaceholder) return;
      setIsLoaded(true);
    },
    [showPlaceholder, uri, size]
  );

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    containerWidthRef.current = event.nativeEvent.layout.width;
    containerHeightRef.current = event.nativeEvent.layout.height;
  }, []);

  const showSpinner = showPlaceholder && !isLoaded && !hasError && !!uri;
  const showLabel =
    showSpinner && !hideLoadingLabel && containerHeightRef.current >= LOADING_LABEL_MIN_HEIGHT;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: placeholderColor },
        style,
      ]}
      onLayout={handleLayout}
    >
      <Image
        source={imageSource}
        style={[StyleSheet.absoluteFill, styles.image]}
        contentFit={contentFit}
        transition={150}
        cachePolicy="memory-disk"
        priority={resolvedPriority}
        allowDownscaling={allowDownscaling}
        onError={handleError}
        // `onLoad` is always wired so the DEV diagnostic above runs even
        // for callers that disable the placeholder (e.g. Discover masonry
        // passes `showCoverPlaceholder={false}` to skip the spinner — but
        // we still need the load event to inspect decoded bitmap sizes).
        onLoad={handleLoad}
        recyclingKey={recyclingKey}
        {...props}
      />

      {showSpinner && (
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, styles.loadingOverlay]}
        >
          <ActivityIndicator size="small" color={theme.colors.gray300} />
          {showLabel && <Text style={styles.loadingText}>{t("common.loading")}</Text>}
        </View>
      )}

      {hasError && (
        <View
          style={[
            StyleSheet.absoluteFill,
            styles.errorPlaceholder,
            { backgroundColor: errorColor },
          ]}
        />
      )}
    </View>
  );
};

export const OptimizedImage = React.memo(OptimizedImageInner);
OptimizedImage.displayName = 'OptimizedImage';

const makeStyles = (t: AppTheme) => StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  loadingOverlay: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 6,
    fontSize: 12,
    color: t.colors.gray300,
    letterSpacing: 0.3,
  },
  errorPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default OptimizedImage;
