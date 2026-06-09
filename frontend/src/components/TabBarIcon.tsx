import React, { useEffect } from "react";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
  withTiming,
} from "react-native-reanimated";

const AnimatedIonicons = Animated.createAnimatedComponent(Ionicons);

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
    map: {
      focused: "map",
      unfocused: "map-outline",
    },
    interaction: {
      focused: "map",
      unfocused: "map-outline",
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

  // 选中态做一次「弹一下」的微动效：先轻微上抬 + 放大，再回落定格，
  // 给底部导航的切换一点物理回弹感，而不是生硬地直接换图标。
  const scale = useSharedValue(focused ? 1 : 0.92);
  const translateY = useSharedValue(0);

  useEffect(() => {
    if (focused) {
      scale.value = withSpring(1.12, { damping: 12, stiffness: 220 });
      translateY.value = withSequence(
        withTiming(-3, { duration: 120 }),
        withSpring(0, { damping: 10, stiffness: 200 })
      );
    } else {
      scale.value = withSpring(0.92, { damping: 14, stiffness: 220 });
      translateY.value = withTiming(0, { duration: 120 });
    }
  }, [focused, scale, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
  }));

  return (
    <AnimatedIonicons
      name={iconName || "ellipse-outline"}
      size={24}
      color={color}
      style={animatedStyle}
    />
  );
};

export default TabBarIcon;
