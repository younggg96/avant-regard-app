import React from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from "react-native";
import { theme } from "../theme";
import { Lookbook } from "@avant-regard/core/src/types";

const { width } = Dimensions.get("window");
const CARD_WIDTH = width - theme.spacing.md * 2;
const CARD_HEIGHT = CARD_WIDTH * 1.25; // 4:5 ratio

interface RunwayShowCardProps {
  lookbook: Lookbook;
  onPress: () => void;
}

const RunwayShowCard: React.FC<RunwayShowCardProps> = ({
  lookbook,
  onPress,
}) => {
  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.95}
    >
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: lookbook.coverUrl }}
          style={styles.image}
          defaultSource={require("../../assets/placeholder.png")}
        />
        <View style={styles.overlay}>
          <Text style={styles.title}>{lookbook.title}</Text>
          <View style={styles.metaContainer}>
            <Text style={styles.location}>{lookbook.location}</Text>
            <Text style={styles.date}>{lookbook.date}</Text>
          </View>
        </View>
      </View>
      <View style={styles.descriptionContainer}>
        <Text style={styles.description} numberOfLines={2}>
          {lookbook.description}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: theme.spacing.lg,
    backgroundColor: theme.colors.white,
  },
  imageContainer: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    position: "relative",
  },
  image: {
    width: "100%",
    height: "100%",
    backgroundColor: theme.colors.gray100,
  },
  overlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: theme.spacing.md,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  title: {
    ...theme.typography.h2,
    color: theme.colors.white,
    marginBottom: theme.spacing.xs,
  },
  metaContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  location: {
    ...theme.typography.caption,
    color: theme.colors.gray200,
    textTransform: "uppercase",
  },
  date: {
    ...theme.typography.caption,
    color: theme.colors.gray200,
  },
  descriptionContainer: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.white,
  },
  description: {
    ...theme.typography.bodySmall,
    color: theme.colors.gray500,
    lineHeight: 20,
  },
});

export default RunwayShowCard;
