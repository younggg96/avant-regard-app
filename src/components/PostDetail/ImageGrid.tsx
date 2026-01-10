import React from "react";
import { View, Image as RNImage } from "react-native";
import { Pressable } from "../ui";
import { styles } from "./styles";

interface ImageGridProps {
  images: string[];
  onOpenFullscreen: (index: number) => void;
}

export const ImageGrid: React.FC<ImageGridProps> = ({
  images,
  onOpenFullscreen,
}) => {
  if (images.length === 0) return null;

  return (
    <View style={styles.imageGrid}>
      {images.map((image, index) => (
        <Pressable
          key={index}
          style={styles.gridImageWrapper}
          onPress={() => onOpenFullscreen(index)}
        >
          <RNImage
            source={{ uri: image }}
            style={styles.gridImage}
            resizeMode="cover"
          />
        </Pressable>
      ))}
    </View>
  );
};
