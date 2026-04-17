import React, { useCallback } from "react";
import { View, GestureResponderEvent } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, HStack } from "./ui";

interface HalfStarRatingProps {
  rating: number;
  size?: number;
  color?: string;
  inactiveColor?: string;
  interactive?: boolean;
  onRatingChange?: (rating: number) => void;
  gap?: number;
}

const HalfStarRating: React.FC<HalfStarRatingProps> = ({
  rating,
  size = 16,
  color = "#FFD700",
  inactiveColor = "#D1D5DB",
  interactive = false,
  onRatingChange,
  gap = 2,
}) => {
  const handlePress = useCallback(
    (event: GestureResponderEvent, starIndex: number) => {
      if (!interactive || !onRatingChange) return;
      const { locationX } = event.nativeEvent;
      const halfWidth = size / 2;
      const newRating = locationX <= halfWidth ? starIndex - 0.5 : starIndex;
      onRatingChange(Math.max(0.5, newRating));
    },
    [interactive, onRatingChange, size]
  );

  const getStarIcon = (starPosition: number): "star" | "star-half" | "star-outline" => {
    if (rating >= starPosition) return "star";
    if (rating >= starPosition - 0.5) return "star-half";
    return "star-outline";
  };

  const getStarColor = (starPosition: number): string => {
    if (rating >= starPosition - 0.5) return color;
    return inactiveColor;
  };

  return (
    <HStack style={{ gap }}>
      {[1, 2, 3, 4, 5].map((star) =>
        interactive ? (
          <Pressable
            key={star}
            onPress={(e: GestureResponderEvent) => handlePress(e, star)}
            hitSlop={{ top: 8, bottom: 8, left: 2, right: 2 }}
          >
            <Ionicons
              name={getStarIcon(star)}
              size={size}
              color={getStarColor(star)}
            />
          </Pressable>
        ) : (
          <View key={star}>
            <Ionicons
              name={getStarIcon(star)}
              size={size}
              color={getStarColor(star)}
            />
          </View>
        )
      )}
    </HStack>
  );
};

export default HalfStarRating;
