import React from "react";
import { View } from "react-native";
import { Video, ResizeMode } from "expo-av";
import { styles } from "../styles";

export const BrandLogo: React.FC = () => {
  return (
    <View style={styles.brandContainer}>
      <Video
        source={require("../../../../assets/video/logo-video.mp4")}
        style={styles.logoImage}
        resizeMode={ResizeMode.CONTAIN}
        shouldPlay={true}
        isLooping={true}
        isMuted={true}
      />
    </View>
  );
};
