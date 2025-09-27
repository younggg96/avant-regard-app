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

interface HistoryItem {
  id: string;
  type: "look" | "designer" | "collection" | "article";
  title: string;
  subtitle?: string;
  image: string;
  timestamp: string;
  viewTime: string;
}

const HistoryScreen = () => {
  const navigation = useNavigation();
  const [refreshing, setRefreshing] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  // Mock history data grouped by date
  const [historyData] = useState<{ [key: string]: HistoryItem[] }>({
    今天: [
      {
        id: "1",
        type: "look",
        title: "春日优雅套装搭配",
        subtitle: "CHANEL 2024春夏",
        image: "https://via.placeholder.com/300x400",
        timestamp: "今天",
        viewTime: "14:30",
      },
      {
        id: "2",
        type: "designer",
        title: "Gabrielle Chanel",
        subtitle: "香奈儿创始人传记",
        image: "https://via.placeholder.com/300x300",
        timestamp: "今天",
        viewTime: "12:15",
      },
    ],
    昨天: [
      {
        id: "3",
        type: "collection",
        title: "2024春夏高级定制系列",
        subtitle: "Dior Haute Couture",
        image: "https://via.placeholder.com/300x200",
        timestamp: "昨天",
        viewTime: "19:45",
      },
      {
        id: "4",
        type: "article",
        title: "时尚趋势分析：可持续时尚的未来",
        subtitle: "深度解析",
        image: "https://via.placeholder.com/300x200",
        timestamp: "昨天",
        viewTime: "16:20",
      },
    ],
    本周: [
      {
        id: "5",
        type: "look",
        title: "街头休闲风造型",
        subtitle: "个人搭配分享",
        image: "https://via.placeholder.com/300x400",
        timestamp: "3天前",
        viewTime: "20:30",
      },
      {
        id: "6",
        type: "designer",
        title: "Karl Lagerfeld",
        subtitle: "时尚界传奇人物",
        image: "https://via.placeholder.com/300x300",
        timestamp: "5天前",
        viewTime: "15:10",
      },
    ],
  });

  const onRefresh = async () => {
    setRefreshing(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  const handleItemPress = (item: HistoryItem) => {
    if (isSelectionMode) {
      toggleItemSelection(item.id);
      return;
    }

    switch (item.type) {
      case "look":
        (navigation as any).navigate("LookDetail", {
          look: {
            id: item.id,
            title: item.title,
            image: item.image,
          },
        });
        break;
      case "designer":
        (navigation as any).navigate("DesignerDetail", {
          designerId: item.id,
          designerName: item.title,
        });
        break;
      case "collection":
        (navigation as any).navigate("CollectionDetail", {
          collectionId: item.id,
          collectionTitle: item.title,
        });
        break;
    }
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

  const handleClearSelected = () => {
    Alert.alert(
      "删除历史记录",
      `确定要删除选中的 ${selectedItems.size} 条记录吗？`,
      [
        { text: "取消", style: "cancel" },
        {
          text: "删除",
          style: "destructive",
          onPress: () => {
            // Here you would delete the selected items
            setSelectedItems(new Set());
            setIsSelectionMode(false);
            Alert.alert("删除成功", "选中的历史记录已删除");
          },
        },
      ]
    );
  };

  const handleClearAll = () => {
    Alert.alert("清空历史记录", "确定要清空所有浏览历史吗？此操作无法撤销。", [
      { text: "取消", style: "cancel" },
      {
        text: "清空",
        style: "destructive",
        onPress: () => {
          // Here you would clear all history
          Alert.alert("清空成功", "所有历史记录已清空");
        },
      },
    ]);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "look":
        return "shirt-outline";
      case "designer":
        return "person-outline";
      case "collection":
        return "albums-outline";
      case "article":
        return "document-text-outline";
      default:
        return "time-outline";
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "look":
        return "#10b981";
      case "designer":
        return "#3b82f6";
      case "collection":
        return "#f59e0b";
      case "article":
        return "#8b5cf6";
      default:
        return theme.colors.gray500;
    }
  };

  const renderHistoryItem = (item: HistoryItem) => {
    const isSelected = selectedItems.has(item.id);

    return (
      <TouchableOpacity
        key={item.id}
        style={[styles.historyItem, isSelected && styles.selectedItem]}
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

        <Image source={{ uri: item.image }} style={styles.itemImage} />
        <View style={styles.itemContent}>
          <View style={styles.itemHeader}>
            <View style={styles.itemTitleRow}>
              <Text style={styles.itemTitle} numberOfLines={2}>
                {item.title}
              </Text>
              <View
                style={[
                  styles.typeTag,
                  { backgroundColor: getTypeColor(item.type) },
                ]}
              >
                <Ionicons
                  name={getTypeIcon(item.type)}
                  size={12}
                  color={theme.colors.white}
                />
              </View>
            </View>
            {item.subtitle && (
              <Text style={styles.itemSubtitle} numberOfLines={1}>
                {item.subtitle}
              </Text>
            )}
          </View>
          <View style={styles.itemFooter}>
            <Text style={styles.itemTimestamp}>
              {item.timestamp} {item.viewTime}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderDateSection = (date: string, items: HistoryItem[]) => (
    <View key={date} style={styles.dateSection}>
      <Text style={styles.dateTitle}>{date}</Text>
      <View style={styles.itemsList}>{items.map(renderHistoryItem)}</View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="time-outline" size={64} color={theme.colors.gray300} />
      <Text style={styles.emptyTitle}>暂无浏览历史</Text>
      <Text style={styles.emptySubtitle}>开始探索精彩的时尚内容吧</Text>
      <TouchableOpacity
        style={styles.exploreButton}
        onPress={() => (navigation as any).navigate("Home")}
      >
        <Text style={styles.exploreButtonText}>去探索</Text>
      </TouchableOpacity>
    </View>
  );

  const totalItems = Object.values(historyData).flat().length;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader
        title="浏览历史"
        showBack={true}
        rightComponent={
          !isSelectionMode ? (
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => setIsSelectionMode(true)}
            >
              <Ionicons
                name="ellipsis-horizontal"
                size={20}
                color={theme.colors.black}
              />
            </TouchableOpacity>
          ) : (
            <View style={styles.selectionActions}>
              <TouchableOpacity
                style={styles.headerButton}
                onPress={() => {
                  setIsSelectionMode(false);
                  setSelectedItems(new Set());
                }}
              >
                <Text style={styles.cancelText}>取消</Text>
              </TouchableOpacity>
            </View>
          )
        }
      />

      {isSelectionMode && (
        <View style={styles.selectionBar}>
          <Text style={styles.selectionText}>
            已选择 {selectedItems.size} 项
          </Text>
          <View style={styles.selectionButtons}>
            <TouchableOpacity
              style={styles.selectionButton}
              onPress={handleClearSelected}
              disabled={selectedItems.size === 0}
            >
              <Text
                style={[
                  styles.selectionButtonText,
                  selectedItems.size === 0 && styles.disabledText,
                ]}
              >
                删除选中
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.selectionButton}
              onPress={handleClearAll}
            >
              <Text style={[styles.selectionButtonText, { color: "#ff4757" }]}>
                清空全部
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {totalItems > 0 ? (
          <View style={styles.historyList}>
            {Object.entries(historyData).map(([date, items]) =>
              renderDateSection(date, items)
            )}
          </View>
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
  cancelText: {
    fontSize: 16,
    fontFamily: __DEV__ ? "System" : "Inter-Medium",
    color: theme.colors.black,
  },
  selectionActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  selectionBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: theme.colors.gray100,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray100,
  },
  selectionText: {
    fontSize: 14,
    fontFamily: __DEV__ ? "System" : "Inter-Medium",
    color: theme.colors.gray600,
  },
  selectionButtons: {
    flexDirection: "row",
  },
  selectionButton: {
    marginLeft: 16,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  selectionButtonText: {
    fontSize: 14,
    fontFamily: __DEV__ ? "System" : "Inter-Medium",
    color: theme.colors.black,
  },
  disabledText: {
    color: theme.colors.gray400,
  },
  content: {
    flex: 1,
  },
  historyList: {
    padding: 20,
  },
  dateSection: {
    marginBottom: 24,
  },
  dateTitle: {
    fontSize: 18,
    fontFamily: __DEV__ ? "Georgia" : "PlayfairDisplay-Bold",
    color: theme.colors.black,
    marginBottom: 16,
  },
  itemsList: {
    gap: 12,
  },
  historyItem: {
    flexDirection: "row",
    backgroundColor: theme.colors.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.gray100,
    shadowColor: theme.colors.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  selectedItem: {
    borderColor: theme.colors.black,
    backgroundColor: theme.colors.gray100,
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
  itemImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: theme.colors.gray200,
  },
  itemContent: {
    flex: 1,
    marginLeft: 16,
    justifyContent: "space-between",
  },
  itemHeader: {
    flex: 1,
  },
  itemTitleRow: {
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
  itemSubtitle: {
    fontSize: 14,
    fontFamily: __DEV__ ? "System" : "Inter-Regular",
    color: theme.colors.gray500,
    marginBottom: 8,
  },
  typeTag: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  itemFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  itemTimestamp: {
    fontSize: 12,
    fontFamily: __DEV__ ? "System" : "Inter-Regular",
    color: theme.colors.gray400,
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
  exploreButton: {
    backgroundColor: theme.colors.black,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  exploreButtonText: {
    fontSize: 16,
    fontFamily: __DEV__ ? "System" : "Inter-Medium",
    color: theme.colors.white,
  },
});

export default HistoryScreen;
