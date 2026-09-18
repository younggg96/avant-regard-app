/**
 * ArchiveDetailScreen —— 单条藏品页，一个屏两种模式。
 *
 * mode="view"（默认）：把藏品当成一种帖子来看 —— 三视图 + 基本信息 +
 *   点赞 / 收藏 / 评论。作者从 Archive feed 点进自己的藏品时走的也是这条，
 *   看到的和陌生人完全一样，这样他才知道自己公开出去的究竟长什么样。
 *
 * mode="edit"：管理视角，从「我的档案」类入口进来。在 view 的内容之上多出
 *   购入价、存放位置、持有记录时间轴、新增持有记录、一键转卖、实拍展示开关。
 *   这些要么是隐私（成交价、藏在哪），要么是只有主人才做的操作。
 *
 * 互动本身不重新造：每条档案在 posts 里挂一条 status=HIDDEN 的影子帖子
 * （migration 092），点赞/收藏/评论直接复用帖子那套接口和组件。
 *
 * 视觉：ArchiveDetailHeader（对齐帖子详情）+ useAppTheme，全部跟随主题。
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  StyleSheet,
  TextInput,
  TouchableWithoutFeedback,
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
// 评论区与底部互动条直接复用帖子详情的组件 —— 档案的互动就是帖子的互动，
// 照抄一份只会让两边的交互慢慢分叉。
import { CommentsSection } from "../../components/PostDetail/CommentsSection";
import { CommentInputBar } from "../../components/PostDetail/CommentInputBar";
import { useComments } from "../../components/PostDetail/hooks/useComments";
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
import {
  likePost,
  unlikePost,
  favoritePost,
  unfavoritePost,
} from "../../services/postService";
import { useAuthStore } from "../../store/authStore";
import { parsePriceInputToCents } from "../../services/storeProductService";
import { useTradingEnabled } from "../../store/featureFlagsStore";
import { useFormatPrice } from "../../utils/currency";

type HoldingStatus = "owned" | "lent" | "transferred" | "resold" | "returned";

/**
 * 进这一页的入口决定给什么模式，而不是「是不是我的」：
 * 藏品主人也需要一个能看到自己公开面貌的入口。
 */
export type ArchiveDetailMode = "view" | "edit";

type RouteParams = {
  ArchiveDetail: { archiveId: number; mode?: ArchiveDetailMode };
};

const ArchiveDetailScreen: React.FC = () => {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, "ArchiveDetail">>();
  const { t } = useTranslation();
  const tradingEnabled = useTradingEnabled();
  const formatPrice = useFormatPrice();
  const { archiveId, mode = "view" } = route.params;
  const currentUserId = useAuthStore((s) => s.user?.userId);
  const currentUsername = useAuthStore((s) => s.user?.username);

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
  // 管理区要同时满足「是我的」和「从管理入口进来的」。只看 isOwner 的话，
  // 作者从 Archive feed 点进自己的藏品会看到一堆别人看不到的表单，
  // 也就永远无法确认自己公开出去的样子。
  const canEdit = isOwner && mode === "edit";
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

  // ---------------- 点赞 / 收藏 / 评论 ----------------
  // 全部挂在影子帖子上（migration 092），所以这里用的是帖子的接口。
  // postId 缺失说明后端还没建起这条记录，互动区整体不渲染 —— 见下方 showEngagement。
  const postId = item?.postId ?? null;

  // 评论区照搬帖子详情那套 hook。postStatus 固定传 PUBLISHED：影子帖子在库里
  // 是 HIDDEN（好让它被所有帖子流排除），而 hook 拿这个字段只当「能不能评论」
  // 的开关用，传 HIDDEN 会让评论永远加载不出来。能不能看这条档案，
  // 在 getArchiveItem 那一步已经判过了。
  const comments = useComments({
    postId: postId ? String(postId) : undefined,
    postStatus: "PUBLISHED",
    userId: currentUserId,
    username: currentUsername,
  });

  const [likeBusy, setLikeBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);

  /**
   * 点赞 / 收藏共用的乐观更新。先改本地再发请求，失败原样回滚 ——
   * 互动的手感比一致性优先，但回滚必须做，否则界面会停在一个服务端
   * 并不认同的状态上。busy 标记挡住连点造成的计数漂移。
   */
  const toggleEngagement = useCallback(
    async (
      kind: "like" | "favorite",
      busy: boolean,
      setBusy: (v: boolean) => void,
    ) => {
      if (!item || !postId || busy) return;
      if (!currentUserId) {
        Alert.show(t("engagement.pleaseLogin"));
        return;
      }
      const liking = kind === "like";
      const on = liking ? !item.isLiked : !item.isFavorited;
      const countKey = liking ? "likeCount" : "favoriteCount";
      const flagKey = liking ? "isLiked" : "isFavorited";
      const delta = on ? 1 : -1;

      setBusy(true);
      setItem((prev) =>
        prev
          ? {
              ...prev,
              [flagKey]: on,
              [countKey]: Math.max(0, (prev[countKey] ?? 0) + delta),
            }
          : prev,
      );
      try {
        if (liking) {
          await (on ? likePost : unlikePost)(postId, currentUserId);
        } else {
          await (on ? favoritePost : unfavoritePost)(postId, currentUserId);
        }
      } catch (e: any) {
        setItem((prev) =>
          prev
            ? {
                ...prev,
                [flagKey]: !on,
                [countKey]: Math.max(0, (prev[countKey] ?? 0) - delta),
              }
            : prev,
        );
        Alert.show(e?.message ?? t("common.failed"));
      } finally {
        setBusy(false);
      }
    },
    [item, postId, currentUserId, t],
  );

  const onLike = () => toggleEngagement("like", likeBusy, setLikeBusy);
  const onSave = () => toggleEngagement("favorite", saveBusy, setSaveBusy);

  // 互动区只在 view 模式出现：edit 的底部要留给「一键转卖」那个主按钮，
  // 两条底栏叠在一起谁都用不了。edit 模式下走 viewPublicPage 入口过来看。
  // postId 为空说明影子帖子还没建起来（092 未执行），此时点赞根本不会落库，
  // 与其给一个假的成功，不如整块不渲染。
  const showEngagement = mode === "view" && !!postId;

  // 计数以服务端为准，但评论一加载完就切到本地列表 —— 这样刚发出去的评论
  // 立刻反映在数字上，不用为了一个 +1 再跑一趟详情接口。回复也要算进去，
  // 否则这里的数字和帖子详情的口径对不上。
  const displayCommentCount = comments.isLoadingComments
    ? item?.commentCount ?? 0
    : comments.comments.reduce((n, c) => n + 1 + (c.replyCount || 0), 0);

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
        // view 模式下它不展示，也就没必要多发这个请求。
        if (it.isOwner && mode === "edit") reloadHoldings();
        else if (!it.isOwner && it.author?.id && currentUserId) {
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
  }, [archiveId, reloadHoldings, currentUserId, mode]);

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

              {/* 只有管理视角看得到这个开关。关掉之后实拍由服务端剔除，
                  别人的响应里根本不含这些 URL。 */}
              {canEdit && aiGenerated.length > 0 && (
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
            {/* 购入价和存放位置只出现在管理视角。前者是别人不该知道的成交价，
                后者直接指向这件衣服现在放在哪 —— 公开出去是另一类问题。 */}
            {canEdit ? (
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

          {/* PDF p.22 · 持有记录。仅管理视角可见 —— 时间轴里带着交易对手的
              名字和流转时间，公开验证页对这段有单独的脱敏规则，在那套规则
              落地之前不要先把原始记录摊开给陌生人。 */}
          {canEdit ? (
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
          {canEdit ? (
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
          {!canEdit || !tradingEnabled ? null : item.relistedProductId ? (
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

          {/* 管理视角没有互动区，但作者仍然需要看到别人眼里的这条藏品
              （以及别人留下的评论），所以给一个跳到 view 模式的入口。
              用 push 而不是 navigate：同名路由 navigate 只会复用当前这个
              实例并改参数，返回栈里就少了一层，返回键会直接退出详情。 */}
          {canEdit ? (
            <Pressable
              style={styles.publicPageLink}
              onPress={() =>
                navigation.push("ArchiveDetail", { archiveId, mode: "view" })
              }
              accessibilityRole="button"
            >
              <Ionicons
                name="globe-outline"
                size={14}
                color={theme.colors.gray300}
              />
              <Text style={styles.publicPageLinkText}>
                {t("trading.archiveDetail.viewPublicPage")}
              </Text>
              <Ionicons
                name="chevron-forward"
                size={14}
                color={theme.colors.gray300}
              />
            </Pressable>
          ) : null}

          {showEngagement ? (
            <CommentsSection
              comments={comments.comments}
              isLoading={comments.isLoadingComments}
              postStatus="PUBLISHED"
              currentUserId={currentUserId}
              onCommentLike={comments.handleCommentLike}
              onReplyLike={comments.handleReplyLike}
              onDeleteComment={comments.handleDeleteComment}
              onDeleteReply={comments.handleDeleteReply}
              onUserPress={(userId) =>
                navigation.navigate("UserProfile", { userId })
              }
              onReplyPress={comments.handleReplyPress}
              onToggleReplies={comments.handleToggleReplies}
            />
          ) : null}

          {/* 有底部互动条时要多留出它的高度，否则最后一条评论被压在条下面。 */}
          <Box style={{ height: showEngagement ? 80 : 24 }} />
        </KeyboardFriendScrollView>

        {/* 输入展开时压暗正文。必须夹在滚动区和互动条之间：
            互动条 zIndex 20 > 遮罩 10，这样点空白处能收起键盘，
            而输入框本身不会被自己的遮罩挡住。 */}
        {showEngagement && comments.isCommentFocused ? (
          <TouchableWithoutFeedback onPress={comments.handleOverlayPress}>
            <View style={styles.contentOverlay} />
          </TouchableWithoutFeedback>
        ) : null}

        {showEngagement ? (
          <CommentInputBar
            ref={comments.commentInputRef}
            commentInput={comments.commentInput}
            isSubmitting={comments.isSubmittingComment}
            isFocused={comments.isCommentFocused}
            displayLikes={item.likeCount ?? 0}
            displaySaves={item.favoriteCount ?? 0}
            displayComments={displayCommentCount}
            displayIsLiked={item.isLiked ?? false}
            displayIsSaved={item.isFavorited ?? false}
            replyTarget={comments.replyTarget}
            onInputChange={comments.setCommentInput}
            onInputFocus={comments.handleInputFocus}
            onInputBlur={comments.handleInputBlur}
            onSubmit={comments.handleSubmitComment}
            onLike={onLike}
            onSave={onSave}
            onOverlayPress={comments.handleOverlayPress}
            onCancelReply={comments.handleCancelReply}
          />
        ) : null}

        {canEdit && tradingEnabled && !item.relistedProductId ? (
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
    // 管理视角底部的「查看公开页」入口
    publicPageLink: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 20,
      paddingVertical: 10,
    },
    publicPageLinkText: { flex: 1, fontSize: 13, color: t.colors.gray300 },
    // 评论输入展开时压暗正文。zIndex 要低于 CommentInputBar 的 20。
    contentOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: t.colors.overlay,
      zIndex: 10,
    },
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
