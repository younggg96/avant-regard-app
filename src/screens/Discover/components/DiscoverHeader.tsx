import React from "react";
import { StyleSheet, Image as RNImage, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ResizeMode, Video } from "expo-av";
import { Box, Text, Pressable, HStack, VStack } from "../../../components/ui";
import { theme } from "../../../theme";

interface DiscoverHeaderProps {
    avatar?: string;
    unreadCount?: number;
    onAvatarPress: () => void;
    onSearchPress: () => void;
    onNotificationPress: () => void;
}

/**
 * 发现页顶部栏组件 - FARFETCH 风格
 * 第一行：左侧 Logo/视频，右侧头像+通知
 * 第二行：搜索框独立一行
 */
export const DiscoverHeader: React.FC<DiscoverHeaderProps> = ({
    avatar,
    unreadCount = 0,
    onAvatarPress,
    onSearchPress,
    onNotificationPress,
}) => {
    return (
        <Box bg="$white" px="$md" pt="$sm" pb="$md">
            <VStack space="sm">
                {/* 第一行：Logo/视频 + 头像 + 通知 */}
                <HStack alignItems="center" justifyContent="space-between">
                    {/* 左侧 Logo 视频 */}
                    <Video
                        source={require("../../../../assets/video/header1.mp4")}
                        style={styles.logoVideo}
                        resizeMode={ResizeMode.CONTAIN}
                        shouldPlay
                        isLooping
                        isMuted
                    />

                    {/* 右侧：头像 + 通知图标 */}
                    <HStack alignItems="center" space="md">
                        {/* 头像 */}
                        <Pressable
                            onPress={onAvatarPress}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            {avatar ? (
                                <RNImage source={{ uri: avatar }} style={styles.avatar} />
                            ) : (
                                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                                    <Ionicons name="person" size={18} color={theme.colors.white} />
                                </View>
                            )}
                        </Pressable>

                        {/* 通知图标 */}
                        <Pressable
                            onPress={onNotificationPress}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            style={styles.notificationButton}
                        >
                            <Ionicons
                                name="notifications-outline"
                                size={24}
                                color={theme.colors.black}
                            />
                            {unreadCount > 0 && (
                                <View style={styles.badge}>
                                    <Text style={styles.badgeText}>
                                        {unreadCount > 99 ? "99+" : unreadCount}
                                    </Text>
                                </View>
                            )}
                        </Pressable>
                    </HStack>
                </HStack>

                {/* 第二行：搜索框 */}
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
        borderRadius: 16, // 圆形
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
        fontFamily: __DEV__ ? "System" : "Inter-Regular",
        color: theme.colors.gray400,
    },
    notificationButton: {
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
        lineHeight: 16,
        includeFontPadding: false,
    },
});

export default DiscoverHeader;
