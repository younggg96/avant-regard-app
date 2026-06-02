/**
 * KeyboardFriend —— 统一的键盘避让包装。
 *
 * - mode="screen"：全屏表单，使用 KeyboardAvoidingView。
 * - mode="sheet"：底部弹层 / Modal 内输入，随键盘上移。
 */
import React, { useEffect, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleProp,
  View,
  ViewStyle,
  type ScrollViewProps,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type KeyboardFriendMode = "screen" | "sheet";

interface KeyboardFriendProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  mode?: KeyboardFriendMode;
  /** screen 模式下额外偏移（如自定义 header 高度） */
  keyboardVerticalOffset?: number;
}

export const KeyboardFriend: React.FC<KeyboardFriendProps> = ({
  children,
  style,
  mode = "screen",
  keyboardVerticalOffset,
}) => {
  const insets = useSafeAreaInsets();
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (mode !== "sheet") return;

    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [mode]);

  if (mode === "sheet") {
    return (
      <View
        style={[
          style,
          keyboardHeight > 0 ? { marginBottom: keyboardHeight } : null,
        ]}
      >
        {children}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[{ flex: 1 }, style]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={
        keyboardVerticalOffset ?? (Platform.OS === "ios" ? insets.top : 0)
      }
    >
      {children}
    </KeyboardAvoidingView>
  );
};

/** ScrollView 默认带上键盘友好 props */
export const KeyboardFriendScrollView = React.forwardRef<
  ScrollView,
  ScrollViewProps
>(function KeyboardFriendScrollView({ keyboardShouldPersistTaps, keyboardDismissMode, ...rest }, ref) {
  return (
    <ScrollView
      ref={ref}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps ?? "handled"}
      keyboardDismissMode={keyboardDismissMode ?? "interactive"}
      {...rest}
    />
  );
});

export default KeyboardFriend;
