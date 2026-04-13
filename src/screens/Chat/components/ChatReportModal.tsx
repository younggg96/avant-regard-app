import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../../theme";
import { ActionSheet } from "../../../components/ui/ActionSheet";
import {
  moderationService,
  ReportReason,
} from "../../../services/moderationService";
import { Alert } from "../../../utils/Alert";

const CHAT_REPORT_REASONS: { key: ReportReason; label: string; icon: string }[] = [
  { key: "PORNOGRAPHY", label: "色情低俗", icon: "eye-off-outline" },
  { key: "VIOLENCE", label: "暴力恐怖", icon: "skull-outline" },
  { key: "SPAM", label: "垃圾广告", icon: "megaphone-outline" },
  { key: "HARASSMENT", label: "辱骂骚扰", icon: "sad-outline" },
  { key: "OTHER", label: "其他", icon: "ellipsis-horizontal-circle-outline" },
];

type ReportTarget =
  | { type: "MESSAGE"; messageId: number; senderId: number }
  | { type: "USER"; userId: number };

interface ChatReportModalProps {
  visible: boolean;
  target: ReportTarget | null;
  onClose: () => void;
}

export const ChatReportModal = ({
  visible,
  target,
  onClose,
}: ChatReportModalProps) => {
  const [selectedReason, setSelectedReason] = useState<ReportReason | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setSelectedReason(null);
    setSubmitting(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!selectedReason || !target) return;
    setSubmitting(true);
    try {
      const targetType = target.type;
      const targetId = target.type === "MESSAGE" ? target.messageId : target.userId;
      await moderationService.reportContent({
        targetType,
        targetId,
        reason: selectedReason,
      });
      handleClose();
      Alert.show("已收到，我们会处理");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "举报失败";
      if (msg.includes("已举报")) {
        Alert.show("24小时内已举报过，请勿重复提交");
      } else {
        Alert.show(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const title = target?.type === "MESSAGE" ? "举报此消息" : "举报该用户";

  return (
    <ActionSheet
      visible={visible}
      onClose={handleClose}
      footerRight={
        <TouchableOpacity
          style={[
            styles.submitBtn,
            (!selectedReason || submitting) && styles.submitBtnDisabled,
          ]}
          onPress={handleSubmit}
          disabled={!selectedReason || submitting}
          activeOpacity={0.6}
        >
          {submitting ? (
            <ActivityIndicator size="small" color={theme.colors.white} />
          ) : (
            <Text style={styles.submitText}>提交举报</Text>
          )}
        </TouchableOpacity>
      }
    >
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>

        <ScrollView showsVerticalScrollIndicator={false}>
          {CHAT_REPORT_REASONS.map((r) => (
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
                color={
                  selectedReason === r.key
                    ? theme.colors.black
                    : theme.colors.gray400
                }
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
        </ScrollView>
      </View>
    </ActionSheet>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  title: {
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
    color: theme.colors.gray300,
  },
  reasonTextSelected: {
    color: theme.colors.black,
    fontWeight: "600",
  },
  submitBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 8,
    backgroundColor: theme.colors.black,
    alignItems: "center",
  },
  submitBtnDisabled: {
    opacity: 0.4,
  },
  submitText: {
    fontSize: 18,
    fontWeight: "600",
    color: theme.colors.white,
  },
});
