import React from "react";
import { View, Modal, TouchableWithoutFeedback, ActivityIndicator } from "react-native";
import { useTranslation } from "react-i18next";
import { Box, Text, Pressable, VStack, HStack } from "../../../components/ui";
import { playfairFonts, useAppTheme } from "../../../theme";
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
}: DeletePostDialogProps) => {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const appTheme = theme;

  return (
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
            backgroundColor: appTheme.colors.overlay,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <TouchableWithoutFeedback>
            <VStack style={{ backgroundColor: theme.colors.white }} borderRadius={16} width={SCREEN_WIDTH - 80} overflow="hidden">
              <VStack px="$lg" pt="$lg" pb="$md">
                <Text
                  fontSize="$lg"
                  fontWeight="$semibold"
                  style={[{ fontFamily: playfairFonts.bold }, { color: theme.colors.black }]}
                  textAlign="center"

                >
                  {t("profile.deletePostTitle")}
                </Text>
                <Text
                  fontSize="$sm"
                  style={[{ fontFamily: playfairFonts.regular }, { color: theme.colors.gray600 }]}
                  textAlign="center"
                  mt="$sm"

                >
                  {t("profile.deletePostMessage")}
                </Text>
              </VStack>

              <Box height={1} style={{ backgroundColor: theme.colors.gray100 }} />

              <HStack>
                <Pressable
                  flex={1}
                  py="$md"
                  alignItems="center"
                  borderRightWidth={1}
                  style={{ borderRightColor: theme.colors.gray100 }}
                  onPress={onClose}
                  disabled={isDeleting}
                  opacity={isDeleting ? 0.5 : 1}
                >
                  <Text
                    fontSize="$md"
                    fontWeight="$medium"
                    style={[{ fontFamily: playfairFonts.medium }, { color: theme.colors.gray600 }]}

                  >
                    {t("common.cancel")}
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
                        <Text
                          fontSize="$md"
                          fontWeight="$semibold"
                          color="#FF3040"
                          style={{ fontFamily: playfairFonts.bold }}
                        >
                          {t("common.loading")}
                        </Text>
                      </>
                    ) : (
                      <Text
                        fontSize="$md"
                        fontWeight="$semibold"
                        color="#FF3040"
                        style={{ fontFamily: playfairFonts.bold }}
                      >
                        {t("common.delete")}
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
};
