import React from "react";
import { View, Modal, TouchableWithoutFeedback, ActivityIndicator } from "react-native";
import { Box, Text, Pressable, VStack, HStack } from "../../../components/ui";
import { SCREEN_WIDTH } from "../constants";

interface DeletePostDialogProps {
  visible: boolean;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const DeletePostDialog = ({
  visible,
  isDeleting,
  onClose,
  onConfirm,
}: DeletePostDialogProps) => (
  <Modal
    visible={visible}
    transparent
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
          <VStack bg="$white" borderRadius={16} width={SCREEN_WIDTH - 80} overflow="hidden">
            <VStack px="$lg" pt="$lg" pb="$md">
              <Text fontSize="$lg" fontWeight="$semibold" color="$black" textAlign="center">
                确认删除
              </Text>
              <Text fontSize="$sm" color="$gray600" textAlign="center" mt="$sm">
                删除后将无法恢复，确定要删除这篇帖子吗？
              </Text>
            </VStack>

            <Box height={1} bg="$gray100" />

            <HStack>
              <Pressable
                flex={1}
                py="$md"
                alignItems="center"
                borderRightWidth={1}
                borderRightColor="$gray100"
                onPress={onClose}
                disabled={isDeleting}
                opacity={isDeleting ? 0.5 : 1}
              >
                <Text fontSize="$md" fontWeight="$medium" color="$gray600">
                  取消
                </Text>
              </Pressable>

              <Pressable
                flex={1}
                py="$md"
                alignItems="center"
                onPress={onConfirm}
                disabled={isDeleting}
              >
                <HStack alignItems="center" justifyContent="center">
                  {isDeleting ? (
                    <>
                      <ActivityIndicator color="#FF3040" style={{ marginRight: 8 }} />
                      <Text fontSize="$md" fontWeight="$semibold" color="#FF3040">
                        删除中...
                      </Text>
                    </>
                  ) : (
                    <Text fontSize="$md" fontWeight="$semibold" color="#FF3040">
                      删除
                    </Text>
                  )}
                </HStack>
              </Pressable>
            </HStack>
          </VStack>
        </TouchableWithoutFeedback>
      </View>
    </TouchableWithoutFeedback>
  </Modal>
);
