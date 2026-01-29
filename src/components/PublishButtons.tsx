import React from "react";
import { Ionicons } from "@expo/vector-icons";
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
  draftButtonText = "存草稿",
  publishButtonText = "发布",
  showDraftButton = true,
  publishDisabled = false,
  draftDisabled = false,
}) => {
  return (
    <Box
      position="absolute"
      bottom={6}
      left={0}
      right={0}
      bg="$white"
      px="$lg"
      py="$md"
      borderTopWidth={1}
      borderTopColor="$gray200"
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
                color={theme.colors.gray600}
              />
              <Text color="$gray600" ml="$xs" fontWeight="$medium">
                {draftButtonText}
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
            <Text color="$white" ml="$xs" fontWeight="$medium">
              {publishButtonText}
            </Text>
          </HStack>
        </Pressable>
      </HStack>
    </Box>
  );
};

export default PublishButtons;
