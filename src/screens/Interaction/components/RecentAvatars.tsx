import React, { useCallback, useState } from "react";
import { StyleSheet, Alert, ScrollView as RNScrollView } from "react-native";
import { Image as ExpoImage } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { Box, Text, Pressable } from "../../../components/ui";
import { UserAvatar } from "../../../components/ui/UserAvatar";
import { Conversation, createConversation } from "../../../services/chatService";
import { theme } from "../../../theme";
import { CS_USER_ID, CS_DISPLAY_NAME } from "../constants";
import { isStrangerConversation } from "../utils";

const AVATAR_SIZE = 56;
const RING_SIZE = AVATAR_SIZE + 4;
const ITEM_WIDTH = 64;
const MAX_VISIBLE = 20;

const APP_LOGO = require("../../../../assets/images/logo.jpg");

interface RecentAvatarsProps {
  conversations: Conversation[];
}

export const RecentAvatars: React.FC<RecentAvatarsProps> = ({
  conversations,
}) => {
  const navigation = useNavigation();
  const [csLoading, setCsLoading] = useState(false);

  const recent = conversations
    .filter((c) => c.otherUser?.userId !== CS_USER_ID && !isStrangerConversation(c))
    .slice(0, MAX_VISIBLE);

  const handleConversationPress = useCallback(
    (c: Conversation) => {
      (navigation.navigate as any)("Chat", {
        conversationId: c.id,
        otherUserName: c.otherUser?.username || "聊天",
        otherUserAvatar: c.otherUser?.avatarUrl,
        otherUserId: c.otherUser?.userId,
      });
    },
    [navigation]
  );

  const handleCsPress = useCallback(async () => {
    if (csLoading) return;
    setCsLoading(true);
    try {
      const { conversationId } = await createConversation(CS_USER_ID);
      (navigation.navigate as any)("Chat", {
        conversationId,
        otherUserName: CS_DISPLAY_NAME,
        otherUserId: CS_USER_ID,
      });
    } catch {
      Alert.alert("提示", "无法连接客服，请稍后再试");
    } finally {
      setCsLoading(false);
    }
  }, [navigation, csLoading]);

  const handleAddPress = useCallback(() => {
    (navigation.navigate as any)("Search", { allowedTypes: ["users"] });
  }, [navigation]);

  return (
    <Box style={styles.wrapper}>
      <RNScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.container}
      >
        <Pressable style={styles.item} onPress={handleCsPress}>
          <Box style={styles.csRing}>
            <ExpoImage
              source={APP_LOGO}
              style={styles.csAvatar}
              contentFit="cover"
            />
          </Box>
          <Text style={styles.name} numberOfLines={1}>
            客服
          </Text>
        </Pressable>

        {recent.map((c) => {
          const other = c.otherUser;
          return (
            <Pressable
              key={c.id}
              style={styles.item}
              onPress={() => handleConversationPress(c)}
            >
              <Box style={styles.avatarRing}>
                <UserAvatar
                  uri={other?.avatarUrl}
                  name={other?.username}
                  size={AVATAR_SIZE}
                />
              </Box>
              <Text style={styles.name} numberOfLines={1}>
                {other?.username || "用户"}
              </Text>
            </Pressable>
          );
        })}

        <Pressable style={styles.item} onPress={handleAddPress}>
          <Box style={styles.addRing}>
            <Ionicons name="add" size={28} color={theme.colors.gray300} />
          </Box>
          <Text style={styles.name} numberOfLines={1}>
            搜索用户
          </Text>
        </Pressable>
      </RNScrollView>
    </Box>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.gray100,
  },
  container: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    gap: 14,
  },
  item: {
    alignItems: "center",
    width: ITEM_WIDTH,
  },
  avatarRing: {
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    justifyContent: "center",
    alignItems: "center",
  },
  csRing: {
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    justifyContent: "center",
    alignItems: "center",
  },
  csAvatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
  },
  addRing: {
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
  },
  name: {
    marginTop: 6,
    fontSize: 11,
    color: theme.colors.gray400,
    textAlign: "center",
    width: ITEM_WIDTH,
  },
});
