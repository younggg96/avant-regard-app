import React from "react";
import {
  Modal,
  View,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "../ui";
import { theme } from "../../theme";
import { styles } from "./styles";

interface OptionsMenuModalProps {
  visible: boolean;
  onClose: () => void;
  onDelete: () => void;
}

export const OptionsMenuModal: React.FC<OptionsMenuModalProps> = ({
  visible,
  onClose,
  onDelete,
}) => {
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
                <Text style={styles.optionsMenuTitle}>管理帖子</Text>
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
                  <Text style={styles.optionsMenuItemTextDanger}>删除帖子</Text>
                </TouchableOpacity>

                {/* 取消按钮 */}
                <TouchableOpacity
                  style={[styles.optionsMenuItem, styles.optionsMenuItemCancel]}
                  onPress={onClose}
                >
                  <Text style={styles.optionsMenuItemText}>取消</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};
