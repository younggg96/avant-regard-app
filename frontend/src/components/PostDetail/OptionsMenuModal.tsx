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
import { styles } from "./styles";

interface OptionsMenuModalProps {
  visible: boolean;
  showEditOption?: boolean;
  onClose: () => void;
  onEdit?: () => void;
  onDelete: () => void;
  onShare?: () => void;
}

export const OptionsMenuModal: React.FC<OptionsMenuModalProps> = ({
  visible,
  showEditOption = false,
  onClose,
  onEdit,
  onDelete,
  onShare,
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
        <View style={styles.optionsMenuOverlay}>
          <TouchableWithoutFeedback>
            <View style={styles.optionsMenuContainer}>
              <View style={styles.optionsMenuHeader}>
                <Text style={styles.optionsMenuTitle}>{t("postDetail.managePost")}</Text>
                <TouchableOpacity
                  onPress={onClose}
                  style={styles.optionsMenuCloseButton}
                >
                  <Ionicons
                    name="close"
                    size={24}
                    color={theme.colors.gray400}
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.optionsMenuContent}>
                {/* 分享选项 */}
                {onShare && (
                  <TouchableOpacity
                    style={styles.optionsMenuItem}
                    onPress={() => {
                      onClose();
                      setTimeout(() => {
                        onShare();
                      }, 300);
                    }}
                  >
                    <Ionicons
                      name="share-outline"
                      size={22}
                      color={theme.colors.black}
                      style={styles.optionsMenuIcon}
                    />
                    <Text style={styles.optionsMenuItemText}>{t("postDetail.sharePost")}</Text>
                  </TouchableOpacity>
                )}

                {/* 编辑选项 - 仅在已发布或审核中帖子显示 */}
                {showEditOption && onEdit && (
                  <TouchableOpacity
                    style={styles.optionsMenuItem}
                    onPress={() => {
                      onClose();
                      setTimeout(() => {
                        onEdit();
                      }, 300);
                    }}
                  >
                    <Ionicons
                      name="create-outline"
                      size={22}
                      color={theme.colors.black}
                      style={styles.optionsMenuIcon}
                    />
                    <Text style={styles.optionsMenuItemText}>{t("postDetail.editPost")}</Text>
                  </TouchableOpacity>
                )}

                {/* 删除选项 */}
                <TouchableOpacity
                  style={styles.optionsMenuItem}
                  onPress={() => {
                    onClose();
                    setTimeout(() => {
                      onDelete();
                    }, 300);
                  }}
                >
                  <Ionicons
                    name="trash-outline"
                    size={22}
                    color="#FF3040"
                    style={styles.optionsMenuIcon}
                  />
                  <Text style={styles.optionsMenuItemTextDanger}>{t("postDetail.deletePost")}</Text>
                </TouchableOpacity>

                {/* 取消按钮 */}
                <TouchableOpacity
                  style={[styles.optionsMenuItem, styles.optionsMenuItemCancel]}
                  onPress={onClose}
                >
                  <Text style={styles.optionsMenuItemText}>{t("common.cancel")}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};
