/**
 * UploadArchiveItemScreen —— 数字护照 5.2「拍照 → AI 候选 → 确认入库」。
 *
 * 原来是一张纯表单，现在拆成三步：
 *   1 PHOTOS     上传照片（可选生成三视图）→ 发起 AI 识别
 *   2 CANDIDATES AI 给出品牌 / 系列 / 年份候选，用户选一个或点「都不对」
 *   3 CONFIRM    确认并补齐字段后入库，同时落一条标注数据
 *
 * 两条硬约束：
 *   - 图片没过有效性检查（不是服装 / 时尚单品）就停在第 1 步，不让进档案。
 *   - 品牌只能从品牌列表选（BrandSearchSheet）；列表里没有就走新品牌审核，
 *     此时带 pendingBrandName 入库并标记为待复核，不把用户卡死在提交页。
 *
 * 识别因 AI 自身原因失败（配额用尽 / 模型挂了）时，才放出「手动填写」的
 * 退路，走原来的 createArchiveItem 路径 —— 识别是增强，不该成为入档的唯一
 * 通道。但这个入口不能常驻：图片没过有效性闸门时它必须消失，否则用户被拦下
 * 后点一下就绕过去了，5.3 的硬闸门等于没做。走退路入档的条目会被后端标成
 * manual_review 进人工队列，不冒充「已通过检查」。
 */
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image as RNImage,
  ActivityIndicator,
  Text as RNText,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useTranslation } from "react-i18next";

import { Box, HStack, Pressable } from "../../components/ui";
import ScreenHeader from "../../components/ScreenHeader";
import BrandSearchSheet from "../../components/BrandSearchSheet";
import AttributionCandidateCard from "../../components/trading/AttributionCandidateCard";
import {
  makeTradingFormStyles,
  TradingFormField,
  TradingFormInput,
  TradingFormTextArea,
} from "../../components/trading/TradingFormShared";
import { useAppTheme, useThemedStyles } from "../../theme";
import { Alert } from "../../utils/Alert";
import { uploadImageFromUri } from "../admin/adminUtils";
import { createArchiveItem } from "../../services/archivePlusService";
import {
  attributeItem,
  confirmPassport,
  generateThreeView,
  type AttributionCandidate,
  type AttributionResult,
  type UserAction,
} from "../../services/passportService";
import type { Brand } from "../../services/brandService";

type Step = "photos" | "candidates" | "confirm";

const UploadArchiveItemScreen: React.FC = () => {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeTradingFormStyles);
  const navigation = useNavigation<any>();
  const { t } = useTranslation();

  const [step, setStep] = useState<Step>("photos");
  const [photos, setPhotos] = useState<string[]>([]);

  // AI 归因结果。attribution 为 null 表示走的是「跳过识别」的退路。
  const [attribution, setAttribution] = useState<AttributionResult | null>(null);
  const [picked, setPicked] = useState<AttributionCandidate | null>(null);

  const [title, setTitle] = useState("");
  const [brandId, setBrandId] = useState<number | null>(null);
  const [brandName, setBrandName] = useState("");
  // 新品牌已提交、还在后台审核：此时 brands 表里还没这一行，拿不到 brandId，
  // 先用用户填的名字入库并标记待复核，等品牌审核通过后由后台回填 brand_id。
  const [brandPending, setBrandPending] = useState(false);
  const [pendingBrandName, setPendingBrandName] = useState("");
  const [showId, setShowId] = useState<string | null>(null);
  const [releaseYear, setReleaseYear] = useState("");
  const [size, setSize] = useState("");
  const [color, setColor] = useState("");
  const [acquiredAt, setAcquiredAt] = useState("");
  const [priceText, setPriceText] = useState("");
  const [note, setNote] = useState("");
  const [storage, setStorage] = useState("");

  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [generatingViews, setGeneratingViews] = useState(false);
  const [recognizing, setRecognizing] = useState(false);
  const [brandSheetVisible, setBrandSheetVisible] = useState(false);
  // 只有在识别「因为 AI 这边的原因」失败过之后，才放出手动填写的入口。
  // 详见 runRecognition 里对状态码的判断。
  const [skipAllowed, setSkipAllowed] = useState(false);

  // ------------------------------------------------------------------
  // 第 1 步 · 照片
  // ------------------------------------------------------------------
  const pickImage = async () => {
    if (photos.length >= 9) {
      Alert.show(t("trading.uploadArchive.maxPhotos"));
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.show(t("trading.uploadArchive.permissionAlbum"));
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsMultipleSelection: true,
      selectionLimit: 9 - photos.length,
    });
    if (res.canceled || !res.assets?.length) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const asset of res.assets) {
        const url = await uploadImageFromUri(asset.uri);
        if (url) urls.push(url);
      }
      setPhotos((prev) => [...prev, ...urls]);
    } catch (e: any) {
      Alert.show(e?.message ?? t("trading.uploadArchive.uploadFailed"));
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = (idx: number) =>
    setPhotos((prev) => prev.filter((_, i) => i !== idx));

  /**
   * 以第一张图为源生成正 / 侧 / 背三视图，成功的追加进图片网格。
   * 可能部分成功（某一张挂了整体仍返回 200），所以按 view 逐个收。
   */
  const generateViews = async () => {
    if (photos.length === 0) {
      Alert.show(t("trading.uploadArchive.threeViewNeedPhoto"));
      return;
    }
    setGeneratingViews(true);
    try {
      const result = await generateThreeView(photos[0]);
      const urls = result.views
        .map((v) => v.url)
        .filter((u): u is string => Boolean(u));
      setPhotos((prev) => [...prev, ...urls].slice(0, 9));

      const failed = result.views.length - urls.length;
      if (failed > 0) {
        Alert.show(
          t("trading.uploadArchive.threeViewPartial", { count: failed }),
        );
      }
    } catch (e: any) {
      Alert.show(e?.message ?? t("trading.uploadArchive.threeViewFailed"));
    } finally {
      setGeneratingViews(false);
    }
  };

  /**
   * 有效性检查 + AI 归因。
   *
   * 后端对「不是服装 / 时尚单品」返 422，message 里写了图里看到的是什么，
   * 直接展示给用户让他重拍，不推进到下一步。
   */
  const runRecognition = async () => {
    if (photos.length === 0) {
      Alert.show(t("trading.uploadArchive.photoRequired"));
      return;
    }
    setRecognizing(true);
    try {
      const result = await attributeItem(photos, title.trim() || undefined);
      setAttribution(result);
      setStep("candidates");
    } catch (e: any) {
      // 失败分两类，能不能绕过去完全不同：
      //   422 图片没过 5.3 有效性闸门 —— 闸门在正常工作，绝不能放行，
      //       否则用户被拦下后点一下「手动填写」就把宠物照塞进档案了。
      //   400 传的图有问题（不在白名单等），改输入就能解决，同样不放行。
      //   其余（429 配额用尽 / 502 模型挂了 / 503 未配置）是 AI 这边的问题，
      //       不该让用户因此无法入档，这时才放出手动填写的入口。
      const status = e?.status;
      if (status !== 422 && status !== 400) setSkipAllowed(true);
      Alert.show(e?.message ?? t("trading.uploadArchive.recognizeFailed"));
    } finally {
      setRecognizing(false);
    }
  };

  /**
   * AI 不可用时的退路：跳过识别直接手填。
   *
   * 这条路径没经过有效性检查，后端会把条目标成 manual_review 进人工队列
   * （archive_service.manual_create 的默认值），不会冒充「已通过检查」。
   */
  const skipRecognition = () => {
    if (photos.length === 0) {
      Alert.show(t("trading.uploadArchive.photoRequired"));
      return;
    }
    setAttribution(null);
    setPicked(null);
    setStep("confirm");
  };

  // ------------------------------------------------------------------
  // 第 2 步 · 候选
  // ------------------------------------------------------------------
  const acceptCandidate = (c: AttributionCandidate) => {
    setPicked(c);
    setBrandId(c.brandId);
    setBrandName(c.brandName);
    setPendingBrandName("");
    setShowId(c.showId);
    setReleaseYear(c.year ? String(c.year) : "");
    setStep("confirm");
  };

  const rejectAllCandidates = () => {
    setPicked(null);
    setBrandId(null);
    setBrandName("");
    setShowId(null);
    setReleaseYear("");
    setStep("confirm");
  };

  // ------------------------------------------------------------------
  // 第 3 步 · 确认入库
  // ------------------------------------------------------------------
  const selectBrand = (b: Brand) => {
    setBrandId(b.id);
    setBrandName(b.name);
    setBrandPending(false);
    setPendingBrandName("");
    // 换了品牌，原候选的系列就不再成立，清掉免得把错的 show_id 存进去。
    if (picked && b.id !== picked.brandId) setShowId(null);
    setBrandSheetVisible(false);
  };

  /**
   * 品牌列表里没有 → 走现有的新品牌提交与后台审核流程。
   *
   * 提交页是独立一屏，用户审核完回来时这屏的 state 还在，所以这里先把
   * 待审输入框亮出来，让他把名字填进去先把单品入档，不用等品牌审核通过。
   */
  const goSubmitBrand = () => {
    setBrandId(null);
    setBrandName("");
    setShowId(null);
    setBrandPending(true);
    navigation.navigate("SubmitBrand");
  };

  /**
   * 用户最终动作，写进标注数据用来衡量 AI 建议的采纳率：
   *   none_of_above 点了「都不对」
   *   edited        采纳了候选但改了品牌 / 系列 / 年份
   *   accepted      原样采纳
   */
  const resolveUserAction = (): UserAction => {
    if (!picked) return "none_of_above";
    const yearChanged =
      (picked.year ? String(picked.year) : "") !== releaseYear.trim();
    if (brandId !== picked.brandId || showId !== picked.showId || yearChanged) {
      return "edited";
    }
    return "accepted";
  };

  const submit = async () => {
    if (!title.trim()) {
      Alert.show(t("trading.uploadArchive.titleRequired"));
      return;
    }
    if (!brandId && !pendingBrandName.trim()) {
      Alert.show(t("trading.uploadArchive.brandRequired"));
      return;
    }

    setSubmitting(true);
    try {
      const priceCents = priceText.trim()
        ? Math.round(parseFloat(priceText) * 100)
        : undefined;
      const yearNum = releaseYear.trim() ? parseInt(releaseYear.trim(), 10) : undefined;

      if (attribution) {
        await confirmPassport({
          attributionId: attribution.attributionId,
          title: title.trim(),
          brandId: brandId ?? undefined,
          pendingBrandName: pendingBrandName.trim() || undefined,
          showId: showId ?? undefined,
          releaseYear: Number.isFinite(yearNum) ? yearNum : undefined,
          userAction: resolveUserAction(),
          size: size.trim() || undefined,
          color: color.trim() || undefined,
          acquiredAt: acquiredAt.trim() || undefined,
          acquiredPriceCents: priceCents,
          note: note.trim() || undefined,
          storageLocation: storage.trim() || undefined,
          photos,
        });
      } else {
        // 跳过识别的退路，没有 attributionId 可回填，走原来的入库接口。
        await createArchiveItem({
          title: title.trim(),
          brandName: brandName.trim() || pendingBrandName.trim() || undefined,
          size: size.trim() || undefined,
          color: color.trim() || undefined,
          acquiredPriceCents: priceCents,
          acquiredAt: acquiredAt.trim() || undefined,
          note: note.trim() || undefined,
          storageLocation: storage.trim() || undefined,
          photos,
        });
      }
      navigation.goBack();
    } catch (e: any) {
      Alert.show(e?.message ?? t("trading.uploadArchive.submitFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  // ------------------------------------------------------------------
  // 渲染
  // ------------------------------------------------------------------
  const renderPhotosStep = () => (
    <>
      <RNText style={styles.mutedText}>
        {t("trading.uploadArchive.privacyHint")}
      </RNText>

      <View style={styles.photoGrid}>
        {photos.map((uri, idx) => (
          <View key={uri + idx} style={styles.photoWrap}>
            <RNImage source={{ uri }} style={styles.photoThumb} />
            <Pressable
              style={styles.photoRemove}
              onPress={() => removePhoto(idx)}
              accessibilityRole="button"
              accessibilityLabel={t("common.delete")}
            >
              <Ionicons name="close" size={14} color={theme.colors.textInverted} />
            </Pressable>
          </View>
        ))}
        {photos.length < 9 ? (
          <Pressable style={styles.photoAdd} onPress={pickImage}>
            {uploading ? (
              <ActivityIndicator color={theme.colors.text} />
            ) : (
              <Ionicons name="add" size={28} color={theme.colors.gray300} />
            )}
          </Pressable>
        ) : null}
      </View>

      <Pressable
        style={[
          styles.primaryBtn,
          { alignSelf: "flex-start", marginBottom: 8 },
          (generatingViews || photos.length === 0) && styles.primaryBtnDisabled,
        ]}
        onPress={generateViews}
        disabled={generatingViews || photos.length === 0}
      >
        {generatingViews ? (
          <HStack space="sm" style={{ alignItems: "center" }}>
            <ActivityIndicator size="small" color={theme.colors.textInverted} />
            <RNText style={styles.primaryBtnText}>
              {t("trading.uploadArchive.threeViewGenerating")}
            </RNText>
          </HStack>
        ) : (
          <RNText style={styles.primaryBtnText}>
            {t("trading.uploadArchive.threeViewBtn")}
          </RNText>
        )}
      </Pressable>

      <RNText style={[styles.mutedText, { marginBottom: 16 }]}>
        {t("trading.uploadArchive.threeViewHint")}
      </RNText>

      <TradingFormField label={t("trading.uploadArchive.titleLabel")}>
        <TradingFormInput
          value={title}
          onChangeText={setTitle}
          placeholder={t("trading.uploadArchive.titlePlaceholder")}
        />
      </TradingFormField>

      <RNText style={styles.mutedText}>
        {t("trading.uploadArchive.recognizeHint")}
      </RNText>
    </>
  );

  const renderCandidatesStep = () => {
    const v = attribution?.validity;
    const candidates = attribution?.candidates ?? [];
    return (
      <>
        {v?.categoryZh || v?.category ? (
          <RNText style={styles.mutedText}>
            {t("trading.uploadArchive.detectedCategory", {
              category: v.categoryZh || v.category,
            })}
          </RNText>
        ) : null}
        {attribution?.visualSummary ? (
          <RNText style={[styles.mutedText, { marginBottom: 16 }]}>
            {attribution.visualSummary}
          </RNText>
        ) : null}

        {candidates.length === 0 ? (
          <RNText style={[styles.mutedText, { marginBottom: 16 }]}>
            {t("trading.uploadArchive.noCandidates")}
          </RNText>
        ) : (
          candidates.map((c) => (
            <AttributionCandidateCard
              key={`${c.brandId}-${c.showId ?? "none"}`}
              candidate={c}
              selected={picked?.brandId === c.brandId}
              onPress={() => acceptCandidate(c)}
            />
          ))
        )}

        <Pressable
          style={[styles.secondaryBtn, { marginTop: 8 }]}
          onPress={rejectAllCandidates}
        >
          <RNText style={styles.secondaryBtnText}>
            {candidates.length === 0
              ? t("trading.uploadArchive.fillManually")
              : t("trading.uploadArchive.noneOfAbove")}
          </RNText>
        </Pressable>
      </>
    );
  };

  const renderConfirmStep = () => (
    <>
      <TradingFormField label={t("trading.uploadArchive.titleLabel")}>
        <TradingFormInput
          value={title}
          onChangeText={setTitle}
          placeholder={t("trading.uploadArchive.titlePlaceholder")}
        />
      </TradingFormField>

      <TradingFormField label={t("trading.uploadArchive.brandLabel")}>
        <Pressable
          style={styles.selectRow}
          onPress={() => setBrandSheetVisible(true)}
        >
          <RNText
            style={brandName ? styles.selectRowValue : styles.selectRowPlaceholder}
          >
            {brandName || t("trading.uploadArchive.brandPlaceholder")}
          </RNText>
          <Ionicons
            name="chevron-forward"
            size={16}
            color={theme.colors.gray300}
          />
        </Pressable>
      </TradingFormField>

      {brandPending ? (
        <TradingFormField label={t("trading.uploadArchive.pendingBrandLabel")}>
          <TradingFormInput
            value={pendingBrandName}
            onChangeText={setPendingBrandName}
            placeholder={t("trading.uploadArchive.pendingBrandPlaceholder")}
          />
        </TradingFormField>
      ) : null}

      <Pressable onPress={goSubmitBrand} style={{ marginBottom: 16 }}>
        <RNText style={styles.linkText}>
          {t("trading.uploadArchive.brandNotFound")}
        </RNText>
      </Pressable>

      <HStack space="md">
        <Box flex={1}>
          <TradingFormField label={t("trading.uploadArchive.seasonLabel")}>
            <TradingFormInput
              value={picked?.season ?? ""}
              editable={false}
              placeholder={t("trading.uploadArchive.optionalPlaceholder")}
            />
          </TradingFormField>
        </Box>
        <Box flex={1}>
          <TradingFormField label={t("trading.uploadArchive.yearLabel")}>
            <TradingFormInput
              value={releaseYear}
              onChangeText={setReleaseYear}
              placeholder={t("trading.uploadArchive.optionalPlaceholder")}
              keyboardType="number-pad"
            />
          </TradingFormField>
        </Box>
      </HStack>

      <HStack space="md">
        <Box flex={1}>
          <TradingFormField label={t("trading.uploadArchive.sizeLabel")}>
            <TradingFormInput
              value={size}
              onChangeText={setSize}
              placeholder={t("trading.uploadArchive.sizePlaceholder")}
            />
          </TradingFormField>
        </Box>
        <Box flex={1}>
          <TradingFormField label={t("trading.uploadArchive.colorLabel")}>
            <TradingFormInput
              value={color}
              onChangeText={setColor}
              placeholder={t("trading.uploadArchive.colorPlaceholder")}
            />
          </TradingFormField>
        </Box>
      </HStack>

      <TradingFormField label={t("trading.uploadArchive.acquiredAtLabel")}>
        <TradingFormInput
          value={acquiredAt}
          onChangeText={setAcquiredAt}
          placeholder={t("trading.uploadArchive.optionalPlaceholder")}
          autoCorrect={false}
        />
      </TradingFormField>

      <TradingFormField label={t("trading.uploadArchive.priceLabel")}>
        <TradingFormInput
          value={priceText}
          onChangeText={setPriceText}
          placeholder={t("trading.uploadArchive.optionalPlaceholder")}
          keyboardType="decimal-pad"
        />
      </TradingFormField>

      <TradingFormField label={t("trading.uploadArchive.storageLabel")}>
        <TradingFormInput
          value={storage}
          onChangeText={setStorage}
          placeholder={t("trading.uploadArchive.storagePlaceholder")}
        />
      </TradingFormField>

      <TradingFormField label={t("trading.uploadArchive.noteLabel")}>
        <TradingFormTextArea
          value={note}
          onChangeText={setNote}
          placeholder={t("trading.uploadArchive.notePlaceholder")}
        />
      </TradingFormField>
    </>
  );

  const footer = () => {
    if (step === "photos") {
      return (
        <>
          <Pressable
            style={[
              styles.stickyFooterPrimary,
              (recognizing || photos.length === 0) &&
                styles.stickyFooterPrimaryDisabled,
            ]}
            onPress={runRecognition}
            disabled={recognizing || photos.length === 0}
          >
            {recognizing ? (
              <HStack space="sm" style={{ alignItems: "center" }}>
                <ActivityIndicator size="small" color={theme.colors.textInverted} />
                <RNText style={styles.primaryBtnText}>
                  {t("trading.uploadArchive.recognizing")}
                </RNText>
              </HStack>
            ) : (
              <RNText style={styles.primaryBtnText}>
                {t("trading.uploadArchive.recognizeBtn")}
              </RNText>
            )}
          </Pressable>
          {skipAllowed ? (
            <Pressable onPress={skipRecognition} style={{ marginTop: 10 }}>
              <RNText style={[styles.linkText, { textAlign: "center" }]}>
                {t("trading.uploadArchive.skipRecognize")}
              </RNText>
            </Pressable>
          ) : null}
        </>
      );
    }

    if (step === "candidates") {
      return (
        <Pressable
          style={styles.secondaryBtn}
          onPress={() => setStep("photos")}
        >
          <RNText style={styles.secondaryBtnText}>{t("common.back")}</RNText>
        </Pressable>
      );
    }

    return (
      <Pressable
        style={[
          styles.stickyFooterPrimary,
          submitting && styles.stickyFooterPrimaryDisabled,
        ]}
        onPress={submit}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color={theme.colors.textInverted} />
        ) : (
          <RNText style={styles.primaryBtnText}>
            {t("trading.uploadArchive.submitBtn")}
          </RNText>
        )}
      </Pressable>
    );
  };

  const headerTitle =
    step === "candidates"
      ? t("trading.uploadArchive.stepCandidates")
      : step === "confirm"
        ? t("trading.uploadArchive.stepConfirm")
        : t("trading.uploadArchive.headerTitle");

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      edges={["top"]}
    >
      <ScreenHeader title={headerTitle} showBack />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {step === "photos" ? renderPhotosStep() : null}
          {step === "candidates" ? renderCandidatesStep() : null}
          {step === "confirm" ? renderConfirmStep() : null}
          <Box style={{ height: 24 }} />
        </ScrollView>

        <View style={styles.stickyFooter}>{footer()}</View>
      </KeyboardAvoidingView>

      <BrandSearchSheet
        visible={brandSheetVisible}
        onClose={() => setBrandSheetVisible(false)}
        onSelect={selectBrand}
      />
    </SafeAreaView>
  );
};

export default UploadArchiveItemScreen;
