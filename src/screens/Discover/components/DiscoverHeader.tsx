import React from "react";
import { StyleSheet, Image as RNImage, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Box, Text, Pressable, HStack } from "../../../components/ui";
import { theme } from "../../../theme";

interface DiscoverHeaderProps {
    username?: string;
    avatar?: string;
    unreadCount?: number;
    onAvatarPress: () => void;
    onSearchPress: () => void;
    onNotificationPress: () => void;
}

/**
 * 发现页顶部栏组件 - B站风格
 * 左侧：用户头像
 * 中间：搜索框（带欢迎语）
 * 右侧：消息通知图标
 */
export const DiscoverHeader: React.FC<DiscoverHeaderProps> = ({
    username,
    avatar,
    unreadCount = 0,
    onAvatarPress,
    onSearchPress,
    onNotificationPress,
}) => {
    // 获取显示的用户名（最多显示8个字符）
    const displayName = username
        ? username.length > 8
            ? username.slice(0, 8) + "..."
            : username
        : "时尚爱好者";

    return (
        <Box bg="$white" px="$md" py="$sm">
            <HStack alignItems="center" justifyContent="space-between">
                {/* 左侧头像 */}
                <Pressable
                    onPress={onAvatarPress}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    {avatar ? (
                        <RNImage source={{ uri: avatar }} style={styles.avatar} />
                    ) : (
                        <View style={[styles.avatar, styles.avatarPlaceholder]}>
                            <Ionicons name="person" size={16} color={theme.colors.white} />
                        </View>
                    )}
                </Pressable>

                {/* 中间搜索框 */}
                <Pressable onPress={onSearchPress} style={styles.searchContainer}>
                    <HStack alignItems="center" flex={1}>
                        <Ionicons
                            name="search-outline"
                            size={16}
                            color={theme.colors.gray300}
                            style={styles.searchIcon}
                        />
                        <Text style={styles.searchText} numberOfLines={1}>
                            欢迎，{displayName}
                        </Text>
                    </HStack>
                </Pressable>

                {/* 右侧消息图标 */}
                <Pressable
                    onPress={onNotificationPress}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={styles.notificationButton}
                >
                    <Ionicons
                        name="notifications-outline"
                        size={22}
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
        </Box>
    );
};

const styles = StyleSheet.create({
    avatar: {
        width: 32,
        height: 32,
        borderRadius: theme.borderRadius.sm, // 方形小圆角
        borderWidth: 1,
        borderColor: theme.colors.gray100,
    },
    avatarPlaceholder: {
        backgroundColor: theme.colors.gray300,
        justifyContent: "center",
        alignItems: "center",
    },
    searchContainer: {
        flex: 1,
        marginHorizontal: 12,
        height: 40,
        backgroundColor: theme.colors.gray50,
        borderRadius: theme.borderRadius.sm, // 方形小圆角
        paddingHorizontal: 12,
        justifyContent: "center",
    },
    searchIcon: {
        marginRight: 6,
    },
    searchText: {
        flex: 1,
        fontSize: 13,
        color: theme.colors.gray300,
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
        fontSize: 10,
        fontWeight: "600",
    },
});

export default DiscoverHeader;
