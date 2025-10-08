import React from "react";
import { styled } from "@gluestack-style/react";
import { View, Text as RNText } from "react-native";

const StyledToast = styled(View, {
  position: "absolute",
  bottom: 100,
  left: 16,
  right: 16,
  backgroundColor: "$gray800",
  borderRadius: "$md",
  padding: "$4",
  shadowColor: "$black",
  shadowOffset: {
    width: 0,
    height: 2,
  },
  shadowOpacity: 0.25,
  shadowRadius: 3.84,
  elevation: 5,
  zIndex: 9999,
});

const StyledToastText = styled(RNText, {
  color: "$white",
  fontSize: "$md",
  textAlign: "center",
});

const Toast = StyledToast;
const ToastText = StyledToastText;

export { Toast, ToastText };

