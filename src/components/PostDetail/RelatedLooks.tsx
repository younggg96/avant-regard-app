import React from "react";
import {
  View,
  ScrollView as RNScrollView,
  Image as RNImage,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Text, VStack } from "../ui";
import { Show } from "@/services/showService";
import { theme } from "../../theme";

interface RelatedShowsProps {
  shows: Show[];
  onShowPress: (show: Show) => void;
}

export const RelatedLooks: React.FC<RelatedShowsProps> = ({
  shows,
  onShowPress,
}) => {
  if (!shows || shows.length === 0) return null;

  return (
    <VStack
      px="$md"
      py="$md"
      space="md"
      borderTopWidth={1}
      borderTopColor="$gray100"
    >
      <Text
        fontFamily="PlayfairDisplay-Bold"
        fontSize={20}
        color="$black"
      >
        秀场
      </Text>
      <RNScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingRight: 16 }}
      >
        {shows.map((show, index) => (
          <TouchableOpacity
            key={`show-${show.id || index}`}
            style={styles.showCard}
            onPress={() => onShowPress(show)}
            activeOpacity={0.8}
          >
            <RNImage
              source={{ uri: show.coverImage }}
              style={styles.showImage}
              resizeMode="cover"
            />
            <LinearGradient
              colors={["transparent", "rgba(0,0,0,0.6)"]}
              style={styles.showGradient}
            />
            <View style={styles.showInfo}>
              <Text
                fontFamily="Inter-Bold"
                fontSize={14}
                color="$white"
                numberOfLines={1}
              >
                {show.brand}
              </Text>
              <Text
                fontFamily="Inter-Regular"
                fontSize={12}
                style={{ color: "rgba(255,255,255,0.8)", marginTop: 2 }}
                numberOfLines={1}
              >
                {show.season}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </RNScrollView>
    </VStack>
  );
};

const styles = StyleSheet.create({
  showCard: {
    width: 160,
    height: 200,
    borderRadius: 12,
    overflow: "hidden",
    marginRight: 12,
    position: "relative",
  },
  showImage: {
    width: "100%",
    height: "100%",
    backgroundColor: theme.colors.gray100,
  },
  showGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
  },
  showInfo: {
    position: "absolute",
    bottom: 12,
    left: 12,
    right: 12,
  },
});
