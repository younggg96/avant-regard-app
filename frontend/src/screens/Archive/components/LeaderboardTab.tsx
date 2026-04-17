import React from "react";
import { StyleSheet } from "react-native";
import { ScrollView, Box } from "../../../components/ui";
import { ArchiveLeaderboard } from "../../Discover/components/ArchiveLeaderboard";

const LeaderboardTab: React.FC = () => (
  <ScrollView
    showsVerticalScrollIndicator={false}
    contentContainerStyle={styles.container}
  >
    <ArchiveLeaderboard />
  </ScrollView>
);

const styles = StyleSheet.create({
  container: {
    paddingBottom: 32,
  },
});

export default LeaderboardTab;
