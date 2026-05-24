/**
 * RegionPicker —— 三段式发货地选择（国家 / 省 - 州 / 城市）。
 *
 * 设计目标：
 *   - 中国大陆走内置的省 + 城市列表（覆盖直辖市 + 省会 + 头部地级市）；
 *   - 国外采用 "国家 + 自由填写州/城市" 的轻量方案，避免内置全球数据；
 *   - 全部走 react-native 自带 Modal，不引入新依赖；
 *   - 圆角统一 4。
 *
 * Props:
 *   - value: { country, state, city }
 *   - onChange: 修改时回调
 *   - visible / onClose: Modal 状态
 */
import React, { useMemo, useState } from "react";
import {
  Modal,
  StyleSheet,
  TouchableWithoutFeedback,
  ScrollView,
  FlatList,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { Box, HStack, VStack, Text, Pressable } from "./ui";
import { useThemedStyles, useAppTheme, type AppTheme } from "../theme";

export interface RegionValue {
  country: string | null;
  state: string | null;
  city: string | null;
}

interface RegionPickerProps {
  visible: boolean;
  value: RegionValue;
  onClose: () => void;
  onChange: (value: RegionValue) => void;
}

const COUNTRY_OPTIONS = [
  "中国",
  "日本",
  "美国",
  "英国",
  "法国",
  "意大利",
  "德国",
  "韩国",
  "加拿大",
  "澳大利亚",
  "新加坡",
  "西班牙",
  "比利时",
  "荷兰",
  "瑞士",
  "其他",
] as const;

// 中国常用省 / 直辖市 + 部分头部城市
const CN_STATES: { state: string; cities: string[] }[] = [
  { state: "北京市", cities: ["北京"] },
  { state: "上海市", cities: ["上海"] },
  { state: "天津市", cities: ["天津"] },
  { state: "重庆市", cities: ["重庆"] },
  {
    state: "广东省",
    cities: ["广州", "深圳", "佛山", "东莞", "珠海", "汕头", "中山"],
  },
  { state: "江苏省", cities: ["南京", "苏州", "无锡", "常州", "南通", "扬州"] },
  { state: "浙江省", cities: ["杭州", "宁波", "温州", "金华", "嘉兴", "绍兴"] },
  { state: "山东省", cities: ["济南", "青岛", "烟台", "潍坊", "威海"] },
  { state: "四川省", cities: ["成都", "绵阳", "德阳", "宜宾"] },
  { state: "湖北省", cities: ["武汉", "宜昌", "襄阳"] },
  { state: "湖南省", cities: ["长沙", "株洲", "湘潭"] },
  { state: "福建省", cities: ["福州", "厦门", "泉州"] },
  { state: "辽宁省", cities: ["沈阳", "大连", "鞍山"] },
  { state: "陕西省", cities: ["西安", "咸阳"] },
  { state: "河南省", cities: ["郑州", "洛阳", "开封"] },
  { state: "河北省", cities: ["石家庄", "唐山", "保定"] },
  { state: "云南省", cities: ["昆明", "大理"] },
  { state: "广西壮族自治区", cities: ["南宁", "桂林"] },
  { state: "贵州省", cities: ["贵阳"] },
  { state: "海南省", cities: ["海口", "三亚"] },
  { state: "其他", cities: [] },
];

const RegionPicker: React.FC<RegionPickerProps> = ({
  visible,
  value,
  onClose,
  onChange,
}) => {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);

  const [tab, setTab] = useState<"country" | "state" | "city">("country");
  const isCN = (value.country ?? "中国") === "中国";

  const stateOptions = useMemo(() => {
    if (!isCN) return [] as string[];
    return CN_STATES.map((s) => s.state);
  }, [isCN]);

  const cityOptions = useMemo(() => {
    if (!isCN) return [] as string[];
    const found = CN_STATES.find((s) => s.state === value.state);
    return found?.cities ?? [];
  }, [isCN, value.state]);

  const renderListPickerItem = (
    label: string,
    selected: boolean,
    onPress: () => void
  ) => (
    <Pressable style={styles.row} onPress={onPress}>
      <Text
        style={[
          styles.rowText,
          selected && { color: theme.colors.accent, fontWeight: "600" },
        ]}
      >
        {label}
      </Text>
      {selected && (
        <Ionicons name="checkmark" size={18} color={theme.colors.accent} />
      )}
    </Pressable>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <Box style={styles.sheet}>
              <HStack alignItems="center" justifyContent="space-between" style={styles.header}>
                <Text style={styles.title}>
                  {t("trading.publishListing.logistics.regionSheetTitle")}
                </Text>
                <Pressable onPress={onClose} style={styles.closeBtn}>
                  <Ionicons name="close" size={22} color={theme.colors.text} />
                </Pressable>
              </HStack>

              {/* Tabs */}
              <HStack style={styles.tabs}>
                {(["country", "state", "city"] as const).map((k) => (
                  <Pressable
                    key={k}
                    style={[styles.tab, tab === k && styles.tabActive]}
                    onPress={() => setTab(k)}
                  >
                    <Text
                      style={[
                        styles.tabText,
                        tab === k && styles.tabTextActive,
                      ]}
                    >
                      {t(`trading.publishListing.logistics.tab_${k}`)}
                    </Text>
                    {/* 当前值的预览 */}
                    <Text style={styles.tabValue} numberOfLines={1}>
                      {value[k] ?? "—"}
                    </Text>
                  </Pressable>
                ))}
              </HStack>

              {tab === "country" && (
                <FlatList
                  data={COUNTRY_OPTIONS as readonly string[]}
                  keyExtractor={(c) => c}
                  renderItem={({ item }) =>
                    renderListPickerItem(item, value.country === item, () => {
                      onChange({
                        country: item,
                        // 切国家时清空 state / city
                        state: null,
                        city: null,
                      });
                      setTab(item === "中国" ? "state" : "state");
                    })
                  }
                  style={styles.list}
                />
              )}

              {tab === "state" && (
                <>
                  {isCN ? (
                    <FlatList
                      data={stateOptions}
                      keyExtractor={(s) => s}
                      renderItem={({ item }) =>
                        renderListPickerItem(item, value.state === item, () => {
                          onChange({ ...value, state: item, city: null });
                          setTab("city");
                        })
                      }
                      style={styles.list}
                    />
                  ) : (
                    <ScrollView
                      style={styles.list}
                      contentContainerStyle={styles.inputPadding}
                      keyboardShouldPersistTaps="handled"
                    >
                      <Text style={styles.inputLabel}>
                        {t("trading.publishListing.logistics.stateLabel")}
                      </Text>
                      <TextInput
                        style={styles.input}
                        value={value.state ?? ""}
                        onChangeText={(s) => onChange({ ...value, state: s })}
                        placeholder={t(
                          "trading.publishListing.logistics.statePlaceholder"
                        )}
                        placeholderTextColor={theme.colors.placeholder}
                      />
                      <Pressable
                        style={styles.nextBtn}
                        onPress={() => setTab("city")}
                      >
                        <Text style={styles.nextBtnText}>
                          {t("trading.publishListing.logistics.tab_city")}
                        </Text>
                      </Pressable>
                    </ScrollView>
                  )}
                </>
              )}

              {tab === "city" && (
                <>
                  {isCN && cityOptions.length > 0 ? (
                    <FlatList
                      data={cityOptions}
                      keyExtractor={(c) => c}
                      renderItem={({ item }) =>
                        renderListPickerItem(item, value.city === item, () => {
                          onChange({ ...value, city: item });
                          onClose();
                        })
                      }
                      style={styles.list}
                    />
                  ) : (
                    <ScrollView
                      style={styles.list}
                      contentContainerStyle={styles.inputPadding}
                      keyboardShouldPersistTaps="handled"
                    >
                      <Text style={styles.inputLabel}>
                        {t("trading.publishListing.logistics.cityLabel")}
                      </Text>
                      <TextInput
                        style={styles.input}
                        value={value.city ?? ""}
                        onChangeText={(c) => onChange({ ...value, city: c })}
                        placeholder={t(
                          "trading.publishListing.logistics.cityPlaceholder"
                        )}
                        placeholderTextColor={theme.colors.placeholder}
                      />
                      <Pressable style={styles.nextBtn} onPress={onClose}>
                        <Text style={styles.nextBtnText}>
                          {t("common.done")}
                        </Text>
                      </Pressable>
                    </ScrollView>
                  )}
                </>
              )}
            </Box>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: t.colors.overlay,
      justifyContent: "flex-end",
    },
    sheet: {
      maxHeight: "80%",
      backgroundColor: t.colors.card,
      borderTopLeftRadius: t.borderRadius.sm,
      borderTopRightRadius: t.borderRadius.sm,
      paddingBottom: 24,
    },
    header: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    title: {
      fontSize: 16,
      fontWeight: "600",
      color: t.colors.text,
    },
    closeBtn: {
      padding: 4,
    },
    tabs: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    tab: {
      flex: 1,
      paddingVertical: 8,
      paddingHorizontal: 6,
      alignItems: "center",
      borderBottomWidth: 2,
      borderBottomColor: "transparent",
    },
    tabActive: {
      borderBottomColor: t.colors.accent,
    },
    tabText: {
      fontSize: 12,
      color: t.colors.textSecondary,
      letterSpacing: 1,
    },
    tabTextActive: {
      color: t.colors.text,
      fontWeight: "600",
    },
    tabValue: {
      fontSize: 12,
      color: t.colors.text,
      marginTop: 2,
    },
    list: {
      maxHeight: 360,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 18,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    rowText: {
      fontSize: 14,
      color: t.colors.text,
    },
    inputPadding: {
      padding: 16,
    },
    inputLabel: {
      fontSize: 13,
      color: t.colors.textSecondary,
      marginBottom: 8,
    },
    input: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
      borderRadius: t.borderRadius.sm,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
      color: t.colors.text,
    },
    nextBtn: {
      marginTop: 14,
      backgroundColor: t.colors.accent,
      paddingVertical: 12,
      borderRadius: t.borderRadius.sm,
      alignItems: "center",
    },
    nextBtnText: {
      color: t.colors.textInverted,
      fontSize: 15,
      fontWeight: "600",
    },
  });

export default RegionPicker;
