import React from "react";
import { View, TextInput, TouchableOpacity, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { theme } from "../../../theme";
import { useChatStyles } from "../styles";

interface MessageInputProps {
  inputText: string;
  isWriting: boolean;
  inputRef: React.RefObject<TextInput>;
  disabled?: boolean;
  sharePickerOpen?: boolean;
  onChangeText: (text: string) => void;
  onStartWriting: () => void;
  onSend: () => void;
  onToggleSharePicker?: () => void;
}

export const MessageInput = ({
  inputText,
  isWriting,
  inputRef,
  disabled = false,
  sharePickerOpen = false,
  onChangeText,
  onStartWriting,
  onSend,
  onToggleSharePicker,
}: MessageInputProps) => {
  const { t } = useTranslation();
  const styles = useChatStyles();

  if (disabled) {
    return (
      <View style={styles.inputContainer}>
        <View style={styles.disabledInputContainer}>
          <Ionicons name="lock-closed-outline" size={16} color={theme.colors.gray200} />
          <Text style={styles.disabledInputText}>
            {t("chat.sendRestricted")}
          </Text>
        </View>
      </View>
    );
  }

  // Plus button only shows in the collapsed (non-writing) state — when the user
  // is actively composing, extra controls just add noise.
  const plusButton =
    !isWriting && onToggleSharePicker ? (
      <TouchableOpacity
        style={[
          styles.plusButton,
          sharePickerOpen && styles.plusButtonActive,
        ]}
        onPress={onToggleSharePicker}
        activeOpacity={0.7}
        accessibilityLabel={t('chat.openShareMenu')}
      >
        <Ionicons
          name={sharePickerOpen ? "close" : "add"}
          size={22}
          color={sharePickerOpen ? theme.colors.white : theme.colors.gray400}
        />
      </TouchableOpacity>
    ) : null;

  return (
    <View style={styles.inputContainer}>
      {!isWriting ? (
        <View style={styles.inputRow}>
          {plusButton}
          <TouchableOpacity
            style={[styles.writeMessageButton, styles.inputRowFlex]}
            onPress={onStartWriting}
            activeOpacity={0.7}
          >
            <Text style={styles.writeMessagePlaceholder}>{t("chat.inputPlaceholder")}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.writeMessageExpanded}>
          <TextInput
            ref={inputRef}
            style={styles.expandedTextInput}
            value={inputText}
            onChangeText={onChangeText}
            placeholder={t("chat.inputPlaceholder")}
            placeholderTextColor={theme.colors.gray200}
            multiline
            scrollEnabled
            maxLength={5000}
            autoFocus
          />
          <View style={styles.inputActionsEnd}>
            <TouchableOpacity
              style={[
                styles.sendButton,
                !inputText.trim() && styles.sendButtonDisabled,
              ]}
              onPress={onSend}
              disabled={!inputText.trim()}
            >
              <Text
                style={[
                  styles.sendButtonText,
                  !inputText.trim() && styles.sendButtonTextDisabled,
                ]}
              >
                {t("chat.send")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};
