import React from "react";
import { HStack, Box, Text } from "../../../components/ui";
import { useAppTheme } from "../../../theme";

export const DateSeparator = ({ dateStr }: { dateStr: string }) => {
  const theme = useAppTheme();
  return (
    <HStack justifyContent="center" py="$sm" my="$xs">
      <Box px="$md" py="$xs" rounded="$full" style={{ backgroundColor: theme.colors.gray100 }}>
        <Text fontSize="$xs" style={{ color: theme.colors.gray300 }}>
          {dateStr}
        </Text>
      </Box>
    </HStack>
  );
};
