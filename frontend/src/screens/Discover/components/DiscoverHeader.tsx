import React from "react";
import { StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import { Box, Pressable, HStack } from "../../../components/ui";
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
    onSearchPress: () => void;
}

export const DiscoverHeader: React.FC<DiscoverHeaderProps> = ({
    onSearchPress,
}) => {
    const { t } = useTranslation();
    const theme = useAppTheme();
    const styles = useThemedStyles(makeStyles);

    return (
        <Box style={{ backgroundColor: theme.colors.background }} px="$md" pt={2} pb={0}>
            <HStack alignItems="center" justifyContent="space-between">
                <DiscoverLogo />
                <Pressable
                    onPress={onSearchPress}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={styles.searchButton}
                    accessibilityRole="button"
                    accessibilityLabel={t("discover.searchPlaceholder")}
                >
                    <Ionicons name="search" size={20} color={theme.colors.text} />
                </Pressable>
            </HStack>
        </Box>
    );
};

const makeStyles = (t: AppTheme) => StyleSheet.create({
    logoImage: {
        width: 92,
        height: 30,
    },
    searchButton: {
        width: 32,
        height: 32,
        alignItems: "center",
        justifyContent: "center",
    },
});

export default DiscoverHeader;
