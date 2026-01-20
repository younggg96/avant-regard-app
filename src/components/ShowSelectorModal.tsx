import React from "react";
import {
  Modal,
  FlatList,
  Dimensions,
  StyleSheet,
  GestureResponderEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Box, Text, Pressable, HStack, Input, Image, VStack } from "./ui";
import { theme } from "../theme";

const { width: screenWidth } = Dimensions.get("window");

export interface Show {
  brand: string;
  season: string;
  title: string;
  cover_image: string;
  show_url: string;
  year: number;
  category: string;
  show_id?: number;  // 数据库中的秀场 ID
}

interface ShowSelectorModalProps {
  visible: boolean;
  shows: Show[];
  searchQuery: string;
  isLoading?: boolean;
  hasMore?: boolean;
  onSearchChange: (query: string) => void;
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
  onSelectShow,
  onClose,
  onLoadMore,
}) => {
  const showWidth = (screenWidth - 48) / 2;

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
              borderBottomColor="$gray100"
              bg="$white"
            >
              <HStack alignItems="center" justifyContent="between" mb="$sm">
                <Text fontSize="$lg" color="$black" fontWeight="$medium">
                  选择相关秀场
                </Text>
                <Pressable p="$xs" onPress={onClose}>
                  <Ionicons
                    name="close"
                    size={24}
                    color={theme.colors.gray600}
                  />
                </Pressable>
              </HStack>
              <Input
                value={searchQuery}
                onChangeText={onSearchChange}
                placeholder="搜索设计师或季节..."
                placeholderTextColor={theme.colors.gray400}
                variant="outline"
                sx={{
                  fontSize: 14,
                  height: 40,
                }}
              />
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
              onEndReached={handleEndReached}
              onEndReachedThreshold={0.5}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => onSelectShow(item)}
                  style={[styles.showItem, { width: showWidth }]}
                >
                  <Image
                    source={{ uri: item.cover_image }}
                    style={[styles.showImage, { height: showWidth * 0.6 }]}
                  />
                  <VStack mt="$xs" px="$xs">
                    <Text
                      fontSize="$sm"
                      color="$black"
                      fontWeight="$medium"
                      numberOfLines={1}
                    >
                      {item.brand}
                    </Text>
                    <Text fontSize="$xs" color="$gray500" numberOfLines={1}>
                      {item.season}
                    </Text>
                    <Text fontSize={10} color="$gray400" numberOfLines={1}>
                      {item.category}
                    </Text>
                  </VStack>
                </Pressable>
              )}
              ListFooterComponent={
                isLoading && shows.length > 0 ? (
                  <Box py="$md" alignItems="center">
                    <Text color="$gray400" fontSize="$sm">
                      加载中...
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
                  <Text color="$gray400" mt="$md">
                    {isLoading ? "加载中..." : "未找到相关秀场"}
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

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    height: "85%",
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: theme.colors.gray300,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 8,
  },
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
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
