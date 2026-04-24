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
} from 'react-native';
import { Image, ImageProps, ImageSource } from 'expo-image';
import { theme } from '../../theme';
import { getOptimizedImageUrl, ImageSize } from '../../utils/imageUtils';

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
  placeholderColor = theme.colors.black,
  errorColor = theme.colors.gray200,
  contentFit = 'cover',
  hideLoadingLabel = false,
  style,
  ...props
}: OptimizedImageProps) => {
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
  const resolvedPriority: ImagePriority =
    priority ?? (lazy ? 'low' : 'normal');

  // Use the raw URI as the recycling key so expo-image can share the
  // decoded bitmap across different `size` presets (e.g. THUMBNAIL →
  // MEDIUM upgrade when the user opens the detail screen). Keying on the
  // transformed URL would make every size variant a cold cache miss.
  const recyclingKey = React.useMemo(() => uri || undefined, [uri]);

  // Reset load state when the underlying uri changes so recycled cells
  // show the spinner again instead of a stale "loaded" flag.
  React.useEffect(() => {
    if (showPlaceholder) {
      setIsLoaded(false);
    }
    setHasError(false);
  }, [optimizedUri, showPlaceholder]);

  const handleError = useCallback(() => {
    setHasError(true);
    setIsLoaded(true);
  }, []);

  const handleLoad = useCallback(() => {
    if (!showPlaceholder) return;
    setIsLoaded(true);
  }, [showPlaceholder]);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
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
        onError={handleError}
        onLoad={showPlaceholder ? handleLoad : undefined}
        recyclingKey={recyclingKey}
        {...props}
      />

      {showSpinner && (
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, styles.loadingOverlay]}
        >
          <ActivityIndicator size="small" color={theme.colors.gray300} />
          {showLabel && <Text style={styles.loadingText}>加载中…</Text>}
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

const styles = StyleSheet.create({
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
    color: theme.colors.gray300,
    letterSpacing: 0.3,
  },
  errorPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default OptimizedImage;
