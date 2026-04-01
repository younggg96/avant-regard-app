import React from "react";
import { Box, Text, HStack } from "./ui";
import { theme } from "../theme";
import HalfStarRating from "./HalfStarRating";

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
      <HStack gap="$sm" pl="$md" alignItems="center">
        <HalfStarRating
          rating={rating}
          size={32}
          interactive
          onRatingChange={onRatingChange}
          color="#FFD700"
          inactiveColor={theme.colors.gray300}
          gap={8}
        />
        {rating > 0 && (
          <Text color="$gray400" fontSize="$sm" ml="$sm">
            {rating % 1 === 0 ? `${rating}.0` : rating.toFixed(1)}
          </Text>
        )}
      </HStack>
    </Box>
  );
};

export default RatingSelector;
