import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { theme, useThemedStyles, type AppTheme } from "../../../theme";
import { ActionSheet } from "../../../components/ui/ActionSheet";
import {
  moderationService,
  ReportReason,
} from "../../../services/moderationService";
import { Alert } from "../../../utils/Alert";

const CHAT_REPORT_REASONS: { key: ReportReason; labelKey: string; icon: string }[] = [
  { key: "PORNOGRAPHY", labelKey: "chat.reasonPornography", icon: "eye-off-outline" },
  { key: "VIOLENCE", labelKey: "chat.reasonViolence", icon: "skull-outline" },
  { key: "SPAM", labelKey: "chat.reasonSpam", icon: "megaphone-outline" },
  { key: "HARASSMENT", labelKey: "chat.reasonHarassment", icon: "sad-outline" },
  { key: "OTHER", labelKey: "report.other", icon: "ellipsis-horizontal-circle-outline" },
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
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);
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
      Alert.show(t('chat.reportReceived'));
    } catch (error) {
      const msg = error instanceof Error ? error.message : t('report.failed');
      if (msg.includes("已举报")) {
        Alert.show(t('chat.reportDuplicate'));
      } else {
        Alert.show(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const title = target?.type === "MESSAGE" ? t('chat.reportMessage') : t('chat.reportUser');

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
            <Text style={styles.submitText}>{t('reportBlock.submitReport')}</Text>
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
                {t(r.labelKey)}
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

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    content: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 20,
    },
    title: {
      fontSize: 18,
      fontWeight: "700",
      color: t.colors.text,
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
      backgroundColor: t.colors.gray100,
    },
    reasonText: {
      flex: 1,
      fontSize: 15,
      color: t.colors.gray300,
    },
    reasonTextSelected: {
      color: t.colors.text,
      fontWeight: "600",
    },
    submitBtn: {
      flex: 1,
      paddingVertical: 16,
      borderRadius: 8,
      backgroundColor: t.colors.accent,
      alignItems: "center",
    },
    submitBtnDisabled: {
      opacity: 0.4,
    },
    submitText: {
      fontSize: 18,
      fontWeight: "600",
      color: t.colors.textInverted,
    },
  });
