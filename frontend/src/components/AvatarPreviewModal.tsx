/**
 * AvatarPreviewModal
 *
 * Fullscreen fade-in preview for a single avatar image. Shared by
 * `ProfileScreen` (自己的主页) and `UserProfileScreen` (他人主页) so the
 * interaction stays identical everywhere we expose an avatar tap.
 *
 * Why a dedicated component instead of reusing `FullscreenImageViewer`:
 *   - The viewer is a horizontally-paged `FlatList` tuned for post
 *     carousels; for a single avatar it forces a meaningless "1 / 1"
 *     counter and pays for a pager we don't need.
 *   - Tap-to-dismiss on the backdrop is the expected iOS/Android idiom
 *     for avatar previews.
 *
 * Pinch-to-zoom and double-tap are provided by `ZoomableImage`. Single-
 * tap still dismisses the overlay; because `ZoomableImage` sequences
 * single-tap after double-tap, a user who double-taps to zoom won't
 * accidentally dismiss the preview.
 */
import React from "react";
import {
  Dimensions,
  Modal,
  Pressable,
  StatusBar,
  StyleSheet,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ZoomableImage } from "./ZoomableImage";
import { theme } from "../theme";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

interface AvatarPreviewModalProps {
  visible: boolean;
  uri?: string | null;
  onClose: () => void;
}

export const AvatarPreviewModal: React.FC<AvatarPreviewModalProps> = ({
  visible,
  uri,
  onClose,
}) => {
  const insets = useSafeAreaInsets();

  if (!uri) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <StatusBar hidden />
      <GestureHandlerRootView style={styles.backdrop}>
        <View style={styles.imageContainer}>
          <ZoomableImage
            uri={uri}
            width={SCREEN_WIDTH}
            height={SCREEN_HEIGHT}
            onTap={onClose}
          />
        </View>
        <Pressable
          style={[styles.closeButton, { top: insets.top + 8 }]}
          onPress={onClose}
          hitSlop={12}
        >
          <Ionicons name="close" size={26} color="#FFF" />
        </Pressable>
      </GestureHandlerRootView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.96)",
    justifyContent: "center",
    alignItems: "center",
  },
  imageContainer: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  closeButton: {
    position: "absolute",
    right: 16,
    width: 36,
    height: 36,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
});

export default AvatarPreviewModal;
