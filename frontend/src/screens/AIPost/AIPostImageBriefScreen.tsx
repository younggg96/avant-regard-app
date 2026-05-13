/**
 * AI 发帖助手 — 图片 + 简述模式 (V3 #25)。
 *
 * 流程:
 *   用户选 1-9 张图 → 选 1 个 prompt chip → (可选) 写 ≤50 字补充 →
 *   "生成帖子" → uploadImages → navigate("AIPostPreview", {mode: IMAGE_BRIEF})
 *   Preview 屏会调 generate(imageUrls=...) 走真实流程,
 *   图片审核 / Qwen-VL 在那一步触发。
 *
 * 注意:
 *   - 这一屏只负责"装组件参数",真正的耗时调用在 Preview 屏。
 *   - 上传放在 Preview 之前是因为 generate 要的是公网 URL, 而非本地 uri。
 */

import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Alert as RNAlert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import * as ImagePicker from "expo-image-picker";
import {
  Box,
  Button,
  ButtonText,
  HStack,
  OptimizedImage,
  Pressable,
  ScrollView,
  Text,
  VStack,
} from "../../components/ui";
import { theme, useThemedStyles, type AppTheme } from "../../theme";
import ScreenHeader from "../../components/ScreenHeader";
import QuotaBadge from "./components/QuotaBadge";
import { ImageSize } from "../../utils/imageUtils";
import { getQuota, type ImageBriefChip, type QuotaInfo } from "../../services/aiPostService";
import { uploadImages } from "../../services/postService";

const MAX_IMAGES = 9;
const MAX_NOTE_CHARS = 50;

const CHIPS: ImageBriefChip[] = [
  "RECENT_BUY",
  "FAVORITE_ITEM",
  "LOOK_APPRECIATION",
  "CUSTOM",
];

const AIPostImageBriefScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const styles = useThemedStyles(makeStyles);

  const [localUris, setLocalUris] = useState<string[]>([]);
  const [chip, setChip] = useState<ImageBriefChip>("RECENT_BUY");
  const [note, setNote] = useState("");
  const [uploading, setUploading] = useState(false);
  const [quota, setQuota] = useState<QuotaInfo | null>(null);

  // focus 时重拉配额: 与 AIPostEntryScreen 同理,
  // 用户在预览屏消耗 quota 后回到本屏时,徽章必须反映最新值。
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getQuota()
        .then((r) => {
          if (!cancelled) setQuota(r.quota);
        })
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const handlePickImages = async () => {
    if (localUris.length >= MAX_IMAGES) {
      RNAlert.alert(t("publish.maxMediaReached", { count: MAX_IMAGES }));
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      RNAlert.alert(t("publish.galleryPermissionRequired"));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: MAX_IMAGES - localUris.length,
      quality: 0.8,
    });
    if (!result.canceled && result.assets) {
      const next = [
        ...localUris,
        ...result.assets.map((a) => a.uri),
      ].slice(0, MAX_IMAGES);
      setLocalUris(next);
    }
  };

  const handleRemove = (idx: number) => {
    setLocalUris((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleGenerate = async () => {
    if (localUris.length === 0) {
      RNAlert.alert(t("aiPost.imageBrief.needImages"));
      return;
    }
    if (chip === "CUSTOM" && !note.trim()) {
      // CUSTOM 必须有 note
      RNAlert.alert(t("aiPost.imageBrief.notePlaceholder"));
      return;
    }

    setUploading(true);
    try {
      const urls = await uploadImages(localUris);
      setUploading(false);

      navigation.replace("AIPostPreview", {
        mode: "IMAGE_BRIEF",
        answers: {
          prompt_chip: chip,
          user_note: note.trim() || null,
        },
        imageUrls: urls,
      });
    } catch (err) {
      setUploading(false);
      const msg = err instanceof Error ? err.message : t("common.unknownError");
      RNAlert.alert(t("publish.uploadInProgress"), msg);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScreenHeader
        title={t("aiPost.imageBrief.title")}
        showBackButton
        onBackPress={() => navigation.goBack()}
        rightComponent={<QuotaBadge quota={quota} />}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
        <VStack px="$lg" pt="$sm" pb="$lg" gap="$md">
          {/* 图片九宫格 */}
          <Box>
            <Text fontSize="$xs" color="$gray400" mb="$xs">
              {t("aiPost.imageBrief.imageTip")}
            </Text>
            <HStack flexWrap="wrap" gap={8}>
              {localUris.map((uri, idx) => (
                <Box key={`${uri}-${idx}`} w={"31%"} aspectRatio={1}>
                  <OptimizedImage
                    uri={uri}
                    size={ImageSize.THUMBNAIL}
                    style={{ width: "100%", height: "100%", borderRadius: 6 }}
                    contentFit="cover"
                  />
                  <TouchableOpacity
                    onPress={() => handleRemove(idx)}
                    style={styles.removeBtn}
                  >
                    <Ionicons name="close" size={14} color="white" />
                  </TouchableOpacity>
                </Box>
              ))}

              {localUris.length < MAX_IMAGES ? (
                <Pressable
                  onPress={handlePickImages}
                  w={"31%"}
                  aspectRatio={1}
                  alignItems="center"
                  justifyContent="center"
                  borderWidth={1}
                  borderColor="$gray200"
                  rounded={6}
                  style={{ borderStyle: "dashed" }}
                >
                  <Ionicons
                    name="add"
                    size={22}
                    color={theme.colors.gray300}
                  />
                  <Text fontSize="$2xs" color="$gray400" mt={2}>
                    {t("aiPost.imageBrief.addImage")}
                  </Text>
                </Pressable>
              ) : null}
            </HStack>
          </Box>

          {/* prompt chip */}
          <Box>
            <Text fontSize="$xs" color="$gray400" mb="$xs">
              {t("aiPost.imageBrief.chipLabel")}
            </Text>
            <HStack flexWrap="wrap" gap="$xs">
              {CHIPS.map((c) => {
                const selected = c === chip;
                return (
                  <Pressable
                    key={c}
                    onPress={() => setChip(c)}
                    bg={selected ? "$black" : "$white"}
                    borderWidth={1}
                    borderColor={selected ? "$black" : "$gray100"}
                    px="$sm"
                    py={6}
                    rounded={16}
                  >
                    <Text
                      fontSize="$xs"
                      color={selected ? "$white" : "$gray500"}
                    >
                      {t(`aiPost.imageBrief.chip.${c}`)}
                    </Text>
                  </Pressable>
                );
              })}
            </HStack>
          </Box>

          {/* note */}
          <Box>
            <Text fontSize="$xs" color="$gray400" mb="$xs">
              {t("aiPost.imageBrief.noteLabel")}
            </Text>
            <Box
              borderWidth={1}
              borderColor="$gray100"
              rounded="$md"
              p="$sm"
            >
              <TextInput
                value={note}
                onChangeText={(v) => setNote(v.slice(0, MAX_NOTE_CHARS))}
                placeholder={t("aiPost.imageBrief.notePlaceholder") as string}
                placeholderTextColor={theme.colors.gray200}
                multiline
                style={styles.noteInput}
              />
              <Text
                fontSize="$2xs"
                color="$gray300"
                alignSelf="flex-end"
                mt="$xs"
              >
                {note.length}/{MAX_NOTE_CHARS}
              </Text>
            </Box>
          </Box>
        </VStack>
      </ScrollView>
      </KeyboardAvoidingView>

      {/* 生成按钮 */}
      <Box
        px="$lg"
        py="$md"
        borderTopWidth={1}
        borderTopColor="$gray100"
        bg="$white"
      >
        <Button
          onPress={handleGenerate}
          bg="$black"
          rounded="$md"
          disabled={uploading || localUris.length === 0}
        >
          {uploading ? (
            <HStack gap="$sm" alignItems="center">
              <ActivityIndicator color="white" />
              <ButtonText color="$white">
                {t("aiPost.imageBrief.uploading")}
              </ButtonText>
            </HStack>
          ) : (
            <ButtonText color="$white">
              {t("aiPost.imageBrief.generate")}
            </ButtonText>
          )}
        </Button>
      </Box>
    </SafeAreaView>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.colors.background,
    },
    removeBtn: {
      position: "absolute",
      top: 4,
      right: 4,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: "rgba(0,0,0,0.6)",
      alignItems: "center",
      justifyContent: "center",
    },
    noteInput: {
      minHeight: 56,
      fontSize: 13,
      color: t.colors.text,
      textAlignVertical: "top",
    },
  });

export default AIPostImageBriefScreen;
