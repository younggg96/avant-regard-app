import React, { useCallback } from "react";
import { View, Text, FlatList, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../theme";
import ScreenHeader from "../../components/ScreenHeader";
import { useChatStore } from "../../store/chatStore";
import { Conversation } from "../../services/chatService";
import { ConversationItem } from "./components/ConversationItem";
import { styles } from "./styles";

const ChatListScreen = () => {
  const navigation = useNavigation();
  const {
    conversations,
    isLoadingConversations,
    loadConversations,
    connectWebSocket,
    disconnectWebSocket,
  } = useChatStore();
  const [refreshing, setRefreshing] = React.useState(false);

  React.useEffect(() => {
    connectWebSocket();
    return () => {
      disconnectWebSocket();
    };
  }, []);

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

  const handleConversationPress = (conversation: Conversation) => {
    (navigation.navigate as any)("Chat", {
      conversationId: conversation.id,
      otherUserName: conversation.otherUser?.username || "聊天",
      otherUserAvatar: conversation.otherUser?.avatarUrl,
      otherUserId: conversation.otherUser?.userId,
    });
  };

  const renderEmpty = () => (
    <View style={styles.emptyState}>
      <Ionicons
        name="chatbubbles-outline"
        size={48}
        color={theme.colors.gray200}
      />
      <Text style={styles.emptyTitle}>暂无对话</Text>
      <Text style={styles.emptyText}>
        在用户主页点击"发消息"开始聊天
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScreenHeader title="消息" showBackButton={true} />

      <FlatList
        data={conversations}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <ConversationItem
            conversation={item}
            onPress={() => handleConversationPress(item)}
          />
        )}
        ListEmptyComponent={
          isLoadingConversations ? null : renderEmpty()
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.black}
          />
        }
        contentContainerStyle={
          conversations.length === 0 ? styles.emptyContainer : undefined
        }
      />
    </SafeAreaView>
  );
};

export default ChatListScreen;
