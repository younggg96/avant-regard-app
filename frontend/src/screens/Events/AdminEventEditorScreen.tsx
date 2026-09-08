/**
 * 管理员 · 发布 / 编辑活动（PRD 3 节 P0：新增仅管理员可发布的「活动」类型）
 *
 * 入口：管理后台「活动管理」Tab；统一发布器在论坛日历 Tab 下对管理员开放「发布活动」。
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { Pressable, Text } from "../../components/ui";
import { OptimizedImage } from "../../components/ui/OptimizedImage";
import ScreenHeader from "../../components/ScreenHeader";
import { ImageSize } from "../../utils/imageUtils";
import { useAppTheme, useThemedStyles, type AppTheme } from "../../theme";
import { Alert } from "../../utils/Alert";
import { pickAndUploadImage } from "../admin/adminUtils";
import { BuyerStore, searchStores } from "../../services/buyerStoreService";
import {
  EVENT_TYPES,
  EventCreatePayload,
  EventStatus,
  EventType,
  adminCreateEvent,
  adminGetEvent,
  adminUpdateEvent,
} from "../../services/eventService";
import EventTypeBadge from "./EventTypeBadge";

type RouteParams = { AdminEventEditor: { eventId?: number } | undefined };

const pad = (n: number) => String(n).padStart(2, "0");
const splitDateTime = (iso?: string | null) => {
  if (!iso) return { date: "", time: "" };
  const d = new Date(iso);
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
};
/** 本地 "YYYY-MM-DD" + "HH:mm" → ISO（UTC） */
const joinDateTime = (date: string, time: string): string | null => {
  const dm = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(date.trim());
  const tm = /^(\d{1,2}):(\d{2})$/.exec(time.trim() || "00:00");
  if (!dm || !tm) return null;
  const d = new Date(+dm[1], +dm[2] - 1, +dm[3], +tm[1], +tm[2], 0, 0);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
};

const STATUS_OPTIONS: EventStatus[] = ["PUBLISHED", "DRAFT", "ENDED", "HIDDEN"];

/**
 * 表单字段容器。定义在组件外部：若写在 render 内部，每次输入都会生成新的组件类型，
 * 导致内部 TextInput 卸载重挂、键盘收起。
 */
const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => {
  const theme = useAppTheme();
  return (
    <View style={{ marginBottom: 16 }}>
      <Text fontSize="$sm" fontWeight="$semibold" style={{ color: theme.colors.text, marginBottom: 6 }}>
        {label}
      </Text>
      {children}
      {!!hint && (
        <Text fontSize={11} style={{ color: theme.colors.gray300, marginTop: 4 }}>
          {hint}
        </Text>
      )}
    </View>
  );
};

const AdminEventEditorScreen: React.FC = () => {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const s = useThemedStyles(makeStyles);
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, "AdminEventEditor">>();
  const eventId = route.params?.eventId;
  const isEdit = typeof eventId === "number";

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [eventType, setEventType] = useState<EventType>("MARKET");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("10:00");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("20:00");
  const [locationName, setLocationName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [store, setStore] = useState<{ id: string; name: string } | null>(null);
  const [storeKeyword, setStoreKeyword] = useState("");
  const [storeResults, setStoreResults] = useState<BuyerStore[]>([]);
  const [organizer, setOrganizer] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [status, setStatus] = useState<EventStatus>("PUBLISHED");

  const isOnline = eventType === "ONLINE";

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      try {
        const e = await adminGetEvent(eventId!);
        setTitle(e.title);
        setDescription(e.description || "");
        setCoverImage(e.coverImage ?? null);
        setImages(e.images || []);
        setEventType(e.eventType);
        const sd = splitDateTime(e.startAt);
        const ed = splitDateTime(e.endAt);
        setStartDate(sd.date);
        setStartTime(sd.time);
        setEndDate(ed.date);
        setEndTime(ed.time);
        setLocationName(e.locationName || "");
        setAddress(e.address || "");
        setCity(e.city || "");
        setCountry(e.country || "");
        setLatitude(e.latitude != null ? String(e.latitude) : "");
        setLongitude(e.longitude != null ? String(e.longitude) : "");
        setStore(e.store ? { id: e.store.id, name: e.store.name } : e.storeId ? { id: e.storeId, name: e.storeId } : null);
        setOrganizer(e.organizer || "");
        setLinkUrl(e.linkUrl || "");
        setStatus(e.status);
      } catch {
        Alert.show(t("common.loadFailed"));
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    })();
  }, [isEdit, eventId, navigation, t]);

  // 店铺搜索（关联活动地点到买手店实体）
  useEffect(() => {
    if (!storeKeyword.trim()) {
      setStoreResults([]);
      return;
    }
    const h = setTimeout(async () => {
      try {
        setStoreResults(await searchStores(storeKeyword.trim(), 8));
      } catch {
        setStoreResults([]);
      }
    }, 350);
    return () => clearTimeout(h);
  }, [storeKeyword]);

  const applyStore = (st: BuyerStore) => {
    setStore({ id: st.id, name: st.name });
    setStoreKeyword("");
    setStoreResults([]);
    if (!locationName) setLocationName(st.name);
    if (!address) setAddress(st.address || "");
    if (!city) setCity(st.city || "");
    if (!country) setCountry(st.country || "");
    if (st.coordinates) {
      setLatitude(String(st.coordinates.latitude));
      setLongitude(String(st.coordinates.longitude));
    }
  };

  const pickCover = async () => {
    setUploading(true);
    try {
      const url = await pickAndUploadImage([16, 9]);
      if (url) setCoverImage(url);
    } finally {
      setUploading(false);
    }
  };

  const addImage = async () => {
    if (images.length >= 9) return;
    setUploading(true);
    try {
      const url = await pickAndUploadImage([4, 5]);
      if (url) setImages((prev) => [...prev, url]);
    } finally {
      setUploading(false);
    }
  };

  const payload = useMemo((): EventCreatePayload | string => {
    if (!title.trim()) return t("events.admin.errTitle");
    const startAt = joinDateTime(startDate, startTime);
    const endAt = joinDateTime(endDate, endTime);
    if (!startAt || !endAt) return t("events.admin.errTime");
    if (new Date(endAt) < new Date(startAt)) return t("events.admin.errTimeOrder");
    const lat = latitude.trim() ? Number(latitude) : null;
    const lng = longitude.trim() ? Number(longitude) : null;
    if ((lat !== null && Number.isNaN(lat)) || (lng !== null && Number.isNaN(lng))) return t("events.admin.errCoords");
    return {
      title: title.trim(),
      description: description.trim(),
      coverImage,
      images,
      eventType,
      startAt,
      endAt,
      isOnline,
      locationName: isOnline ? null : locationName.trim() || null,
      address: isOnline ? null : address.trim() || null,
      city: city.trim() || null,
      country: country.trim() || null,
      latitude: isOnline ? null : lat,
      longitude: isOnline ? null : lng,
      storeId: isOnline ? null : store?.id ?? null,
      organizer: organizer.trim() || null,
      linkUrl: linkUrl.trim() || null,
      status,
    };
  }, [
    title, description, coverImage, images, eventType, startDate, startTime, endDate, endTime,
    locationName, address, city, country, latitude, longitude, store, organizer, linkUrl, status, isOnline, t,
  ]);

  const save = useCallback(async () => {
    if (typeof payload === "string") {
      Alert.show(payload);
      return;
    }
    setSaving(true);
    try {
      if (isEdit) await adminUpdateEvent(eventId!, payload);
      else await adminCreateEvent(payload);
      Alert.show(isEdit ? t("common.updateSuccess") : t("common.publishSuccess"));
      navigation.goBack();
    } catch (e: any) {
      Alert.show(e?.message || t("common.saveFailed"));
    } finally {
      setSaving(false);
    }
  }, [payload, isEdit, eventId, navigation, t]);

  const inputStyle = [s.input, { color: theme.colors.text, backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.inputBorder }];

  if (loading) {
    return (
      <SafeAreaView style={s.container} edges={["top"]}>
        <ScreenHeader title={t("events.admin.editTitle")} showBack />
        <ActivityIndicator style={{ marginTop: 40 }} color={theme.colors.gray300} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container} edges={["top"]}>
      <ScreenHeader
        title={isEdit ? t("events.admin.editTitle") : t("events.admin.createTitle")}
        showBack
        rightActions={[{ text: saving ? t("common.loading") : t("common.save"), onPress: save, style: "primary" }]}
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          {/* 封面 */}
          <Field label={t("events.admin.cover")}>
            <Pressable onPress={pickCover} style={[s.cover, { backgroundColor: theme.colors.surface }]}>
              {coverImage ? (
                <OptimizedImage uri={coverImage} size={ImageSize.MEDIUM} style={s.coverImg} contentFit="cover" />
              ) : uploading ? (
                <ActivityIndicator color={theme.colors.gray300} />
              ) : (
                <>
                  <Ionicons name="image-outline" size={28} color={theme.colors.gray200} />
                  <Text fontSize="$xs" style={{ color: theme.colors.gray300, marginTop: 6 }}>
                    {t("events.admin.pickCover")}
                  </Text>
                </>
              )}
            </Pressable>
          </Field>

          <Field label={t("events.admin.title")}>
            <TextInput value={title} onChangeText={setTitle} placeholder={t("events.admin.titlePh")} placeholderTextColor={theme.colors.placeholder} style={inputStyle} />
          </Field>

          {/* 类型 */}
          <Field label={t("events.admin.type")} hint={isOnline ? t("events.admin.onlineHint") : undefined}>
            <View style={s.chips}>
              {EVENT_TYPES.map((tp) => (
                <Pressable
                  key={tp}
                  onPress={() => setEventType(tp)}
                  style={[s.chip, { borderColor: eventType === tp ? theme.colors.text : theme.colors.divider, backgroundColor: theme.colors.card }]}
                >
                  <EventTypeBadge type={tp} />
                </Pressable>
              ))}
            </View>
          </Field>

          {/* 时间 */}
          <Field label={t("events.admin.startAt")} hint={t("events.admin.timeHint")}>
            <View style={s.row}>
              <TextInput value={startDate} onChangeText={setStartDate} placeholder="2026-05-18" placeholderTextColor={theme.colors.placeholder} style={[...inputStyle, { flex: 2 }]} />
              <TextInput value={startTime} onChangeText={setStartTime} placeholder="10:00" placeholderTextColor={theme.colors.placeholder} style={[...inputStyle, { flex: 1 }]} />
            </View>
          </Field>
          <Field label={t("events.admin.endAt")}>
            <View style={s.row}>
              <TextInput value={endDate} onChangeText={setEndDate} placeholder="2026-05-25" placeholderTextColor={theme.colors.placeholder} style={[...inputStyle, { flex: 2 }]} />
              <TextInput value={endTime} onChangeText={setEndTime} placeholder="20:00" placeholderTextColor={theme.colors.placeholder} style={[...inputStyle, { flex: 1 }]} />
            </View>
          </Field>

          {/* 地点 */}
          {!isOnline && (
            <>
              <Field label={t("events.admin.linkStore")} hint={t("events.admin.linkStoreHint")}>
                {store ? (
                  <View style={[s.storeChip, { borderColor: theme.colors.text }]}>
                    <Ionicons name="storefront-outline" size={14} color={theme.colors.text} />
                    <Text fontSize="$sm" style={{ color: theme.colors.text, flex: 1, marginLeft: 6 }} numberOfLines={1}>
                      {store.name}
                    </Text>
                    <Pressable onPress={() => setStore(null)} hitSlop={8}>
                      <Ionicons name="close" size={16} color={theme.colors.text} />
                    </Pressable>
                  </View>
                ) : (
                  <TextInput value={storeKeyword} onChangeText={setStoreKeyword} placeholder={t("events.admin.searchStorePh")} placeholderTextColor={theme.colors.placeholder} style={inputStyle} />
                )}
                {storeResults.length > 0 && (
                  <View style={[s.dropdown, { borderColor: theme.colors.divider, backgroundColor: theme.colors.card }]}>
                    {storeResults.map((st) => (
                      <Pressable key={st.id} onPress={() => applyStore(st)} style={[s.dropdownItem, { borderBottomColor: theme.colors.divider }]}>
                        <Text fontSize="$sm" style={{ color: theme.colors.text }}>{st.name}</Text>
                        <Text fontSize={11} style={{ color: theme.colors.gray300 }} numberOfLines={1}>
                          {st.city} · {st.address}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </Field>
              <Field label={t("events.admin.locationName")}>
                <TextInput value={locationName} onChangeText={setLocationName} placeholder={t("events.admin.locationNamePh")} placeholderTextColor={theme.colors.placeholder} style={inputStyle} />
              </Field>
              <Field label={t("events.admin.address")}>
                <TextInput value={address} onChangeText={setAddress} placeholderTextColor={theme.colors.placeholder} style={inputStyle} />
              </Field>
              <Field label={t("events.admin.coords")} hint={t("events.admin.coordsHint")}>
                <View style={s.row}>
                  <TextInput value={latitude} onChangeText={setLatitude} placeholder="31.2304" keyboardType="numbers-and-punctuation" placeholderTextColor={theme.colors.placeholder} style={[...inputStyle, { flex: 1 }]} />
                  <TextInput value={longitude} onChangeText={setLongitude} placeholder="121.4737" keyboardType="numbers-and-punctuation" placeholderTextColor={theme.colors.placeholder} style={[...inputStyle, { flex: 1 }]} />
                </View>
              </Field>
            </>
          )}
          <Field label={t("events.admin.cityCountry")}>
            <View style={s.row}>
              <TextInput value={city} onChangeText={setCity} placeholder={t("events.admin.cityPh")} placeholderTextColor={theme.colors.placeholder} style={[...inputStyle, { flex: 1 }]} />
              <TextInput value={country} onChangeText={setCountry} placeholder={t("events.admin.countryPh")} placeholderTextColor={theme.colors.placeholder} style={[...inputStyle, { flex: 1 }]} />
            </View>
          </Field>

          <Field label={t("events.admin.organizer")}>
            <TextInput value={organizer} onChangeText={setOrganizer} placeholderTextColor={theme.colors.placeholder} style={inputStyle} />
          </Field>
          <Field label={t("events.admin.link")}>
            <TextInput value={linkUrl} onChangeText={setLinkUrl} placeholder="https://" autoCapitalize="none" keyboardType="url" placeholderTextColor={theme.colors.placeholder} style={inputStyle} />
          </Field>
          <Field label={t("events.admin.description")}>
            <TextInput value={description} onChangeText={setDescription} multiline placeholderTextColor={theme.colors.placeholder} style={[...inputStyle, { minHeight: 100, textAlignVertical: "top" }]} />
          </Field>

          {/* 图片 */}
          <Field label={t("events.admin.images")}>
            <View style={s.imagesRow}>
              {images.map((img, i) => (
                <View key={img} style={s.imgCell}>
                  <OptimizedImage uri={img} size={ImageSize.THUMBNAIL} style={s.img} contentFit="cover" />
                  <Pressable onPress={() => setImages((prev) => prev.filter((_, idx) => idx !== i))} style={s.imgRemove}>
                    <Ionicons name="close" size={10} color="#fff" />
                  </Pressable>
                </View>
              ))}
              {images.length < 9 && (
                <Pressable onPress={addImage} style={[s.imgCell, s.imgAdd, { borderColor: theme.colors.divider }]}>
                  <Ionicons name="add" size={22} color={theme.colors.gray300} />
                </Pressable>
              )}
            </View>
          </Field>

          {/* 状态 */}
          <Field label={t("events.admin.status")}>
            <View style={s.chips}>
              {STATUS_OPTIONS.map((st) => (
                <Pressable
                  key={st}
                  onPress={() => setStatus(st)}
                  style={[s.chip, { borderColor: theme.colors.text, backgroundColor: status === st ? theme.colors.text : theme.colors.card }]}
                >
                  <Text fontSize="$xs" style={{ color: status === st ? theme.colors.textInverted : theme.colors.text }}>
                    {t(`events.status.${st}`)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Field>

          <Pressable onPress={save} disabled={saving} style={[s.saveBtn, { backgroundColor: theme.colors.text, opacity: saving ? 0.6 : 1 }]}>
            {saving ? (
              <ActivityIndicator color={theme.colors.textInverted} />
            ) : (
              <Text fontSize="$md" fontWeight="$semibold" style={{ color: theme.colors.textInverted }}>
                {isEdit ? t("common.save") : t("events.admin.publish")}
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: t.colors.background },
    content: { padding: 16, paddingBottom: 48 },
    input: {
      borderWidth: 1,
      borderRadius: 4,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
    },
    row: { flexDirection: "row", gap: 8 },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: { height: 30, paddingHorizontal: 10, borderRadius: 4, borderWidth: 1, alignItems: "center", justifyContent: "center" },
    cover: { height: 160, borderRadius: 4, alignItems: "center", justifyContent: "center", overflow: "hidden" },
    coverImg: { width: "100%", height: "100%" },
    storeChip: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 4, paddingHorizontal: 10, height: 40 },
    dropdown: { borderWidth: 1, borderRadius: 4, marginTop: 6, overflow: "hidden" },
    dropdownItem: { paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1 },
    imagesRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    imgCell: { width: 72, height: 90, borderRadius: 4, overflow: "hidden", position: "relative" },
    img: { width: 72, height: 90 },
    imgAdd: { borderWidth: 1, borderStyle: "dashed", alignItems: "center", justifyContent: "center" },
    imgRemove: {
      position: "absolute",
      top: 3,
      right: 3,
      width: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: "rgba(0,0,0,0.6)",
      alignItems: "center",
      justifyContent: "center",
    },
    saveBtn: { height: 46, borderRadius: 4, alignItems: "center", justifyContent: "center", marginTop: 8 },
  });

export default AdminEventEditorScreen;
