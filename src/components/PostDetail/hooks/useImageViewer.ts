import { useState, useCallback } from "react";

interface UseImageViewerReturn {
  fullscreenVisible: boolean;
  currentImageIndex: number;
  setCurrentImageIndex: (index: number) => void;
  handleOpenFullscreen: (index: number) => void;
  handleCloseFullscreen: () => void;
}

/**
 * 管理全屏图片查看器状态
 */
export const useImageViewer = (): UseImageViewerReturn => {
  const [fullscreenVisible, setFullscreenVisible] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // 处理打开全屏图片
  const handleOpenFullscreen = useCallback((index: number) => {
    setCurrentImageIndex(index);
    setFullscreenVisible(true);
  }, []);

  // 处理关闭全屏图片
  const handleCloseFullscreen = useCallback(() => {
    setFullscreenVisible(false);
  }, []);

  return {
    fullscreenVisible,
    currentImageIndex,
    setCurrentImageIndex,
    handleOpenFullscreen,
    handleCloseFullscreen,
  };
};
