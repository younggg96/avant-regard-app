import React, { useRef } from "react";
import {
  Modal,
  View,
  FlatList,
  Image as RNImage,
  TouchableOpacity,
  StatusBar,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "../ui";
import { styles, SCREEN_WIDTH } from "./styles";

interface FullscreenImageViewerProps {
  visible: boolean;
  images: string[];
  currentIndex: number;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}

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

        {/* Image Counter */}
        <View style={styles.imageCounter}>
          <Text style={styles.imageCounterText}>
            {currentIndex + 1} / {images.length}
          </Text>
        </View>

        {/* Image Carousel */}
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
          renderItem={({ item }) => (
            <View style={styles.fullscreenImageWrapper}>
              <RNImage
                source={{ uri: item }}
                style={styles.fullscreenImage}
                resizeMode="contain"
              />
            </View>
          )}
          keyExtractor={(item, index) => `fullscreen-${index}`}
        />
      </View>
    </Modal>
  );
};
