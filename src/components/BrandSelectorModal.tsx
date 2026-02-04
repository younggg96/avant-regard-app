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
import { Brand } from "../services/brandService";

const { width: screenWidth } = Dimensions.get("window");

interface BrandSelectorModalProps {
  visible: boolean;
  brands: Brand[];
  searchQuery: string;
  isLoading?: boolean;
  hasMore?: boolean;
  onSearchChange: (query: string) => void;
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
  onSelectBrand,
  onClose,
  onLoadMore,
}) => {
  const brandWidth = (screenWidth - 48) / 2;

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
                  选择关联品牌
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
                placeholder="搜索品牌名称..."
                placeholderTextColor={theme.colors.gray400}
                variant="outline"
                sx={{
                  fontSize: 14,
                  height: 40,
                }}
              />
            </Box>

            <FlatList
              data={brands}
              keyExtractor={(item, index) => `${item.id}-${item.name}-${index}`}
              numColumns={2}
              contentContainerStyle={styles.listContent}
              columnWrapperStyle={styles.columnWrapper}
              showsVerticalScrollIndicator={false}
              onEndReached={handleEndReached}
              onEndReachedThreshold={0.5}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => onSelectBrand(item)}
                  style={[styles.brandItem, { width: brandWidth }]}
                >
                  <Box
                    style={[styles.brandImageContainer, { height: brandWidth * 0.8 }]}
                    bg="$gray100"
                    rounded="$md"
                    alignItems="center"
                    justifyContent="center"
                    overflow="hidden"
                  >
                    {item.coverImage ? (
                      <Image
                        source={{ uri: item.coverImage }}
                        style={styles.brandImage}
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
                          color="$gray400"
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
                      color="$black"
                      fontWeight="$medium"
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                    {item.category && (
                      <Text fontSize="$xs" color="$gray500" numberOfLines={1}>
                        {item.category}
                      </Text>
                    )}
                    {item.country && (
                      <Text fontSize={10} color="$gray400" numberOfLines={1}>
                        {item.country}
                      </Text>
                    )}
                  </VStack>
                </Pressable>
              )}
              ListFooterComponent={
                isLoading && brands.length > 0 ? (
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
                    name="pricetag-outline"
                    size={24}
                    color={theme.colors.gray300}
                  />
                  <Text color="$gray400" mt="$md">
                    {isLoading ? "加载中..." : "未找到相关品牌"}
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
