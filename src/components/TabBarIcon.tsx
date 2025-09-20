import React from "react";
import { View, Text } from "react-native";
import { theme } from "../theme";

interface TabBarIconProps {
  name: string;
  color: string;
  focused: boolean;
}

const TabBarIcon: React.FC<TabBarIconProps> = ({ name, color, focused }) => {
  // Using text icons as placeholders - in production, use react-native-vector-icons
  const iconMap: { [key: string]: string } = {
    explore: "◉",
    collections: "▣",
    bookmark: "▾",
    person: "◎",
  };

  return (
    <View style={{ alignItems: "center" }}>
      <Text style={{ color, fontSize: focused ? 24 : 20 }}>
        {iconMap[name] || "○"}
      </Text>
    </View>
  );
};

export default TabBarIcon;
