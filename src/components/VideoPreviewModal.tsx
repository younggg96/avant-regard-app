import React from "react";
import { Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useVideoPlayer, VideoView } from "expo-video";
import { Box, Pressable } from "./ui";

interface VideoPreviewModalProps {
  visible: boolean;
  uri: string;
  onClose: () => void;
}

export const VideoPreviewModal: React.FC<VideoPreviewModalProps> = ({
  visible,
  uri,
  onClose,
}) => {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.play();
  });

  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} animationType="fade" transparent={false}>
      <Box
        flex={1}
        bg="black"
        style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
      >
        <Box h={50} flexDirection="row" alignItems="center" px={16} zIndex={10}>
          <Pressable
            w={36}
            h={36}
            rounded="$full"
            bg="rgba(255, 255, 255, 0.15)"
            alignItems="center"
            justifyContent="center"
            onPress={onClose}
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
          >
            <Ionicons name="close" size={22} color="white" />
          </Pressable>
        </Box>
        <VideoView
          player={player}
          style={{ flex: 1 }}
          contentFit="contain"
          nativeControls
        />
      </Box>
    </Modal>
  );
};

export default VideoPreviewModal;
