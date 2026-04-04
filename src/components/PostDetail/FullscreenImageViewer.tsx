import React, { useRef } from "react";
import { Modal, View, FlatList, TouchableOpacity, StatusBar } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "../ui";
import { OptimizedImage } from "../ui/OptimizedImage";
import { ImageSize } from "../../utils/imageUtils";
import { isVideoUrl } from "../../services/postService";
import { styles, SCREEN_WIDTH, SCREEN_HEIGHT } from "./styles";
import { VideoPlayer } from "./VideoPlayer";

interface FullscreenImageViewerProps {
  visible: boolean;
  images: string[];
  currentIndex: number;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}

const FullscreenVideoPlayer: React.FC<{ uri: string }> = ({ uri }) => (
  <VideoPlayer
    uri={uri}
    style={styles.fullscreenImageWrapper}
    videoStyle={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }}
    contentFit="contain"
    playIconSize={64}
  />
);

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
