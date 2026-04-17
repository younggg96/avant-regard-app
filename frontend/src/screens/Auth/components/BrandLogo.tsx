import React from "react";
import { View } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { styles } from "../styles";

const logoSource = require("../../../../assets/video/logo-video.mp4");

export const BrandLogo: React.FC = () => {
  const player = useVideoPlayer(logoSource, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  return (
    <View style={styles.brandContainer}>
      <VideoView
        player={player}
        style={styles.logoImage}
        contentFit="contain"
        nativeControls={false}
      />
    </View>
  );
};
