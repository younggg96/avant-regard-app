import { useState, useEffect } from "react";
import { Keyboard, Platform } from "react-native";

interface UseKeyboardReturn {
  keyboardHeight: number;
  isKeyboardVisible: boolean;
}

/**
 * 监听键盘事件
 */
export const useKeyboard = (): UseKeyboardReturn => {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
      }
    );

    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => {
        setKeyboardHeight(0);
      }
    );

    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, []);

  return {
    keyboardHeight,
    isKeyboardVisible: keyboardHeight > 0,
  };
};
