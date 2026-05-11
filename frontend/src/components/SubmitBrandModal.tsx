import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  GestureResponderEvent,
} from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme";
import SubmitBrandForm from "./SubmitBrandForm";

interface SubmitBrandModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const SubmitBrandModal: React.FC<SubmitBrandModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const { t } = useTranslation();

  return (
    <Modal
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
      transparent={true}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardView}
        >
          <Pressable
            style={styles.modalContent}
            onPress={(e: GestureResponderEvent) => e.stopPropagation()}
          >
            <View style={styles.handleBar} />
            <View style={styles.header}>
              <Text style={styles.headerTitle}>{t("submitBrand.title")}</Text>
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Ionicons
                  name="close"
                  size={24}
                  color={theme.colors.gray600}
                />
              </TouchableOpacity>
            </View>
            <SubmitBrandForm
              key={visible ? "submit-brand-modal-open" : "submit-brand-modal-idle"}
              variant="modal"
              onClose={onClose}
              onSuccess={onSuccess}
            />
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  keyboardView: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalContent: {
    maxHeight: "85%",
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: theme.colors.gray300,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.lg,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: theme.colors.black,
    fontFamily: __DEV__ ? "Georgia" : "PlayfairDisplay-Medium",
  },
  closeButton: {
    padding: 4,
  },
});

export default SubmitBrandModal;
