import React, { useState, useEffect } from "react";
import { View, Image, StyleSheet, ViewStyle, ImageStyle, StyleProp } from "react-native";
import * as FileSystem from "expo-file-system";

import { getVideoThumbnail } from "../utils/videoThumbnail";

function cleanVideoUri(uri: string): string {
  return uri.endsWith("?") ? uri.slice(0, -1) : uri;
}

function getCacheKey(uri: string): string {
  return uri.replace(/[^a-zA-Z0-9]/g, "_").slice(-80);
}

interface VideoThumbnailViewProps {
  uri: string;
  style: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
}

export const VideoThumbnailView: React.FC<VideoThumbnailViewProps> = ({
  uri,
  style,
  imageStyle,
}) => {
  const cleanUri = cleanVideoUri(uri);
  const [thumbnail, setThumbnail] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cacheDir = FileSystem.cacheDirectory + "video_cache/";
        const dirInfo = await FileSystem.getInfoAsync(cacheDir);
        if (!dirInfo.exists) {
          await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true });
        }
        const dest = cacheDir + getCacheKey(cleanUri) + ".mp4";
        let localPath = dest;
        const fileInfo = await FileSystem.getInfoAsync(dest);
        if (!fileInfo.exists) {
          const result = await FileSystem.downloadAsync(cleanUri, dest);
          if (result.status !== 200) return;
          localPath = result.uri;
        }
        const thumb = await getVideoThumbnail(localPath);
        if (!cancelled && thumb) setThumbnail(thumb);
      } catch {
        // Thumbnail generation failed silently
      }
    })();
    return () => { cancelled = true; };
  }, [cleanUri]);

  return (
    <View style={[styles.container, style]}>
      {thumbnail ? (
        <Image
          source={{ uri: thumbnail }}
          style={[styles.image, imageStyle]}
        />
      ) : (
        <View style={[styles.image, styles.placeholder, imageStyle]} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  placeholder: {
    backgroundColor: "#1a1a1a",
  },
});
