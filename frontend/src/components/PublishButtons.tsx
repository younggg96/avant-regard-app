import React from "react";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Box, Text, HStack, Pressable } from "./ui";
import { theme } from "../theme";

interface PublishButtonsProps {
  onSaveDraft: () => void;
  onPublish: () => void;
  draftButtonText?: string;
  publishButtonText?: string;
  showDraftButton?: boolean;
  publishDisabled?: boolean;
  draftDisabled?: boolean;
}

const PublishButtons: React.FC<PublishButtonsProps> = ({
  onSaveDraft,
  onPublish,
  draftButtonText,
  publishButtonText,
  showDraftButton = true,
  publishDisabled = false,
  draftDisabled = false,
}) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const draftLabel = draftButtonText || t("publishButtons.saveDraft");
  const publishLabel = publishButtonText || t("publishButtons.publish");
  return (
    <Box
      position="absolute"
      bottom={0}
      left={0}
      right={0}
      bg="$white"
      px="$lg"
      pt="$md"
      borderTopWidth={1}
      borderTopColor="$gray200"
      style={{ paddingBottom: Math.max(insets.bottom, 12) }}
    >
      <HStack>
        {showDraftButton && (
          <Pressable
            flex={1}
            py="$md"
            mr="$sm"
            bg="$gray200"
            rounded="$md"
            onPress={draftDisabled ? undefined : onSaveDraft}
            opacity={draftDisabled ? 0.6 : 1}
            disabled={draftDisabled}
          >
            <HStack justifyContent="center" alignItems="center" gap="$xs">
              <Ionicons
                name="bookmark-outline"
                size={20}
                color={theme.colors.white}
              />
              <Text color="$white" ml="$xs" fontWeight="$medium" fontSize="$sm">
                {draftLabel}
              </Text>
            </HStack>
          </Pressable>
        )}
        <Pressable
          flex={showDraftButton ? 2 : 1}
          py="$md"
          ml={showDraftButton ? "$sm" : undefined}
          bg={publishDisabled ? "$gray200" : "$accent"}
          rounded="$md"
          onPress={publishDisabled ? undefined : onPublish}
          opacity={publishDisabled ? 0.6 : 1}
          disabled={publishDisabled}
        >
          <HStack justifyContent="center" alignItems="center" gap="$xs">
            <Ionicons name="paper-plane" size={20} color={theme.colors.white} />
            <Text color="$white" ml="$xs" fontWeight="$medium" fontSize="$sm">
              {publishLabel}
            </Text>
          </HStack>
        </Pressable>
      </HStack>
    </Box>
  );
};

export default PublishButtons;
