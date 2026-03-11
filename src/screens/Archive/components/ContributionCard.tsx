import React from "react";
import { StyleSheet, Dimensions, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Box, Text, Image, VStack, HStack } from "../../../components/ui";
import { theme } from "../../../theme";
import { STATUS_STYLES } from "../types";

const CARD_GAP = 12;
const CARD_PADDING = 16;
const CARD_WIDTH =
  (Dimensions.get("window").width - CARD_PADDING * 2 - CARD_GAP) / 2;

export { CARD_GAP, CARD_PADDING, CARD_WIDTH };

interface ContributionCardProps {
  title: string;
  subtitle?: string;
  imageUri?: string;
  placeholderIcon: keyof typeof Ionicons.glyphMap;
  status: string;
  date?: string;
  onPress?: () => void;
}

const formatDate = (dateStr?: string) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const ContributionCard: React.FC<ContributionCardProps> = ({
  title,
  subtitle,
  imageUri,
  placeholderIcon,
  status,
  date,
  onPress,
}) => {
  const ss = STATUS_STYLES[status] || STATUS_STYLES.PENDING;

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.7}
      onPress={onPress}
    >
      <Box style={styles.imageContainer}>
        {imageUri ? (
          <Image
            source={{ uri: imageUri }}
            style={styles.image}
            resizeMode="cover"
          />
        ) : (
          <Box style={styles.imagePlaceholder}>
            <Ionicons
              name={placeholderIcon}
              size={32}
              color={theme.colors.gray300}
            />
          </Box>
        )}
      </Box>

      <VStack p={10}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
        <HStack justifyContent="between" mt={6}>
          <Box style={[styles.statusBadge, { backgroundColor: ss.bg }]}>
            <Text style={[styles.statusText, { color: ss.color }]}>
              {ss.label}
            </Text>
          </Box>
          <Text style={styles.dateText}>{formatDate(date)}</Text>
        </HStack>
      </VStack>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    marginBottom: CARD_GAP,
    borderRadius: 12,
    backgroundColor: "#FFF",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  imageContainer: {
    width: "100%",
    aspectRatio: 3 / 4,
    position: "relative",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  imagePlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: "#F5F5F5",
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1A1A1A",
    lineHeight: 18,
  },
  subtitle: {
    fontSize: 11,
    color: "#999",
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "600",
  },
  dateText: {
    fontSize: 10,
    color: theme.colors.gray300,
  },
});

export default ContributionCard;
