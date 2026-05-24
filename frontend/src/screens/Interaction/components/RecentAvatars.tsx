import React, { useCallback, useState } from "react";
import { StyleSheet, Alert, ScrollView as RNScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { Box, Text, Pressable } from "../../../components/ui";
import { UserAvatar } from "../../../components/ui/UserAvatar";
import { CustomerServiceAvatar } from "../../../components/ui/CustomerServiceAvatar";
import { Conversation, createConversation } from "../../../services/chatService";
import { theme, useThemedStyles, type AppTheme } from "../../../theme";
import { CS_USER_ID } from "../../../constants/customerService";
import { getConversationChatParams, getCustomerServiceChatParams } from "../../../utils/chatNavigationUtils";
import { isStrangerConversation } from "../utils";

const AVATAR_SIZE = 56;
const RING_SIZE = AVATAR_SIZE + 4;
const ITEM_WIDTH = 64;
const MAX_VISIBLE = 20;

interface RecentAvatarsProps {
  conversations: Conversation[];
}

export const RecentAvatars: React.FC<RecentAvatarsProps> = ({
  conversations,
}) => {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const [csLoading, setCsLoading] = useState(false);
  const styles = useThemedStyles(makeStyles);

  const recent = conversations
    .filter((c) => c.otherUser?.userId !== CS_USER_ID && !isStrangerConversation(c))
    .slice(0, MAX_VISIBLE);

  const handleConversationPress = useCallback(
    (c: Conversation) => {
      (navigation.navigate as any)("Chat", getConversationChatParams(c, t));
    },
    [navigation, t]
  );

  const handleCsPress = useCallback(async () => {
    if (csLoading) return;
    setCsLoading(true);
    try {
      const { conversationId } = await createConversation(CS_USER_ID);
      (navigation.navigate as any)(
        "Chat",
        getCustomerServiceChatParams(conversationId, CS_USER_ID, t),
      );
    } catch {
      Alert.alert(t("common.hint"), t("interaction.csUnavailable"));
    } finally {
      setCsLoading(false);
    }
  }, [navigation, csLoading, t]);

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
            <CustomerServiceAvatar size={AVATAR_SIZE} />
          </Box>
          <Text style={styles.name} numberOfLines={1}>
            {t("interaction.csLabel")}
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
                {other?.username || t("profile.user")}
              </Text>
            </Pressable>
          );
        })}

        <Pressable style={styles.item} onPress={handleAddPress}>
          <Box style={styles.addRing}>
            <Ionicons name="add" size={28} color={theme.colors.gray300} />
          </Box>
          <Text style={styles.name} numberOfLines={1}>
            {t("chat.searchUser")}
          </Text>
        </Pressable>
      </RNScrollView>
    </Box>
  );
};

const makeStyles = (t: AppTheme) => StyleSheet.create({
  wrapper: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.colors.border,
  },
  container: {
    paddingHorizontal: t.spacing.md,
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
    borderColor: t.colors.gray200,
    justifyContent: "center",
    alignItems: "center",
  },
  csRing: {
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 1,
    borderColor: t.colors.gray200,
    justifyContent: "center",
    alignItems: "center",
  },
  addRing: {
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 1,
    borderColor: t.colors.gray200,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
  },
  name: {
    marginTop: 6,
    fontSize: 11,
    color: t.colors.gray400,
    textAlign: "center",
    width: ITEM_WIDTH,
  },
});
