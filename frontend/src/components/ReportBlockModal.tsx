/**
 * Report content / Block user modal.
 * Required by Apple Guideline 1.2 (User-Generated Content).
 */

import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme";
import { moderationService, ReportReason } from "../services/moderationService";
import { Alert } from "../utils/Alert";

interface ReportBlockModalProps {
  visible: boolean;
  targetType: "POST" | "COMMENT";
  targetId: number | string;
  targetAuthorId: number | string;
  targetAuthorName: string;
  onClose: () => void;
  onBlockComplete?: () => void;
  onShare?: () => void;
}

const REPORT_REASONS: { key: ReportReason; label: string; icon: string }[] = [
  { key: "SPAM", label: "垃圾内容 / 广告", icon: "megaphone-outline" },
  { key: "INAPPROPRIATE", label: "不当或攻击性内容", icon: "alert-circle-outline" },
  { key: "HARASSMENT", label: "骚扰或霸凌", icon: "sad-outline" },
  { key: "MISINFORMATION", label: "虚假信息", icon: "warning-outline" },
  { key: "COPYRIGHT", label: "侵权内容", icon: "copy-outline" },
  { key: "OTHER", label: "其他", icon: "ellipsis-horizontal-circle-outline" },
];

type Step = "menu" | "report" | "block-confirm";

export const ReportBlockModal: React.FC<ReportBlockModalProps> = ({
  visible,
  targetType,
  targetId,
  targetAuthorId,
  targetAuthorName,
  onClose,
  onBlockComplete,
  onShare,
}) => {
  const [step, setStep] = useState<Step>("menu");
  const [selectedReason, setSelectedReason] = useState<ReportReason | null>(null);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setStep("menu");
    setSelectedReason(null);
    setDescription("");
    setSubmitting(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleReport = async () => {
    if (!selectedReason) {
      Alert.show("请选择举报原因");
      return;
    }
    setSubmitting(true);
    try {
      await moderationService.reportContent({
        targetType,
        targetId: Number(targetId),
        reason: selectedReason,
        description: description.trim() || undefined,
      });
      Alert.show("举报已提交，我们会尽快处理");
      handleClose();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "举报失败，请稍后重试";
      Alert.show(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleBlock = async () => {
    setSubmitting(true);
    try {
      await moderationService.blockUser(Number(targetAuthorId));
      Alert.show(`已屏蔽 ${targetAuthorName}，其内容将不再显示`);
      handleClose();
      onBlockComplete?.();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "屏蔽失败，请稍后重试";
      Alert.show(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const renderMenu = () => (
    <>
      {onShare && (
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => {
            handleClose();
            onShare();
          }}
        >
          <Ionicons name="share-outline" size={22} color={theme.colors.black} />
          <Text style={styles.menuItemText}>分享帖子</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity
        style={styles.menuItem}
        onPress={() => setStep("report")}
      >
        <Ionicons name="flag-outline" size={22} color={theme.colors.error} />
        <Text style={styles.menuItemTextDanger}>举报内容</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.menuItem}
        onPress={() => setStep("block-confirm")}
      >
        <Ionicons name="ban-outline" size={22} color={theme.colors.error} />
        <Text style={styles.menuItemTextDanger}>屏蔽用户 @{targetAuthorName}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
        <Text style={styles.cancelText}>取消</Text>
      </TouchableOpacity>
    </>
  );

  const renderReportForm = () => (
    <ScrollView showsVerticalScrollIndicator={false}>
      <Text style={styles.formTitle}>举报原因</Text>
      {REPORT_REASONS.map((r) => (
        <TouchableOpacity
          key={r.key}
          style={[
            styles.reasonItem,
            selectedReason === r.key && styles.reasonItemSelected,
          ]}
          onPress={() => setSelectedReason(r.key)}
        >
          <Ionicons
            name={r.icon as any}
            size={20}
            color={selectedReason === r.key ? theme.colors.black : theme.colors.gray400}
          />
          <Text
            style={[
              styles.reasonText,
              selectedReason === r.key && styles.reasonTextSelected,
            ]}
          >
            {r.label}
          </Text>
          {selectedReason === r.key && (
            <Ionicons name="checkmark" size={20} color={theme.colors.black} />
          )}
        </TouchableOpacity>
      ))}

      {selectedReason === "OTHER" && (
        <TextInput
          style={styles.descriptionInput}
          placeholder="请描述具体问题..."
          placeholderTextColor={theme.colors.gray300}
          value={description}
          onChangeText={setDescription}
          multiline
          maxLength={500}
        />
      )}

      <View style={styles.formActions}>
        <TouchableOpacity style={styles.backButton} onPress={() => setStep("menu")}>
          <Text style={styles.backButtonText}>返回</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.submitButton,
            (!selectedReason || submitting) && styles.submitButtonDisabled,
          ]}
          onPress={handleReport}
          disabled={!selectedReason || submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color={theme.colors.white} />
          ) : (
            <Text style={styles.submitButtonText}>提交举报</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderBlockConfirm = () => (
    <>
      <View style={styles.blockIcon}>
        <Ionicons name="ban-outline" size={48} color={theme.colors.error} />
      </View>
      <Text style={styles.blockTitle}>屏蔽 @{targetAuthorName}？</Text>
      <Text style={styles.blockMessage}>
        屏蔽后，该用户的所有内容将从你的动态中移除，且对方无法看到你的内容。你可以随时在设置中取消屏蔽。
      </Text>
      <View style={styles.formActions}>
        <TouchableOpacity style={styles.backButton} onPress={() => setStep("menu")}>
          <Text style={styles.backButtonText}>取消</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.blockConfirmButton, submitting && { opacity: 0.6 }]}
          onPress={handleBlock}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color={theme.colors.white} />
          ) : (
            <Text style={styles.submitButtonText}>确认屏蔽</Text>
          )}
        </TouchableOpacity>
      </View>
    </>
  );

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={handleClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={handleClose}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={styles.container}
          onPress={() => { }}
        >
          <View style={styles.handle} />
          {step === "menu" && renderMenu()}
          {step === "report" && renderReportForm()}
          {step === "block-confirm" && renderBlockConfirm()}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 40,
    maxHeight: "70%",
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: theme.colors.gray200,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 20,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray100,
    gap: 12,
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: "500",
    color: theme.colors.black,
  },
  menuItemTextDanger: {
    fontSize: 16,
    fontWeight: "500",
    color: theme.colors.error,
  },
  cancelButton: {
    paddingVertical: 16,
    alignItems: "center",
  },
  cancelText: {
    fontSize: 16,
    color: theme.colors.gray600,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: theme.colors.black,
    marginBottom: 16,
  },
  reasonItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 6,
    gap: 10,
  },
  reasonItemSelected: {
    backgroundColor: theme.colors.gray100,
  },
  reasonText: {
    flex: 1,
    fontSize: 15,
    color: theme.colors.gray600,
  },
  reasonTextSelected: {
    color: theme.colors.black,
    fontWeight: "600",
  },
  descriptionInput: {
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: theme.colors.black,
    minHeight: 80,
    textAlignVertical: "top",
    marginTop: 8,
    marginBottom: 8,
  },
  formActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },
  backButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    alignItems: "center",
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: theme.colors.black,
  },
  submitButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: theme.colors.black,
    alignItems: "center",
  },
  submitButtonDisabled: {
    opacity: 0.4,
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: theme.colors.white,
  },
  blockIcon: {
    alignSelf: "center",
    marginBottom: 12,
  },
  blockTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: theme.colors.black,
    textAlign: "center",
    marginBottom: 8,
  },
  blockMessage: {
    fontSize: 14,
    color: theme.colors.gray600,
    textAlign: "center",
    lineHeight: 20,
  },
  blockConfirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: theme.colors.error,
    alignItems: "center",
  },
});

export default ReportBlockModal;
