import React, { useState } from "react";
import {
  StyleSheet,
  Modal,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../theme";
import { adminService } from "../../services/adminService";
import { sharedStyles } from "./adminStyles";
import { Box, HStack, Text, Input, Button, ButtonText, Pressable } from "../../components/ui";

const UsersTab = () => {
  const [deleteUserModalVisible, setDeleteUserModalVisible] = useState(false);
  const [deleteUserId, setDeleteUserId] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const handleDeleteUser = async () => {
    const userId = parseInt(deleteUserId, 10);
    if (isNaN(userId) || userId <= 0) {
      Alert.alert("错误", "请输入有效的用户ID");
      return;
    }

    Alert.alert("危险操作", `确定要删除用户 ${userId} 及其所有数据吗？\n\n此操作不可撤销！`, [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
        style: "destructive",
        onPress: async () => {
          try {
            setActionLoading(true);
            await adminService.deleteUser(userId);
            Alert.alert("成功", `用户 ${userId} 已被删除`);
            setDeleteUserModalVisible(false);
            setDeleteUserId("");
          } catch (error) {
            Alert.alert("错误", error instanceof Error ? error.message : "删除用户失败");
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  return (
    <Box style={styles.usersContainer}>
      <Box style={styles.userManageCard}>
        <HStack style={styles.userManageHeader}>
          <Ionicons name="trash-outline" size={24} color={theme.colors.error} />
          <Text style={styles.userManageTitle}>删除用户</Text>
        </HStack>
        <Text style={styles.userManageDesc}>
          删除用户及其所有关联数据（帖子/关注/点赞/评论/收藏等）。此操作不可撤销。
        </Text>
        <Pressable style={styles.deleteUserButton} onPress={() => setDeleteUserModalVisible(true)}>
          <Text style={styles.deleteUserButtonText}>删除用户</Text>
        </Pressable>
      </Box>

      <Modal visible={deleteUserModalVisible} transparent animationType="fade" onRequestClose={() => setDeleteUserModalVisible(false)}>
        <Box style={sharedStyles.modalOverlay}>
          <Box style={sharedStyles.modalContent}>
            <HStack style={sharedStyles.modalTitleRow}>
              <Ionicons name="warning" size={24} color={theme.colors.error} />
              <Text style={[sharedStyles.modalTitle, { color: theme.colors.error, marginLeft: 8 }]}>删除用户</Text>
            </HStack>
            <Text style={sharedStyles.modalWarning}>
              此操作将删除用户及其所有数据，包括帖子、评论、点赞、收藏、关注等。此操作不可撤销！
            </Text>
            <Input
              style={sharedStyles.modalInput}
              placeholder="请输入要删除的用户ID"
              placeholderTextColor={theme.colors.gray300}
              value={deleteUserId}
              onChangeText={setDeleteUserId}
              keyboardType="numeric"
              variant="outline"
              size="md"
            />
            <HStack style={sharedStyles.modalButtons}>
              <Button
                variant="outline"
                size="sm"
                onPress={() => {
                  setDeleteUserModalVisible(false);
                  setDeleteUserId("");
                }}
              >
                <ButtonText style={{ color: theme.colors.gray400 }}>取消</ButtonText>
              </Button>
              <Button
                size="sm"
                colorScheme="error"
                onPress={handleDeleteUser}
                disabled={actionLoading || !deleteUserId}
                isLoading={actionLoading}
              >
                <ButtonText>确认删除</ButtonText>
              </Button>
            </HStack>
          </Box>
        </Box>
      </Modal>
    </Box>
  );
};

const styles = StyleSheet.create({
  usersContainer: {
    flex: 1,
    padding: theme.spacing.md,
  },
  userManageCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    ...theme.shadows.sm,
  },
  userManageHeader: {
    alignItems: "center",
    marginBottom: theme.spacing.sm,
  },
  userManageTitle: {
    ...theme.typography.h4,
    color: theme.colors.black,
    marginLeft: theme.spacing.sm,
  },
  userManageDesc: {
    ...theme.typography.bodySmall,
    color: theme.colors.gray400,
    marginBottom: theme.spacing.lg,
  },
  deleteUserButton: {
    backgroundColor: theme.colors.error,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: "center",
  },
  deleteUserButtonText: {
    ...theme.typography.button,
    color: theme.colors.white,
  },
});

export default UsersTab;
