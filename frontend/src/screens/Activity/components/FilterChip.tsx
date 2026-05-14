import React from "react";
import { Text, Pressable } from "../../../components/ui";
import { styles } from "../styles";
import { useAppTheme } from "../../../theme";

interface FilterChipProps {
  label: string;
  isActive: boolean;
  onPress: () => void;
}

export const FilterChip = ({ label, isActive, onPress }: FilterChipProps) => {
  const theme = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, isActive && styles.chipActive]}
    >
      <Text
        fontSize="$sm"
        fontWeight={isActive ? "$semibold" : "$normal"}
        style={{ color: isActive ? theme.colors.white : theme.colors.gray400 }}
      >
        {label}
      </Text>
    </Pressable>
  );
};
