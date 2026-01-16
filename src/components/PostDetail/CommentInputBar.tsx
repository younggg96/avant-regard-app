import React, {
  useRef,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text, Pressable, HStack, VStack } from "../ui";
import { theme } from "../../theme";
import { ReplyTarget } from "./types";
import { styles } from "./styles";

interface CommentInputBarProps {
  commentInput: string;
  isSubmitting: boolean;
  isFocused: boolean;
  displayLikes: number;
  displaySaves: number;
  displayComments: number;
  displayIsLiked: boolean;
  displayIsSaved: boolean;
  replyTarget?: ReplyTarget | null;
  onInputChange: (text: string) => void;
  onInputFocus: () => void;
  onInputBlur: () => void;
  onSubmit: () => void;
  onLike: () => void;
  onSave: () => void;
  onOverlayPress: () => void;
  onCancelReply?: () => void;
}

export interface CommentInputBarRef {
  focus: () => void;
  blur: () => void;
}

export const CommentInputBar = forwardRef<
  CommentInputBarRef,
  CommentInputBarProps
>(
  (
    {
      commentInput,
      isSubmitting,
      isFocused,
      displayLikes,
      displaySaves,
      displayComments,
      displayIsLiked,
      displayIsSaved,
      replyTarget,
      onInputChange,
      onInputFocus,
      onInputBlur,
      onSubmit,
      onLike,
      onSave,
      onOverlayPress,
      onCancelReply,
    },
    ref
  ) => {
    const inputRef = useRef<TextInput>(null);

    useImperativeHandle(ref, () => ({
      focus: () => {
        inputRef.current?.focus();
      },
      blur: () => {
        inputRef.current?.blur();
      },
    }));

    const handleInputPress = useCallback(() => {
      onInputFocus();
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }, [onInputFocus]);

    const handleTextChange = useCallback(
      (text: string) => {
        const singleLineText = text.replace(/[\r\n]/g, "");
        onInputChange(singleLineText);
      },
      [onInputChange]
    );

    const placeholderText = replyTarget
      ? `回复 @${replyTarget.userName}...`
      : "写评论...";

    return (
      <View style={[styles.bottomBar, isFocused && styles.bottomBarExpanded]}>
        {/* Expanded Input Area when focused */}
        {isFocused && (
          <View style={styles.expandedInputContainer}>
            {/* 回复提示条 */}
            {replyTarget && (
              <View style={styles.replyHint}>
                <Text style={styles.replyHintText}>
                  正在回复 <Text color="$accent" fontWeight="$medium">@{replyTarget.userName}</Text>
                </Text>
                <TouchableOpacity
                  style={styles.replyHintClose}
                  onPress={onCancelReply}
                >
                  <Ionicons
                    name="close-circle"
                    size={20}
                    color={theme.colors.gray400}
                  />
                </TouchableOpacity>
              </View>
            )}
            <View style={[
              styles.expandedTextInputWrapper,
              replyTarget && { borderTopLeftRadius: 0, borderTopRightRadius: 0 }
            ]}>
              <TextInput
                ref={inputRef}
                style={styles.expandedTextInput}
                placeholder={placeholderText}
                placeholderTextColor={theme.colors.gray600}
                value={commentInput}
                onChangeText={handleTextChange}
                onBlur={onInputBlur}
                maxLength={500}
                returnKeyType="send"
                onSubmitEditing={onSubmit}
                multiline={false}
              />
              <TouchableOpacity
                onPress={onSubmit}
                disabled={isSubmitting || !commentInput.trim()}
                style={styles.expandedSendButton}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color={theme.colors.accent} />
                ) : (
                  <Ionicons
                    name="send"
                    size={20}
                    color={
                      commentInput.trim()
                        ? theme.colors.accent
                        : theme.colors.gray400
                    }
                  />
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Compact Bottom Bar */}
        <View style={styles.compactBottomBar}>
          {/* Engagement Icons */}
          {!isFocused && (
            <View style={styles.engagementSection}>
              <Pressable onPress={onLike} style={styles.engagementButton}>
                <VStack alignItems="center" space="xs">
                  <Ionicons
                    name={displayIsLiked ? "heart" : "heart-outline"}
                    size={20}
                    color={displayIsLiked ? "#FF3040" : theme.colors.gray600}
                  />
                  <Text
                    fontSize="$xs"
                    color={displayIsLiked ? "#FF3040" : "$gray600"}
                    fontWeight="$medium"
                  >
                    {displayLikes}
                  </Text>
                </VStack>
              </Pressable>

              <Pressable onPress={onSave} style={styles.engagementButton}>
                <VStack alignItems="center" space="xs">
                  <Ionicons
                    name={displayIsSaved ? "bookmark" : "bookmark-outline"}
                    size={20}
                    color={
                      displayIsSaved
                        ? theme.colors.accent
                        : theme.colors.gray600
                    }
                  />
                  <Text
                    fontSize="$xs"
                    color={displayIsSaved ? "$accent" : "$gray600"}
                    fontWeight="$medium"
                  >
                    {displaySaves}
                  </Text>
                </VStack>
              </Pressable>

              <Pressable style={styles.engagementButton}>
                <VStack alignItems="center" space="xs">
                  <Ionicons
                    name="chatbubble-outline"
                    size={20}
                    color={theme.colors.gray600}
                  />
                  <Text fontSize="$xs" color="$gray600" fontWeight="$medium">
                    {displayComments}
                  </Text>
                </VStack>
              </Pressable>
            </View>
          )}

          {/* Comment Input */}
          {!isFocused && (
            <TouchableOpacity
              onPress={handleInputPress}
              style={styles.compactInputWrapper}
              activeOpacity={0.7}
            >
              <Text fontSize="$sm" color="$gray600">
                {placeholderText}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }
);

CommentInputBar.displayName = "CommentInputBar";
