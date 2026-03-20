/**
 * 优化的图片组件
 * 使用 expo-image 提供更好的性能和缓存支持
 */

import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ActivityIndicator, Dimensions } from 'react-native';
import { Image, ImageProps, ImageSource } from 'expo-image';
import { theme } from '../../theme';
import { getOptimizedImageUrl, ImageSize, getAutoSizedUrl } from '../../utils/imageUtils';

interface OptimizedImageProps extends Omit<ImageProps, 'source' | 'contentFit'> {
  /** 图片URL */
  uri: string;
  /** 目标尺寸，如果不指定则根据容器宽度自动选择 */
  size?: ImageSize;
  /** 是否显示加载占位符 */
  showPlaceholder?: boolean;
  /** 是否启用懒加载（仅在视口内时加载） */
  lazy?: boolean;
  /** 占位符颜色 */
  placeholderColor?: string;
  /** 错误占位符颜色 */
  errorColor?: string;
  /** 图片适配方式，默认为 cover */
  contentFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scaleDown';
}

/**
 * 优化的图片组件
 * 
 * 特性：
 * - 使用 expo-image 提供更好的缓存和性能
 * - 支持图片尺寸优化
 * - 支持懒加载
 * - 自动显示加载状态
 */
export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  uri,
  size,
  showPlaceholder = true,
  lazy = false,
  placeholderColor = theme.colors.gray100,
  errorColor = theme.colors.gray200,
  contentFit = 'cover',
  style,
  ...props
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);

  // 根据容器宽度或指定尺寸生成优化URL
  const optimizedUri = React.useMemo(() => {
    if (!uri) return '';
    
    if (size) {
      return getOptimizedImageUrl(uri, size);
    }
    
    if (containerWidth > 0) {
      return getAutoSizedUrl(uri, containerWidth);
    }
    
    // 默认使用中等尺寸
    return getOptimizedImageUrl(uri, ImageSize.MEDIUM);
  }, [uri, size, containerWidth]);

  const handleLoadStart = useCallback(() => {
    setIsLoading(true);
    setHasError(false);
  }, []);

  const handleLoadEnd = useCallback(() => {
    setIsLoading(false);
  }, []);

  const handleError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
  }, []);

  const handleLayout = useCallback((event: any) => {
    const { width } = event.nativeEvent.layout;
    if (width > 0 && width !== containerWidth) {
      setContainerWidth(width);
    }
  }, [containerWidth]);

  // 构建图片源
  const imageSource: ImageSource = React.useMemo(() => {
    if (!optimizedUri) {
      return { uri: '' };
    }
    return { uri: optimizedUri };
  }, [optimizedUri]);

  return (
    <View 
      style={[styles.container, style]} 
      onLayout={handleLayout}
    >
      <Image
        source={imageSource}
        style={[StyleSheet.absoluteFill, styles.image]}
        contentFit={contentFit}
        transition={200}
        cachePolicy="memory-disk"
        priority={lazy ? 'low' : 'normal'}
        onLoadStart={handleLoadStart}
        onLoadEnd={handleLoadEnd}
        onError={handleError}
        {...props}
      />
      
      {/* 加载占位符 */}
      {showPlaceholder && isLoading && (
        <View style={[StyleSheet.absoluteFill, styles.placeholder]}>
          <ActivityIndicator 
            size="small" 
            color={theme.colors.gray400} 
          />
        </View>
      )}
      
      {/* 错误占位符 */}
      {hasError && (
        <View 
          style={[
            StyleSheet.absoluteFill, 
            styles.errorPlaceholder,
            { backgroundColor: errorColor }
          ]} 
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    backgroundColor: theme.colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default OptimizedImage;
