import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Image,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme";
import ScreenHeader from "../components/ScreenHeader";

interface DraftItem {
  id: string;
  type: "lookbook" | "outfit" | "review" | "article";
  title: string;
  content?: string;
  images: string[];
  lastModified: string;
}

const DraftsScreen = () => {
  const navigation = useNavigation();
  const [refreshing, setRefreshing] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  // Mock drafts data
  const [drafts] = useState<DraftItem[]>([
    {
      id: "1",
      type: "lookbook",
      title: "春季搭配指南",
      content: "探索春季时尚趋势，分享实用的搭配技巧...",
      images: [
        "https://via.placeholder.com/300x400",
        "https://via.placeholder.com/300x400",
      ],
      lastModified: "2小时前",
    },
    {
      id: "2",
      type: "outfit",
      title: "周末休闲装",
      content: "舒适又时尚的周末穿搭分享",
      images: ["https://via.placeholder.com/300x400"],
      lastModified: "昨天",
    },
    {
      id: "3",
      type: "review",
      title: "CHANEL 新款包包评测",
      content: "详细评测这款备受瞩目的新品...",
      images: ["https://via.placeholder.com/300x200"],
      lastModified: "3天前",
    },
    {
      id: "4",
      type: "article",
      title: "可持续时尚的未来",
      content: "深入探讨时尚行业的可持续发展...",
      images: [],
      lastModified: "1周前",
    },
  ]);

  const onRefresh = async () => {
    setRefreshing(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  const handleItemPress = (item: DraftItem) => {
    if (isSelectionMode) {
      toggleItemSelection(item.id);
      return;
    }

    // Navigate to publish screen with draft data
    (navigation as any).navigate("Publish", {
      draftId: item.id,
      draftData: item,
    });
  };

  const toggleItemSelection = (itemId: string) => {
    const newSelection = new Set(selectedItems);
    if (newSelection.has(itemId)) {
      newSelection.delete(itemId);
    } else {
      newSelection.add(itemId);
    }
    setSelectedItems(newSelection);
  };

  const handleDeleteSelected = () => {
    Alert.alert(
      "删除草稿",
      `确定要删除选中的 ${selectedItems.size} 个草稿吗？`,
      [
        { text: "取消", style: "cancel" },
        {
          text: "删除",
          style: "destructive",
          onPress: () => {
            // Here you would delete the selected drafts
            setSelectedItems(new Set());
            setIsSelectionMode(false);
            Alert.alert("删除成功", "选中的草稿已删除");
          },
        },
      ]
    );
  };

  const getTypeInfo = (type: string) => {
    switch (type) {
      case "lookbook":
        return {
          label: "Lookbook",
          icon: "albums-outline",
          color: "#10b981",
        };
      case "outfit":
        return {
          label: "搭配分享",
          icon: "shirt-outline",
          color: "#3b82f6",
        };
      case "review":
        return {
          label: "单品评测",
          icon: "star-outline",
          color: "#f59e0b",
        };
      case "article":
        return {
          label: "时尚文章",
          icon: "document-text-outline",
          color: "#8b5cf6",
        };
      default:
        return {
          label: "草稿",
          icon: "document-outline",
          color: theme.colors.gray500,
        };
    }
  };

  const renderDraftItem = (item: DraftItem) => {
    const isSelected = selectedItems.has(item.id);
    const typeInfo = getTypeInfo(item.type);

    return (
      <TouchableOpacity
        key={item.id}
        style={[styles.draftItem, isSelected && styles.selectedItem]}
        onPress={() => handleItemPress(item)}
        onLongPress={() => {
          if (!isSelectionMode) {
            setIsSelectionMode(true);
            toggleItemSelection(item.id);
          }
        }}
      >
        {isSelectionMode && (
          <View style={styles.selectionContainer}>
            <View style={[styles.checkbox, isSelected && styles.checkedBox]}>
              {isSelected && (
                <Ionicons
                  name="checkmark"
                  size={16}
                  color={theme.colors.white}
                />
              )}
            </View>
          </View>
        )}

        <View style={styles.itemContent}>
          <View style={styles.itemHeader}>
            <View style={styles.titleRow}>
              <Text style={styles.itemTitle} numberOfLines={2}>
                {item.title}
              </Text>
            </View>
            <Text style={styles.typeLabel}>{typeInfo.label}</Text>

            {item.content && (
              <Text style={styles.itemDescription} numberOfLines={2}>
                {item.content}
              </Text>
            )}
          </View>

          <View style={styles.itemFooter}>
            <Text style={styles.lastModified}>{item.lastModified}</Text>
          </View>
        </View>

        {item.images.length > 0 && (
          <View style={styles.imagePreview}>
            <Image
              source={{ uri: item.images[0] }}
              style={styles.previewImage}
            />
            {item.images.length > 1 && (
              <View style={styles.imageCount}>
                <Text style={styles.imageCountText}>
                  +{item.images.length - 1}
                </Text>
              </View>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons
        name="document-outline"
        size={64}
        color={theme.colors.gray300}
      />
      <Text style={styles.emptyTitle}>暂无草稿</Text>
      <Text style={styles.emptySubtitle}>开始创作您的时尚内容吧</Text>
      <TouchableOpacity
        style={styles.createButton}
        onPress={() => (navigation as any).navigate("Publish")}
      >
        <Text style={styles.createButtonText}>开始创作</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader
        title="我的草稿"
        showBack={true}
        rightComponent={
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setIsSelectionMode(!isSelectionMode)}
          >
            <Ionicons
              name="ellipsis-horizontal"
              size={20}
              color={theme.colors.black}
            />
          </TouchableOpacity>
        }
      />

      {isSelectionMode && (
        <View style={styles.selectionBar}>
          <Text style={styles.selectionText}>
            已选择 {selectedItems.size} 个草稿
          </Text>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDeleteSelected}
            disabled={selectedItems.size === 0}
          >
            <Text
              style={[
                styles.deleteButtonText,
                selectedItems.size === 0 && styles.disabledText,
              ]}
            >
              删除
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {drafts.length > 0 ? (
          <View style={styles.draftsList}>{drafts.map(renderDraftItem)}</View>
        ) : (
          renderEmptyState()
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  headerButton: {
    padding: 8,
  },
  selectionBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: theme.colors.gray50,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray100,
  },
  selectionText: {
    fontSize: 14,
    fontFamily: __DEV__ ? "System" : "Inter-Medium",
    color: theme.colors.gray600,
  },
  deleteButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  deleteButtonText: {
    fontSize: 14,
    fontFamily: __DEV__ ? "System" : "Inter-Medium",
    color: "#ff4757",
  },
  disabledText: {
    color: theme.colors.gray400,
  },
  content: {
    flex: 1,
  },
  draftsList: {
    padding: 20,
  },
  draftItem: {
    flexDirection: "row",
    backgroundColor: theme.colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.gray100,
  },
  selectedItem: {
    borderColor: theme.colors.black,
    backgroundColor: theme.colors.gray50,
  },
  selectionContainer: {
    marginRight: 12,
    justifyContent: "center",
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: theme.colors.gray300,
    alignItems: "center",
    justifyContent: "center",
  },
  checkedBox: {
    backgroundColor: theme.colors.black,
    borderColor: theme.colors.black,
  },
  itemContent: {
    flex: 1,
    marginRight: 12,
  },
  itemHeader: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  itemTitle: {
    fontSize: 16,
    fontFamily: __DEV__ ? "System" : "Inter-Medium",
    color: theme.colors.black,
    flex: 1,
    marginRight: 8,
  },
  typeTag: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  typeLabel: {
    fontSize: 12,
    fontFamily: __DEV__ ? "System" : "Inter-Medium",
    color: theme.colors.gray500,
    marginBottom: 6,
  },
  itemDescription: {
    fontSize: 14,
    fontFamily: __DEV__ ? "System" : "Inter-Regular",
    color: theme.colors.gray600,
    lineHeight: 20,
  },
  itemFooter: {
    marginTop: "auto",
    paddingTop: 8,
  },
  lastModified: {
    fontSize: 12,
    fontFamily: __DEV__ ? "System" : "Inter-Regular",
    color: theme.colors.gray400,
  },
  imagePreview: {
    position: "relative",
  },
  previewImage: {
    width: 60,
    height: 80,
    borderRadius: 8,
    backgroundColor: theme.colors.gray200,
  },
  imageCount: {
    position: "absolute",
    bottom: 4,
    right: 4,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  imageCountText: {
    fontSize: 10,
    fontFamily: __DEV__ ? "System" : "Inter-Medium",
    color: theme.colors.white,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    paddingVertical: 80,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: __DEV__ ? "Georgia" : "PlayfairDisplay-Bold",
    color: theme.colors.black,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    fontFamily: __DEV__ ? "System" : "Inter-Regular",
    color: theme.colors.gray500,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 24,
  },
  createButton: {
    backgroundColor: theme.colors.black,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createButtonText: {
    fontSize: 16,
    fontFamily: __DEV__ ? "System" : "Inter-Medium",
    color: theme.colors.white,
  },
});

export default DraftsScreen;
