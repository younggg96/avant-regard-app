import React from "react";
import { ImageStyle, StyleProp } from "react-native";
import { Image as ExpoImage } from "expo-image";
import { APP_LOGO } from "../../constants/customerService";

interface CustomerServiceAvatarProps {
  size?: number;
  style?: StyleProp<ImageStyle>;
}

export const CustomerServiceAvatar: React.FC<CustomerServiceAvatarProps> = ({
  size = 40,
  style,
}) => (
  <ExpoImage
    source={APP_LOGO}
    style={[{ width: size, height: size, borderRadius: size / 2 }, style]}
    contentFit="cover"
  />
);
