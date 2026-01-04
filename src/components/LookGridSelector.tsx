import React from "react";
import { Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Box, Text, HStack, Pressable, Image } from "./ui";
import { theme } from "../theme";

const { width: screenWidth } = Dimensions.get("window");

export interface SelectedLook {
  id: number;
  designer: string;
  season: string;
  imageUrl: string;
}

interface LookGridSelectorProps {
  selectedLooks: SelectedLook[];
  onLookPress: (look: SelectedLook, index: number) => void;
  onRemoveLook: (index: number) => void;
  onAddLook: () => void;
  maxLooks?: number;
  label?: string;
  required?: boolean;
}

const LookGridSelector: React.FC<LookGridSelectorProps> = ({
  selectedLooks,
  onLookPress,
  onRemoveLook,
  onAddLook,
  maxLooks = 6,
  label = "关联造型",
  required = false,
}) => {
  const lookWidth = (screenWidth - 48 - 16) / 3;

  return (
    <Box mx="$md" mb="$md">
      <HStack mb="$sm" alignItems="center">
        <Text color="$gray600" fontSize="$sm">
          {label}
        </Text>
        {required && (
          <Text color="$red500" fontSize="$sm" ml="$xs">
            *
          </Text>
        )}
      </HStack>

      <HStack flexWrap="wrap" gap="$sm" pl="$sm">
        {selectedLooks.map((look, index) => (
          <Box key={`look-${index}`} w={lookWidth} position="relative">
            <Pressable onPress={() => onLookPress(look, index)}>
              <Box
                borderWidth={1}
                borderColor="$gray200"
                rounded="$md"
                overflow="hidden"
                bg="$white"
              >
                <Image
                  source={{ uri: look.imageUrl }}
                  style={{
                    width: "100%",
                    height: lookWidth * 1.5,
                  }}
                />
                <Box p="$xs" bg="$white">
                  <Text
                    fontSize="$xs"
                    color="$black"
                    fontWeight="$medium"
                    numberOfLines={1}
                  >
                    {look.designer}
                  </Text>
                  <Text fontSize={10} color="$gray400" numberOfLines={1}>
                    {look.season}
                  </Text>
                </Box>
              </Box>
            </Pressable>

            <Pressable
              position="absolute"
              top={4}
              right={4}
              w={24}
              h={24}
              rounded="$full"
              bg="rgba(0,0,0,0.7)"
              alignItems="center"
              justifyContent="center"
              onPress={() => onRemoveLook(index)}
            >
              <Ionicons name="close" size={14} color={theme.colors.white} />
            </Pressable>
          </Box>
        ))}

        {selectedLooks.length < maxLooks && (
          <Pressable
            w={lookWidth}
            h={lookWidth * 1.5 + 44}
            rounded="$sm"
            bg="$gray100"
            alignItems="center"
            justifyContent="center"
            onPress={onAddLook}
          >
            <Ionicons
              name="add-circle-outline"
              size={32}
              color={theme.colors.gray400}
            />
            <Text color="$gray400" fontSize="$xs" mt="$xs">
              添加造型
            </Text>
          </Pressable>
        )}
      </HStack>
    </Box>
  );
};

export default LookGridSelector;
