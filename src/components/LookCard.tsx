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
import { Look } from "@avant-regard/core/src/types";

const { width } = Dimensions.get("window");
const CARD_WIDTH = (width - theme.spacing.md * 3) / 2;
const CARD_HEIGHT = CARD_WIDTH * 1.33; // 3:4 ratio

interface LookCardProps {
  look: Look;
  onPress: () => void;
  isGrid?: boolean;
}

const LookCard: React.FC<LookCardProps> = ({
  look,
  onPress,
  isGrid = true,
}) => {
  const cardStyle = isGrid ? styles.gridContainer : styles.listContainer;
  const imageStyle = isGrid ? styles.gridImage : styles.listImage;

  return (
    <TouchableOpacity style={cardStyle} onPress={onPress} activeOpacity={0.9}>
      <Image
        source={{ uri: look.images[0] }}
        style={imageStyle}
        defaultSource={require("../../assets/placeholder.png")}
      />
      <View style={styles.infoContainer}>
        <Text style={styles.index}>LOOK {look.index}</Text>
        {look.title && (
          <Text style={styles.title} numberOfLines={1}>
            {look.title}
          </Text>
        )}
        {look.silhouette && (
          <Text style={styles.silhouette} numberOfLines={1}>
            {look.silhouette}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  gridContainer: {
    width: CARD_WIDTH,
    marginBottom: theme.spacing.md,
  },
  listContainer: {
    width: "100%",
    marginBottom: theme.spacing.lg,
  },
  gridImage: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: theme.colors.gray100,
  },
  listImage: {
    width: "100%",
    height: width * 0.75,
    backgroundColor: theme.colors.gray100,
  },
  infoContainer: {
    paddingTop: theme.spacing.sm,
  },
  index: {
    ...theme.typography.caption,
    color: theme.colors.gray400,
    letterSpacing: 1,
    marginBottom: 2,
  },
  title: {
    ...theme.typography.bodySmall,
    color: theme.colors.black,
    fontFamily: __DEV__ ? "System" : "Inter-Medium",
  },
  silhouette: {
    ...theme.typography.caption,
    color: theme.colors.gray300,
    fontStyle: "italic",
    marginTop: 2,
  },
});

export default LookCard;
