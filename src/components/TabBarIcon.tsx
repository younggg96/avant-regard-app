import React from "react";
import { Ionicons } from "@expo/vector-icons";

interface TabBarIconProps {
  name: string;
  color: string;
  focused: boolean;
}

const TabBarIcon: React.FC<TabBarIconProps> = ({ name, color, focused }) => {
  // Map our custom names to fashion-appropriate Ionicons
  const iconMap: {
    [key: string]: {
      focused: keyof typeof Ionicons.glyphMap;
      unfocused: keyof typeof Ionicons.glyphMap;
    };
  } = {
    home: {
      focused: "home",
      unfocused: "home-outline",
    },
    archive: {
      focused: "library",
      unfocused: "library-outline",
    },
    add: {
      focused: "add-circle",
      unfocused: "add-circle-outline",
    },
    notifications: {
      focused: "notifications",
      unfocused: "notifications-outline",
    },
    profile: {
      focused: "person-circle",
      unfocused: "person-circle-outline",
    },
    // Keep old ones for backward compatibility
    explore: {
      focused: "compass",
      unfocused: "compass-outline",
    },
    collections: {
      focused: "library",
      unfocused: "library-outline",
    },
    bookmark: {
      focused: "heart",
      unfocused: "heart-outline",
    },
    person: {
      focused: "person-circle",
      unfocused: "person-circle-outline",
    },
  };

  const iconConfig = iconMap[name];
  const iconName = focused ? iconConfig?.focused : iconConfig?.unfocused;

  return (
    <Ionicons
      name={iconName || "ellipse-outline"}
      size={focused ? 26 : 24}
      color={color}
    />
  );
};

export default TabBarIcon;
