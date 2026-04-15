/**
 * Optimized image component using expo-image.
 * Minimizes state updates during scroll for better FlatList/FlashList perf.
 */

import React, { useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { Image, ImageProps, ImageSource } from 'expo-image';
import { theme } from '../../theme';
import { getOptimizedImageUrl, ImageSize } from '../../utils/imageUtils';

interface OptimizedImageProps extends Omit<ImageProps, 'source' | 'contentFit'> {
  uri: string;
  size?: ImageSize;
  showPlaceholder?: boolean;
  lazy?: boolean;
  placeholderColor?: string;
  errorColor?: string;
  contentFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scaleDown';
}

const blurhash = 'L6PZfSi_.AyE_3t7t7R**0o#DgR4';

const OptimizedImageInner = ({
  uri,
  size = ImageSize.MEDIUM,
  showPlaceholder = true,
  lazy = false,
  placeholderColor = theme.colors.gray100,
  errorColor = theme.colors.gray200,
  contentFit = 'cover',
  style,
  ...props
}: OptimizedImageProps) => {
  const [hasError, setHasError] = useState(false);

  const optimizedUri = React.useMemo(() => {
    if (!uri) return '';
    return getOptimizedImageUrl(uri, size);
  }, [uri, size]);

  const imageSource: ImageSource = React.useMemo(() => {
    if (!optimizedUri) return { uri: '' };
    return { uri: optimizedUri };
  }, [optimizedUri]);

  const handleError = useCallback(() => {
    setHasError(true);
  }, []);

  return (
    <View style={[styles.container, style]}>
      <Image
        source={imageSource}
        style={[StyleSheet.absoluteFill, styles.image]}
        contentFit={contentFit}
        transition={150}
        cachePolicy="memory-disk"
        priority={lazy ? 'low' : 'normal'}
        placeholder={{ blurhash }}
        placeholderContentFit="cover"
        onError={handleError}
        recyclingKey={optimizedUri}
        {...props}
      />

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
  errorPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default OptimizedImage;
