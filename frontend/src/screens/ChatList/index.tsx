import React, { useCallback } from "react";
import { View, Text, FlatList, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../theme";
import ScreenHeader from "../../components/ScreenHeader";
import { useChatStore } from "../../store/chatStore";
import { Conversation } from "../../services/chatService";
import { ConversationItem } from "./components/ConversationItem";
import { getConversationChatParams } from "../../utils/chatNavigationUtils";
import { useChatListStyles } from "./styles";

const ChatListScreen = () => {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const styles = useChatListStyles();
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
    (navigation.navigate as any)("Chat", getConversationChatParams(conversation, t));
  };

  const renderEmpty = () => (
    <View style={styles.emptyState}>
      <Ionicons
        name="chatbubbles-outline"
        size={48}
        color={theme.colors.gray200}
      />
      <Text style={styles.emptyTitle}>{t('chat.noMessages')}</Text>
      <Text style={styles.emptyText}>
        {t('interaction.startChatHint')}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScreenHeader title={t('interaction.title')} showBackButton={true} />

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
