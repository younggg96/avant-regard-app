import React from "react";
import { StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import { Box, Pressable, HStack, NotificationBadge } from "../../../components/ui";
import { UserAvatar } from "../../../components/ui/UserAvatar";
import { useAppTheme, useThemedStyles, type AppTheme } from "../../../theme";

const headerLogoDark = require("../../../../assets/gif/header-logo-dark.gif");
const headerLogoLight = require("../../../../assets/gif/header-logo.gif");

const DiscoverLogo: React.FC = () => {
    const theme = useAppTheme();
    const styles = useThemedStyles(makeStyles);
    const source = theme.mode === "dark" ? headerLogoDark : headerLogoLight;
    return (
        <ExpoImage
            source={source}
            style={styles.logoImage}
            contentFit="contain"
        />
    );
};

interface DiscoverHeaderProps {
    avatar?: string;
    username?: string | null;
    totalInteractionUnread?: number;
    onAvatarPress: () => void;
    onInteractionPress: () => void;
}

export const DiscoverHeader: React.FC<DiscoverHeaderProps> = ({
    avatar,
    username,
    totalInteractionUnread = 0,
    onAvatarPress,
    onInteractionPress,
}) => {
    const { t } = useTranslation();
    const theme = useAppTheme();
    const styles = useThemedStyles(makeStyles);

    return (
        <Box style={{ backgroundColor: theme.colors.background }} px="$md" pt={2} pb={0}>
            <HStack alignItems="center" justifyContent="space-between">
                <DiscoverLogo />
                <HStack alignItems="center" space="md">
                    <Pressable
                        onPress={onInteractionPress}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        style={styles.interactionButton}
                        accessibilityRole="button"
                        accessibilityLabel={t("tabs.interaction")}
                    >
                        <Ionicons name="notifications-outline" size={22} color={theme.colors.text} />
                        <NotificationBadge count={totalInteractionUnread} size="sm" showBorder />
                    </Pressable>
                    <Pressable
                        onPress={onAvatarPress}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        accessibilityRole="button"
                        accessibilityLabel={t("tabs.profile")}
                    >
                        <UserAvatar
                            uri={avatar}
                            name={username}
                            size={32}
                            style={styles.avatar}
                        />
                    </Pressable>
                </HStack>
            </HStack>
        </Box>
    );
};

const makeStyles = (t: AppTheme) => StyleSheet.create({
    logoImage: {
        width: 92,
        height: 30,
    },
    avatar: {
        borderWidth: 1,
        borderColor: t.colors.border,
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
