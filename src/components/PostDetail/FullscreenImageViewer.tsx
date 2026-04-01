import React, { useRef, useState, useCallback } from "react";
import {
  Modal,
  View,
  FlatList,
  TouchableOpacity,
  StatusBar,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Video, ResizeMode, AVPlaybackStatus } from "expo-av";
import { Text } from "../ui";
import { OptimizedImage } from "../ui/OptimizedImage";
import { ImageSize } from "../../utils/imageUtils";
import { isVideoUrl } from "../../services/postService";
import { styles, SCREEN_WIDTH, SCREEN_HEIGHT } from "./styles";

interface FullscreenImageViewerProps {
  visible: boolean;
  images: string[];
  currentIndex: number;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}

const FullscreenVideoPlayer: React.FC<{ uri: string }> = ({ uri }) => {
  const videoRef = useRef<Video>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const handlePress = useCallback(() => {
    if (isPlaying) {
      videoRef.current?.pauseAsync();
    } else {
      videoRef.current?.playAsync();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const onPlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setIsPlaying(status.isPlaying);
    }
  }, []);

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={handlePress}
      style={styles.fullscreenImageWrapper}
    >
      <Video
        ref={videoRef}
        source={{ uri }}
        style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }}
        resizeMode={ResizeMode.CONTAIN}
        shouldPlay={false}
        isLooping
        isMuted={false}
        onPlaybackStatusUpdate={onPlaybackStatusUpdate}
      />
      {!isPlaying && (
        <View style={localStyles.playOverlay}>
          <Ionicons name="play-circle" size={64} color="rgba(255,255,255,0.85)" />
        </View>
      )}
    </TouchableOpacity>
  );
};

export const FullscreenImageViewer: React.FC<FullscreenImageViewerProps> = ({
  visible,
  images,
  currentIndex,
  onClose,
  onIndexChange,
}) => {
  const flatListRef = useRef<FlatList>(null);

  return (
    <Modal
      visible={visible}
      transparent={true}
      onRequestClose={onClose}
      animationType="fade"
    >
      <View style={styles.fullscreenContainer}>
        <StatusBar hidden />

        {/* Close Button */}
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Ionicons name="close" size={30} color="#fff" />
        </TouchableOpacity>

        {/* Counter */}
        <View style={styles.imageCounter}>
          <Text style={styles.imageCounterText}>
            {currentIndex + 1} / {images.length}
          </Text>
        </View>

        {/* Media Carousel */}
        <FlatList
          ref={flatListRef}
          data={images}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={currentIndex}
          getItemLayout={(data, index) => ({
            length: SCREEN_WIDTH,
            offset: SCREEN_WIDTH * index,
            index,
          })}
          onMomentumScrollEnd={(event) => {
            const newIndex = Math.round(
              event.nativeEvent.contentOffset.x / SCREEN_WIDTH
            );
            onIndexChange(newIndex);
          }}
          renderItem={({ item }) => {
            if (isVideoUrl(item)) {
              return <FullscreenVideoPlayer uri={item} />;
            }
            return (
              <View style={styles.fullscreenImageWrapper}>
                <OptimizedImage
                  uri={item}
                  size={ImageSize.ORIGINAL}
                  style={styles.fullscreenImage}
                  contentFit="contain"
                  lazy={true}
                />
              </View>
            );
          }}
          keyExtractor={(item, index) => `fullscreen-${index}`}
        />
      </View>
    </Modal>
  );
};

const localStyles = StyleSheet.create({
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
});
