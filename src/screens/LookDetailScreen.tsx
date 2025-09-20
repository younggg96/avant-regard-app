import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { theme } from "../theme";

const LookDetailScreen = ({ route }: any) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Look Detail</Text>
      <Text style={styles.subtitle}>ID: {route.params?.id}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
    padding: theme.spacing.md,
  },
  title: {
    ...theme.typography.h1,
    color: theme.colors.black,
  },
  subtitle: {
    ...theme.typography.body,
    color: theme.colors.gray400,
    marginTop: theme.spacing.sm,
  },
});

export default LookDetailScreen;
