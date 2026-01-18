import React from "react";
import {
  View,
  ScrollView as RNScrollView,
  Image as RNImage,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Text, VStack, HStack } from "../ui";
import { Show } from "@/services/showService";
import { theme } from "../../theme";

interface RelatedShowsProps {
  shows: Show[];
  onShowPress: (show: Show) => void;
}

export const RelatedLooks: React.FC<RelatedShowsProps> = ({
  shows,
  onShowPress,
}) => {
  if (!shows || shows.length === 0) return null;

  return (
    <View style={styles.container}>
      {/* 标题区域 - 带有精致的分割线 */}
      <View style={styles.headerSection}>
        <View style={styles.headerLine} />
        <Text style={styles.headerTitle}>
          RUNWAY
        </Text>
        <View style={styles.headerLine} />
      </View>

      <RNScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {shows.map((show, index) => (
          <TouchableOpacity
            key={`show-${show.id || index}`}
            style={styles.showCard}
            onPress={() => onShowPress(show)}
            activeOpacity={0.9}
          >
            <RNImage
              source={{ uri: show.coverImage }}
              style={styles.showImage}
              resizeMode="cover"
            />
            <LinearGradient
              colors={["transparent", "rgba(0,0,0,0.75)"]}
              style={styles.showGradient}
            />
            <View style={styles.showInfo}>
              <Text style={styles.brandText}>
                {show.brand}
              </Text>
              <Text style={styles.seasonText}>
                {show.season}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </RNScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 20,
  },
  headerSection: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  headerLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.gray100,
  },
  headerTitle: {
    fontSize: 11,
    fontFamily: "Inter-Medium",
    color: theme.colors.gray300,
    letterSpacing: 3,
    marginHorizontal: 16,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  showCard: {
    width: 140,
    height: 185,
    borderRadius: 6,
    overflow: "hidden",
    marginRight: 12,
    position: "relative",
    backgroundColor: theme.colors.gray100,
  },
  showImage: {
    width: "100%",
    height: "100%",
  },
  showGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 90,
  },
  showInfo: {
    position: "absolute",
    bottom: 14,
    left: 12,
    right: 12,
  },
  brandText: {
    fontSize: 13,
    fontFamily: "Inter-Bold",
    color: "#FFFFFF",
    letterSpacing: 0.3,
    marginBottom: 3,
  },
  seasonText: {
    fontSize: 11,
    fontFamily: "Inter-Regular",
    color: "rgba(255,255,255,0.75)",
    letterSpacing: 0.2,
  },
});
