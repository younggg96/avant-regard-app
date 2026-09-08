import React from "react";
import { StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import { Box, Text, Pressable, HStack } from "../../../components/ui";
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

export const DiscoverHeader: React.FC = () => {
    const theme = useAppTheme();

    return (
        <Box style={{ backgroundColor: theme.colors.background }} px="$md" pt={2} pb={0}>
            <DiscoverLogo />
        </Box>
    );
};

interface DiscoverSearchBarProps {
    onSearchPress: () => void;
}

/** 一级 Tab 下方的搜索入口；与 Logo 行拆开，方便夹在 Tab 与内容之间。 */
export const DiscoverSearchBar: React.FC<DiscoverSearchBarProps> = ({
    onSearchPress,
}) => {
    const { t } = useTranslation();
    const theme = useAppTheme();
    const styles = useThemedStyles(makeStyles);

    return (
        <Box
            px="$md"
            style={{
                backgroundColor: theme.colors.background,
                paddingTop: 2,
                paddingBottom: 4,
            }}
        >
            <Pressable onPress={onSearchPress} style={styles.searchContainer}>
                <HStack alignItems="center" flex={1}>
                    <Ionicons
                        name="search"
                        size={16}
                        color={theme.colors.gray400}
                        style={styles.searchIcon}
                    />
                    <Text style={styles.searchText} numberOfLines={1}>
                        {t("discover.searchPlaceholder")}
                    </Text>
                </HStack>
            </Pressable>
        </Box>
    );
};

const makeStyles = (t: AppTheme) => StyleSheet.create({
    logoImage: {
        width: 92,
        height: 30,
    },
    searchContainer: {
        height: 32,
        backgroundColor: t.colors.gray50,
        borderRadius: t.borderRadius.sm,
        paddingHorizontal: 10,
        justifyContent: "center",
    },
    searchIcon: {
        marginRight: 6,
    },
    searchText: {
        flex: 1,
        fontSize: 13,
        color: t.colors.gray400,
    },
});

export default DiscoverHeader;
