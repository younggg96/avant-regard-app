import React from "react";
import {
  StyleSheet,
  Modal,
  TouchableOpacity,
} from "react-native";
import { Box, Text, Pressable, HStack } from "../../../components/ui";
import { theme } from "../../../theme";

interface CategoryFilter {
  label: string;
  value: string;
}

interface CategoryFilterModalProps {
  visible: boolean;
  onClose: () => void;
  filters: CategoryFilter[];
  selectedValue: string;
  onSelect: (value: string) => void;
}

const CategoryFilterModal: React.FC<CategoryFilterModalProps> = ({
  visible,
  onClose,
  filters,
  selectedValue,
  onSelect,
}) => {
  const hasActive = selectedValue !== "all";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e: any) => e.stopPropagation()}>
          <Box style={styles.handle} />
          <Text style={styles.title}>筛选类别</Text>

          <HStack style={styles.grid}>
            {filters.map((filter) => (
              <TouchableOpacity
                key={filter.value}
                style={[
                  styles.chip,
                  selectedValue === filter.value && styles.chipActive,
                ]}
                onPress={() => {
                  onSelect(filter.value);
                  onClose();
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.chipText,
                    selectedValue === filter.value && styles.chipTextActive,
                  ]}
                >
                  {filter.label}
                </Text>
              </TouchableOpacity>
            ))}
          </HStack>

          {hasActive && (
            <TouchableOpacity
              style={styles.resetButton}
              onPress={() => {
                onSelect("all");
                onClose();
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.resetText}>重置筛选</Text>
            </TouchableOpacity>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 40,
    maxHeight: "70%",
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.gray200,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 20,
  },
  title: {
    fontSize: 17,
    fontWeight: "600",
    color: theme.colors.black,
    marginBottom: 16,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: theme.colors.gray50,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
  },
  chipActive: {
    backgroundColor: theme.colors.black,
    borderColor: theme.colors.black,
  },
  chipText: {
    fontSize: 14,
    color: theme.colors.gray600,
  },
  chipTextActive: {
    color: theme.colors.white,
    fontWeight: "600",
  },
  resetButton: {
    marginTop: 20,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    alignItems: "center",
  },
  resetText: {
    fontSize: 14,
    color: theme.colors.gray500,
    fontWeight: "500",
  },
});

export default CategoryFilterModal;
