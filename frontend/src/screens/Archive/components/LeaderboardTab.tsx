import React from "react";
import { StyleSheet } from "react-native";
import { ScrollView } from "../../../components/ui";
import { useThemedStyles, type AppTheme } from "../../../theme";
import { ArchiveLeaderboard } from "../../Discover/components/ArchiveLeaderboard";

const LeaderboardTab: React.FC = () => {
  const styles = useThemedStyles(makeStyles);
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      <ArchiveLeaderboard />
    </ScrollView>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: {
      flexGrow: 1,
      paddingBottom: 32,
    },
  });

export default LeaderboardTab;
