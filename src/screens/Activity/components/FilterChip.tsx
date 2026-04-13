import React from "react";
import { Text, Pressable } from "../../../components/ui";
import { styles } from "../styles";

interface FilterChipProps {
  label: string;
  isActive: boolean;
  onPress: () => void;
}

export const FilterChip = ({ label, isActive, onPress }: FilterChipProps) => (
  <Pressable
    onPress={onPress}
    style={[styles.chip, isActive && styles.chipActive]}
  >
    <Text
      fontSize="$sm"
      fontWeight={isActive ? "$semibold" : "$normal"}
      color={isActive ? "$white" : "$gray400"}
    >
      {label}
    </Text>
  </Pressable>
);
