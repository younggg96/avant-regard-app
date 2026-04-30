import React from "react";
import {
  Modal,
  View,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ActivityIndicator,
} from "react-native";
import { useTranslation } from "react-i18next";
import { Text } from "../ui";
import { theme } from "../../theme";
import { SCREEN_WIDTH } from "./styles";

interface DeleteConfirmDialogProps {
  visible: boolean;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const DeleteConfirmDialog: React.FC<DeleteConfirmDialogProps> = ({
  visible,
  isDeleting,
  onClose,
  onConfirm,
}) => {
  const { t } = useTranslation();
  return (
    <Modal
      visible={visible}
      transparent={true}
      onRequestClose={() => {
        if (!isDeleting) {
          onClose();
        }
      }}
      animationType="fade"
    >
      <TouchableWithoutFeedback
        onPress={() => {
          if (!isDeleting) {
            onClose();
          }
        }}
      >
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
              {/* 标题 */}
              <View
                style={{
                  paddingHorizontal: 24,
                  paddingTop: 24,
                  paddingBottom: 16,
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
                  {t("postDetail.confirmDelete")}
                </Text>
                <Text
                  style={{
                    fontSize: 14,
                    color: theme.colors.gray600,
                    textAlign: "center",
                    marginTop: 8,
                  }}
                >
                  {t("postDetail.confirmDeleteMessage")}
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
                  disabled={isDeleting}
                  style={{
                    flex: 1,
                    paddingVertical: 16,
                    alignItems: "center",
                    borderRightWidth: 1,
                    borderRightColor: theme.colors.gray100,
                    opacity: isDeleting ? 0.5 : 1,
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

                {/* 删除按钮 */}
                <TouchableOpacity
                  onPress={onConfirm}
                  disabled={isDeleting}
                  style={{
                    flex: 1,
                    paddingVertical: 16,
                    alignItems: "center",
                    flexDirection: "row",
                    justifyContent: "center",
                  }}
                >
                  {isDeleting ? (
                    <>
                      <ActivityIndicator
                        size="small"
                        color="#FF3040"
                        style={{ marginRight: 8 }}
                      />
                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: "600",
                          color: "#FF3040",
                        }}
                      >
                        {t("postDetail.deleting")}
                      </Text>
                    </>
                  ) : (
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: "600",
                        color: "#FF3040",
                      }}
                    >
                      {t("common.delete")}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};
