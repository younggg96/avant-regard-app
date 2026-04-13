import React from "react";
import { View, TextInput, TouchableOpacity, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../../theme";
import { styles } from "../styles";

interface MessageInputProps {
  inputText: string;
  isWriting: boolean;
  inputRef: React.RefObject<TextInput>;
  disabled?: boolean;
  onChangeText: (text: string) => void;
  onStartWriting: () => void;
  onCancel: () => void;
  onSend: () => void;
}

export const MessageInput = ({
  inputText,
  isWriting,
  inputRef,
  disabled = false,
  onChangeText,
  onStartWriting,
  onCancel,
  onSend,
}: MessageInputProps) => {
  if (disabled) {
    return (
      <View style={styles.inputContainer}>
        <View style={styles.disabledInputContainer}>
          <Ionicons name="lock-closed-outline" size={16} color={theme.colors.gray200} />
          <Text style={styles.disabledInputText}>
            等待对方回复后才能继续发送
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.inputContainer}>
      {!isWriting ? (
        <TouchableOpacity
          style={styles.writeMessageButton}
          onPress={onStartWriting}
          activeOpacity={0.7}
        >
          <Text style={styles.writeMessagePlaceholder}>输入消息...</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.writeMessageExpanded}>
          <TextInput
            ref={inputRef}
            style={styles.expandedTextInput}
            value={inputText}
            onChangeText={onChangeText}
            placeholder="输入消息..."
            placeholderTextColor={theme.colors.gray200}
            multiline
            scrollEnabled
            maxLength={5000}
            autoFocus
          />
          <View style={styles.inputActions}>
            <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
              <Text style={styles.cancelButtonText}>取消</Text>
            </TouchableOpacity>
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
                发送
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};
