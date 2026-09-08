/**
 * 「买手店」顶部 Tab —— 内部二级切换：买手店地图 / 买手店详情。
 *
 *   - 地图：内嵌 BuyerMapScreen（embedded），在地图上浏览 / 定位买手店
 *   - 详情：现有精选门店视图（BuyerTabContent），门店选择 + 商品 / 帖子
 *
 * 两个形态都按「首次进入后再常驻」挂载：地图较重，不能在邻页预挂载时就
 * 触发 loadStores；详情切走后用 display 隐藏以保留选择态与滚动位置。
 */
import React, { useEffect, useMemo, useState } from "react";
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import BuyerMapScreen from "../../BuyerMapScreen";
import { BuyerTabContent } from "./BuyerTab";
import { DiscoverSubTabBar } from "./DiscoverSubTabBar";
import type { BuyerStoreProduct } from "./BuyerTab/types";
import type { OpenProductListPayload } from "./BuyerTab";
import { SCREEN_WIDTH } from "../constants";
import type { BuyerSubTab } from "../types";

interface BuyerPageProps {
  isActive: boolean;
  subTab: BuyerSubTab;
  onSubTabChange: (tab: BuyerSubTab) => void;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onSearchPress: () => void;
  onStorePress: (storeId: string) => void;
  onProductPress: (product: BuyerStoreProduct) => void;
  onPostPress: (postId: number) => void;
  onOpenAllStores: () => void;
  onOpenProductList: (payload: OpenProductListPayload) => void;
}

const BuyerPageImpl: React.FC<BuyerPageProps> = ({
  isActive,
  subTab,
  onSubTabChange,
  onScroll,
  onSearchPress,
  onStorePress,
  onProductPress,
  onPostPress,
  onOpenAllStores,
  onOpenProductList,
}) => {
  const { t } = useTranslation();
  const [hasMountedMap, setHasMountedMap] = useState(false);
  const [hasMountedDetail, setHasMountedDetail] = useState(false);

  useEffect(() => {
    if (!isActive) return;
    if (subTab === "map") setHasMountedMap(true);
    if (subTab === "detail") setHasMountedDetail(true);
  }, [isActive, subTab]);

  const subTabs = useMemo<{ id: BuyerSubTab; label: string }[]>(
    () => [
      { id: "map", label: t("discover.buyerMap") },
      { id: "detail", label: t("discover.buyerDetail") },
    ],
    [t]
  );

  return (
    <View style={styles.root}>
      <DiscoverSubTabBar<BuyerSubTab>
        tabs={subTabs}
        activeTab={subTab}
        onTabPress={onSubTabChange}
      />
      <View style={styles.body}>
        {hasMountedDetail ? (
          <View
            style={[
              StyleSheet.absoluteFill,
              { display: subTab === "detail" ? "flex" : "none" },
            ]}
          >
            <BuyerTabContent
              isActive={isActive && subTab === "detail"}
              onScroll={onScroll}
              onSearchPress={onSearchPress}
              onStorePress={onStorePress}
              onProductPress={onProductPress}
              onPostPress={onPostPress}
              onOpenAllStores={onOpenAllStores}
              onOpenProductList={onOpenProductList}
            />
          </View>
        ) : null}
        {hasMountedMap ? (
          <View
            style={[
              StyleSheet.absoluteFill,
              { display: subTab === "map" ? "flex" : "none" },
            ]}
          >
            <BuyerMapScreen embedded />
          </View>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { width: SCREEN_WIDTH, flex: 1 },
  body: { flex: 1 },
});

export const BuyerPage = React.memo(BuyerPageImpl);

export default BuyerPage;
