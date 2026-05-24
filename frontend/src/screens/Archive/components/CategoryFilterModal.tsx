import React from "react";
import {
  StyleSheet,
  Modal,
  TouchableOpacity,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { Box, Text, Pressable, AnimatedChip, chipRowStyle } from "../../../components/ui";
import { useThemedStyles, type AppTheme } from "../../../theme";

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
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);
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
          <Text style={styles.title}>{t("archive.filterCategory")}</Text>

          <View style={chipRowStyle}>
            {filters.map((filter) => (
              <AnimatedChip
                key={filter.value}
                label={filter.label}
                isActive={selectedValue === filter.value}
                onPress={() => {
                  onSelect(filter.value);
                  onClose();
                }}
              />
            ))}
          </View>

          {hasActive && (
            <TouchableOpacity
              style={styles.resetButton}
              onPress={() => {
                onSelect("all");
                onClose();
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.resetText}>{t("archive.resetFilter")}</Text>
            </TouchableOpacity>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: t.colors.overlay,
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: t.colors.card,
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
      backgroundColor: t.colors.gray200,
      alignSelf: "center",
      marginTop: 12,
      marginBottom: 20,
    },
    title: {
      fontSize: 17,
      fontWeight: "600",
      color: t.colors.text,
      marginBottom: 16,
    },
    resetButton: {
      marginTop: 20,
      paddingVertical: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: t.colors.gray200,
      alignItems: "center",
    },
    resetText: {
      fontSize: 14,
      color: t.colors.gray500,
      fontWeight: "500",
    },
  });

export default CategoryFilterModal;
