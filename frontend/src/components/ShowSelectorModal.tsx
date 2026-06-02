import React from "react";
import {
  Modal,
  FlatList,
  Dimensions,
  StyleSheet,
  GestureResponderEvent,
  TextInput,
} from "react-native";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Box, Text, Pressable, HStack, Input, VStack } from "./ui";
import { OptimizedImage } from "./ui/OptimizedImage";
import { ImageSize } from "../utils/imageUtils";
import { theme, useThemedStyles, type AppTheme, useAppTheme } from "../theme";
import KeyboardFriend from "./KeyboardFriend";

const { width: screenWidth } = Dimensions.get("window");

export interface Show {
  brand: string;
  season: string;
  title: string;
  cover_image: string;
  show_url: string;
  year: number;
  category: string;
  show_id?: number | string;  // 数据库中的秀场 ID (shows.id 为字符串 slug)
}

interface ShowSelectorModalProps {
  visible: boolean;
  shows: Show[];
  searchQuery: string;
  isLoading?: boolean;
  hasMore?: boolean;
  onSearchChange: (query: string) => void;
  onSearch: () => void;
  onSelectShow: (show: Show) => void;
  onClose: () => void;
  onLoadMore?: () => void;
}

const ShowSelectorModal: React.FC<ShowSelectorModalProps> = ({
  visible,
  shows,
  searchQuery,
  isLoading = false,
  hasMore = false,
  onSearchChange,
  onSearch,
  onSelectShow,
  onClose,
  onLoadMore,
}) => {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const showWidth = (screenWidth - 48) / 2;
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
        <KeyboardFriend mode="sheet" style={styles.modalContent}>
        <Pressable
          style={{ flex: 1 }}
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
                  {t("showSelector.title")}
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
                    placeholder={t("showSelector.searchPlaceholder")}
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
                    {t("showSelector.search")}
                  </Text>
                </Pressable>
              </HStack>
            </Box>

            <FlatList
              data={shows}
              keyExtractor={(item, index) =>
                `${item.brand}-${item.season}-${index}`
              }
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
                  onPress={() => onSelectShow(item)}
                  style={[styles.showItem, { width: showWidth }]}
                >
                  <OptimizedImage
                    uri={item.cover_image}
                    size={ImageSize.MEDIUM}
                    style={[styles.showImage, { height: showWidth * 1.4 }]}
                    contentFit="cover"
                    lazy={true}
                  />
                  <VStack mt="$xs" px="$xs">
                    <Text
                      fontSize="$sm"
                      style={{ color: theme.colors.black }}
                      fontWeight="$medium"
                      numberOfLines={1}
                    >
                      {item.brand}
                    </Text>
                    <Text fontSize="$xs" style={{ color: theme.colors.gray500 }} numberOfLines={1}>
                      {item.season}
                    </Text>
                    <Text fontSize={10} style={{ color: theme.colors.gray400 }} numberOfLines={1}>
                      {item.category}
                    </Text>
                  </VStack>
                </Pressable>
              )}
              ListFooterComponent={
                isLoading && shows.length > 0 ? (
                  <Box py="$md" alignItems="center">
                    <Text style={{ color: theme.colors.gray400 }} fontSize="$sm">
                      {t("showSelector.loading")}
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
                    name="albums-outline"
                    size={24}
                    color={theme.colors.gray300}
                  />
                  <Text style={{ color: theme.colors.gray400 }} mt="$md">
                    {isLoading ? t("showSelector.loading") : t("showSelector.noResults")}
                  </Text>
                </Box>
              }
            />
          </SafeAreaView>
        </Pressable>
        </KeyboardFriend>
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
    showItem: {
      marginBottom: 16,
    },
    showImage: {
      width: "100%",
      borderRadius: 8,
    },
  });

export default ShowSelectorModal;
