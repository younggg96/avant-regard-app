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

interface Look {
  designer: string;
  season: string;
  imageUrl: string;
}

interface LookSelectorModalProps {
  visible: boolean;
  looks: Look[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSelectLook: (look: Look) => void;
  onClose: () => void;
}

const LookSelectorModal: React.FC<LookSelectorModalProps> = ({
  visible,
  looks,
  searchQuery,
  onSearchChange,
  onSelectLook,
  onClose,
}) => {
  const lookWidth = (screenWidth - 48) / 3;

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
                  选择相关造型
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
                placeholder="搜索设计师或系列..."
                placeholderTextColor={theme.colors.gray400}
                variant="outline"
                sx={{
                  fontSize: 14,
                  height: 40,
                }}
              />
            </Box>

            <FlatList
              data={looks}
              keyExtractor={(item, index) =>
                `${item.designer}-${item.season}-${index}`
              }
              numColumns={3}
              contentContainerStyle={styles.listContent}
              columnWrapperStyle={styles.columnWrapper}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => onSelectLook(item)}
                  style={[styles.lookItem, { width: lookWidth }]}
                >
                  <Image
                    source={{ uri: item.imageUrl }}
                    style={[styles.lookImage, { height: lookWidth * 1.5 }]}
                  />
                  <VStack mt="$xs" px="$xs">
                    <Text
                      fontSize="$xs"
                      color="$black"
                      fontWeight="$medium"
                      numberOfLines={1}
                    >
                      {item.designer}
                    </Text>
                    <Text fontSize={10} color="$gray400" numberOfLines={1}>
                      {item.season}
                    </Text>
                  </VStack>
                </Pressable>
              )}
              ListEmptyComponent={
                <Box
                  flex={1}
                  alignItems="center"
                  justifyContent="center"
                  py="$xl"
                  minHeight={400}
                >
                  <Ionicons
                    name="search-outline"
                    size={48}
                    color={theme.colors.gray300}
                  />
                  <Text color="$gray400" mt="$md">
                    {searchQuery ? "未找到相关造型" : "加载中..."}
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
  lookItem: {
    marginBottom: 16,
  },
  lookImage: {
    width: "100%",
    borderRadius: 8,
  },
});

export default LookSelectorModal;
