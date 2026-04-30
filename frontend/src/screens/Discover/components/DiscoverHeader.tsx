import React from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import { Box, Text, Pressable, HStack, VStack, NotificationBadge } from "../../../components/ui";
import { OptimizedImage } from "../../../components/ui/OptimizedImage";
import { ImageSize } from "../../../utils/imageUtils";
import { theme } from "../../../theme";

const headerLogoSource = require("../../../../assets/gif/header-logo.gif");

const DiscoverLogo: React.FC = () => (
    <ExpoImage
        source={headerLogoSource}
        style={styles.logoImage}
        contentFit="contain"
    />
);

interface DiscoverHeaderProps {
    avatar?: string;
    totalInteractionUnread?: number;
    onAvatarPress: () => void;
    onSearchPress: () => void;
    onInteractionPress: () => void;
}

export const DiscoverHeader: React.FC<DiscoverHeaderProps> = ({
    avatar,
    onAvatarPress,
    onSearchPress,
}) => {
    const { t } = useTranslation();

    return (
        <Box bg="$white" px="$md" pt="$xs">
            <VStack space="sm">
                <HStack alignItems="center" justifyContent="space-between">
                    <DiscoverLogo />

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
                            {t("discover.searchPlaceholder")}
                        </Text>
                    </HStack>
                </Pressable>
            </VStack>
        </Box>
    );
};

const styles = StyleSheet.create({
    logoImage: {
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
});

export default DiscoverHeader;
