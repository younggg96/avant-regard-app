import React from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useVideoPlayer, VideoView } from "expo-video";
import { Box, Text, Pressable, HStack, VStack } from "../../../components/ui";
import { OptimizedImage } from "../../../components/ui/OptimizedImage";
import { ImageSize } from "../../../utils/imageUtils";
import { theme } from "../../../theme";

const headerVideoSource = require("../../../../assets/video/header1.mp4");

const DiscoverLogoVideo: React.FC = () => {
  const player = useVideoPlayer(headerVideoSource, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  return (
    <VideoView
      player={player}
      style={styles.logoVideo}
      contentFit="contain"
      nativeControls={false}
    />
  );
};

interface DiscoverHeaderProps {
    avatar?: string;
    totalInteractionUnread?: number;
    onAvatarPress: () => void;
    onSearchPress: () => void;
    onInteractionPress: () => void;
}

export const DiscoverHeader: React.FC<DiscoverHeaderProps> = ({
    avatar,
    totalInteractionUnread = 0,
    onAvatarPress,
    onSearchPress,
    onInteractionPress,
}) => {
    return (
        <Box bg="$white" px="$md" pt="$sm" pb="$md">
            <VStack space="sm">
                <HStack alignItems="center" justifyContent="space-between">
                    <DiscoverLogoVideo />

                    <HStack alignItems="center" space="md">
                        <Pressable
                            onPress={onAvatarPress}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            {avatar ? (
                                <OptimizedImage
                                    uri={avatar}
                                    size={ImageSize.THUMBNAIL}
                                    style={styles.avatar}
                                    contentFit="cover"
                                    lazy={true}
                                />
                            ) : (
                                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                                    <Ionicons name="person" size={18} color={theme.colors.white} />
                                </View>
                            )}
                        </Pressable>

                        {/* Interaction icon (messages + notifications) */}
                        <Pressable
                            onPress={onInteractionPress}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            style={styles.interactionButton}
                        >
                            <Ionicons
                                name="chatbubbles-outline"
                                size={24}
                                color={theme.colors.black}
                            />
                            {totalInteractionUnread > 0 && (
                                <View style={styles.badge}>
                                    <Text style={styles.badgeText}>
                                        {totalInteractionUnread > 99 ? "99+" : totalInteractionUnread}
                                    </Text>
                                </View>
                            )}
                        </Pressable>
                    </HStack>
                </HStack>

                <Pressable onPress={onSearchPress} style={styles.searchContainer}>
                    <HStack alignItems="center" flex={1}>
                        <Ionicons
                            name="search"
                            size={20}
                            color={theme.colors.gray400}
                            style={styles.searchIcon}
                        />
                        <Text style={styles.searchText} numberOfLines={1}>
                            搜索品牌、单品、穿搭...
                        </Text>
                    </HStack>
                </Pressable>
            </VStack>
        </Box>
    );
};

const styles = StyleSheet.create({
    logoVideo: {
        width: 140,
        height: 36,
    },
    avatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: theme.colors.gray100,
    },
    avatarPlaceholder: {
        backgroundColor: theme.colors.gray300,
        justifyContent: "center",
        alignItems: "center",
    },
    searchContainer: {
        height: 40,
        backgroundColor: theme.colors.gray50,
        borderRadius: theme.borderRadius.sm,
        paddingHorizontal: 12,
        justifyContent: "center",
    },
    searchIcon: {
        marginRight: 6,
    },
    searchText: {
        flex: 1,
        fontSize: 16,
        fontFamily: __DEV__ ? "Georgia" : "PlayfairDisplay-Regular",
        color: theme.colors.gray400,
    },
    interactionButton: {
        position: "relative",
        width: 32,
        height: 32,
        justifyContent: "center",
        alignItems: "center",
    },
    badge: {
        position: "absolute",
        top: -2,
        right: -2,
        minWidth: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: theme.colors.error,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 4,
    },
    badgeText: {
        color: theme.colors.white,
        fontSize: 12,
        fontWeight: "600",
        textAlign: "center",
        lineHeight: 12,
        includeFontPadding: false,
    },
});

export default DiscoverHeader;
