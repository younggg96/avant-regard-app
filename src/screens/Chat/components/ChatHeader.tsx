import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../../theme";
import { Box, Pressable, HStack, VStack, ActionSheet } from "../../../components/ui";
import type { ActionSheetAction } from "../../../components/ui";
import { UserAvatar } from "../../../components/ui/UserAvatar";
import { moderationService } from "../../../services/moderationService";
import { Alert } from "../../../utils/Alert";
import { styles as chatStyles } from "../styles";

interface ChatHeaderProps {
  name: string;
  avatar?: string;
  otherUserId?: number;
  onBack: () => void;
  onProfile: () => void;
  onBlocked?: () => void;
}

export const ChatHeader = ({
  name,
  avatar,
  otherUserId,
  onBack,
  onProfile,
  onBlocked,
}: ChatHeaderProps) => {
  const [showMenu, setShowMenu] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [blocking, setBlocking] = useState(false);

  const handleBlock = async () => {
    if (!otherUserId || blocking) return;
    setBlocking(true);
    try {
      await moderationService.blockUser(otherUserId);
      setShowBlockConfirm(false);
      Alert.show(`已屏蔽 ${name}`);
      onBlocked?.();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "屏蔽失败";
      Alert.show(msg);
    } finally {
      setBlocking(false);
    }
  };

  const menuActions = useMemo<ActionSheetAction[]>(() => [
    {
      label: "查看资料",
      icon: <Ionicons name="person-outline" size={20} color={theme.colors.black} />,
      onPress: () => onProfile(),
    },
    {
      label: "屏蔽用户",
      icon: <Ionicons name="ban-outline" size={20} color={theme.colors.error} />,
      destructive: true,
      onPress: () => setShowBlockConfirm(true),
    },
  ], [onProfile]);

  return (
    <>
      <Box bg="$white" px="$md" py="$sm" borderBottomWidth={1} borderBottomColor="$gray100">
        <HStack alignItems="center" space="sm">
          <Pressable
            w={40}
            h={40}
            justifyContent="center"
            alignItems="center"
            onPress={onBack}
          >
            <Ionicons name="arrow-back" size={22} color={theme.colors.black} />
          </Pressable>

          <Pressable onPress={onProfile} style={chatStyles.headerUserInfo}>
            <HStack alignItems="center" space="sm">
              <UserAvatar uri={avatar} name={name} size={38} />
              <VStack>
                <Box>
                  <Text style={styles.headerName} numberOfLines={1}>
                    {name}
                  </Text>
                </Box>
              </VStack>
            </HStack>
          </Pressable>

          {otherUserId ? (
            <Pressable
              w={40}
              h={40}
              justifyContent="center"
              alignItems="center"
              onPress={() => setShowMenu(true)}
            >
              <Ionicons
                name="ellipsis-horizontal"
                size={20}
                color={theme.colors.black}
              />
            </Pressable>
          ) : null}
        </HStack>
      </Box>

      <ActionSheet
        visible={showMenu}
        actions={menuActions}
        onClose={() => setShowMenu(false)}
      />

      {/* Block Confirm Modal */}
      <Modal
        visible={showBlockConfirm}
        animationType="fade"
        transparent
        onRequestClose={() => setShowBlockConfirm(false)}
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmDialog}>
            <Ionicons
              name="ban-outline"
              size={44}
              color={theme.colors.error}
              style={{ alignSelf: "center", marginBottom: 12 }}
            />
            <Text style={styles.confirmTitle}>屏蔽 @{name}？</Text>
            <Text style={styles.confirmMessage}>
              屏蔽后，该用户的帖子和聊天消息将对你不可见，对方发送的消息也将被静默拒绝。你可以随时在设置中取消屏蔽。
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.confirmCancelBtn}
                onPress={() => setShowBlockConfirm(false)}
                disabled={blocking}
              >
                <Text style={styles.confirmCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBlockBtn, blocking && { opacity: 0.6 }]}
                onPress={handleBlock}
                disabled={blocking}
              >
                {blocking ? (
                  <ActivityIndicator size="small" color={theme.colors.white} />
                ) : (
                  <Text style={styles.confirmBlockText}>确认屏蔽</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  headerName: {
    ...theme.typography.body,
    fontWeight: "600",
    color: theme.colors.black,
  },
  confirmOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  confirmDialog: {
    backgroundColor: theme.colors.white,
    borderRadius: 16,
    padding: 24,
    width: "100%",
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: theme.colors.black,
    textAlign: "center",
    marginBottom: 8,
  },
  confirmMessage: {
    fontSize: 14,
    color: theme.colors.gray300,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  confirmActions: {
    flexDirection: "row",
    gap: 12,
  },
  confirmCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    alignItems: "center",
  },
  confirmCancelText: {
    fontSize: 15,
    fontWeight: "600",
    color: theme.colors.black,
  },
  confirmBlockBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: theme.colors.error,
    alignItems: "center",
  },
  confirmBlockText: {
    fontSize: 15,
    fontWeight: "600",
    color: theme.colors.white,
  },
});
