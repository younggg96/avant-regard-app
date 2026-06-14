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
import { useTranslation } from "react-i18next";
import { theme, useThemedStyles, type AppTheme, useAppTheme } from "../../../theme";
import { Box, Pressable, HStack, VStack, ActionSheet } from "../../../components/ui";
import type { ActionSheetAction } from "../../../components/ui";
import { UserAvatar } from "../../../components/ui/UserAvatar";
import { CustomerServiceAvatar } from "../../../components/ui/CustomerServiceAvatar";
import { isCustomerServiceUser } from "../../../constants/customerService";
import { moderationService } from "../../../services/moderationService";
import { Alert } from "../../../utils/Alert";
import { useChatStyles } from "../styles";

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
  const theme = useAppTheme();
  const { t } = useTranslation();
  const [showMenu, setShowMenu] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const chatStyles = useChatStyles();
  const styles = useThemedStyles(makeStyles);
  const isCs = isCustomerServiceUser(otherUserId);

  const handleBlock = async () => {
    if (!otherUserId || blocking) return;
    setBlocking(true);
    try {
      await moderationService.blockUser(otherUserId);
      setShowBlockConfirm(false);
      Alert.show(t("chat.blocked", { name }));
      onBlocked?.();
    } catch (error) {
      const msg = error instanceof Error ? error.message : t("chat.blockFailed");
      Alert.show(msg);
    } finally {
      setBlocking(false);
    }
  };

  const menuActions = useMemo<ActionSheetAction[]>(() => [
    {
      label: t("chat.viewProfile"),
      icon: <Ionicons name="person-outline" size={20} color={theme.colors.black} />,
      onPress: () => onProfile(),
    },
    {
      label: t("chat.blockUser"),
      icon: <Ionicons name="ban-outline" size={20} color={theme.colors.error} />,
      destructive: true,
      onPress: () => setShowBlockConfirm(true),
    },
  ], [onProfile, t, theme.colors.black, theme.colors.error]);

  return (
    <>
      <Box style={[{ backgroundColor: theme.colors.background }, { borderBottomColor: theme.colors.gray100 }]} px="$md" py="$sm" borderBottomWidth={1}>
        <HStack alignItems="center" space="sm">
          <Pressable
            w={40}
            h={40}
            justifyContent="center"
            alignItems="center"
            onPress={onBack}
          >
            <Ionicons name="arrow-back" size={22} color={theme.colors.text} />
          </Pressable>

          <Pressable
            onPress={isCs ? undefined : onProfile}
            style={chatStyles.headerUserInfo}
          >
            <HStack alignItems="center" space="sm">
              {isCs ? (
                <CustomerServiceAvatar size={38} />
              ) : (
                <UserAvatar uri={avatar} name={name} size={38} />
              )}
              <VStack>
                <Box>
                  <Text style={styles.headerName} numberOfLines={1}>
                    {name}
                  </Text>
                </Box>
              </VStack>
            </HStack>
          </Pressable>

          {otherUserId && !isCs ? (
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
            <Text style={styles.confirmTitle}>{t("chat.blockConfirmTitle", { name })}</Text>
            <Text style={styles.confirmMessage}>
              {t("chat.blockConfirmMessage")}
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.confirmCancelBtn}
                onPress={() => setShowBlockConfirm(false)}
                disabled={blocking}
              >
                <Text style={styles.confirmCancelText}>{t("common.cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBlockBtn, blocking && { opacity: 0.6 }]}
                onPress={handleBlock}
                disabled={blocking}
              >
                {blocking ? (
                  <ActivityIndicator size="small" color={theme.colors.white} />
                ) : (
                  <Text style={styles.confirmBlockText}>{t("chat.confirmBlock")}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const makeStyles = (t: AppTheme) => StyleSheet.create({
  headerName: {
    ...t.typography.body,
    fontWeight: "600",
    color: t.colors.text,
  },
  confirmOverlay: {
    flex: 1,
    backgroundColor: t.colors.overlay,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  confirmDialog: {
    backgroundColor: t.colors.card,
    borderRadius: 16,
    padding: 24,
    width: "100%",
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: t.colors.text,
    textAlign: "center",
    marginBottom: 8,
  },
  confirmMessage: {
    fontSize: 14,
    color: t.colors.gray300,
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
    borderColor: t.colors.border,
    alignItems: "center",
  },
  confirmCancelText: {
    fontSize: 15,
    fontWeight: "600",
    color: t.colors.text,
  },
  confirmBlockBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: t.colors.error,
    alignItems: "center",
  },
  confirmBlockText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
