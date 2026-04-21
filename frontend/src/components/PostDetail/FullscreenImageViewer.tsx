import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Modal,
  View,
  FlatList,
  TouchableOpacity,
  StatusBar,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "../ui";
import { ZoomableImage } from "../ZoomableImage";
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
  // When the active image is zoomed, horizontal paging must be disabled
  // so single-finger pans move within the image instead of flipping the
  // page. Tracked by active index; pager re-enables automatically when
  // the user swipes to another image (which resets the zoom for the
  // incoming tile because each tile owns its own shared values).
  const [isZoomed, setIsZoomed] = useState(false);

  useEffect(() => {
    if (!visible) setIsZoomed(false);
  }, [visible]);

  // Scrolling to a new page implies leaving the zoomed tile behind. The
  // previous tile's zoom state is local and irrelevant now, so we clear
  // the pager lock.
  const handleIndexChange = useCallback(
    (newIndex: number) => {
      setIsZoomed(false);
      onIndexChange(newIndex);
    },
    [onIndexChange]
  );

  return (
    <Modal
      visible={visible}
      transparent={true}
      onRequestClose={onClose}
      animationType="fade"
    >
      <GestureHandlerRootView style={styles.fullscreenContainer}>
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
          scrollEnabled={!isZoomed}
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
            handleIndexChange(newIndex);
          }}
          renderItem={({ item }) => {
            if (isVideoUrl(item)) {
              return <FullscreenVideoPlayer uri={item} />;
            }
            return (
              <View style={styles.fullscreenImageWrapper}>
                <ZoomableImage
                  uri={item}
                  width={SCREEN_WIDTH}
                  height={SCREEN_HEIGHT}
                  onZoomChange={setIsZoomed}
                />
              </View>
            );
          }}
          keyExtractor={(item, index) => `fullscreen-${index}`}
        />
      </GestureHandlerRootView>
    </Modal>
  );
};
