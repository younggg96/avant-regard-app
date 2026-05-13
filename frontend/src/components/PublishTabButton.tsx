import React from "react";
import { View, TouchableOpacity, StyleSheet, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { theme, useThemedStyles, type AppTheme } from "../theme";

interface PublishTabButtonProps {
  onPress?: (event: any) => void;
}

const PublishTabButton: React.FC<PublishTabButtonProps> = ({ onPress }) => {
  const navigation = useNavigation();
  const styles = useThemedStyles(makeStyles);

  const handlePress = () => {
    // @ts-ignore - navigation types
    navigation.navigate("PublishType");
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      <View style={styles.button}>
        <Ionicons name="add" size={28} color={theme.colors.textInverted} />
      </View>
    </TouchableOpacity>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: {
      top: -10, // Slightly elevated above the tab bar
      justifyContent: "center",
      alignItems: "center",
    },
    button: {
      width: 56,
      height: 56,
      borderRadius: 8,
      backgroundColor: t.colors.accent,
      justifyContent: "center",
      alignItems: "center",
      shadowColor: t.colors.accent,
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
  });

export default PublishTabButton;
