import React from "react";
import {
  Modal,
  View,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "../ui";
import { theme } from "../../theme";
import { SCREEN_WIDTH } from "./styles";

interface EditConfirmDialogProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const EditConfirmDialog: React.FC<EditConfirmDialogProps> = ({
  visible,
  onClose,
  onConfirm,
}) => {
  const { t } = useTranslation();
  return (
    <Modal
      visible={visible}
      transparent={true}
      onRequestClose={onClose}
      animationType="fade"
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <TouchableWithoutFeedback>
            <View
              style={{
                backgroundColor: theme.colors.white,
                borderRadius: 16,
                marginHorizontal: 40,
                width: SCREEN_WIDTH - 80,
                overflow: "hidden",
              }}
            >
              {/* 图标 */}
              <View
                style={{
                  paddingTop: 24,
                  alignItems: "center",
                }}
              >
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    backgroundColor: theme.colors.accent + "15",
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <Ionicons
                    name="alert-circle-outline"
                    size={32}
                    color={theme.colors.accent}
                  />
                </View>
              </View>

              {/* 标题和内容 */}
              <View
                style={{
                  paddingHorizontal: 24,
                  paddingTop: 16,
                  paddingBottom: 24,
                }}
              >
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: "600",
                    color: theme.colors.black,
                    textAlign: "center",
                  }}
                >
                  {t("postDetail.editPostTitle")}
                </Text>
                <Text
                  style={{
                    fontSize: 14,
                    color: theme.colors.gray600,
                    textAlign: "center",
                    marginTop: 8,
                    lineHeight: 20,
                  }}
                >
                  {t("postDetail.editPostMessage")}
                </Text>
              </View>

              {/* 分割线 */}
              <View
                style={{
                  height: 1,
                  backgroundColor: theme.colors.gray100,
                }}
              />

              {/* 按钮区域 */}
              <View style={{ flexDirection: "row" }}>
                {/* 取消按钮 */}
                <TouchableOpacity
                  onPress={onClose}
                  style={{
                    flex: 1,
                    paddingVertical: 16,
                    alignItems: "center",
                    borderRightWidth: 1,
                    borderRightColor: theme.colors.gray100,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "500",
                      color: theme.colors.gray600,
                    }}
                  >
                    {t("common.cancel")}
                  </Text>
                </TouchableOpacity>

                {/* 确认编辑按钮 */}
                <TouchableOpacity
                  onPress={onConfirm}
                  style={{
                    flex: 1,
                    paddingVertical: 16,
                    alignItems: "center",
                    flexDirection: "row",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "600",
                      color: theme.colors.black,
                    }}
                  >
                    {t("postDetail.confirmEdit")}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};
