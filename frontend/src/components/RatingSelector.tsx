import React from "react";
import { useTranslation } from "react-i18next";
import { Box, Text, HStack } from "./ui";
import { theme, useAppTheme } from "../theme";
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
  label,
  required = false,
}) => {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const displayLabel = label || t("ratingSelector.rating");
  return (
    <Box mb="$md">
      <HStack mb="$sm" alignItems="center">
        <Text style={{ color: theme.colors.gray600 }} fontSize="$sm">
          {displayLabel}
        </Text>
        {required && (
          <Text style={{ color: theme.colors.error }} fontSize="$sm" ml="$xs">
            *
          </Text>
        )}
      </HStack>
      <HStack gap="$sm" alignItems="center">
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
          <Text style={{ color: theme.colors.gray400 }} fontSize="$sm" ml="$sm">
            {rating % 1 === 0 ? `${rating}.0` : rating.toFixed(1)}
          </Text>
        )}
      </HStack>
    </Box>
  );
};

export default RatingSelector;
