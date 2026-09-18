/**
 * ArchiveDetailScreen —— 单条藏品页。
 *
 * 功能：
 *   - 展示藏品快照
 *   - 一键转卖（生成新 listing 草稿）
 *   - PDF p.22 · 持有记录时间轴 + 新增持有记录
 *
 * 视觉：ArchiveDetailHeader（对齐帖子详情）+ useAppTheme，全部跟随主题。
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  StyleSheet,
  TextInput,
  Image as RNImage,
  ActivityIndicator,
  Platform,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import {
  AnimatedChip,
  Box,
  HStack,
  VStack,
  Text,
  Pressable,
  AiPhotoBadge,
  isAiPhoto,
} from "../../components/ui";
import ArchiveDetailHeader from "../../components/trading/ArchiveDetailHeader";
import ImagePreviewModal from "../../components/ImagePreviewModal";
import { KeyboardFriend, KeyboardFriendScrollView } from "../../components/KeyboardFriend";
import { TradingNotFoundState } from "../../components/trading/TradingFormShared";
import { useAppTheme, useThemedStyles, type AppTheme } from "../../theme";
import { Alert } from "../../utils/Alert";
import {
  getArchiveItem,
  updateArchiveVisibility,
  updateArchivePhotoDisplay,
  resellFromArchive,
  ArchiveItemDetail,
  ArchiveHoldingRecord,
  listArchiveHoldings,
  createArchiveHolding,
} from "../../services/archivePlusService";
import {
  followUser,
  unfollowUser,
  isFollowingUser,
} from "../../services/followService";
import { useAuthStore } from "../../store/authStore";
import { parsePriceInputToCents } from "../../services/storeProductService";
import { useTradingEnabled } from "../../store/featureFlagsStore";
import { useFormatPrice } from "../../utils/currency";

type HoldingStatus = "owned" | "lent" | "transferred" | "resold" | "returned";

type RouteParams = { ArchiveDetail: { archiveId: number } };

const ArchiveDetailScreen: React.FC = () => {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, "ArchiveDetail">>();
  const { t } = useTranslation();
  const tradingEnabled = useTradingEnabled();
  const formatPrice = useFormatPrice();
  const { archiveId } = route.params;
  const currentUserId = useAuthStore((s) => s.user?.userId);

  const HOLDING_STATUS_LABELS = useMemo<Record<HoldingStatus, string>>(
    () => ({
      owned: t("trading.archiveDetail.statusOwned"),
      lent: t("trading.archiveDetail.statusLent"),
      transferred: t("trading.archiveDetail.statusTransferred"),
      resold: t("trading.archiveDetail.statusResold"),
      returned: t("trading.archiveDetail.statusReturned"),
    }),
    [t]
  );

  const [item, setItem] = useState<ArchiveItemDetail | null>(null);
  const [priceText, setPriceText] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // 这页现在也会被藏品主人以外的人打开（世界 feed 点进来），
  // 所以「是不是我的」决定了半页内容给不给看，不再是恒真。
  const isOwner = item?.isOwner ?? false;
  const [visibilityLoading, setVisibilityLoading] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  // 骨架屏微光，与帖子详情同一套时长和透明度区间。
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!loading) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [loading, shimmerAnim]);

  const skeletonOpacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  const SkeletonBox = ({
    width,
    height,
    style,
  }: {
    width: number | string;
    height: number;
    style?: any;
  }) => (
    <Animated.View
      style={[
        {
          width,
          height,
          backgroundColor: theme.colors.gray200,
          borderRadius: 4,
          opacity: skeletonOpacity,
        },
        style,
      ]}
    />
  );

  const [holdings, setHoldings] = useState<ArchiveHoldingRecord[]>([]);
  const [holdingNote, setHoldingNote] = useState("");
  const [holdingStatus, setHoldingStatus] = useState<HoldingStatus>("owned");

  // 点图放大。ai 决定全屏里要不要挂来源说明 —— 放大看细节恰恰是最容易
  // 把生成图当实物照的时刻。
  const [preview, setPreview] = useState<{
    urls: string[];
    index: number;
    ai: boolean;
  } | null>(null);
  const openPreview = (urls: string[], index: number, ai = false) =>
    setPreview({ urls, index, ai });

  // 实拍与 AI 生成分开。photos[0] 是封面，始终留在实拍那组里。
  const shotPhotos = useMemo(
    () => (item?.photos ?? []).filter((u) => !isAiPhoto(u, item?.aiPhotos)),
    [item],
  );
  const aiGenerated = useMemo(
    () => (item?.photos ?? []).filter((u) => isAiPhoto(u, item?.aiPhotos)),
    [item],
  );

  // 主图取三视图；没有生成过就退回实拍。heroIsAi 决定要不要挂来源说明，
  // 以及实拍是否降级成下方的次要区。
  const heroPhotos = aiGenerated.length > 0 ? aiGenerated : shotPhotos;
  const heroIsAi = aiGenerated.length > 0;
  const [heroIndex, setHeroIndex] = useState(0);
  // 图片集合会变（切换实拍展示、重新加载），下标必须跟着收敛，
  // 否则会停在一个已经不存在的位置上渲染 undefined。
  useEffect(() => {
    setHeroIndex((i) => (i < heroPhotos.length ? i : 0));
  }, [heroPhotos.length]);

  const showRealPhotos = item?.showRealPhotos ?? true;
  const [photoDisplayLoading, setPhotoDisplayLoading] = useState(false);

  const reloadHoldings = useCallback(async () => {
    try {
      const list = await listArchiveHoldings(archiveId);
      setHoldings(list);
    } catch (e) {
      console.warn("[ArchiveDetail] load holdings failed", e);
    }
  }, [archiveId]);

  useEffect(() => {
    (async () => {
      try {
        const it = await getArchiveItem(archiveId);
        setItem(it);
        if (it.acquiredPriceCents) {
          setPriceText((it.acquiredPriceCents / 100).toFixed(2));
        }
        // 持有记录是本人才有的数据，别人打开这页不该去拉（后端也会拒）。
        if (it.isOwner) reloadHoldings();
        else if (it.author?.id && currentUserId) {
          setIsFollowing(
            await isFollowingUser(currentUserId, it.author.id).catch(() => false),
          );
        }
      } catch {
        // 不存在、或是别人的私密藏品，后端一律 404 —— 都落到「找不到」页。
        setItem(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [archiveId, reloadHoldings, currentUserId]);

  const onToggleVisibility = async () => {
    if (!item) return;
    const next = item.visibility === "public" ? "private" : "public";
    setVisibilityLoading(true);
    try {
      await updateArchiveVisibility(archiveId, next);
      setItem({ ...item, visibility: next });
      Alert.show(
        next === "public"
          ? t("trading.archiveDetail.visibilityNowPublic")
          : t("trading.archiveDetail.visibilityNowPrivate"),
      );
    } catch (e: any) {
      Alert.show(e?.message ?? t("trading.archiveDetail.visibilityFailed"));
    } finally {
      setVisibilityLoading(false);
    }
  };

  const onTogglePhotoDisplay = async () => {
    if (!item) return;
    const next = !showRealPhotos;
    setPhotoDisplayLoading(true);
    try {
      await updateArchivePhotoDisplay(archiveId, next);
      setItem({ ...item, showRealPhotos: next });
      Alert.show(
        next
          ? t("trading.archiveDetail.realPhotosNowShown")
          : t("trading.archiveDetail.realPhotosNowHidden"),
      );
    } catch (e: any) {
      Alert.show(e?.message ?? t("trading.archiveDetail.photoDisplayFailed"));
    } finally {
      setPhotoDisplayLoading(false);
    }
  };

  const onToggleFollow = async () => {
    const targetUserId = item?.author?.id;
    if (!targetUserId || !currentUserId) return;
    setFollowLoading(true);
    const next = !isFollowing;
    try {
      const params = { followerId: currentUserId, targetUserId };
      if (next) await followUser(params);
      else await unfollowUser(params);
      setIsFollowing(next);
    } catch (e: any) {
      Alert.show(e?.message ?? t("trading.archiveDetail.followFailed"));
    } finally {
      setFollowLoading(false);
    }
  };

  const onResell = async () => {
    if (!item) return;
    const cents = parsePriceInputToCents(priceText);
    if (!cents || cents <= 0) {
      Alert.show(t("trading.archiveDetail.invalidPrice"));
      return;
    }
    setSubmitting(true);
    try {
      await resellFromArchive(archiveId, {
        priceCents: cents,
        description: description.trim() || undefined,
      });
      Alert.alert(
        t("trading.archiveDetail.successTitle"),
        t("trading.archiveDetail.successMessage"),
        [
          {
            text: t("trading.archiveDetail.successCta"),
            onPress: () => navigation.navigate("SellerListings"),
          },
          { text: t("trading.archiveDetail.confirm") },
        ],
      );
    } catch (e: any) {
      Alert.show(e?.message ?? t("trading.archiveDetail.submitFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  const addHolding = async () => {
    try {
      await createArchiveHolding(archiveId, {
        status: holdingStatus,
        note: holdingNote.trim() || undefined,
        heldFrom: new Date().toISOString().slice(0, 10),
      });
      setHoldingNote("");
      setHoldingStatus("owned");
      await reloadHoldings();
    } catch (e: any) {
      Alert.show(e?.message ?? t("trading.archiveDetail.addHoldingFailed"));
    }
  };

  // 加载态用骨架屏，和帖子详情一致。这里不能放「藏品详情」那个居中标题的
  // ScreenHeader —— 加载完换成作者头部之后标题会整个消失，页面顶部跳一下。
  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <HStack px="$md" py="$sm" alignItems="center" gap="$sm">
          <SkeletonBox width={30} height={30} style={{ borderRadius: 15 }} />
          <SkeletonBox width={100} height={14} />
        </HStack>

        <Animated.View
          style={[styles.skeletonCover, { opacity: skeletonOpacity }]}
        />

        <Box px="$md" py="$md" gap="$sm">
          <SkeletonBox width="70%" height={18} />
          <SkeletonBox width="100%" height={14} />
          <SkeletonBox width="50%" height={14} />
        </Box>
      </SafeAreaView>
    );
  }
  if (!item) {
    return (
      <TradingNotFoundState
        headerTitle={t("trading.archiveDetail.headerTitle")}
        title={t("trading.archiveDetail.notFound")}
        hint={t("trading.notFoundState.archiveHint")}
        icon="archive-outline"
      />
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ArchiveDetailHeader
        author={item.author}
        createdAt={item.createdAt}
        isOwner={isOwner}
        visibility={item.visibility ?? "public"}
        isVisibilityLoading={visibilityLoading}
        isFollowing={isFollowing}
        isFollowLoading={followLoading}
        onGoBack={() => navigation.goBack()}
        onAuthorPress={() =>
          item.author?.id &&
          navigation.navigate("UserProfile", { userId: item.author.id })
        }
        onFollow={onToggleFollow}
        onToggleVisibility={onToggleVisibility}
      />

      <KeyboardFriend style={styles.flex}>
        <KeyboardFriendScrollView
          contentContainerStyle={styles.scroll}
        >
          {/* 主图区。三视图是白底、角度齐整的一组，拿它当主视觉比衣柜里
              随手拍的实拍更能说明单品本身；没有三视图时退回实拍。
              但主图无论落到哪一组，AI 角标都必须跟着 —— 被放大到全屏看
              细节的那一刻，正是最容易把推测图当实物照的时刻。 */}
          {heroPhotos.length > 0 ? (
            <View>
              <Pressable
                onPress={() => openPreview(heroPhotos, heroIndex, heroIsAi)}
                accessibilityRole="imagebutton"
                accessibilityLabel={t("common.preview")}
              >
                <RNImage
                  source={{ uri: heroPhotos[heroIndex] }}
                  style={styles.cover}
                />
                {isAiPhoto(heroPhotos[heroIndex], item.aiPhotos) && (
                  <AiPhotoBadge />
                )}
              </Pressable>

              {heroPhotos.length > 1 && (
                <HStack style={styles.thumbRow}>
                  {heroPhotos.map((url, i) => (
                    <Pressable
                      key={`${url}-${i}`}
                      onPress={() => setHeroIndex(i)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: i === heroIndex }}
                      style={[
                        styles.heroThumb,
                        i === heroIndex && styles.heroThumbActive,
                      ]}
                    >
                      <RNImage source={{ uri: url }} style={styles.thumb} />
                      {isAiPhoto(url, item.aiPhotos) && <AiPhotoBadge size="sm" />}
                    </Pressable>
                  ))}
                </HStack>
              )}

              {heroIsAi && (
                <Text style={styles.aiNote}>
                  {t("trading.archiveDetail.aiPhotoNote")}
                </Text>
              )}

              {/* 实拍降为次要区：三视图当主图后，实拍的作用变成「核对实物
                  状况」，不再是第一眼看的东西。 */}
              {shotPhotos.length > 0 && heroIsAi && (
                <View style={styles.realPanel}>
                  <HStack style={styles.aiPanelHead}>
                    <Ionicons
                      name="camera-outline"
                      size={13}
                      color={theme.colors.gray300}
                    />
                    <Text style={styles.aiPanelTitle}>
                      {t("trading.archiveDetail.realPhotosLabel")}
                    </Text>
                  </HStack>
                  <HStack style={styles.thumbRow}>
                    {shotPhotos.map((url, i) => (
                      <Pressable
                        key={`${url}-${i}`}
                        onPress={() => openPreview(shotPhotos, i)}
                        accessibilityRole="imagebutton"
                        accessibilityLabel={t("common.preview")}
                      >
                        <RNImage source={{ uri: url }} style={styles.thumb} />
                      </Pressable>
                    ))}
                  </HStack>
                </View>
              )}

              {/* 只有本人看得到这个开关。关掉之后实拍由服务端剔除，
                  别人的响应里根本不含这些 URL。 */}
              {isOwner && aiGenerated.length > 0 && (
                <Pressable
                  style={styles.photoDisplayRow}
                  onPress={onTogglePhotoDisplay}
                  disabled={photoDisplayLoading}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: !showRealPhotos }}
                >
                  {photoDisplayLoading ? (
                    <ActivityIndicator size="small" color={theme.colors.gray300} />
                  ) : (
                    <Ionicons
                      name={showRealPhotos ? "eye-outline" : "eye-off-outline"}
                      size={14}
                      color={theme.colors.gray300}
                    />
                  )}
                  <Text style={styles.photoDisplayText}>
                    {showRealPhotos
                      ? t("trading.archiveDetail.realPhotosShown")
                      : t("trading.archiveDetail.realPhotosHidden")}
                  </Text>
                </Pressable>
              )}
            </View>
          ) : (
            <Box style={[styles.cover, styles.coverPlaceholder]}>
              <Ionicons
                name="image-outline"
                size={48}
                color={theme.colors.gray300}
              />
            </Box>
          )}

          <Text style={styles.title}>{item.title}</Text>
          {item.brandName ? (
            <Text style={styles.brand}>{item.brandName}</Text>
          ) : null}

          <VStack space="xs" style={{ marginTop: 8 }}>
            <InfoRow
              label={t("trading.archiveDetail.sizeLabel")}
              value={item.size ?? "-"}
            />
            <InfoRow
              label={t("trading.archiveDetail.colorLabel")}
              value={item.color ?? "-"}
            />
            <InfoRow
              label={t("trading.archiveDetail.conditionLabel")}
              value={item.condition ?? "-"}
            />
            {/* 购入价和存放位置只给本人。前者是别人不该知道的成交价，
                后者直接指向这件衣服现在放在哪 —— 公开出去是另一类问题。 */}
            {isOwner ? (
              <>
                <InfoRow
                  label={t("trading.archiveDetail.acquiredPriceLabel")}
                  value={`${formatPrice(item.acquiredPriceCents ?? 0)}${
                    item.acquiredAt ? ` · ${item.acquiredAt}` : ""
                  }`}
                />
                {item.storageLocation ? (
                  <InfoRow
                    label={t("trading.archiveDetail.storageLocationLabel")}
                    value={item.storageLocation}
                  />
                ) : null}
              </>
            ) : null}
          </VStack>

          {/* PDF p.22 · 持有记录。仅本人可见 —— 时间轴里带着交易对手的
              名字和流转时间，公开验证页对这段有单独的脱敏规则，在那套规则
              落地之前不要先把原始记录摊开给陌生人。 */}
          {isOwner ? (
            <>
              <Text style={styles.sectionTitle}>
                {t("trading.archiveDetail.holdingHistoryTitle")}
              </Text>
              {holdings.length === 0 ? (
                <Text style={styles.muted}>
                  {t("trading.archiveDetail.noHoldingRecord")}
                </Text>
              ) : (
                <VStack space="xs">
                  {holdings.map((h) => (
                    <HStack
                      key={h.id}
                      style={styles.holdingRow}
                      space="md"
                      alignItems="flex-start"
                    >
                      <Box style={styles.holdingDot} />
                      <VStack flex={1} space="xs">
                        <Text style={styles.holdingTitle}>
                          {HOLDING_STATUS_LABELS[h.status as HoldingStatus] ??
                            h.status}
                          {h.heldFrom ? ` · ${h.heldFrom}` : ""}
                          {h.heldTo ? ` ~ ${h.heldTo}` : ""}
                        </Text>
                        {h.note ? (
                          <Text style={styles.holdingNote}>{h.note}</Text>
                        ) : null}
                        {h.counterpartName ? (
                          <Text style={styles.muted}>
                            {t("trading.archiveDetail.counterpartLabel", {
                              name: h.counterpartName,
                            })}
                          </Text>
                        ) : null}
                      </VStack>
                    </HStack>
                  ))}
                </VStack>
              )}
            </>
          ) : null}

          {/* 添加新记录 */}
          {isOwner ? (
            <Box style={styles.holdingAddCard}>
              <Text style={styles.holdingAddLabel}>
                {t("trading.archiveDetail.addHoldingTitle")}
              </Text>
              <View style={styles.holdingChipRow}>
                {(
                  ["owned", "lent", "transferred", "resold", "returned"] as const
                ).map((s) => (
                  <AnimatedChip
                    key={s}
                    label={HOLDING_STATUS_LABELS[s]}
                    isActive={holdingStatus === s}
                    onPress={() => setHoldingStatus(s)}
                  />
                ))}
              </View>
              <TextInput
                style={[styles.input, styles.textarea]}
                placeholder={t("trading.archiveDetail.holdingNotePlaceholder")}
                placeholderTextColor={theme.colors.placeholder}
                value={holdingNote}
                onChangeText={setHoldingNote}
                multiline
                textAlignVertical="top"
              />
              <Pressable style={styles.smallDarkBtn} onPress={addHolding}>
                <Text style={styles.smallDarkBtnText}>
                  {t("trading.archiveDetail.addHoldingBtn")}
                </Text>
              </Pressable>
            </Box>
          ) : null}

          {/* 一键转卖（属于交易系统，随开关隐藏）。别人的藏品不是你能转卖的。 */}
          {!isOwner || !tradingEnabled ? null : item.relistedProductId ? (
            <Box style={styles.banner}>
              <Text style={styles.bannerText}>
                {t("trading.archiveDetail.relistedBanner", {
                  id: item.relistedProductId,
                })}
              </Text>
            </Box>
          ) : (
            <>
              <Text style={styles.sectionTitle}>
                {t("trading.archiveDetail.resellTitle")}
              </Text>
              <Text style={styles.muted}>
                {t("trading.archiveDetail.resellHint")}
              </Text>
              <HStack style={styles.priceRow} alignItems="center">
                <Text style={styles.currency}>¥</Text>
                <TextInput
                  style={styles.priceInput}
                  placeholder={t("trading.archiveDetail.pricePlaceholder")}
                  placeholderTextColor={theme.colors.placeholder}
                  value={priceText}
                  onChangeText={setPriceText}
                  keyboardType="decimal-pad"
                />
              </HStack>
              <TextInput
                style={[styles.input, styles.textareaShort]}
                placeholder={t("trading.archiveDetail.descriptionPlaceholder")}
                placeholderTextColor={theme.colors.placeholder}
                value={description}
                onChangeText={setDescription}
                multiline
                textAlignVertical="top"
              />
            </>
          )}

          <Box style={{ height: 24 }} />
        </KeyboardFriendScrollView>

        {isOwner && tradingEnabled && !item.relistedProductId ? (
          <Box style={styles.footer}>
            <Pressable
              style={[styles.primary, submitting && styles.primaryDisabled]}
              onPress={onResell}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color={theme.colors.textInverted} />
              ) : (
                <Text style={styles.primaryText}>
                  {t("trading.archiveDetail.submitBtn")}
                </Text>
              )}
            </Pressable>
          </Box>
        ) : null}
      </KeyboardFriend>

      {/* 与发布流程共用同一个预览组件，手势和交互保持一致 */}
      <ImagePreviewModal
        visible={preview !== null}
        imageUrls={preview?.urls}
        initialIndex={preview?.index ?? 0}
        title={
          preview?.ai ? t("trading.archiveDetail.aiPhotosLabel") : undefined
        }
        subtitle={
          preview?.ai ? t("trading.archiveDetail.aiPhotoNote") : undefined
        }
        onClose={() => setPreview(null)}
      />
    </SafeAreaView>
  );
};

const InfoRow: React.FC<{ label: string; value: string }> = ({
  label,
  value,
}) => {
  const styles = useThemedStyles(makeStyles);
  return (
    <HStack space="md" alignItems="center">
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </HStack>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.colors.background },
    flex: { flex: 1 },
    scroll: { padding: 16, paddingBottom: 120 },
    cover: {
      width: "100%",
      aspectRatio: 1,
      borderRadius: 12,
      backgroundColor: t.colors.skeleton,
    },
    coverPlaceholder: { alignItems: "center", justifyContent: "center" },
    // 主图缩略图：选中态用描边而不是变暗，白底三视图上变暗几乎看不出来。
    heroThumb: {
      borderRadius: 6,
      borderWidth: 2,
      borderColor: "transparent",
    },
    heroThumbActive: { borderColor: t.colors.text },
    // 实拍次要区，和 AI 面板同一种收纳样式。
    realPanel: {
      marginTop: 12,
      padding: 10,
      borderRadius: 10,
      backgroundColor: t.colors.surface,
    },
    photoDisplayRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 10,
      paddingVertical: 6,
    },
    photoDisplayText: { fontSize: 12, color: t.colors.gray300 },
    // 骨架屏主图：占位比例跟着真实封面（1:1），避免加载完成时高度跳变。
    skeletonCover: {
      width: "100%",
      aspectRatio: 1,
      backgroundColor: t.colors.gray200,
    },
    thumbRow: { gap: 8, marginTop: 8, flexWrap: "wrap" },
    // AI 生成图单独圈起来，和实拍区拉开距离。
    aiPanel: {
      marginTop: 12,
      padding: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
      borderRadius: 8,
      backgroundColor: t.colors.card,
    },
    aiPanelHead: { alignItems: "center", gap: 6 },
    aiPanelTitle: {
      fontFamily: "PlayfairDisplay-Medium",
      fontSize: 11,
      letterSpacing: 1.6,
      color: t.colors.text,
    },
    thumb: {
      width: 88,
      height: 88,
      borderRadius: 8,
      backgroundColor: t.colors.skeleton,
    },
    aiNote: {
      marginTop: 8,
      fontSize: 12,
      lineHeight: 17,
      color: t.colors.gray300,
    },
    title: {
      fontSize: 18,
      fontWeight: "700",
      color: t.colors.text,
      marginTop: 12,
    },
    brand: { color: t.colors.gray300, marginTop: 4 },
    muted: { color: t.colors.gray300, fontSize: 12 },
    infoLabel: { fontSize: 13, color: t.colors.gray300, width: 60 },
    infoValue: { fontSize: 13, color: t.colors.text, flex: 1 },
    sectionTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: t.colors.text,
      marginTop: 24,
      marginBottom: 8,
      letterSpacing: 0.5,
    },

    // ---------- 持有记录 ----------
    holdingRow: {
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    holdingDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: t.colors.accent,
      marginTop: 8,
    },
    holdingTitle: { fontSize: 13, color: t.colors.text, fontWeight: "600" },
    holdingNote: { fontSize: 12, color: t.colors.gray400 },

    holdingAddCard: {
      backgroundColor: t.colors.cardElevated,
      borderRadius: 12,
      padding: t.spacing.md,
      marginTop: t.spacing.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
      gap: t.spacing.sm,
    },
    holdingAddLabel: {
      fontSize: 12,
      color: t.colors.gray300,
    },
    holdingChipRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "flex-start",
      gap: t.spacing.xs,
    },
    smallDarkBtn: {
      alignSelf: "flex-start",
      paddingHorizontal: 14,
      paddingVertical: 8,
      backgroundColor: t.colors.accent,
      borderRadius: 16,
    },
    smallDarkBtnText: {
      color: t.colors.textInverted,
      fontSize: 12,
      fontWeight: "600",
    },

    // ---------- 一键转卖 ----------
    banner: {
      backgroundColor: `${t.colors.success}22`,
      padding: 12,
      borderRadius: 8,
      marginTop: 16,
    },
    bannerText: { color: t.colors.success, fontWeight: "600" },
    priceRow: {
      borderBottomWidth: 1,
      borderBottomColor: t.colors.text,
      paddingVertical: 8,
      marginTop: 12,
    },
    currency: {
      fontSize: 28,
      fontWeight: "700",
      color: t.colors.text,
      marginRight: 8,
    },
    priceInput: {
      flex: 1,
      fontSize: 28,
      fontWeight: "700",
      color: t.colors.text,
    },

    input: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: t.colors.text,
      backgroundColor: t.colors.inputBackground,
    },
    textarea: { minHeight: 88 },
    textareaShort: { minHeight: 80, marginTop: t.spacing.sm },

    footer: {
      padding: 16,
      paddingBottom: Platform.OS === "ios" ? 32 : 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border,
      backgroundColor: t.colors.card,
    },
    primary: {
      backgroundColor: t.colors.accent,
      paddingVertical: 14,
      borderRadius: 8,
      alignItems: "center",
    },
    primaryDisabled: { opacity: 0.5 },
    primaryText: {
      color: t.colors.textInverted,
      fontSize: 16,
      fontWeight: "600",
    },
    empty: {
      textAlign: "center",
      color: t.colors.gray300,
      marginTop: 32,
    },
  });

export default ArchiveDetailScreen;
