import React from "react";
import { HStack, Box, Text, Pressable } from "../../../components/ui";

export const DateSeparator = ({ dateStr }: { dateStr: string }) => (
  <HStack justifyContent="center" py="$sm" my="$xs">
    <Box px="$md" py="$xs" rounded="$full" bg="$gray100">
      <Text fontSize="$xs" color="$gray300">
        {dateStr}
      </Text>
    </Box>
  </HStack>
);
