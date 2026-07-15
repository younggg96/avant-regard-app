/**
 * 店铺图片全部页 —— 从 StoreDetail「查看全部图片」进入。
 * 2 列网格展示全部店铺图；点击任意图片进入全屏查看，可左右滑动切换。
 */
import React, { useCallback, useMemo, useState } from "react";
import {
  Dimensions,
  FlatList,
  ListRenderItem,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { Box, Pressable, Text } from "../components/ui";
import ScreenHeader from "../components/ScreenHeader";
import { OptimizedImage } from "../components/ui/OptimizedImage";
import { ImageSize } from "../utils/imageUtils";
import { FullscreenImageViewer } from "../components/PostDetail";
import { useThemedStyles, type AppTheme, useAppTheme } from "../theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const GRID_PADDING = 16;
const GRID_GAP = 8;
const COLUMNS = 2;
const CELL_SIZE =
  (SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP * (COLUMNS - 1)) / COLUMNS;

export type StoreImageGalleryRouteParams = {
  images: string[];
  storeName?: string;
  initialIndex?: number;
};

type RouteParams = {
  StoreImageGallery: StoreImageGalleryRouteParams;
};

const StoreImageGalleryScreen: React.FC = () => {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RouteParams, "StoreImageGallery">>();

  const images = useMemo(
    () => (route.params?.images ?? []).filter(Boolean),
    [route.params?.images]
  );
  const storeName = route.params?.storeName;

  const [fullscreenVisible, setFullscreenVisible] = useState(false);
  const [fullscreenIndex, setFullscreenIndex] = useState(
    route.params?.initialIndex ?? 0
  );

  const openFullscreen = useCallback((index: number) => {
    setFullscreenIndex(index);
    setFullscreenVisible(true);
  }, []);

  const closeFullscreen = useCallback(() => {
    setFullscreenVisible(false);
  }, []);

  const renderItem: ListRenderItem<string> = useCallback(
    ({ item, index }) => (
      <Pressable
        onPress={() => openFullscreen(index)}
        style={[
          styles.cell,
          // 右列不加右边距，靠 gap 控制；FlatList numColumns 用 margin 更稳妥
          (index + 1) % COLUMNS !== 0 && { marginRight: GRID_GAP },
        ]}
      >
        <OptimizedImage
          uri={item}
          size={ImageSize.MEDIUM}
          style={styles.image}
          contentFit="cover"
          lazy
        />
      </Pressable>
    ),
    [openFullscreen, styles]
  );

  const title = t("store.storeImages");

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <ScreenHeader
        title={title}
        subtitle={storeName}
        showBack
        onBackPress={() => navigation.goBack()}
      />

      {images.length === 0 ? (
        <Box style={styles.empty}>
          <Text fontSize={14} style={{ color: theme.colors.gray400 }}>
            {t("store.noStoreImages")}
          </Text>
        </Box>
      ) : (
        <FlatList
          data={images}
          keyExtractor={(uri, idx) => `${uri}-${idx}`}
          numColumns={COLUMNS}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      <FullscreenImageViewer
        visible={fullscreenVisible}
        images={images}
        currentIndex={fullscreenIndex}
        onClose={closeFullscreen}
        onIndexChange={setFullscreenIndex}
      />
    </SafeAreaView>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: t.colors.background,
    },
    listContent: {
      paddingHorizontal: GRID_PADDING,
      paddingTop: 12,
      paddingBottom: 40,
    },
    cell: {
      width: CELL_SIZE,
      height: CELL_SIZE,
      marginBottom: GRID_GAP,
      borderRadius: 4,
      overflow: "hidden",
      backgroundColor: t.colors.gray100,
    },
    image: {
      width: "100%",
      height: "100%",
    },
    empty: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
  });

export default StoreImageGalleryScreen;
