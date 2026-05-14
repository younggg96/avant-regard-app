import React from "react";
import {
  Modal,
  FlatList,
  Dimensions,
  StyleSheet,
  GestureResponderEvent,
} from "react-native";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Box, Text, Pressable, HStack, Input, VStack } from "./ui";
import { OptimizedImage } from "./ui/OptimizedImage";
import { ImageSize } from "../utils/imageUtils";
import { theme, useThemedStyles, type AppTheme, useAppTheme } from "../theme";
import { Brand } from "../services/brandService";

const { width: screenWidth } = Dimensions.get("window");

interface BrandSelectorModalProps {
  visible: boolean;
  brands: Brand[];
  searchQuery: string;
  isLoading?: boolean;
  hasMore?: boolean;
  onSearchChange: (query: string) => void;
  onSearch: () => void;
  onSelectBrand: (brand: Brand) => void;
  onClose: () => void;
  onLoadMore?: () => void;
}

const BrandSelectorModal: React.FC<BrandSelectorModalProps> = ({
  visible,
  brands,
  searchQuery,
  isLoading = false,
  hasMore = false,
  onSearchChange,
  onSearch,
  onSelectBrand,
  onClose,
  onLoadMore,
}) => {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const brandWidth = (screenWidth - 48) / 2;
  const styles = useThemedStyles(makeStyles);

  const handleEndReached = () => {
    if (!isLoading && hasMore && onLoadMore) {
      onLoadMore();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
      transparent={true}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={styles.modalContent}
          onPress={(e: GestureResponderEvent) => e.stopPropagation()}
        >
          <Box style={styles.handleBar} />
          <SafeAreaView style={styles.container} edges={["bottom"]}>
            <Box
              px="$md"
              py="$sm"
              borderBottomWidth={1}
              style={[{ borderBottomColor: theme.colors.gray100 }, { backgroundColor: theme.colors.white }]}

            >
              <HStack alignItems="center" justifyContent="between" mb="$sm">
                <Text fontSize="$lg" style={{ color: theme.colors.black }} fontWeight="$medium">
                  {t("brandSelector.title")}
                </Text>
                <Pressable p="$xs" onPress={onClose}>
                  <Ionicons
                    name="close"
                    size={24}
                    color={theme.colors.gray600}
                  />
                </Pressable>
              </HStack>
              <HStack alignItems="center" gap="$sm">
                <Box flex={1}>
                  <Input
                    value={searchQuery}
                    onChangeText={onSearchChange}
                    onSubmitEditing={onSearch}
                    placeholder={t("brandSelector.searchPlaceholder")}
                    placeholderTextColor={theme.colors.gray400}
                    variant="outline"
                    returnKeyType="search"
                    sx={{
                      fontSize: 14,
                      height: 40,
                    }}
                  />
                </Box>
                <Pressable onPress={onSearch} px="$lg" h={40} style={{ backgroundColor: theme.colors.black }} rounded="$sm" justifyContent="center">
                  <Text style={{ color: theme.colors.white }} fontSize="$sm" fontWeight="$semibold">
                    {t("brandSelector.search")}
                  </Text>
                </Pressable>
              </HStack>
            </Box>

            <FlatList
              data={brands}
              keyExtractor={(item, index) => `${item.id}-${item.name}-${index}`}
              numColumns={2}
              contentContainerStyle={styles.listContent}
              columnWrapperStyle={styles.columnWrapper}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              onEndReached={handleEndReached}
              onEndReachedThreshold={0.5}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => onSelectBrand(item)}
                  style={[styles.brandItem, { width: brandWidth }]}
                >
                  <Box
                    style={[styles.brandImageContainer, { height: brandWidth * 0.8 }, { backgroundColor: theme.colors.gray100 }]}

                    rounded="$md"
                    alignItems="center"
                    justifyContent="center"
                    overflow="hidden"
                  >
                    {item.coverImage ? (
                      <OptimizedImage
                        uri={item.coverImage}
                        size={ImageSize.MEDIUM}
                        style={styles.brandImage}
                        contentFit="cover"
                        lazy={true}
                      />
                    ) : (
                      <Box
                        flex={1}
                        alignItems="center"
                        justifyContent="center"
                        w="100%"
                        h="100%"
                      >
                        <Text
                          fontSize="$xl"
                          fontWeight="$bold"
                          style={{ color: theme.colors.gray400 }}
                          textAlign="center"
                        >
                          {item.name.substring(0, 2).toUpperCase()}
                        </Text>
                      </Box>
                    )}
                  </Box>
                  <VStack mt="$xs" px="$xs">
                    <Text
                      fontSize="$sm"
                      style={{ color: theme.colors.black }}
                      fontWeight="$medium"
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                    {item.category && (
                      <Text fontSize="$xs" style={{ color: theme.colors.gray500 }} numberOfLines={1}>
                        {item.category}
                      </Text>
                    )}
                    {item.country && (
                      <Text fontSize={10} style={{ color: theme.colors.gray400 }} numberOfLines={1}>
                        {item.country}
                      </Text>
                    )}
                  </VStack>
                </Pressable>
              )}
              ListFooterComponent={
                isLoading && brands.length > 0 ? (
                  <Box py="$md" alignItems="center">
                    <Text style={{ color: theme.colors.gray400 }} fontSize="$sm">
                      {t("brandSelector.loading")}
                    </Text>
                  </Box>
                ) : null
              }
              ListEmptyComponent={
                <Box
                  flex={1}
                  alignItems="center"
                  justifyContent="center"
                  py="$xl"
                  minHeight={400}
                >
                  <Ionicons
                    name="pricetag-outline"
                    size={24}
                    color={theme.colors.gray300}
                  />
                  <Text style={{ color: theme.colors.gray400 }} mt="$md">
                    {isLoading ? t("brandSelector.loading") : t("brandSelector.noResults")}
                  </Text>
                </Box>
              }
            />
          </SafeAreaView>
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
    modalContent: {
      height: "85%",
      backgroundColor: t.colors.background,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      overflow: "hidden",
    },
    handleBar: {
      width: 40,
      height: 4,
      backgroundColor: t.colors.gray300,
      borderRadius: 2,
      alignSelf: "center",
      marginTop: 12,
      marginBottom: 8,
    },
    container: {
      flex: 1,
      backgroundColor: t.colors.background,
    },
    listContent: {
      padding: 12,
      paddingBottom: 24,
    },
    columnWrapper: {
      justifyContent: "space-between",
      paddingHorizontal: 6,
    },
    brandItem: {
      marginBottom: 16,
    },
    brandImageContainer: {
      width: "100%",
    },
    brandImage: {
      width: "100%",
      height: "100%",
      borderRadius: 8,
    },
  });

export default BrandSelectorModal;
