/**
 * PRD 模块一 · Step 2：规范化 5 视角图 + 最多 4 张额外图。
 *
 * 5 个必填卡槽：正面 / 背面 / 洗标 / 领标 / 瑕疵细节。
 * 无瑕疵也要拍一张兜底证明（PRD 1.3）。
 */
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";

import { Box, HStack, Pressable, Text, VStack } from "../../components/ui";
import { OptimizedImage } from "../../components/ui/OptimizedImage";
import ScreenHeader from "../../components/ScreenHeader";
import { useThemedStyles, type AppTheme } from "../../theme";
import { Alert } from "../../utils/Alert";
import { uploadImageFromUri } from "../admin/adminUtils";
import { usePublishListingStore } from "../../store/publishListingStore";
import type { PhotoAngles } from "../../services/storeProductService";

type AngleKey = keyof Pick<
  PhotoAngles,
  "front" | "back" | "wash_label" | "brand_label" | "flaw"
>;

const ANGLE_LABELS: Record<AngleKey, { title: string; tip: string }> = {
  front: { title: "正面", tip: "整件正面清晰图" },
  back: { title: "背面", tip: "整件背面清晰图" },
  wash_label: { title: "洗标", tip: "成分 / 产地标签" },
  brand_label: { title: "领标", tip: "品牌标 / 内标" },
  flaw: { title: "瑕疵细节", tip: "无瑕疵也需拍一张兜底证明" },
};

const ORDER: AngleKey[] = ["front", "back", "wash_label", "brand_label", "flaw"];

const PublishListingStep2Screen: React.FC = () => {
  const navigation = useNavigation();
  const styles = useThemedStyles(makeStyles);

  const photoAngles = usePublishListingStore((s) => s.photoAngles);
  const patch = usePublishListingStore((s) => s.patch);

  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  const handlePickAngle = async (key: AngleKey) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.show("需要相册访问权限");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 5],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;
    setUploadingKey(key);
    try {
      const url = await uploadImageFromUri(result.assets[0].uri);
      patch({
        photoAngles: { ...photoAngles, [key]: url },
      });
    } catch (e) {
      Alert.show(e instanceof Error ? e.message : "上传失败");
    } finally {
      setUploadingKey(null);
    }
  };

  const handlePickExtra = async () => {
    const extras = photoAngles.extras ?? [];
    if (extras.length >= 4) {
      Alert.show("最多 4 张额外图");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;
    setUploadingKey("extras");
    try {
      const url = await uploadImageFromUri(result.assets[0].uri);
      patch({
        photoAngles: { ...photoAngles, extras: [...extras, url] },
      });
    } catch (e) {
      Alert.show(e instanceof Error ? e.message : "上传失败");
    } finally {
      setUploadingKey(null);
    }
  };

  const handleRemoveExtra = (index: number) => {
    const extras = photoAngles.extras ?? [];
    patch({
      photoAngles: {
        ...photoAngles,
        extras: extras.filter((_, i) => i !== index),
      },
    });
  };

  const allComplete = useMemo(
    () => ORDER.every((k) => !!photoAngles[k]),
    [photoAngles]
  );

  const handleNext = () => {
    if (!allComplete) {
      Alert.show("5 视角图全部为必填项");
      return;
    }
    // @ts-expect-error - navigation types
    navigation.navigate("PublishListingStep3");
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader title="发布单品 · 5 视角图" showBack />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.sectionTitle}>2 / 3 · 图片（必填 5 张 + 可选 4 张）</Text>

        <VStack space="md">
          {ORDER.map((k) => {
            const url = photoAngles[k];
            const isUploading = uploadingKey === k;
            return (
              <Pressable
                key={k}
                style={styles.angleCard}
                onPress={() => handlePickAngle(k)}
                disabled={isUploading}
              >
                <Box style={styles.angleImageBox}>
                  {url ? (
                    <OptimizedImage uri={url} style={styles.angleImage} />
                  ) : (
                    <Box style={styles.angleEmpty}>
                      {isUploading ? (
                        <ActivityIndicator />
                      ) : (
                        <Text style={styles.angleEmptyText}>+</Text>
                      )}
                    </Box>
                  )}
                </Box>
                <VStack style={styles.angleMeta} space="xs">
                  <Text style={styles.angleTitle}>{ANGLE_LABELS[k].title}</Text>
                  <Text style={styles.angleTip}>{ANGLE_LABELS[k].tip}</Text>
                </VStack>
              </Pressable>
            );
          })}
        </VStack>

        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>
          额外图（可选，最多 4 张）
        </Text>
        <HStack flexWrap="wrap" style={{ gap: 8 } as any}>
          {(photoAngles.extras ?? []).map((url, i) => (
            <Pressable
              key={url + i}
              style={styles.extraTile}
              onLongPress={() => handleRemoveExtra(i)}
            >
              <OptimizedImage uri={url} style={styles.extraImage} />
            </Pressable>
          ))}
          {(photoAngles.extras ?? []).length < 4 && (
            <Pressable style={styles.extraAdd} onPress={handlePickExtra}>
              {uploadingKey === "extras" ? (
                <ActivityIndicator />
              ) : (
                <Text style={styles.extraAddText}>+</Text>
              )}
            </Pressable>
          )}
        </HStack>
        <Text style={styles.hintSmall}>长按额外图可移除</Text>
      </ScrollView>

      <Box style={styles.footer}>
        <TouchableOpacity
          style={[styles.nextButton, !allComplete && styles.nextButtonDisabled]}
          onPress={handleNext}
          activeOpacity={0.8}
          disabled={!allComplete}
        >
          <Text style={styles.nextButtonText}>下一步 · 定价</Text>
        </TouchableOpacity>
      </Box>
    </SafeAreaView>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.colors.background },
    scroll: { padding: 16, paddingBottom: 32 },
    sectionTitle: {
      fontSize: 13,
      color: t.colors.textSecondary,
      marginBottom: 12,
      letterSpacing: 1,
    },
    angleCard: {
      flexDirection: "row",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
      borderRadius: 8,
      overflow: "hidden",
      backgroundColor: t.colors.surface,
    },
    angleImageBox: { width: 96, height: 120, backgroundColor: t.colors.border },
    angleImage: { width: "100%", height: "100%" },
    angleEmpty: {
      width: "100%",
      height: "100%",
      justifyContent: "center",
      alignItems: "center",
    },
    angleEmptyText: { fontSize: 24, color: t.colors.textSecondary },
    angleMeta: { padding: 12, flex: 1, justifyContent: "center" },
    angleTitle: { fontSize: 15, fontWeight: "600", color: t.colors.text },
    angleTip: { fontSize: 12, color: t.colors.textSecondary },
    extraTile: { width: 80, height: 80, borderRadius: 6, overflow: "hidden" },
    extraImage: { width: "100%", height: "100%" },
    extraAdd: {
      width: 80,
      height: 80,
      borderRadius: 6,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surface,
      justifyContent: "center",
      alignItems: "center",
    },
    extraAddText: { fontSize: 28, color: t.colors.textSecondary },
    hintSmall: { fontSize: 12, color: t.colors.textSecondary, marginTop: 8 },
    footer: {
      padding: 16,
      paddingBottom: Platform.OS === "ios" ? 32 : 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border,
    },
    nextButton: {
      backgroundColor: t.colors.accent,
      paddingVertical: 14,
      borderRadius: 8,
      alignItems: "center",
    },
    nextButtonDisabled: { opacity: 0.4 },
    nextButtonText: {
      color: t.colors.textInverted,
      fontSize: 16,
      fontWeight: "600",
    },
  });

export default PublishListingStep2Screen;
