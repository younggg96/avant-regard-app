import React from "react";
import {
  View,
  ScrollView as RNScrollView,
  Image as RNImage,
} from "react-native";
import { Text, Pressable, VStack } from "../ui";
import { ShowImageInfo } from "../PostCard";
import { styles } from "./styles";

interface RelatedLooksProps {
  showImages: ShowImageInfo[];
  onLookPress: (showImage: ShowImageInfo) => void;
}

export const RelatedLooks: React.FC<RelatedLooksProps> = ({
  showImages,
  onLookPress,
}) => {
  if (!showImages || showImages.length === 0) return null;

  return (
    <VStack
      px="$md"
      py="$md"
      space="md"
      borderTopWidth={1}
      borderTopColor="$gray100"
    >
      <Text fontSize="$lg" fontWeight="$semibold" color="$black">
        关联秀场
      </Text>
      <RNScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingRight: 16 }}
      >
        {showImages.map((showImage, index) => (
          <Pressable
            key={`show-image-${showImage.id || index}`}
            style={styles.showImageCard}
            onPress={() => onLookPress(showImage)}
          >
            <RNImage
              source={{ uri: showImage.imageUrl }}
              style={styles.showImagePhoto}
              resizeMode="cover"
            />
            <View style={styles.showImageInfo}>
              <Text
                fontSize="$xs"
                fontWeight="$medium"
                color="$black"
                numberOfLines={1}
              >
                {showImage.designerName || "设计师"}
              </Text>
              <Text fontSize={10} color="$gray500" numberOfLines={1}>
                {showImage.season || ""}
              </Text>
            </View>
          </Pressable>
        ))}
      </RNScrollView>
    </VStack>
  );
};
