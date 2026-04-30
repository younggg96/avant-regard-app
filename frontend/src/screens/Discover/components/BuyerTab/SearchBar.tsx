/**
 * 买手店 Tab 内的次级搜索框。
 *
 * 只做搜索入口：按下后走 DiscoverScreen 既有的 "Search" 路由（
 * 由 `DiscoverHeader` 复用），自身不持有 query / focus 状态，
 * 与顶部搜索框视觉区分只在于 placeholder 文案。
 */
import React from "react";
import { StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { HStack, Pressable, Text } from "../../../../components/ui";
import { theme } from "../../../../theme";

interface SearchBarProps {
  onPress: () => void;
  placeholder?: string;
}

const SearchBarImpl: React.FC<SearchBarProps> = ({
  onPress,
  placeholder,
}) => {
  const { t } = useTranslation();
  const displayPlaceholder = placeholder || t("discover.buyerSearchPlaceholder");

  return (
    <Pressable onPress={onPress} style={styles.container}>
      <HStack alignItems="center" flex={1} gap={6}>
        <Ionicons name="search" size={18} color={theme.colors.gray300} />
        <Text numberOfLines={1} style={styles.placeholder}>
          {displayPlaceholder}
        </Text>
      </HStack>
    </Pressable>
  );
};

export const SearchBar = React.memo(SearchBarImpl);

const styles = StyleSheet.create({
  container: {
    height: 40,
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 12,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: theme.colors.gray50,
    justifyContent: "center",
  },
  placeholder: {
    flex: 1,
    fontSize: 13,
    color: theme.colors.gray300,
  },
});

export default SearchBar;
