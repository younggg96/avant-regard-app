/**
 * 活动详情页（PRD 3.1 / 3.4）
 *
 * 字段：活动主题、地点标注（小地图）、举办者、活动类型、活动链接、评论区（评论 + 评分，无点赞）、
 *       收藏按钮（显眼）、预约按钮（活动前 2 小时推送）。
 * 活动结束后进入「活动回顾」态：评论区继续开放，允许返图，返图可关联「我的档案」单品。
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  Image as RNImage,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import MapView, { Marker, PROVIDER_DEFAULT } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import * as ImagePicker from "expo-image-picker";

import { Pressable, Text, UserAvatar } from "../../components/ui";
import { OptimizedImage } from "../../components/ui/OptimizedImage";
import ScreenHeader from "../../components/ScreenHeader";
import HalfStarRating from "../../components/HalfStarRating";
import { ImageSize } from "../../utils/imageUtils";
import { useAppTheme, useThemedStyles, type AppTheme } from "../../theme";
import { Alert } from "../../utils/Alert";
import { useAuthStore } from "../../store/authStore";
import { uploadImage } from "../../services/postService";
import { ArchiveItem, listArchive } from "../../services/archivePlusService";
import {
  EventComment,
  EventDetail,
  createEventComment,
  deleteEventComment,
  formatEventTimeRange,
  getEventComments,
  getEventDetail,
  isEventEnded,
} from "../../services/eventService";
import { useEventInteractionStore, useResolvedEvent } from "../../store/eventInteractionStore";
import EventTypeBadge from "./EventTypeBadge";
import EventActionButtons from "./EventActionButtons";

type RouteParams = { EventDetail: { eventId: number } };

const MAX_COMMENT_IMAGES = 3;

const formatRelative = (iso: string, t: (k: string, o?: any) => string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return t("events.justNow");
  if (m < 60) return t("events.minutesAgo", { count: m });
  const h = Math.floor(m / 60);
  if (h < 24) return t("events.hoursAgo", { count: h });
  const d = Math.floor(h / 24);
  if (d < 30) return t("events.daysAgo", { count: d });
  const dt = new Date(iso);
  return `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, "0")}.${String(dt.getDate()).padStart(2, "0")}`;
};

const EventDetailScreen: React.FC = () => {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const s = useThemedStyles(makeStyles);
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, "EventDetail">>();
  const { eventId } = route.params;
  const currentUser = useAuthStore((st) => st.user);
  const syncFromEvents = useEventInteractionStore((st) => st.syncFromEvents);

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [comments, setComments] = useState<EventComment[]>([]);
  const [commentTotal, setCommentTotal] = useState(0);
  const [commentPage, setCommentPage] = useState(1);
  const [commentsLoading, setCommentsLoading] = useState(false);

  // 评论编辑器
  const [content, setContent] = useState("");
  const [rating, setRating] = useState(0);
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [archiveItem, setArchiveItem] = useState<ArchiveItem | null>(null);
  const [archivePickerVisible, setArchivePickerVisible] = useState(false);
  const [archiveItems, setArchiveItems] = useState<ArchiveItem[] | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await getEventDetail(eventId);
      setEvent(d);
      syncFromEvents([d]);
    } catch (e: any) {
      if (e?.status === 404) setNotFound(true);
      else Alert.show(t("common.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [eventId, syncFromEvents, t]);

  const loadComments = useCallback(
    async (page: number, replace: boolean) => {
      setCommentsLoading(true);
      try {
        const res = await getEventComments(eventId, { page, pageSize: 20 });
        setComments((prev) => (replace ? res.items : [...prev, ...res.items]));
        setCommentTotal(res.total);
        setCommentPage(page);
      } catch {
        /* ignore */
      } finally {
        setCommentsLoading(false);
      }
    },
    [eventId],
  );

  useEffect(() => {
    load();
    loadComments(1, true);
  }, [load, loadComments]);

  const resolved = useResolvedEvent(event ?? ({ id: eventId } as any));
  const ended = event ? isEventEnded(resolved) : false;
  const time = event ? formatEventTimeRange(event.startAt, event.endAt) : null;
  const weekday = useMemo(() => {
    if (!event) return "";
    const wds = t("events.weekdays").split(",");
    return wds.length === 7 ? wds[new Date(event.startAt).getDay()] : "";
  }, [event, t]);

  const hasCoords = !!event && typeof event.latitude === "number" && typeof event.longitude === "number";
  const heroImage = event?.coverImage || event?.images?.[0] || null;

  const openLink = () => {
    if (event?.linkUrl) Linking.openURL(event.linkUrl).catch(() => Alert.show(t("common.operationFailed")));
  };

  const openMaps = () => {
    if (!event) return;
    const q = hasCoords
      ? `${event.latitude},${event.longitude}`
      : encodeURIComponent([event.locationName, event.address, event.city].filter(Boolean).join(" "));
    Linking.openURL(`https://maps.apple.com/?q=${q}`).catch(() => {});
  };

  // ---------- 评论 ----------
  const pickImages = async () => {
    if (images.length >= MAX_COMMENT_IMAGES) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(t("common.permissionDenied"), t("common.photoPermissionRequired"));
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: MAX_COMMENT_IMAGES - images.length,
      quality: 0.8,
    });
    if (res.canceled || !res.assets?.length) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const a of res.assets.slice(0, MAX_COMMENT_IMAGES - images.length)) {
        urls.push(await uploadImage(a.uri));
      }
      setImages((prev) => [...prev, ...urls].slice(0, MAX_COMMENT_IMAGES));
    } catch {
      Alert.show(t("common.uploadFailed"));
    } finally {
      setUploading(false);
    }
  };

  const openArchivePicker = async () => {
    setArchivePickerVisible(true);
    if (archiveItems === null) {
      try {
        const res = await listArchive({ page: 1, pageSize: 60 });
        setArchiveItems(res.items);
      } catch {
        setArchiveItems([]);
      }
    }
  };

  const submitComment = async () => {
    if (!event) return;
    if (!content.trim() && images.length === 0 && rating === 0) {
      Alert.show(t("events.commentEmpty"));
      return;
    }
    setSubmitting(true);
    try {
      const c = await createEventComment(event.id, {
        content: content.trim(),
        rating: rating > 0 ? Math.round(rating) : null,
        images,
        archiveItemId: archiveItem?.id ?? null,
      });
      setComments((prev) => [c, ...prev]);
      setCommentTotal((n) => n + 1);
      setContent("");
      setRating(0);
      setImages([]);
      setArchiveItem(null);
      Alert.show(t("events.commentSuccess"));
    } catch (e: any) {
      Alert.show(e?.message || t("common.operationFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  const removeComment = (c: EventComment) => {
    Alert.alert(t("common.confirmDelete"), undefined, [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: async () => {
          try {
            await deleteEventComment(eventId, c.id);
            setComments((prev) => prev.filter((x) => x.id !== c.id));
            setCommentTotal((n) => Math.max(0, n - 1));
          } catch {
            Alert.show(t("common.deleteFailed"));
          }
        },
      },
    ]);
  };

  // ---------- 渲染 ----------
  if (loading) {
    return (
      <SafeAreaView style={s.container} edges={["top"]}>
        <ScreenHeader title={t("events.detailTitle")} showBack />
        <View style={s.center}>
          <ActivityIndicator color={theme.colors.gray300} />
        </View>
      </SafeAreaView>
    );
  }

  if (notFound || !event) {
    return (
      <SafeAreaView style={s.container} edges={["top"]}>
        <ScreenHeader title={t("events.detailTitle")} showBack />
        <View style={s.center}>
          <Ionicons name="calendar-clear-outline" size={40} color={theme.colors.gray200} />
          <Text fontSize="$md" style={{ color: theme.colors.gray300, marginTop: 12 }}>
            {t("events.notFound")}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const place = event.isOnline
    ? t("events.online")
    : [event.locationName, event.address].filter(Boolean).join(" · ") || event.city || "";

  return (
    <SafeAreaView style={s.container} edges={["top"]}>
      <ScreenHeader title={ended ? t("events.reviewTitle") : t("events.detailTitle")} showBack />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Hero */}
        {heroImage ? (
          <OptimizedImage uri={heroImage} size={ImageSize.LARGE} style={s.hero} contentFit="cover" />
        ) : (
          <View style={[s.hero, { backgroundColor: theme.colors.surface }]} />
        )}

        {ended && (
          <View style={[s.reviewBanner, { backgroundColor: theme.colors.surface }]}>
            <Ionicons name="time-outline" size={14} color={theme.colors.textSecondary} />
            <Text fontSize="$xs" style={{ color: theme.colors.textSecondary, marginLeft: 6 }}>
              {t("events.reviewBanner")}
            </Text>
          </View>
        )}

        <View style={s.section}>
          <EventTypeBadge type={event.eventType} size="md" />
          <Text fontSize="$xl" fontWeight="$bold" style={{ color: theme.colors.text, marginTop: 6 }}>
            {event.title}
          </Text>

          {/* 时间 */}
          <View style={s.infoRow}>
            <Ionicons name="time-outline" size={16} color={theme.colors.gray300} />
            <Text fontSize="$sm" style={[s.infoText, { color: theme.colors.text }]}>
              {time?.date}
              {weekday ? ` (${weekday})` : ""}
              {time?.sameDay ? `   ${time.time}` : ""}
            </Text>
          </View>

          {/* 地点 */}
          {!!place && (
            <Pressable onPress={event.isOnline ? undefined : openMaps} style={s.infoRow}>
              <Ionicons name={event.isOnline ? "globe-outline" : "location-outline"} size={16} color={theme.colors.gray300} />
              <Text fontSize="$sm" style={[s.infoText, { color: theme.colors.text }]} numberOfLines={2}>
                {place}
              </Text>
            </Pressable>
          )}

          {/* 举办者 */}
          {!!event.organizer && (
            <View style={s.infoRow}>
              <Ionicons name="people-outline" size={16} color={theme.colors.gray300} />
              <Text fontSize="$sm" style={[s.infoText, { color: theme.colors.text }]}>
                {t("events.organizer")}：{event.organizer}
              </Text>
            </View>
          )}

          {/* 活动链接 */}
          {!!event.linkUrl && (
            <Pressable onPress={openLink} style={s.infoRow}>
              <Ionicons name="link-outline" size={16} color={theme.colors.gray300} />
              <Text fontSize="$sm" style={[s.infoText, { color: theme.colors.text, textDecorationLine: "underline" }]} numberOfLines={1}>
                {t("events.openLink")}
              </Text>
            </Pressable>
          )}

          <View style={{ marginTop: 16 }}>
            <EventActionButtons event={resolved} size="md" showCounts fullWidth />
          </View>
        </View>

        {/* 小地图标注 */}
        {hasCoords && !event.isOnline && (
          <View style={s.section}>
            <Text fontSize="$md" fontWeight="$semibold" style={{ color: theme.colors.text, marginBottom: 8 }}>
              {t("events.location")}
            </Text>
            <Pressable onPress={openMaps} style={s.mapWrap}>
              <MapView
                provider={PROVIDER_DEFAULT}
                style={s.map}
                pointerEvents="none"
                initialRegion={{
                  latitude: event.latitude!,
                  longitude: event.longitude!,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }}
                scrollEnabled={false}
                zoomEnabled={false}
                rotateEnabled={false}
                pitchEnabled={false}
              >
                <Marker coordinate={{ latitude: event.latitude!, longitude: event.longitude! }} />
              </MapView>
            </Pressable>
            {event.store && (
              <Pressable
                onPress={() => navigation.navigate("StoreDetail", { storeId: event.store!.id })}
                style={[s.storeRow, { borderColor: theme.colors.divider }]}
              >
                <Ionicons name="storefront-outline" size={16} color={theme.colors.text} />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text fontSize="$sm" fontWeight="$semibold" style={{ color: theme.colors.text }}>
                    {event.store.name}
                  </Text>
                  {!!event.store.address && (
                    <Text fontSize="$xs" style={{ color: theme.colors.gray300 }} numberOfLines={1}>
                      {event.store.address}
                    </Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={16} color={theme.colors.gray300} />
              </Pressable>
            )}
          </View>
        )}

        {/* 介绍 */}
        {!!event.description && (
          <View style={s.section}>
            <Text fontSize="$md" fontWeight="$semibold" style={{ color: theme.colors.text, marginBottom: 8 }}>
              {t("events.about")}
            </Text>
            <Text fontSize="$sm" style={{ color: theme.colors.textSecondary, lineHeight: 22 }}>
              {event.description}
            </Text>
          </View>
        )}

        {/* 图片 */}
        {event.images?.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.gallery}>
            {event.images.map((img, i) => (
              <OptimizedImage key={i} uri={img} size={ImageSize.MEDIUM} style={s.galleryImg} contentFit="cover" lazy />
            ))}
          </ScrollView>
        )}

        {/* 评论区 */}
        <View style={s.section}>
          <Text fontSize="$md" fontWeight="$semibold" style={{ color: theme.colors.text }}>
            {ended ? t("events.reviewComments") : t("events.comments")}
            {commentTotal > 0 ? `  ${commentTotal}` : ""}
          </Text>

          {/* 编辑器 */}
          <View style={[s.composer, { backgroundColor: theme.colors.surface }]}>
            <TextInput
              value={content}
              onChangeText={setContent}
              placeholder={ended ? t("events.commentPlaceholderReview") : t("events.commentPlaceholder")}
              placeholderTextColor={theme.colors.placeholder}
              multiline
              style={[s.input, { color: theme.colors.text }]}
            />
            <View style={s.ratingRow}>
              <Text fontSize="$xs" style={{ color: theme.colors.gray300, marginRight: 8 }}>
                {t("events.rating")}
              </Text>
              <HalfStarRating rating={rating} onRatingChange={setRating} interactive size={18} />
              {rating > 0 && (
                <Pressable onPress={() => setRating(0)} hitSlop={8} style={{ marginLeft: 8 }}>
                  <Ionicons name="close-circle" size={14} color={theme.colors.gray200} />
                </Pressable>
              )}
            </View>

            {(images.length > 0 || archiveItem) && (
              <View style={s.attachRow}>
                {images.map((img, i) => (
                  <View key={img} style={s.attach}>
                    <RNImage source={{ uri: img }} style={s.attachImg} />
                    <Pressable
                      onPress={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                      style={s.attachRemove}
                    >
                      <Ionicons name="close" size={10} color="#fff" />
                    </Pressable>
                  </View>
                ))}
                {archiveItem && (
                  <View style={[s.archiveChip, { borderColor: theme.colors.text }]}>
                    <Ionicons name="albums-outline" size={12} color={theme.colors.text} />
                    <Text fontSize={11} numberOfLines={1} style={{ color: theme.colors.text, marginLeft: 4, maxWidth: 140 }}>
                      {archiveItem.title || archiveItem.brandName}
                    </Text>
                    <Pressable onPress={() => setArchiveItem(null)} hitSlop={6} style={{ marginLeft: 4 }}>
                      <Ionicons name="close" size={12} color={theme.colors.text} />
                    </Pressable>
                  </View>
                )}
              </View>
            )}

            <View style={s.composerBar}>
              <View style={{ flexDirection: "row", gap: 14 }}>
                <Pressable onPress={pickImages} disabled={uploading || images.length >= MAX_COMMENT_IMAGES} hitSlop={6}>
                  {uploading ? (
                    <ActivityIndicator size="small" color={theme.colors.gray300} />
                  ) : (
                    <Ionicons name="image-outline" size={20} color={theme.colors.text} />
                  )}
                </Pressable>
                <Pressable onPress={openArchivePicker} hitSlop={6}>
                  <Ionicons name="albums-outline" size={20} color={theme.colors.text} />
                </Pressable>
              </View>
              <Pressable
                onPress={submitComment}
                disabled={submitting}
                style={[s.sendBtn, { backgroundColor: theme.colors.text, opacity: submitting ? 0.6 : 1 }]}
              >
                <Text fontSize="$sm" fontWeight="$semibold" style={{ color: theme.colors.textInverted }}>
                  {t("common.send")}
                </Text>
              </Pressable>
            </View>
          </View>

          {/* 列表 */}
          {comments.map((c) => (
            <View key={c.id} style={[s.comment, { borderBottomColor: theme.colors.divider }]}>
              <UserAvatar uri={c.user.avatarUrl} name={c.user.username} size={32} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text fontSize="$sm" fontWeight="$semibold" style={{ color: theme.colors.text, flex: 1 }} numberOfLines={1}>
                    {c.user.username}
                  </Text>
                  <Text fontSize={11} style={{ color: theme.colors.gray300 }}>
                    {formatRelative(c.createdAt, t)}
                  </Text>
                  {currentUser?.userId === c.user.id && (
                    <Pressable onPress={() => removeComment(c)} hitSlop={8} style={{ marginLeft: 8 }}>
                      <Ionicons name="trash-outline" size={14} color={theme.colors.gray300} />
                    </Pressable>
                  )}
                </View>
                {!!c.rating && (
                  <View style={{ marginTop: 2 }}>
                    <HalfStarRating rating={c.rating} size={12} />
                  </View>
                )}
                {!!c.content && (
                  <Text fontSize="$sm" style={{ color: theme.colors.text, marginTop: 4, lineHeight: 20 }}>
                    {c.content}
                  </Text>
                )}
                {c.images?.length > 0 && (
                  <View style={s.commentImages}>
                    {c.images.map((img, i) => (
                      <OptimizedImage key={i} uri={img} size={ImageSize.THUMBNAIL} style={s.commentImg} contentFit="cover" lazy />
                    ))}
                  </View>
                )}
                {c.archiveItem && (
                  <Pressable
                    onPress={() => navigation.navigate("ArchiveDetail", { archiveId: c.archiveItem!.id })}
                    style={[s.archiveRef, { borderColor: theme.colors.divider }]}
                  >
                    {c.archiveItem.photo ? (
                      <OptimizedImage uri={c.archiveItem.photo} size={ImageSize.THUMBNAIL} style={s.archiveRefImg} contentFit="cover" lazy />
                    ) : (
                      <View style={[s.archiveRefImg, { backgroundColor: theme.colors.surface }]} />
                    )}
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text fontSize={11} style={{ color: theme.colors.gray300 }}>
                        {t("events.woreThis")}
                      </Text>
                      <Text fontSize="$xs" fontWeight="$semibold" numberOfLines={1} style={{ color: theme.colors.text }}>
                        {c.archiveItem.title || c.archiveItem.brandName}
                      </Text>
                    </View>
                  </Pressable>
                )}
              </View>
            </View>
          ))}

          {comments.length < commentTotal && (
            <Pressable onPress={() => loadComments(commentPage + 1, false)} disabled={commentsLoading} style={s.loadMore}>
              {commentsLoading ? (
                <ActivityIndicator size="small" color={theme.colors.gray300} />
              ) : (
                <Text fontSize="$sm" style={{ color: theme.colors.gray300 }}>
                  {t("common.loadMore")}
                </Text>
              )}
            </Pressable>
          )}
          {comments.length === 0 && !commentsLoading && (
            <Text fontSize="$sm" style={{ color: theme.colors.gray300, paddingVertical: 16, textAlign: "center" }}>
              {t("events.noComments")}
            </Text>
          )}
        </View>
      </ScrollView>

      {/* 关联我的档案单品 */}
      <Modal visible={archivePickerVisible} transparent animationType="slide" onRequestClose={() => setArchivePickerVisible(false)}>
        <View style={s.sheetOverlay}>
          <Pressable style={{ flex: 1 }} onPress={() => setArchivePickerVisible(false)} />
          <View style={[s.sheet, { backgroundColor: theme.colors.card }]}>
            <View style={s.sheetHeader}>
              <Text fontSize="$md" fontWeight="$semibold" style={{ color: theme.colors.text }}>
                {t("events.pickArchiveItem")}
              </Text>
              <Pressable onPress={() => setArchivePickerVisible(false)} hitSlop={8}>
                <Ionicons name="close" size={20} color={theme.colors.text} />
              </Pressable>
            </View>
            {archiveItems === null ? (
              <ActivityIndicator color={theme.colors.gray300} style={{ padding: 24 }} />
            ) : archiveItems.length === 0 ? (
              <Text fontSize="$sm" style={{ color: theme.colors.gray300, padding: 24, textAlign: "center" }}>
                {t("events.archiveEmpty")}
              </Text>
            ) : (
              <ScrollView style={{ maxHeight: 360 }}>
                {archiveItems.map((it) => (
                  <Pressable
                    key={it.id}
                    onPress={() => {
                      setArchiveItem(it);
                      setArchivePickerVisible(false);
                    }}
                    style={[s.archiveOption, { borderBottomColor: theme.colors.divider }]}
                  >
                    {it.photos?.[0] ? (
                      <OptimizedImage uri={it.photos[0]} size={ImageSize.THUMBNAIL} style={s.archiveRefImg} contentFit="cover" />
                    ) : (
                      <View style={[s.archiveRefImg, { backgroundColor: theme.colors.surface }]} />
                    )}
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text fontSize="$sm" fontWeight="$semibold" numberOfLines={1} style={{ color: theme.colors.text }}>
                        {it.title || "—"}
                      </Text>
                      {!!it.brandName && (
                        <Text fontSize="$xs" style={{ color: theme.colors.gray300 }}>
                          {it.brandName}
                        </Text>
                      )}
                    </View>
                    {archiveItem?.id === it.id && <Ionicons name="checkmark" size={18} color={theme.colors.text} />}
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.colors.background },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    hero: { width: "100%", aspectRatio: 16 / 9 },
    reviewBanner: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    section: {
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 8,
    },
    infoRow: { flexDirection: "row", alignItems: "flex-start", marginTop: 10 },
    infoText: { marginLeft: 8, flex: 1, lineHeight: 20 },
    mapWrap: { height: 140, borderRadius: 4, overflow: "hidden" },
    map: { flex: 1 },
    storeRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderRadius: 4,
      marginTop: 8,
    },
    gallery: { paddingHorizontal: 16, paddingTop: 8, gap: 8 },
    galleryImg: { width: 160, height: 200, borderRadius: 4 },
    composer: { marginTop: 12, borderRadius: 4, padding: 12 },
    input: { minHeight: 60, fontSize: 14, textAlignVertical: "top" },
    ratingRow: { flexDirection: "row", alignItems: "center", marginTop: 8 },
    attachRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10, alignItems: "center" },
    attach: { width: 56, height: 56, borderRadius: 4, overflow: "hidden", position: "relative" },
    attachImg: { width: 56, height: 56 },
    attachRemove: {
      position: "absolute",
      top: 2,
      right: 2,
      width: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: "rgba(0,0,0,0.6)",
      alignItems: "center",
      justifyContent: "center",
    },
    archiveChip: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderRadius: 4,
      paddingHorizontal: 8,
      height: 28,
    },
    composerBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10 },
    sendBtn: { height: 32, paddingHorizontal: 16, borderRadius: 4, alignItems: "center", justifyContent: "center" },
    comment: { flexDirection: "row", paddingVertical: 14, borderBottomWidth: 1 },
    commentImages: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
    commentImg: { width: 88, height: 88, borderRadius: 4 },
    archiveRef: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderRadius: 4,
      padding: 8,
      marginTop: 8,
    },
    archiveRefImg: { width: 40, height: 40, borderRadius: 4 },
    loadMore: { alignItems: "center", paddingVertical: 14 },
    sheetOverlay: { flex: 1, backgroundColor: t.colors.overlay, justifyContent: "flex-end" },
    sheet: { borderTopLeftRadius: 12, borderTopRightRadius: 12, paddingBottom: 24 },
    sheetHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    archiveOption: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderBottomWidth: 1,
    },
  });

export default EventDetailScreen;
