import React, { useState, useEffect } from "react";
import { View, Image, StyleSheet, ViewStyle, ImageStyle, StyleProp, ActivityIndicator } from "react-native";
import * as FileSystem from "expo-file-system";

import { getVideoThumbnail } from "../utils/videoThumbnail";
import {
  peekMediaAspectRatio,
  rememberMediaAspectRatio,
} from "../utils/useMediaAspectRatio";

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const thumbCacheDir = FileSystem.cacheDirectory + "video_thumbs/";
        const dirInfo = await FileSystem.getInfoAsync(thumbCacheDir);
        if (!dirInfo.exists) {
          await FileSystem.makeDirectoryAsync(thumbCacheDir, { intermediates: true });
        }

        const thumbPath = thumbCacheDir + getCacheKey(cleanUri) + ".jpg";
        const cachedThumb = await FileSystem.getInfoAsync(thumbPath);
        if (cachedThumb.exists) {
          if (!cancelled) {
            setThumbnail(thumbPath);
            setLoading(false);
          }
          // On warm-cache mounts we skipped the native decoder entirely, so
          // the sibling `useMediaAspectRatio` hook would otherwise stay on
          // its 3/4 fallback. If we haven't already published a ratio this
          // session, decode the cached JPG (cheap, no VideoToolbox) and
          // share its natural size so every consumer snaps to the true
          // cover aspect ratio without triggering another AVAsset pass.
          if (!cancelled && peekMediaAspectRatio(cleanUri) == null) {
            Image.getSize(
              thumbPath,
              (w, h) => {
                if (!cancelled) rememberMediaAspectRatio(cleanUri, w, h);
              },
              () => {
                /* ignore — placeholder stays on fallback ratio */
              }
            );
          }
          return;
        }

        // Try generating thumbnail directly from the URL (works on iOS)
        let thumb = await getVideoThumbnail(cleanUri);

        // If direct URL fails, download the video first then try
        if (!thumb) {
          const cacheDir = FileSystem.cacheDirectory + "video_cache/";
          const vDirInfo = await FileSystem.getInfoAsync(cacheDir);
          if (!vDirInfo.exists) {
            await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true });
          }
          const dest = cacheDir + getCacheKey(cleanUri) + ".mp4";
          const fileInfo = await FileSystem.getInfoAsync(dest);

          let localPath = dest;
          if (!fileInfo.exists) {
            const result = await FileSystem.downloadAsync(cleanUri, dest);
            if (result.status !== 200) {
              if (!cancelled) setLoading(false);
              return;
            }
            localPath = result.uri;
          }
          thumb = await getVideoThumbnail(localPath);
        }

        if (!cancelled && thumb) {
          await FileSystem.copyAsync({ from: thumb.uri, to: thumbPath }).catch(() => {});
          setThumbnail(thumb.uri);
          // Share the measured aspect ratio with other mounted consumers
          // (e.g. PostCard, PostContentSection) so they don't redecode the
          // same video just to know its shape.
          rememberMediaAspectRatio(cleanUri, thumb.width, thumb.height);
        }
      } catch {
        // Thumbnail generation failed
      } finally {
        if (!cancelled) setLoading(false);
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
        <View style={[styles.image, styles.placeholder, imageStyle]}>
          {loading && <ActivityIndicator color="rgba(255,255,255,0.5)" />}
        </View>
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
    justifyContent: "center",
    alignItems: "center",
  },
});
