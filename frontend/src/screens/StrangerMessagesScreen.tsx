import React, { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  RefreshControl,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme";
import { Box, Text, ActionSheet } from "../components/ui";
import type { ActionSheetAction } from "../components/ui";
import ScreenHeader from "../components/ScreenHeader";
import { useChatStore } from "../store/chatStore";
import { Conversation } from "../services/chatService";
import { ConversationRow } from "./Interaction/components/ConversationRow";
import { isStrangerConversation } from "./Interaction/utils";

const StrangerMessagesScreen = () => {
  const navigation = useNavigation();
  const {
    conversations,
    loadConversations,
    removeConversation,
    removeConversationsBatch,
    toggleConversationRead,
    deletingConversationIds,
  } = useChatStore();

  const [refreshing, setRefreshing] = useState(false);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [sheetTitle, setSheetTitle] = useState("");
  const [sheetActions, setSheetActions] = useState<ActionSheetAction[]>([]);

  const [editMode, setEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const isDeleting = deletingConversationIds.size > 0;

  useFocusEffect(
    useCallback(() => {
      loadConversations();
    }, [])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadConversations();
    setRefreshing(false);
  }, []);

  const strangerConversations = useMemo(
    () =>
      [...conversations].filter(isStrangerConversation).sort((a, b) => {
        const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return tb - ta;
      }),
    [conversations]
  );

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === strangerConversations.length) return new Set();
      return new Set(strangerConversations.map((c) => c.id));
    });
  }, [strangerConversations]);

  const exitEditMode = useCallback(() => {
    setEditMode(false);
    setSelectedIds(new Set());
  }, []);

  const handleBatchDelete = useCallback(() => {
    if (selectedIds.size === 0) return;
    Alert.alert(
      "确认删除",
      `删除选中的 ${selectedIds.size} 个会话后将无法恢复`,
      [
        { text: "取消", style: "cancel" },
        {
          text: "删除",
          style: "destructive",
          onPress: async () => {
            try {
              await removeConversationsBatch([...selectedIds]);
              exitEditMode();
            } catch {
              Alert.alert("删除失败", "部分会话删除失败，请重试");
            }
          },
        },
      ]
    );
  }, [selectedIds, removeConversationsBatch, exitEditMode]);

  const handleConvPress = useCallback(
    (c: Conversation) => {
      if (editMode) {
        toggleSelect(c.id);
        return;
      }
      (navigation.navigate as any)("Chat", {
        conversationId: c.id,
        otherUserName: c.otherUser?.username || "聊天",
        otherUserAvatar: c.otherUser?.avatarUrl,
        otherUserId: c.otherUser?.userId,
      });
    },
    [navigation, editMode, toggleSelect]
  );

  const handleLongPress = useCallback(
    (c: Conversation) => {
      if (editMode) return;
      const readLabel = c.unreadCount > 0 ? "标记已读" : "标记未读";
      setSheetTitle(c.otherUser?.username || "会话");
      setSheetActions([
        {
          label: readLabel,
          onPress: () => toggleConversationRead(c.id),
        },
        {
          label: "删除会话",
          destructive: true,
          onPress: () => {
            Alert.alert("确认删除", "删除后将无法恢复聊天记录", [
              { text: "取消", style: "cancel" },
              {
                text: "删除",
                style: "destructive",
                onPress: () => removeConversation(c.id),
              },
            ]);
          },
        },
      ]);
      setSheetVisible(true);
    },
    [editMode, toggleConversationRead, removeConversation]
  );

  const renderItem = useCallback(
    ({ item }: { item: Conversation }) => {
      const isSelected = selectedIds.has(item.id);
      const itemDeleting = deletingConversationIds.has(item.id);

      return (
        <Box
          flexDirection="row"
          alignItems="center"
          opacity={itemDeleting ? 0.5 : 1}
        >
          {editMode && (
            <TouchableOpacity
              onPress={() => toggleSelect(item.id)}
              style={s.checkbox}
              activeOpacity={0.6}
            >
              <Ionicons
                name={isSelected ? "checkmark-circle" : "ellipse-outline"}
                size={24}
                color={isSelected ? theme.colors.black : theme.colors.gray200}
              />
            </TouchableOpacity>
          )}
          <Box flex={1}>
            <ConversationRow
              item={item}
              onPress={() => handleConvPress(item)}
              onLongPress={() => handleLongPress(item)}
            />
          </Box>
          {itemDeleting && (
            <ActivityIndicator
              size="small"
              color={theme.colors.gray300}
              style={s.rowSpinner}
            />
          )}
        </Box>
      );
    },
    [
      handleConvPress,
      handleLongPress,
      editMode,
      selectedIds,
      toggleSelect,
      deletingConversationIds,
    ]
  );

  const headerRight = useMemo(
    () =>
      strangerConversations.length > 0 ? (
        <TouchableOpacity
          onPress={editMode ? exitEditMode : () => setEditMode(true)}
          activeOpacity={0.6}
        >
          <Text fontSize="$sm" fontWeight="$medium" color="$black">
            {editMode ? "完成" : "管理"}
          </Text>
        </TouchableOpacity>
      ) : null,
    [editMode, exitEditMode, strangerConversations.length]
  );

  const allSelected =
    strangerConversations.length > 0 &&
    selectedIds.size === strangerConversations.length;

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.white }}
      edges={["top"]}
    >
      <ScreenHeader
        title="陌生人消息"
        showBackButton
        rightComponent={headerRight}
      />

      <FlatList
        data={strangerConversations}
        keyExtractor={(item) => `stranger-${item.id}`}
        renderItem={renderItem}
        ListEmptyComponent={
          <Box py={48} px="$lg" alignItems="center">
            <Ionicons
              name="person-outline"
              size={44}
              color={theme.colors.gray200}
            />
            <Text
              fontSize="$md"
              fontWeight="$semibold"
              color="$black"
              mt="$md"
              mb="$sm"
            >
              暂无陌生人消息
            </Text>
            <Text fontSize="$sm" color="$gray400" textAlign="center">
              来自未对话过的用户的消息将在这里显示
            </Text>
          </Box>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.black}
          />
        }
        showsVerticalScrollIndicator={false}
      />

      {editMode && (
        <Box
          flexDirection="row"
          alignItems="center"
          px="$lg"
          py="$md"
          borderTopWidth={StyleSheet.hairlineWidth}
          borderTopColor="$gray100"
          bg="$white"
        >
          <TouchableOpacity
            onPress={toggleSelectAll}
            style={s.selectAllBtn}
            activeOpacity={0.6}
          >
            <Ionicons
              name={allSelected ? "checkmark-circle" : "ellipse-outline"}
              size={22}
              color={allSelected ? theme.colors.black : theme.colors.gray200}
            />
            <Text
              fontSize="$sm"
              color="$black"
              ml={6}
              fontWeight={allSelected ? "$semibold" : "$normal"}
            >
              全选
            </Text>
          </TouchableOpacity>

          <Box flex={1} />

          <TouchableOpacity
            onPress={handleBatchDelete}
            disabled={selectedIds.size === 0 || isDeleting}
            activeOpacity={0.6}
            style={[
              s.deleteBtn,
              (selectedIds.size === 0 || isDeleting) && s.deleteBtnDisabled,
            ]}
          >
            {isDeleting ? (
              <ActivityIndicator size="small" color={theme.colors.white} />
            ) : (
              <Text
                fontSize="$sm"
                fontWeight="$semibold"
                color="$white"
              >
                删除{selectedIds.size > 0 ? `(${selectedIds.size})` : ""}
              </Text>
            )}
          </TouchableOpacity>
        </Box>
      )}

      {isDeleting && !editMode && (
        <Box
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          justifyContent="center"
          alignItems="center"
          pointerEvents="none"
        >
          <Box
            borderRadius={12}
            px={24}
            py={20}
            alignItems="center"
            style={{ backgroundColor: "rgba(0,0,0,0.75)" }}
          >
            <ActivityIndicator size="small" color="#fff" />
            <Text fontSize="$xs" color="$white" mt={8}>
              删除中...
            </Text>
          </Box>
        </Box>
      )}

      <ActionSheet
        visible={sheetVisible}
        title={sheetTitle}
        actions={sheetActions}
        onClose={() => setSheetVisible(false)}
      />
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  checkbox: {
    paddingLeft: 16,
    paddingRight: 4,
    paddingVertical: 12,
  },
  rowSpinner: {
    position: "absolute",
    right: 16,
  },
  selectAllBtn: {
    flexDirection: "row",
    alignItems: "center",
  },
  deleteBtn: {
    backgroundColor: theme.colors.error,
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    minWidth: 80,
    alignItems: "center",
  },
  deleteBtnDisabled: {
    opacity: 0.4,
  },
});

export default StrangerMessagesScreen;
