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
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { theme, useThemedStyles, type AppTheme } from "../theme";
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

const REPORT_REASON_KEYS: { key: ReportReason; i18nKey: string; icon: string }[] = [
  { key: "SPAM", i18nKey: "reportBlock.spam", icon: "megaphone-outline" },
  { key: "INAPPROPRIATE", i18nKey: "reportBlock.inappropriate", icon: "alert-circle-outline" },
  { key: "HARASSMENT", i18nKey: "reportBlock.harassment", icon: "sad-outline" },
  { key: "MISINFORMATION", i18nKey: "reportBlock.misinformation", icon: "warning-outline" },
  { key: "COPYRIGHT", i18nKey: "reportBlock.copyright", icon: "copy-outline" },
  { key: "OTHER", i18nKey: "reportBlock.other", icon: "ellipsis-horizontal-circle-outline" },
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
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>("menu");
  const [selectedReason, setSelectedReason] = useState<ReportReason | null>(null);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const styles = useThemedStyles(makeStyles);

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
      Alert.show(t("reportBlock.selectReason"));
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
      Alert.show(t("reportBlock.reportSubmitted"));
      handleClose();
    } catch (error) {
      const msg = error instanceof Error ? error.message : t("reportBlock.reportFailed");
      Alert.show(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleBlock = async () => {
    setSubmitting(true);
    try {
      await moderationService.blockUser(Number(targetAuthorId));
      Alert.show(t("reportBlock.blockSuccess", { name: targetAuthorName }));
      handleClose();
      onBlockComplete?.();
    } catch (error) {
      const msg = error instanceof Error ? error.message : t("reportBlock.blockFailed");
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
          <Text style={styles.menuItemText}>{t("reportBlock.sharePost")}</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity
        style={styles.menuItem}
        onPress={() => setStep("report")}
      >
        <Ionicons name="flag-outline" size={22} color={theme.colors.error} />
        <Text style={styles.menuItemTextDanger}>{t("reportBlock.reportContent")}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.menuItem}
        onPress={() => setStep("block-confirm")}
      >
        <Ionicons name="ban-outline" size={22} color={theme.colors.error} />
        <Text style={styles.menuItemTextDanger}>{t("reportBlock.blockUser", { name: targetAuthorName })}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
        <Text style={styles.cancelText}>{t("common.cancel")}</Text>
      </TouchableOpacity>
    </>
  );

  const renderReportForm = () => (
    <ScrollView showsVerticalScrollIndicator={false}>
      <Text style={styles.formTitle}>{t("reportBlock.reportReason")}</Text>
      {REPORT_REASON_KEYS.map((r) => (
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
            {t(r.i18nKey)}
          </Text>
          {selectedReason === r.key && (
            <Ionicons name="checkmark" size={20} color={theme.colors.black} />
          )}
        </TouchableOpacity>
      ))}

      {selectedReason === "OTHER" && (
        <TextInput
          style={styles.descriptionInput}
          placeholder={t("reportBlock.descriptionPlaceholder")}
          placeholderTextColor={theme.colors.gray300}
          value={description}
          onChangeText={setDescription}
          multiline
          maxLength={500}
        />
      )}

      <View style={styles.formActions}>
        <TouchableOpacity style={styles.backButton} onPress={() => setStep("menu")}>
          <Text style={styles.backButtonText}>{t("reportBlock.back")}</Text>
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
            <Text style={styles.submitButtonText}>{t("reportBlock.submitReport")}</Text>
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
      <Text style={styles.blockTitle}>{t("reportBlock.blockTitle", { name: targetAuthorName })}</Text>
      <Text style={styles.blockMessage}>
        {t("reportBlock.blockMessage")}
      </Text>
      <View style={styles.formActions}>
        <TouchableOpacity style={styles.backButton} onPress={() => setStep("menu")}>
          <Text style={styles.backButtonText}>{t("common.cancel")}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.blockConfirmButton, submitting && { opacity: 0.6 }]}
          onPress={handleBlock}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color={theme.colors.white} />
          ) : (
            <Text style={styles.submitButtonText}>{t("reportBlock.confirmBlock")}</Text>
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
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
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
      </KeyboardAvoidingView>
    </Modal>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: t.colors.overlay,
      justifyContent: "flex-end",
    },
    container: {
      backgroundColor: t.colors.background,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 20,
      paddingBottom: 40,
      maxHeight: "70%",
    },
    handle: {
      width: 36,
      height: 4,
      backgroundColor: t.colors.gray200,
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
      borderBottomColor: t.colors.border,
      gap: 12,
    },
    menuItemText: {
      fontSize: 16,
      fontWeight: "500",
      color: t.colors.text,
    },
    menuItemTextDanger: {
      fontSize: 16,
      fontWeight: "500",
      color: t.colors.error,
    },
    cancelButton: {
      paddingVertical: 16,
      alignItems: "center",
    },
    cancelText: {
      fontSize: 16,
      color: t.colors.gray600,
    },
    formTitle: {
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
      color: t.colors.gray600,
    },
    reasonTextSelected: {
      color: t.colors.text,
      fontWeight: "600",
    },
    descriptionInput: {
      borderWidth: 1,
      borderColor: t.colors.gray200,
      borderRadius: 10,
      padding: 12,
      fontSize: 14,
      color: t.colors.text,
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
      borderColor: t.colors.gray200,
      alignItems: "center",
    },
    backButtonText: {
      fontSize: 15,
      fontWeight: "600",
      color: t.colors.text,
    },
    submitButton: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 10,
      backgroundColor: t.colors.accent,
      alignItems: "center",
    },
    submitButtonDisabled: {
      opacity: 0.4,
    },
    submitButtonText: {
      fontSize: 15,
      fontWeight: "600",
      color: t.colors.textInverted,
    },
    blockIcon: {
      alignSelf: "center",
      marginBottom: 12,
    },
    blockTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: t.colors.text,
      textAlign: "center",
      marginBottom: 8,
    },
    blockMessage: {
      fontSize: 14,
      color: t.colors.gray600,
      textAlign: "center",
      lineHeight: 20,
    },
    blockConfirmButton: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 10,
      backgroundColor: t.colors.error,
      alignItems: "center",
    },
  });

export default ReportBlockModal;
