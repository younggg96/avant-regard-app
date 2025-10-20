import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { Box, Text, HStack, Pressable } from "./ui";
import { theme } from "../theme";

interface RatingSelectorProps {
  rating: number;
  onRatingChange: (rating: number) => void;
  label?: string;
  required?: boolean;
}

const RatingSelector: React.FC<RatingSelectorProps> = ({
  rating,
  onRatingChange,
  label = "评分",
  required = false,
}) => {
  return (
    <Box mx="$md" mb="$md">
      <HStack mb="$sm" alignItems="center">
        <Text color="$gray600" fontSize="$sm">
          {label}
        </Text>
        {required && (
          <Text color="$red500" fontSize="$sm" ml="$xs">
            *
          </Text>
        )}
      </HStack>
      <HStack gap="$sm" pl="$md">
        {[1, 2, 3, 4, 5].map((star) => (
          <Pressable key={star} onPress={() => onRatingChange(star)}>
            <Ionicons
              name={star <= rating ? "star" : "star-outline"}
              size={32}
              color={star <= rating ? "#FFD700" : theme.colors.gray300}
            />
          </Pressable>
        ))}
      </HStack>
    </Box>
  );
};

export default RatingSelector;
