/**
 * 商家管理页面
 * 让商家可以管理店铺的 Banner、公告、活动、折扣等内容
 */
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Modal,
  TouchableWithoutFeedback,
  Platform,
  KeyboardAvoidingView,
  Text as RNText,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp, useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import * as ImagePicker from "expo-image-picker";
import {
  Box,
  Text,
  Pressable,
  HStack,
  VStack,
} from "../components/ui";
import { theme, useThemedStyles, type AppTheme } from "../theme";
import ScreenHeader from "../components/ScreenHeader";
import { OptimizedImage } from "../components/ui/OptimizedImage";
import { ImageSize } from "../utils/imageUtils";
import { useAuthStore } from "../store/authStore";
import BrandSelectorModal from "../components/BrandSelectorModal";
import { useBrandSearch } from "../hooks/useBrandSearch";
import { Brand } from "../services/brandService";
import {
  StoreMerchant,
  StoreAnnouncement,
  StoreBanner,
  StoreActivity,
  StoreDiscount,
  BuyerStore,
  getMyMerchants,
  getMerchantAnnouncements,
  getMerchantBanners,
  getMerchantActivities,
  getMerchantDiscounts,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  createBanner,
  updateBanner,
  deleteBanner,
  createActivity,
  updateActivity,
  deleteActivity,
  createDiscount,
  updateDiscount,
  deleteDiscount,
  updateMerchant,
  getBuyerStore,
  updateBuyerStore,
  ContentStatus,
  ActivityType,
  DiscountType,
} from "../services/storeMerchantService";
// 买手店帖子（migration 055）— Posts tab 直接复用 postService 拉/删 帖子,
// 编辑跳到 PublishLookbookScreen, 不在本屏内重复实现复杂的图片九宫格 UI.
import { postService, Post as ApiPost } from "../services/postService";
import { uploadImageFromUri } from "./admin/adminUtils";

type RouteParams = {
  MerchantManage: {
    merchantId?: number;
  };
};

type TabType =
  | "info"
  | "banner"
  | "announcement"
  | "activity"
  | "discount"
  | "post";

const getActivityTypes = (t: (key: string) => string) => [
  { value: "TRUNK_SHOW" as ActivityType, label: "Trunk Show" },
  { value: "POP_UP" as ActivityType, label: t("merchant.activityTypePopUp") },
  { value: "SALE" as ActivityType, label: t("merchant.activityTypeSale") },
  { value: "EVENT" as ActivityType, label: t("merchant.activityTypeEvent") },
  { value: "OTHER" as ActivityType, label: t("merchant.activityTypeOther") },
];

const getDiscountTypes = (t: (key: string) => string) => [
  { value: "PERCENTAGE" as DiscountType, label: t("merchant.discountTypePercentage") },
  { value: "FIXED" as DiscountType, label: t("merchant.discountTypeFixed") },
  { value: "SPECIAL" as DiscountType, label: t("merchant.discountTypeSpecial") },
];

// 营业时间快捷预设：覆盖大多数买手店的常见档期，让商家一键填好。
const HOURS_PRESETS = [
  "10:00-18:00",
  "11:00-21:00",
  "12:00-22:00",
  "13:00-22:00",
];

// 风格标签预设：和消费者端搜索/筛选用到的关键词保持一致，避免商家随手
// 写一些数据库里没有、永远搜不到的词。中文/英文都给一些常见的。
const STYLE_PRESETS_ZH = [
  "先锋", "暗黑", "极简", "解构", "复古", "中性", "街头", "运动", "日系", "韩系", "设计师",
];
const STYLE_PRESETS_EN = [
  "Avant-garde", "Dark", "Minimal", "Deconstructed", "Vintage", "Genderless",
  "Streetwear", "Sport", "Japanese", "Korean", "Designer",
];

// 一周七天 chips。`label` 用 i18n 短文案（"周一"/"Mon"），同时也是序列化
// 后写入 `rest` 字段的 token —— 直接把展示和存储统一，避免再做 key→label
// 的映射，向后兼容现有 "周日"/"周一,周三" 这类历史数据。
const WEEK_DAY_KEYS: Array<
  "weekMon" | "weekTue" | "weekWed" | "weekThu" | "weekFri" | "weekSat" | "weekSun"
> = ["weekMon", "weekTue", "weekWed", "weekThu", "weekFri", "weekSat", "weekSun"];

// 把 `rest` 字段（"周一,周三" 或 "Mon,Wed" 等）拆成一个 Set，方便 chip 组件
// 判断"哪几个 day chip 处于选中态"。容忍中英逗号、空格、顿号。
const parseRestDays = (rest: string): Set<string> => {
  if (!rest) return new Set();
  return new Set(
    rest
      .split(/[,，、]/)
      .map((s) => s.trim())
      .filter(Boolean)
  );
};

// HH:MM-HH:MM 格式解析。失败时返回 null，调用方 fallback 到原始字符串。
const parseHoursRange = (
  hours: string
): { open: string; close: string } | null => {
  if (!hours) return null;
  const m = hours
    .replace(/[：]/g, ":") // 容忍中文冒号
    .match(/^\s*(\d{1,2}):(\d{2})\s*[-–~至到]\s*(\d{1,2}):(\d{2})\s*$/);
  if (!m) return null;
  const oh = m[1].padStart(2, "0");
  const om = m[2];
  const ch = m[3].padStart(2, "0");
  const cm = m[4];
  return { open: `${oh}:${om}`, close: `${ch}:${cm}` };
};

// "11", "1100", "11:00" 都接受；自动补齐为 HH:MM。
// 用于营业时间两个 TextInput 的 onBlur 标准化，让落库结果稳定。
const normalizeHourMinute = (input: string): string => {
  if (!input) return "";
  const digits = input.replace(/\D/g, "");
  if (!digits) return input;
  let h = "0";
  let m = "00";
  if (digits.length === 1) {
    h = `0${digits}`;
  } else if (digits.length === 2) {
    h = digits;
  } else if (digits.length === 3) {
    h = `0${digits[0]}`;
    m = digits.slice(1);
  } else {
    h = digits.slice(0, 2);
    m = digits.slice(2, 4);
  }
  const hh = Math.min(23, parseInt(h, 10) || 0).toString().padStart(2, "0");
  const mm = Math.min(59, parseInt(m, 10) || 0).toString().padStart(2, "0");
  return `${hh}:${mm}`;
};

const MAX_DESCRIPTION_LENGTH = 300;

const MerchantManageScreen = () => {
  const { t, i18n } = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RouteParams, "MerchantManage">>();
  const { user } = useAuthStore();

  const ACTIVITY_TYPES = getActivityTypes(t);
  const DISCOUNT_TYPES = getDiscountTypes(t);

  const isZh = (i18n.language || "").startsWith("zh");
  const STYLE_PRESETS = isZh ? STYLE_PRESETS_ZH : STYLE_PRESETS_EN;
  const WEEK_DAY_OPTIONS = useMemo(
    () => WEEK_DAY_KEYS.map((k) => ({ key: k, label: t(`merchant.${k}`) })),
    [t]
  );

  // 品牌库搜索 hook —— 给店铺信息编辑里的 BrandSelectorModal 用。复用消费
  // 者端发帖流程同款 hook，统一品牌数据来源（`brands` 表）。
  const {
    brands: displayedBrands,
    searchQuery: brandSearchQuery,
    isLoading: isLoadingBrands,
    hasMore: hasMoreBrands,
    setSearchQuery: setBrandSearchQuery,
    search: searchBrands,
    loadMore: loadMoreBrands,
  } = useBrandSearch();

  // Tab label 单独走 `tabXxx` 短文案：英文环境 5 个 Tab 等分 ~78px 单格，
  // "Announcements" / "Activities" 这种长词直接被换行成 "Announcemen|ts"，
  // 即使加了 numberOfLines/adjustsFontSizeToFit 也不可靠（RN Text 在嵌套
  // styled-components / Pressable 内的字号自适应行为差异较大）。
  // 解法：tab 用短文案（公告/Notices、活动/Events 等），把内容区还是用
  // 完整 `merchant.announcement` / `merchant.activity` 等键，语义不丢失。
  const TABS: { key: TabType; label: string; icon: string }[] = [
    { key: "info", label: t("merchant.tabStore"), icon: "storefront-outline" },
    { key: "post", label: t("merchant.tabPost"), icon: "albums-outline" },
    { key: "banner", label: t("merchant.tabBanner"), icon: "image-outline" },
    { key: "announcement", label: t("merchant.tabAnnouncement"), icon: "megaphone-outline" },
    { key: "activity", label: t("merchant.tabActivity"), icon: "calendar-outline" },
    { key: "discount", label: t("merchant.tabDiscount"), icon: "pricetag-outline" },
  ];

  // 商家信息
  const [merchant, setMerchant] = useState<StoreMerchant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 当前选中的 Tab
  const [activeTab, setActiveTab] = useState<TabType>("info");

  // 商家联系信息编辑状态
  const [infoFormData, setInfoFormData] = useState({
    contactName: "",
    contactPhone: "",
    contactEmail: "",
  });
  const [isEditingInfo, setIsEditingInfo] = useState(false);

  // 店铺信息状态
  const [buyerStore, setBuyerStore] = useState<BuyerStore | null>(null);
  const [storeFormData, setStoreFormData] = useState({
    name: "",
    address: "",
    phone: [] as string[],
    hours: "",
    description: "",
    rest: "",
    brands: [] as string[],
    style: [] as string[],
  });
  const [isEditingStore, setIsEditingStore] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const [newBrand, setNewBrand] = useState("");
  const [newStyle, setNewStyle] = useState("");
  // 自定义品牌输入是默认折叠的（首选 BrandSelectorModal 选库内品牌，避免脏
  // 数据），点 "手动添加" 才展开。
  const [showCustomBrandInput, setShowCustomBrandInput] = useState(false);
  const [showBrandSelector, setShowBrandSelector] = useState(false);
  // 营业时间在编辑态拆成开/关两个 HH:MM；只在编辑模式下用，不直接和
  // `storeFormData.hours` 双向绑定 —— 由 `commitHours()` 统一序列化回去。
  const [openTime, setOpenTime] = useState("");
  const [closeTime, setCloseTime] = useState("");

  // 各类内容列表
  const [banners, setBanners] = useState<StoreBanner[]>([]);
  const [announcements, setAnnouncements] = useState<StoreAnnouncement[]>([]);
  const [activities, setActivities] = useState<StoreActivity[]>([]);
  const [discounts, setDiscounts] = useState<StoreDiscount[]>([]);
  // 买手店帖子（migration 055）。商家可见所有状态（DRAFT / PENDING / APPROVED /
  // REJECTED / HIDDEN）, 用于在后台直接管理。
  const [storePosts, setStorePosts] = useState<ApiPost[]>([]);

  // 编辑模态框状态
  const [showEditModal, setShowEditModal] = useState(false);
  const [editType, setEditType] = useState<TabType>("banner");
  const [editItem, setEditItem] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 表单数据
  const [formData, setFormData] = useState<any>({});

  // 正在上传的图片字段名，用于在 pickImage 并发期间反馈 UI loading。
  // 之所以用 string 而不是 boolean，是因为 Banner / 活动 / 折扣三种表单
  // 可能复用同一个组件结构——记录字段名才能在正确的缩略图区域显示"上传中"。
  const [uploadingField, setUploadingField] = useState<string | null>(null);

  // 加载商家信息
  const loadMerchant = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await getMyMerchants(1, 10);
      if (result.merchants.length > 0) {
        // 如果有指定的 merchantId，使用它；否则使用第一个
        const targetMerchant = route.params?.merchantId
          ? result.merchants.find((m) => m.id === route.params.merchantId)
          : result.merchants[0];

        if (targetMerchant && targetMerchant.status === "APPROVED") {
          setMerchant(targetMerchant);
        } else {
          setMerchant(null);
        }
      }
    } catch (error) {
      console.error("Load merchant error:", error);
    } finally {
      setIsLoading(false);
    }
  }, [route.params?.merchantId]);

  // 加载内容
  //
  // 5 类资源 (banner / 公告 / 活动 / 折扣 / 店铺帖子) 互相独立, 用
  // Promise.allSettled 而不是 Promise.all —— 任一接口失败都不应当让其他
  // 4 类一起白屏。 特别是店铺帖子接口 (migration 055) 在后端 migration
  // 还没全量铺开前可能 4xx, 但管理后台其他 tab 已经用了一年, 不能因此
  // 退化。
  const loadContent = useCallback(async () => {
    if (!merchant) return;

    const [bannersRes, announcementsRes, activitiesRes, discountsRes, postsRes] =
      await Promise.allSettled([
        getMerchantBanners(merchant.id),
        getMerchantAnnouncements(merchant.id),
        getMerchantActivities(merchant.id),
        getMerchantDiscounts(merchant.id),
        postService.getPostsByStoreId(merchant.storeId, {
          includeUnpublished: true,
          limit: 100,
        }),
      ]);

    if (bannersRes.status === "fulfilled") setBanners(bannersRes.value.banners);
    else console.warn("Load banners failed:", bannersRes.reason);

    if (announcementsRes.status === "fulfilled")
      setAnnouncements(announcementsRes.value.announcements);
    else console.warn("Load announcements failed:", announcementsRes.reason);

    if (activitiesRes.status === "fulfilled")
      setActivities(activitiesRes.value.activities);
    else console.warn("Load activities failed:", activitiesRes.reason);

    if (discountsRes.status === "fulfilled")
      setDiscounts(discountsRes.value.discounts);
    else console.warn("Load discounts failed:", discountsRes.reason);

    if (postsRes.status === "fulfilled") setStorePosts(postsRes.value || []);
    else console.warn("Load store posts failed:", postsRes.reason);
  }, [merchant]);

  // 仅刷新店铺帖子列表的轻量函数 — 给"删除帖子后"或回到此屏 reload 用,
  // 避免连带把 banner / 公告 / 活动 / 折扣 都重拉一遍。
  const reloadStorePosts = useCallback(async () => {
    if (!merchant) return;
    try {
      const posts = await postService.getPostsByStoreId(merchant.storeId, {
        includeUnpublished: true,
        limit: 100,
      });
      setStorePosts(posts || []);
    } catch (error) {
      console.error("Reload store posts error:", error);
    }
  }, [merchant]);

  useEffect(() => {
    loadMerchant();
  }, [loadMerchant]);

  useEffect(() => {
    if (merchant) {
      loadContent();
      // 初始化商家联系信息表单
      setInfoFormData({
        contactName: merchant.contactName || "",
        contactPhone: merchant.contactPhone || "",
        contactEmail: merchant.contactEmail || "",
      });
      // 加载店铺信息
      loadBuyerStore();
    }
  }, [merchant, loadContent]);

  // 编辑/发布店铺帖子返回此屏后, 自动 refresh Posts 列表 — 给买手店帖子
  // (migration 055) 体验闭环。其他 tab 的内容由 modal 内部 loadContent
  // 触发, 不会受影响。
  useFocusEffect(
    useCallback(() => {
      if (merchant && activeTab === "post") {
        reloadStorePosts();
      }
    }, [merchant, activeTab, reloadStorePosts]),
  );

  // 加载店铺信息
  const loadBuyerStore = async () => {
    if (!merchant) return;
    try {
      const store = await getBuyerStore(merchant.storeId);
      setBuyerStore(store);
      setStoreFormData({
        name: store.name || "",
        address: store.address || "",
        phone: store.phone || [],
        hours: store.hours || "",
        description: store.description || "",
        rest: store.rest || "",
        brands: store.brands || [],
        style: store.style || [],
      });
      const parsed = parseHoursRange(store.hours || "");
      setOpenTime(parsed?.open || "");
      setCloseTime(parsed?.close || "");
    } catch (error) {
      console.error("Load buyer store error:", error);
    }
  };

  // 把开/关两个时段序列化回 storeFormData.hours。两端都为空 → 清空 hours，
  // 否则用 "HH:MM-HH:MM"（与现有数据格式一致，无需后端改动）。
  const commitHours = useCallback(
    (open: string, close: string) => {
      const o = open ? normalizeHourMinute(open) : "";
      const c = close ? normalizeHourMinute(close) : "";
      const merged = o && c ? `${o}-${c}` : o || c || "";
      setStoreFormData((prev) => ({ ...prev, hours: merged }));
    },
    []
  );

  // 切换某个 day chip：在 rest 字符串里插入/移除该 day label。
  const toggleRestDay = useCallback((label: string) => {
    setStoreFormData((prev) => {
      const set = parseRestDays(prev.rest);
      if (set.has(label)) set.delete(label);
      else set.add(label);
      // 按周一→周日的固定顺序输出，避免点击顺序影响展示。
      const ordered = WEEK_DAY_KEYS
        .map((k, idx) => ({ idx, label: t(`merchant.${k}`) }))
        .filter((d) => set.has(d.label))
        .map((d) => d.label);
      return { ...prev, rest: ordered.join(",") };
    });
  }, [t]);

  // 下拉刷新
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadContent();
    setIsRefreshing(false);
  };

  // 保存商家联系信息
  const handleSaveInfo = async () => {
    if (!merchant) return;

    try {
      setIsSubmitting(true);
      await updateMerchant(merchant.id, infoFormData);

      // 更新本地状态
      setMerchant({
        ...merchant,
        ...infoFormData,
      });

      setIsEditingInfo(false);
      Alert.alert(t("common.success"), t("merchant.contactInfoUpdated"));
    } catch (error: any) {
      Alert.alert(t("common.saveFailed"), error.message || t("common.retryLater"));
    } finally {
      setIsSubmitting(false);
    }
  };

  // 保存店铺信息
  const handleSaveStore = async () => {
    if (!merchant || !buyerStore) return;

    try {
      setIsSubmitting(true);
      // 兜底：用户可能改完时间没失焦就点保存，先把 openTime/closeTime
      // 标准化合并到 hours 再提交。
      const o = openTime ? normalizeHourMinute(openTime) : "";
      const c = closeTime ? normalizeHourMinute(closeTime) : "";
      const mergedHours = o && c ? `${o}-${c}` : o || c || storeFormData.hours;
      const payload = { ...storeFormData, hours: mergedHours };
      const updatedStore = await updateBuyerStore(merchant.storeId, payload);

      setBuyerStore(updatedStore);
      setStoreFormData((prev) => ({ ...prev, hours: mergedHours }));
      setIsEditingStore(false);
      setNewPhone("");
      setNewBrand("");
      setNewStyle("");
      setShowCustomBrandInput(false);
      Alert.alert(t("common.success"), t("merchant.storeInfoUpdated"));
    } catch (error: any) {
      Alert.alert(t("common.saveFailed"), error.message || t("common.retryLater"));
    } finally {
      setIsSubmitting(false);
    }
  };

  // 接收 BrandSelectorModal 选中的品牌：去重添加到 brands 列表，关闭模态框。
  const handlePickBrand = useCallback((brand: Brand) => {
    setStoreFormData((prev) =>
      prev.brands.includes(brand.name)
        ? prev
        : { ...prev, brands: [...prev.brands, brand.name] }
    );
    setShowBrandSelector(false);
  }, []);

  // 打开编辑模态框
  const openEditModal = (type: TabType, item?: any) => {
    if (type === "info") {
      setIsEditingInfo(true);
      return;
    }

    // 买手店帖子（migration 055）：CRUD 走独立屏 PublishLookbookScreen,
    // 不在 modal 里再造一套九宫格图片选择器。两条路径:
    //   - 新建: navigate(PublishLookbook, { storeMode })
    //   - 编辑: navigate(PublishLookbook, { editMode, draftPost, storeMode })
    // draftPost 复用 PublishLookbookScreen 已有的"草稿继续编辑"协议
    // (content.title / content.description / content.images), 把后端返回
    // 的 ApiPost 转成它能消费的形状即可。
    if (type === "post") {
      if (!merchant) return;
      if (item) {
        const apiPost = item as ApiPost;
        const draftPost: any = {
          id: String(apiPost.id),
          type: apiPost.postType,
          auditStatus: apiPost.auditStatus,
          status: apiPost.status,
          content: {
            title: apiPost.title,
            description: apiPost.contentText,
            images: apiPost.imageUrls || [],
          },
          storeId: apiPost.storeId,
          storeName: apiPost.storeName,
        };
        (navigation as any).navigate("PublishLookbook", {
          editMode: true,
          draftPost,
          storeMode: {
            storeId: merchant.storeId,
            storeName: buyerStore?.name,
            merchantId: merchant.id,
          },
        });
      } else {
        (navigation as any).navigate("PublishLookbook", {
          storeMode: {
            storeId: merchant.storeId,
            storeName: buyerStore?.name,
            merchantId: merchant.id,
          },
        });
      }
      return;
    }

    setEditType(type);
    setEditItem(item);

    // 初始化表单数据
    if (item) {
      setFormData({ ...item });
    } else {
      // 新建时的默认值
      switch (type) {
        case "banner":
          setFormData({
            title: "",
            imageUrl: "",
            linkUrl: "",
            sortOrder: 0,
            status: "PUBLISHED" as ContentStatus,
          });
          break;
        case "announcement":
          setFormData({
            title: "",
            content: "",
            isPinned: false,
            status: "PUBLISHED" as ContentStatus,
          });
          break;
        case "activity":
          setFormData({
            title: "",
            description: "",
            coverImage: "",
            activityStartTime: new Date().toISOString(),
            activityEndTime: new Date(
              Date.now() + 7 * 24 * 60 * 60 * 1000
            ).toISOString(),
            location: "",
            activityType: "EVENT" as ActivityType,
            needRegistration: false,
            status: "PUBLISHED" as ContentStatus,
          });
          break;
        case "discount":
          setFormData({
            title: "",
            description: "",
            coverImage: "",
            discountType: "PERCENTAGE" as DiscountType,
            discountValue: "",
            discountStartTime: new Date().toISOString(),
            discountEndTime: new Date(
              Date.now() + 30 * 24 * 60 * 60 * 1000
            ).toISOString(),
            needCode: false,
            discountCode: "",
            status: "PUBLISHED" as ContentStatus,
          });
          break;
      }
    }

    setShowEditModal(true);
  };

  // 关闭编辑模态框
  const closeEditModal = () => {
    setShowEditModal(false);
    setEditItem(null);
    setFormData({});
  };

  // 选择图片并上传到后端
  //
  // 历史 bug：此处早期直接把 `expo-image-picker` 返回的 `file://...` 本地
  // 沙盒 URI 写入表单，然后跟随 createBanner / createActivity / createDiscount
  // 落库。结果就是换一台手机或在 Web 商家后台里看这条 banner 时，<img> 的
  // src 还是原机器的本地路径——浏览器 / 其它设备根本访问不到，图片呈
  // broken。
  //
  // 正确路径：选图后先走 `/api/files/upload-image`（admin 侧同款上传端点），
  // 拿到 Supabase Storage 公网 URL 再写回表单。这样所有客户端（web / 其它
  // 设备 / 同一台手机重装后）都能解析出同一张图。
  //
  // UX：上传期间通过 `uploadingField` 给对应的缩略图区域回显"上传中..."
  // 并禁掉二次点击，避免用户重复提交。
  const pickImage = async (fieldName: string = "imageUrl") => {
    if (uploadingField) return; // 防重入：上一次上传还在跑时拒绝再次触发

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(t("common.permissionDenied"), t("common.photoPermissionRequired"));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) return;

    try {
      setUploadingField(fieldName);
      const url = await uploadImageFromUri(result.assets[0].uri);
      setFormData((prev: any) => ({ ...prev, [fieldName]: url }));
    } catch (error: any) {
      Alert.alert(t("common.uploadFailed"), error?.message || t("common.retryLater"));
    } finally {
      setUploadingField(null);
    }
  };

  // 保存内容
  const handleSave = async () => {
    if (!merchant) return;

    try {
      setIsSubmitting(true);

      switch (editType) {
        case "banner":
          if (!formData.imageUrl) {
            Alert.alert(t("common.hint"), t("merchant.selectBannerImage"));
            return;
          }
          if (editItem) {
            await updateBanner(editItem.id, formData);
          } else {
            await createBanner(merchant.id, formData);
          }
          break;

        case "announcement":
          if (!formData.title || !formData.content) {
            Alert.alert(t("common.hint"), t("merchant.fillAnnouncementTitleContent"));
            return;
          }
          if (editItem) {
            await updateAnnouncement(editItem.id, formData);
          } else {
            await createAnnouncement(merchant.id, formData);
          }
          break;

        case "activity":
          if (!formData.title || !formData.activityStartTime || !formData.activityEndTime) {
            Alert.alert(t("common.hint"), t("merchant.fillActivityTitleTime"));
            return;
          }
          if (editItem) {
            await updateActivity(editItem.id, formData);
          } else {
            await createActivity(merchant.id, formData);
          }
          break;

        case "discount":
          if (!formData.title || !formData.discountStartTime || !formData.discountEndTime) {
            Alert.alert(t("common.hint"), t("merchant.fillDiscountTitleTime"));
            return;
          }
          if (editItem) {
            await updateDiscount(editItem.id, formData);
          } else {
            await createDiscount(merchant.id, formData);
          }
          break;
      }

      closeEditModal();
      await loadContent();
      Alert.alert(t("common.success"), editItem ? t("common.updateSuccess") : t("common.publishSuccess"));
    } catch (error: any) {
      Alert.alert(t("common.operationFailed"), error.message || t("common.retryLater"));
    } finally {
      setIsSubmitting(false);
    }
  };

  // 删除内容
  const handleDelete = (type: TabType, id: number) => {
    Alert.alert(t("common.confirmDelete"), t("common.deleteIrreversible"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: async () => {
          try {
            switch (type) {
              case "banner":
                await deleteBanner(id);
                setBanners((prev) => prev.filter((b) => b.id !== id));
                break;
              case "announcement":
                await deleteAnnouncement(id);
                setAnnouncements((prev) => prev.filter((a) => a.id !== id));
                break;
              case "activity":
                await deleteActivity(id);
                setActivities((prev) => prev.filter((a) => a.id !== id));
                break;
              case "discount":
                await deleteDiscount(id);
                setDiscounts((prev) => prev.filter((d) => d.id !== id));
                break;
              case "post":
                if (!user?.userId) return;
                await postService.deletePost(id, user.userId);
                setStorePosts((prev) => prev.filter((p) => p.id !== id));
                break;
            }
          } catch (error: any) {
            Alert.alert(t("common.deleteFailed"), error.message || t("common.retryLater"));
          }
        },
      },
    ]);
  };

  // 渲染 Tab 切换
  //
  // UX 历史：原本用 gluestack 的 `<Text numberOfLines={1} adjustsFontSizeToFit>`，
  // 但实测 styled-components 包装层下 numberOfLines 经常没生效（"Announcemen
  // ts" 仍然换行）。改成直接用 RN 原生 Text + `numberOfLines={1}` 保证截断；
  // 同时把 i18n 改成 tab 专用短文案（详见 TABS 注释）。
  const renderTabs = () => (
    <HStack bg="$white" borderBottomWidth={1} borderBottomColor="$gray100">
      {TABS.map((tab) => (
        <Pressable
          key={tab.key}
          flex={1}
          py="$md"
          px="$xs"
          alignItems="center"
          borderBottomWidth={2}
          borderBottomColor={activeTab === tab.key ? "$black" : "transparent"}
          onPress={() => setActiveTab(tab.key)}
        >
          <Ionicons
            name={tab.icon as any}
            size={20}
            color={activeTab === tab.key ? theme.colors.black : theme.colors.gray300}
          />
          <RNText
            numberOfLines={1}
            ellipsizeMode="tail"
            style={[
              styles.tabLabel,
              {
                color:
                  activeTab === tab.key
                    ? theme.colors.black
                    : theme.colors.gray300,
                fontWeight: activeTab === tab.key ? "600" : "400",
              },
            ]}
          >
            {tab.label}
          </RNText>
        </Pressable>
      ))}
    </HStack>
  );

  // 渲染 Banner 列表
  //
  // 视觉调整：
  //   - 图片走 16:9 比例（store Banner 在消费者端就是 16:9 横幅，让商家后台
  //     和真实展示一致，所见即所得）；
  //   - `imageUrl` 缺失或图加载中时不要留一片纯灰，给个 image-outline 占位
  //     图标，避免被误以为"卡片坏了"。
  const renderBanners = () => (
    <VStack p="$md" gap="$md">
      {banners.length === 0 ? (
        <VStack alignItems="center" py="$xl">
          <Ionicons name="image-outline" size={48} color={theme.colors.gray200} />
          <Text color="$gray300" mt="$md" style={styles.textRegular}>
            {t("merchant.noBanners")}
          </Text>
        </VStack>
      ) : (
        banners.map((banner) => (
          <Box
            key={banner.id}
            bg="$white"
            rounded="$md"
            overflow="hidden"
            borderWidth={1}
            borderColor="$gray100"
          >
            <Box style={styles.bannerImage} bg="$gray100">
              {banner.imageUrl ? (
                <OptimizedImage
                  uri={banner.imageUrl}
                  size={ImageSize.LARGE}
                  style={StyleSheet.absoluteFillObject}
                  contentFit="cover"
                  lazy={true}
                />
              ) : (
                <VStack
                  flex={1}
                  justifyContent="center"
                  alignItems="center"
                  gap="$xs"
                >
                  <Ionicons
                    name="image-outline"
                    size={32}
                    color={theme.colors.gray200}
                  />
                  <Text fontSize="$xs" color="$gray300" style={styles.textRegular}>
                    {t("merchant.noBannerImage")}
                  </Text>
                </VStack>
              )}
            </Box>
            <HStack p="$md" justifyContent="between" alignItems="center">
              <VStack flex={1} mr="$sm">
                <Text
                  fontSize="$md"
                  fontWeight="$semibold"
                  color="$black"
                  numberOfLines={1}
                  style={styles.textBold}
                >
                  {banner.title || t("merchant.noTitle")}
                </Text>
                <HStack gap="$sm" mt="$xs" alignItems="center">
                  <Box
                    px="$sm"
                    py="$xs"
                    rounded="$xs"
                    bg={banner.status === "PUBLISHED" ? "#E8F5E9" : "$gray100"}
                  >
                    <Text
                      fontSize="$xs"
                      color={banner.status === "PUBLISHED" ? "#27AE60" : "$gray300"}
                      style={styles.textRegular}
                    >
                      {banner.status === "PUBLISHED" ? t("merchant.published") : t("merchant.draft")}
                    </Text>
                  </Box>
                  <Text fontSize="$xs" color="$gray300" style={styles.textRegular}>
                    {t("merchant.clickCount", { count: banner.clickCount })}
                  </Text>
                </HStack>
              </VStack>
              <HStack gap="$sm">
                <Pressable
                  p="$sm"
                  onPress={() => openEditModal("banner", banner)}
                >
                  <Ionicons name="create-outline" size={20} color={theme.colors.black} />
                </Pressable>
                <Pressable
                  p="$sm"
                  onPress={() => handleDelete("banner", banner.id)}
                >
                  <Ionicons name="trash-outline" size={20} color={theme.colors.error} />
                </Pressable>
              </HStack>
            </HStack>
          </Box>
        ))
      )}
    </VStack>
  );

  // 渲染公告列表
  const renderAnnouncements = () => (
    <VStack p="$md" gap="$md">
      {announcements.length === 0 ? (
        <VStack alignItems="center" py="$xl">
          <Ionicons name="megaphone-outline" size={48} color={theme.colors.gray200} />
          <Text color="$gray300" mt="$md" style={styles.textRegular}>
            {t("merchant.noAnnouncements")}
          </Text>
        </VStack>
      ) : (
        announcements.map((announcement) => (
          <Box
            key={announcement.id}
            bg="$white"
            rounded="$md"
            p="$md"
            borderWidth={1}
            borderColor="$gray100"
          >
            <HStack justifyContent="between" alignItems="start">
              <VStack flex={1}>
                <HStack alignItems="center" gap="$sm">
                  {announcement.isPinned && (
                    <Ionicons name="pin" size={14} color={theme.colors.error} />
                  )}
                  <Text
                    fontSize="$md"
                    fontWeight="$semibold"
                    color="$black"
                    style={styles.textBold}
                  >
                    {announcement.title}
                  </Text>
                </HStack>
                <Text
                  fontSize="$sm"
                  color="$gray300"
                  mt="$xs"
                  numberOfLines={2}
                  style={styles.textRegular}
                >
                  {announcement.content}
                </Text>
                <HStack gap="$sm" mt="$sm">
                  <Box
                    px="$sm"
                    py="$xs"
                    rounded="$xs"
                    bg={announcement.status === "PUBLISHED" ? "#E8F5E9" : "$gray100"}
                  >
                    <Text
                      fontSize="$xs"
                      color={announcement.status === "PUBLISHED" ? "#27AE60" : "$gray300"}
                      style={styles.textRegular}
                    >
                      {announcement.status === "PUBLISHED" ? t("merchant.published") : t("merchant.draft")}
                    </Text>
                  </Box>
                </HStack>
              </VStack>
              <HStack gap="$sm">
                <Pressable
                  p="$sm"
                  onPress={() => openEditModal("announcement", announcement)}
                >
                  <Ionicons name="create-outline" size={20} color={theme.colors.black} />
                </Pressable>
                <Pressable
                  p="$sm"
                  onPress={() => handleDelete("announcement", announcement.id)}
                >
                  <Ionicons name="trash-outline" size={20} color={theme.colors.error} />
                </Pressable>
              </HStack>
            </HStack>
          </Box>
        ))
      )}
    </VStack>
  );

  // 渲染活动列表
  const renderActivities = () => (
    <VStack p="$md" gap="$md">
      {activities.length === 0 ? (
        <VStack alignItems="center" py="$xl">
          <Ionicons name="calendar-outline" size={48} color={theme.colors.gray200} />
          <Text color="$gray300" mt="$md" style={styles.textRegular}>
            {t("merchant.noActivities")}
          </Text>
        </VStack>
      ) : (
        activities.map((activity) => (
          <Box
            key={activity.id}
            bg="$white"
            rounded="$md"
            overflow="hidden"
            borderWidth={1}
            borderColor="$gray100"
          >
            {activity.coverImage && (
              <OptimizedImage
                uri={activity.coverImage}
                size={ImageSize.MEDIUM}
                style={styles.activityImage}
                contentFit="cover"
                lazy={true}
              />
            )}
            <VStack p="$md">
              <HStack justifyContent="between" alignItems="start">
                <VStack flex={1}>
                  <Text
                    fontSize="$md"
                    fontWeight="$semibold"
                    color="$black"
                    style={styles.textBold}
                  >
                    {activity.title}
                  </Text>
                  <HStack alignItems="center" gap="$xs" mt="$xs">
                    <Ionicons name="time-outline" size={14} color={theme.colors.gray300} />
                    <Text fontSize="$xs" color="$gray300" style={styles.textRegular}>
                      {new Date(activity.activityStartTime).toLocaleDateString("zh-CN")} -{" "}
                      {new Date(activity.activityEndTime).toLocaleDateString("zh-CN")}
                    </Text>
                  </HStack>
                  {activity.location && (
                    <HStack alignItems="center" gap="$xs" mt="$xs">
                      <Ionicons name="location-outline" size={14} color={theme.colors.gray300} />
                      <Text fontSize="$xs" color="$gray300" style={styles.textRegular}>
                        {activity.location}
                      </Text>
                    </HStack>
                  )}
                  <HStack gap="$sm" mt="$sm">
                    <Box px="$sm" py="$xs" rounded="$xs" bg="$gray100">
                      <Text fontSize="$xs" color="$gray300" style={styles.textRegular}>
                        {ACTIVITY_TYPES.find((t) => t.value === activity.activityType)?.label}
                      </Text>
                    </Box>
                    {activity.needRegistration && (
                      <Box px="$sm" py="$xs" rounded="$xs" bg="#E3F2FD">
                        <Text fontSize="$xs" color="#1976D2" style={styles.textRegular}>
                          {t("merchant.needRegistration")} ({activity.registrationCount}
                          {activity.registrationLimit ? `/${activity.registrationLimit}` : ""})
                        </Text>
                      </Box>
                    )}
                  </HStack>
                </VStack>
                <HStack gap="$sm">
                  <Pressable
                    p="$sm"
                    onPress={() => openEditModal("activity", activity)}
                  >
                    <Ionicons name="create-outline" size={20} color={theme.colors.black} />
                  </Pressable>
                  <Pressable
                    p="$sm"
                    onPress={() => handleDelete("activity", activity.id)}
                  >
                    <Ionicons name="trash-outline" size={20} color={theme.colors.error} />
                  </Pressable>
                </HStack>
              </HStack>
            </VStack>
          </Box>
        ))
      )}
    </VStack>
  );

  // 渲染折扣列表
  const renderDiscounts = () => (
    <VStack p="$md" gap="$md">
      {discounts.length === 0 ? (
        <VStack alignItems="center" py="$xl">
          <Ionicons name="pricetag-outline" size={48} color={theme.colors.gray200} />
          <Text color="$gray300" mt="$md" style={styles.textRegular}>
            {t("merchant.noDiscounts")}
          </Text>
        </VStack>
      ) : (
        discounts.map((discount) => (
          <Box
            key={discount.id}
            bg="$white"
            rounded="$md"
            overflow="hidden"
            borderWidth={1}
            borderColor="$gray100"
          >
            {discount.coverImage && (
              <OptimizedImage
                uri={discount.coverImage}
                size={ImageSize.MEDIUM}
                style={styles.discountImage}
                contentFit="cover"
                lazy={true}
              />
            )}
            <VStack p="$md">
              <HStack justifyContent="between" alignItems="start">
                <VStack flex={1}>
                  <Text
                    fontSize="$md"
                    fontWeight="$semibold"
                    color="$black"
                    style={styles.textBold}
                  >
                    {discount.title}
                  </Text>
                  {discount.discountValue && (
                    <Text
                      fontSize="$lg"
                      fontWeight="$bold"
                      color="$error"
                      mt="$xs"
                      style={styles.textBold}
                    >
                      {discount.discountValue}
                    </Text>
                  )}
                  <HStack alignItems="center" gap="$xs" mt="$xs">
                    <Ionicons name="time-outline" size={14} color={theme.colors.gray300} />
                    <Text fontSize="$xs" color="$gray300" style={styles.textRegular}>
                      {new Date(discount.discountStartTime).toLocaleDateString("zh-CN")} -{" "}
                      {new Date(discount.discountEndTime).toLocaleDateString("zh-CN")}
                    </Text>
                  </HStack>
                  <HStack gap="$sm" mt="$sm">
                    <Box px="$sm" py="$xs" rounded="$xs" bg="$gray100">
                      <Text fontSize="$xs" color="$gray300" style={styles.textRegular}>
                        {DISCOUNT_TYPES.find((t) => t.value === discount.discountType)?.label}
                      </Text>
                    </Box>
                    {discount.needCode && discount.discountCode && (
                      <Box px="$sm" py="$xs" rounded="$xs" bg="#FFF3E0">
                        <Text fontSize="$xs" color="#E65100" style={styles.textRegular}>
                          {t("merchant.codeLabel", { code: discount.discountCode })}
                        </Text>
                      </Box>
                    )}
                  </HStack>
                </VStack>
                <HStack gap="$sm">
                  <Pressable
                    p="$sm"
                    onPress={() => openEditModal("discount", discount)}
                  >
                    <Ionicons name="create-outline" size={20} color={theme.colors.black} />
                  </Pressable>
                  <Pressable
                    p="$sm"
                    onPress={() => handleDelete("discount", discount.id)}
                  >
                    <Ionicons name="trash-outline" size={20} color={theme.colors.error} />
                  </Pressable>
                </HStack>
              </HStack>
            </VStack>
          </Box>
        ))
      )}
    </VStack>
  );

  // 渲染店铺帖子列表（migration 055）
  // ─────────────────────────────────────────────────────────────────────
  // 帖子卡片设计原则：
  //   - 大图缩略图（4:3 cover）+ 标题/状态徽章 + 编辑/删除操作；
  //   - 状态徽章覆盖 5 类: APPROVED 已发布 / PENDING 审核中 / REJECTED 被驳回
  //     / DRAFT 草稿 / HIDDEN 已隐藏。 商家在此屏能看到全部状态, 跟普通用户
  //     侧（仅看到 APPROVED+PUBLISHED）形成对比。
  //   - 整张卡可点击跳到 PostDetail（消费者视角），方便商家自检最终展示效果.
  const formatStorePostStatus = (
    post: ApiPost,
  ): { label: string; bg: string; color: string } => {
    if (post.auditStatus === "REJECTED") {
      return { label: t("merchant.statusRejected"), bg: "#FFEBEE", color: "#C62828" };
    }
    if (post.status === "DRAFT") {
      return { label: t("merchant.draft"), bg: "$gray100", color: "$gray500" };
    }
    if (post.status === "HIDDEN") {
      return { label: t("merchant.statusHidden"), bg: "$gray100", color: "$gray500" };
    }
    if (post.auditStatus === "PENDING") {
      return { label: t("postDetail.pending"), bg: "#FFF3E0", color: "#E65100" };
    }
    return { label: t("merchant.published"), bg: "#E8F5E9", color: "#2E7D32" };
  };

  const renderStorePosts = () => (
    <VStack p="$md" gap="$md">
      {storePosts.length === 0 ? (
        <VStack alignItems="center" py="$xl">
          <Ionicons name="albums-outline" size={48} color={theme.colors.gray200} />
          <Text color="$gray300" mt="$md" style={styles.textRegular}>
            {t("merchant.noStorePosts")}
          </Text>
          <Text fontSize="$xs" color="$gray300" mt="$xs" textAlign="center" style={styles.textRegular}>
            {t("merchant.noStorePostsHint")}
          </Text>
        </VStack>
      ) : (
        storePosts.map((post) => {
          const cover = post.imageUrls?.[0];
          const statusBadge = formatStorePostStatus(post);
          return (
            <Box
              key={post.id}
              bg="$white"
              rounded="$md"
              overflow="hidden"
              borderWidth={1}
              borderColor="$gray100"
            >
              <Pressable
                onPress={() =>
                  (navigation as any).navigate("PostDetail", { postId: post.id })
                }
              >
                <HStack p="$md" gap="$md" alignItems="flex-start">
                  <Box
                    w={84}
                    h={84}
                    rounded="$sm"
                    overflow="hidden"
                    bg="$gray100"
                    justifyContent="center"
                    alignItems="center"
                  >
                    {cover ? (
                      <OptimizedImage
                        uri={cover}
                        size={ImageSize.MEDIUM}
                        style={StyleSheet.absoluteFillObject}
                        contentFit="cover"
                        lazy={true}
                      />
                    ) : (
                      <Ionicons
                        name="image-outline"
                        size={28}
                        color={theme.colors.gray300}
                      />
                    )}
                  </Box>
                  <VStack flex={1} gap="$xs">
                    <Text
                      fontSize="$md"
                      fontWeight="$semibold"
                      color="$black"
                      numberOfLines={2}
                      style={styles.textBold}
                    >
                      {post.title || t("merchant.noTitle")}
                    </Text>
                    {!!post.contentText && (
                      <Text
                        fontSize="$xs"
                        color="$gray400"
                        numberOfLines={2}
                        style={styles.textRegular}
                      >
                        {post.contentText}
                      </Text>
                    )}
                    <HStack gap="$sm" mt="$xs" alignItems="center" flexWrap="wrap">
                      <Box
                        px="$sm"
                        py="$xs"
                        rounded="$xs"
                        bg={statusBadge.bg as any}
                      >
                        <Text
                          fontSize="$xs"
                          color={statusBadge.color as any}
                          style={styles.textRegular}
                        >
                          {statusBadge.label}
                        </Text>
                      </Box>
                      <Text fontSize="$xs" color="$gray300" style={styles.textRegular}>
                        {t("merchant.likeCount", { count: post.likeCount || 0 })}
                      </Text>
                    </HStack>
                  </VStack>
                  <HStack gap="$sm">
                    <Pressable
                      p="$sm"
                      onPress={(e: any) => {
                        e?.stopPropagation?.();
                        openEditModal("post", post);
                      }}
                    >
                      <Ionicons name="create-outline" size={20} color={theme.colors.black} />
                    </Pressable>
                    <Pressable
                      p="$sm"
                      onPress={(e: any) => {
                        e?.stopPropagation?.();
                        handleDelete("post", post.id);
                      }}
                    >
                      <Ionicons name="trash-outline" size={20} color={theme.colors.error} />
                    </Pressable>
                  </HStack>
                </HStack>
              </Pressable>
            </Box>
          );
        })
      )}
    </VStack>
  );

  // 关联店铺帖子选择器（migration 055）
  // ─────────────────────────────────────────────────────────────────────
  // 通用组件: banner / 公告 / 活动 / 折扣 编辑表单底部都挂一个, 让商家
  // 选一篇店铺帖子作为"点击跳转目标"。无帖子时显示「先去 Posts tab 发一篇」
  // 引导, 避免空数据时 picker 看上去坏掉。已选中的帖子可以「取消关联」
  // 把 linkedPostId 设回 null。
  const renderLinkedPostPicker = (
    value: number | null | undefined,
    onChange: (id: number | null) => void,
  ) => {
    const selected = value
      ? storePosts.find((p) => p.id === value) || null
      : null;
    return (
      <VStack gap="$xs">
        <Text fontSize="$sm" color="$gray300" style={styles.textRegular}>
          {t("merchant.linkedPostLabel")}
        </Text>
        {selected && (
          <Box
            bg="$gray100"
            rounded="$sm"
            p="$sm"
            borderWidth={1}
            borderColor="$gray200"
          >
            <HStack alignItems="center" gap="$sm">
              {selected.imageUrls?.[0] ? (
                <Box w={40} h={40} rounded="$sm" overflow="hidden">
                  <OptimizedImage
                    uri={selected.imageUrls[0]}
                    size={ImageSize.THUMBNAIL}
                    style={StyleSheet.absoluteFillObject}
                    contentFit="cover"
                    lazy={true}
                  />
                </Box>
              ) : (
                <Box
                  w={40}
                  h={40}
                  rounded="$sm"
                  bg="$gray200"
                  justifyContent="center"
                  alignItems="center"
                >
                  <Ionicons name="image-outline" size={18} color={theme.colors.gray400} />
                </Box>
              )}
              <Text
                flex={1}
                fontSize="$sm"
                color="$black"
                numberOfLines={1}
                style={styles.textRegular}
              >
                {selected.title || t("merchant.noTitle")}
              </Text>
              <Pressable onPress={() => onChange(null)} p="$xs">
                <Ionicons name="close-circle" size={18} color={theme.colors.gray400} />
              </Pressable>
            </HStack>
          </Box>
        )}
        {storePosts.length === 0 ? (
          <Text fontSize={11} color="$gray300" style={styles.textRegular}>
            {t("merchant.linkedPostEmptyHint")}
          </Text>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
          >
            {storePosts.slice(0, 30).map((post) => {
              const isSelected = post.id === value;
              return (
                <Pressable
                  key={post.id}
                  onPress={() => onChange(isSelected ? null : post.id)}
                  style={{
                    width: 88,
                  }}
                >
                  <Box
                    w={88}
                    h={88}
                    rounded="$sm"
                    overflow="hidden"
                    borderWidth={2}
                    borderColor={isSelected ? "$black" : "transparent"}
                    bg="$gray100"
                  >
                    {post.imageUrls?.[0] ? (
                      <OptimizedImage
                        uri={post.imageUrls[0]}
                        size={ImageSize.THUMBNAIL}
                        style={StyleSheet.absoluteFillObject}
                        contentFit="cover"
                        lazy={true}
                      />
                    ) : (
                      <VStack flex={1} justifyContent="center" alignItems="center">
                        <Ionicons
                          name="image-outline"
                          size={24}
                          color={theme.colors.gray300}
                        />
                      </VStack>
                    )}
                  </Box>
                  <Text
                    fontSize={11}
                    color="$black"
                    mt="$xs"
                    numberOfLines={2}
                    style={styles.textRegular}
                  >
                    {post.title || t("merchant.noTitle")}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </VStack>
    );
  };

  // 编辑表单的统一字段壳：左侧图标 + 字段名（可选 hint）+ 内容。
  // 把每个 input/chip 区域包成同样的视觉单元，保证整张表上下对齐、间距一致。
  const renderEditField = ({
    icon,
    label,
    hint,
    children,
  }: {
    icon: React.ComponentProps<typeof Ionicons>["name"];
    label: string;
    hint?: string;
    children: React.ReactNode;
  }) => (
    <VStack>
      <HStack alignItems="center" gap="$xs" mb="$xs">
        <Ionicons name={icon} size={14} color={theme.colors.gray400} />
        <Text fontSize="$sm" color="$gray500" style={styles.textRegular}>
          {label}
        </Text>
        {hint ? (
          <Text fontSize={11} color="$gray300" style={styles.textRegular}>
            · {hint}
          </Text>
        ) : null}
      </HStack>
      {children}
    </VStack>
  );

  // 渲染店铺信息
  const renderStoreInfo = () => {
    if (!merchant) return null;

    return (
      <VStack p="$md" gap="$md">
        {/* 店铺状态卡片 */}
        <Box bg="$white" rounded="$lg" p="$md" borderWidth={1} borderColor="$gray100">
          <HStack justifyContent="space-between" alignItems="center" mb="$md">
            <HStack alignItems="center" gap="$sm">
              <Box
                w={40}
                h={40}
                bg="$gray100"
                rounded="$md"
                justifyContent="center"
                alignItems="center"
              >
                <Ionicons name="storefront" size={20} color={theme.colors.black} />
              </Box>
              <VStack>
                <Text fontSize="$sm" color="$gray300" style={styles.textRegular}>
                  {t("merchant.storeIdLabel")}
                </Text>
                <Text fontSize="$md" fontWeight="$semibold" color="$black" style={styles.textBold}>
                  {merchant.storeId}
                </Text>
              </VStack>
            </HStack>
            <Box bg="#E8F5E9" px="$sm" py="$xs" rounded="$sm">
              <Text fontSize="$xs" fontWeight="$bold" color="#4CAF50">
                {t("merchant.approved")}
              </Text>
            </Box>
          </HStack>
        </Box>

        {/* 联系信息 */}
        <Box bg="$white" rounded="$lg" p="$md" borderWidth={1} borderColor="$gray100">
          <HStack justifyContent="space-between" alignItems="center" mb="$md">
            <Text fontSize="$md" fontWeight="$semibold" color="$black" style={styles.textBold}>
              {t("merchant.contactInfo")}
            </Text>
            {!isEditingInfo && (
              <Pressable onPress={() => setIsEditingInfo(true)}>
                <HStack alignItems="center" gap="$xs">
                  <Ionicons name="create-outline" size={16} color={theme.colors.gray400} />
                  <Text fontSize="$sm" color="$gray400" style={styles.textRegular}>
                    {t("common.edit")}
                  </Text>
                </HStack>
              </Pressable>
            )}
          </HStack>

          {isEditingInfo ? (
            <VStack gap="$md">
              <VStack>
                <Text fontSize="$sm" color="$gray300" mb="$xs" style={styles.textRegular}>
                  {t("merchant.contactName")}
                </Text>
                <TextInput
                  style={styles.input}
                    placeholder={t("merchant.enterContactName")}
                  placeholderTextColor={theme.colors.gray200}
                  value={infoFormData.contactName}
                  onChangeText={(text) =>
                    setInfoFormData({ ...infoFormData, contactName: text })
                  }
                />
              </VStack>

              <VStack>
                <Text fontSize="$sm" color="$gray300" mb="$xs" style={styles.textRegular}>
                  {t("merchant.contactPhone")}
                </Text>
                <TextInput
                  style={styles.input}
                    placeholder={t("merchant.enterContactPhone")}
                  placeholderTextColor={theme.colors.gray200}
                  value={infoFormData.contactPhone}
                  onChangeText={(text) =>
                    setInfoFormData({ ...infoFormData, contactPhone: text })
                  }
                  keyboardType="phone-pad"
                />
              </VStack>

              <VStack>
                <Text fontSize="$sm" color="$gray300" mb="$xs" style={styles.textRegular}>
                  {t("merchant.contactEmail")}
                </Text>
                <TextInput
                  style={styles.input}
                    placeholder={t("merchant.enterContactEmail")}
                  placeholderTextColor={theme.colors.gray200}
                  value={infoFormData.contactEmail}
                  onChangeText={(text) =>
                    setInfoFormData({ ...infoFormData, contactEmail: text })
                  }
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </VStack>

              <HStack gap="$sm" mt="$sm">
                <Pressable
                  flex={1}
                  py="$md"
                  rounded="$sm"
                  borderWidth={1}
                  borderColor="$gray200"
                  alignItems="center"
                  onPress={() => {
                    setIsEditingInfo(false);
                    setInfoFormData({
                      contactName: merchant.contactName || "",
                      contactPhone: merchant.contactPhone || "",
                      contactEmail: merchant.contactEmail || "",
                    });
                  }}
                >
                  <Text fontSize="$md" fontWeight="$semibold" color="$black" style={styles.textBold}>
                    {t("common.cancel")}
                  </Text>
                </Pressable>
                <Pressable
                  flex={1}
                  py="$md"
                  rounded="$sm"
                  bg="$black"
                  alignItems="center"
                  onPress={handleSaveInfo}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator  color={theme.colors.white} />
                  ) : (
                    <Text fontSize="$md" fontWeight="$semibold" color="$white" style={styles.textBold}>
                      {t("common.save")}
                    </Text>
                  )}
                </Pressable>
              </HStack>
            </VStack>
          ) : (
            <VStack gap="$md">
              <HStack alignItems="center" gap="$sm">
                <Ionicons name="person-outline" size={18} color={theme.colors.gray400} />
                <VStack>
                  <Text fontSize="$xs" color="$gray300" style={styles.textRegular}>
                    {t("merchant.contactName")}
                  </Text>
                  <Text fontSize="$md" color="$black" style={styles.textRegular}>
                    {merchant.contactName || t("merchant.notSet")}
                  </Text>
                </VStack>
              </HStack>

              <HStack alignItems="center" gap="$sm">
                <Ionicons name="call-outline" size={18} color={theme.colors.gray400} />
                <VStack>
                  <Text fontSize="$xs" color="$gray300" style={styles.textRegular}>
                    {t("merchant.contactPhone")}
                  </Text>
                  <Text fontSize="$md" color="$black" style={styles.textRegular}>
                    {merchant.contactPhone || t("merchant.notSet")}
                  </Text>
                </VStack>
              </HStack>

              <HStack alignItems="center" gap="$sm">
                <Ionicons name="mail-outline" size={18} color={theme.colors.gray400} />
                <VStack>
                  <Text fontSize="$xs" color="$gray300" style={styles.textRegular}>
                    {t("merchant.contactEmail")}
                  </Text>
                  <Text fontSize="$md" color="$black" style={styles.textRegular}>
                    {merchant.contactEmail || t("merchant.notSet")}
                  </Text>
                </VStack>
              </HStack>
            </VStack>
          )}
        </Box>

        {/* 权限信息 */}
        <Box bg="$white" rounded="$lg" p="$md" borderWidth={1} borderColor="$gray100">
          <Text fontSize="$md" fontWeight="$semibold" color="$black" mb="$md" style={styles.textBold}>
            {t("merchant.permissions")}
          </Text>
          <HStack flexWrap="wrap" gap="$sm">
            {merchant.canPostBanner && (
              <Box bg="#E3F2FD" px="$md" py="$sm" rounded="$sm">
                <HStack alignItems="center" gap="$xs">
                  <Ionicons name="image-outline" size={14} color="#1976D2" />
                  <Text fontSize="$sm" color="#1976D2" style={styles.textRegular}>
                    Banner
                  </Text>
                </HStack>
              </Box>
            )}
            {merchant.canPostAnnouncement && (
              <Box bg="#FFF3E0" px="$md" py="$sm" rounded="$sm">
                <HStack alignItems="center" gap="$xs">
                  <Ionicons name="megaphone-outline" size={14} color="#F57C00" />
                  <Text fontSize="$sm" color="#F57C00" style={styles.textRegular}>
                    {t("merchant.announcement")}
                  </Text>
                </HStack>
              </Box>
            )}
            {merchant.canPostActivity && (
              <Box bg="#E8F5E9" px="$md" py="$sm" rounded="$sm">
                <HStack alignItems="center" gap="$xs">
                  <Ionicons name="calendar-outline" size={14} color="#388E3C" />
                  <Text fontSize="$sm" color="#388E3C" style={styles.textRegular}>
                    {t("merchant.activity")}
                  </Text>
                </HStack>
              </Box>
            )}
            {merchant.canPostDiscount && (
              <Box bg="#FCE4EC" px="$md" py="$sm" rounded="$sm">
                <HStack alignItems="center" gap="$xs">
                  <Ionicons name="pricetag-outline" size={14} color="#C2185B" />
                  <Text fontSize="$sm" color="#C2185B" style={styles.textRegular}>
                    {t("merchant.discount")}
                  </Text>
                </HStack>
              </Box>
            )}
          </HStack>
        </Box>

        {/* 商品管理快捷入口 —— 单独一屏 MerchantProductsScreen，避免在本屏 modal 内塞进
            又一套 CRUD 表单（标题/品牌/价格/折扣/标签/图片九宫格已经超过现有
            modal 的承载量）。和 Web 后台 `/me/merchant/[id]/products` 等价。

            布局注记：左侧 HStack 必须 `flex={1}` + `mr="$sm"`，否则当
            description 是长英文时会撑爆右侧 chevron，把箭头挤出右边界。
            内层 VStack 同样 `flex={1}` 才能让 numberOfLines 真正生效。 */}
        <Pressable
          bg="$white"
          rounded="$lg"
          p="$md"
          borderWidth={1}
          borderColor="$gray100"
          onPress={() => (navigation as any).navigate("MerchantProducts", { merchantId: merchant.id })}
        >
          <HStack alignItems="center" justifyContent="space-between">
            <HStack alignItems="center" gap="$md" flex={1} mr="$sm">
              <Box
                w={40}
                h={40}
                bg="$gray100"
                rounded="$md"
                justifyContent="center"
                alignItems="center"
              >
                <Ionicons name="cube-outline" size={20} color={theme.colors.black} />
              </Box>
              <VStack flex={1}>
                <Text
                  fontSize="$md"
                  fontWeight="$semibold"
                  color="$black"
                  numberOfLines={1}
                  style={styles.textBold}
                >
                  {t("merchant.productsTitle")}
                </Text>
                <Text
                  fontSize="$sm"
                  color="$gray300"
                  numberOfLines={2}
                  style={styles.textRegular}
                >
                  {t("merchant.productsDesc")}
                </Text>
              </VStack>
            </HStack>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.gray300} />
          </HStack>
        </Pressable>

        {/* 店铺信息 */}
        <Box bg="$white" rounded="$lg" p="$md" borderWidth={1} borderColor="$gray100">
          <HStack justifyContent="space-between" alignItems="center" mb="$md">
            <Text fontSize="$md" fontWeight="$semibold" color="$black" style={styles.textBold}>
              {t("merchant.storeInfo")}
            </Text>
            {!isEditingStore && (
              <Pressable onPress={() => setIsEditingStore(true)}>
                <HStack alignItems="center" gap="$xs">
                  <Ionicons name="create-outline" size={16} color={theme.colors.gray400} />
                  <Text fontSize="$sm" color="$gray400" style={styles.textRegular}>
                    {t("common.edit")}
                  </Text>
                </HStack>
              </Pressable>
            )}
          </HStack>

          {isEditingStore ? (
            <VStack gap="$lg">
              {/* 店铺名称 */}
              {renderEditField({
                icon: "storefront-outline",
                label: t("merchant.storeName"),
                children: (
                  <TextInput
                    style={styles.input}
                    placeholder={t("merchant.enterStoreName")}
                    placeholderTextColor={theme.colors.gray200}
                    value={storeFormData.name}
                    onChangeText={(text) =>
                      setStoreFormData({ ...storeFormData, name: text })
                    }
                  />
                ),
              })}

              {/* 店铺地址 */}
              {renderEditField({
                icon: "location-outline",
                label: t("merchant.storeAddress"),
                children: (
                  <TextInput
                    style={[styles.input, styles.multilineInput]}
                    placeholder={t("merchant.enterStoreAddress")}
                    placeholderTextColor={theme.colors.gray200}
                    value={storeFormData.address}
                    onChangeText={(text) =>
                      setStoreFormData({ ...storeFormData, address: text })
                    }
                    multiline
                    textAlignVertical="top"
                  />
                ),
              })}

              {/* 联系电话 —— 回车直接添加（onSubmitEditing）；同号去重 */}
              {renderEditField({
                icon: "call-outline",
                label: t("merchant.contactPhone"),
                children: (
                  <>
                    <HStack gap="$sm" alignItems="center">
                      <TextInput
                        style={[styles.input, { flex: 1 }]}
                        placeholder={t("merchant.addPhoneNumber")}
                        placeholderTextColor={theme.colors.gray200}
                        value={newPhone}
                        onChangeText={setNewPhone}
                        keyboardType="phone-pad"
                        returnKeyType="done"
                        onSubmitEditing={() => {
                          const v = newPhone.trim();
                          if (!v) return;
                          if (storeFormData.phone.includes(v)) {
                            setNewPhone("");
                            return;
                          }
                          setStoreFormData({
                            ...storeFormData,
                            phone: [...storeFormData.phone, v],
                          });
                          setNewPhone("");
                        }}
                      />
                      <Pressable
                        style={styles.addBtn}
                        onPress={() => {
                          const v = newPhone.trim();
                          if (!v || storeFormData.phone.includes(v)) {
                            setNewPhone("");
                            return;
                          }
                          setStoreFormData({
                            ...storeFormData,
                            phone: [...storeFormData.phone, v],
                          });
                          setNewPhone("");
                        }}
                      >
                        <Ionicons name="add" size={20} color={theme.colors.white} />
                      </Pressable>
                    </HStack>
                    {storeFormData.phone.length > 0 && (
                      <HStack flexWrap="wrap" gap="$xs" mt="$sm">
                        {storeFormData.phone.map((p, idx) => (
                          <Box key={`${p}-${idx}`} style={styles.chipNeutral}>
                            <Text fontSize="$sm" color="$black" style={styles.textRegular}>
                              {p}
                            </Text>
                            <Pressable
                              ml="$xs"
                              hitSlop={8}
                              onPress={() => {
                                setStoreFormData({
                                  ...storeFormData,
                                  phone: storeFormData.phone.filter((_, i) => i !== idx),
                                });
                              }}
                            >
                              <Ionicons
                                name="close-circle"
                                size={16}
                                color={theme.colors.gray400}
                              />
                            </Pressable>
                          </Box>
                        ))}
                      </HStack>
                    )}
                  </>
                ),
              })}

              {/* 营业时间 —— 拆成 开始/结束 两个 HH:MM 输入；
                  下面是常用时段一键填充。失焦时 normalize（"11" → "11:00"）。 */}
              {renderEditField({
                icon: "time-outline",
                label: t("merchant.businessHours"),
                children: (
                  <>
                    <HStack gap="$sm" alignItems="center">
                      <VStack flex={1}>
                        <Text fontSize={11} color="$gray300" mb={2} style={styles.textRegular}>
                          {t("merchant.openTime")}
                        </Text>
                        <TextInput
                          style={[styles.input, styles.timeInput]}
                          placeholder="HH:MM"
                          placeholderTextColor={theme.colors.gray200}
                          value={openTime}
                          onChangeText={setOpenTime}
                          onBlur={() => {
                            const n = normalizeHourMinute(openTime);
                            setOpenTime(n);
                            commitHours(n, closeTime);
                          }}
                          keyboardType="numbers-and-punctuation"
                          maxLength={5}
                        />
                      </VStack>
                      <Text mt={14} color="$gray300" style={styles.textRegular}>
                        —
                      </Text>
                      <VStack flex={1}>
                        <Text fontSize={11} color="$gray300" mb={2} style={styles.textRegular}>
                          {t("merchant.closeTime")}
                        </Text>
                        <TextInput
                          style={[styles.input, styles.timeInput]}
                          placeholder="HH:MM"
                          placeholderTextColor={theme.colors.gray200}
                          value={closeTime}
                          onChangeText={setCloseTime}
                          onBlur={() => {
                            const n = normalizeHourMinute(closeTime);
                            setCloseTime(n);
                            commitHours(openTime, n);
                          }}
                          keyboardType="numbers-and-punctuation"
                          maxLength={5}
                        />
                      </VStack>
                    </HStack>
                    <HStack flexWrap="wrap" gap="$xs" mt="$sm">
                      {HOURS_PRESETS.map((preset) => (
                        <Pressable
                          key={preset}
                          style={styles.presetChip}
                          onPress={() => {
                            const parsed = parseHoursRange(preset);
                            if (!parsed) return;
                            setOpenTime(parsed.open);
                            setCloseTime(parsed.close);
                            commitHours(parsed.open, parsed.close);
                          }}
                        >
                          <Text fontSize={12} color="$gray500" style={styles.textRegular}>
                            {preset}
                          </Text>
                        </Pressable>
                      ))}
                    </HStack>
                  </>
                ),
              })}

              {/* 休息日 —— 周一～周日七个 chip 多选。
                  存储格式："周一,周三" / "Mon,Wed"；不选则 hours 字段下方
                  会展示"全年无休"提示，避免商家误以为忘填了。 */}
              {renderEditField({
                icon: "calendar-outline",
                label: t("merchant.restDay"),
                hint: t("merchant.restDayHint"),
                children: (
                  <>
                    <HStack flexWrap="wrap" gap="$xs">
                      {WEEK_DAY_OPTIONS.map((day) => {
                        const set = parseRestDays(storeFormData.rest);
                        const active = set.has(day.label);
                        return (
                          <Pressable
                            key={day.key}
                            style={[
                              styles.dayChip,
                              active && styles.dayChipActive,
                            ]}
                            onPress={() => toggleRestDay(day.label)}
                          >
                            <Text
                              fontSize={13}
                              color={active ? "$white" : "$black"}
                              style={styles.textRegular}
                            >
                              {day.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </HStack>
                    {!storeFormData.rest && (
                      <Text fontSize={12} color="$gray300" mt="$xs" style={styles.textRegular}>
                        {t("merchant.neverClose")}
                      </Text>
                    )}
                  </>
                ),
              })}

              {/* 店铺描述 + 字数计数器（max 300） */}
              {renderEditField({
                icon: "document-text-outline",
                label: t("merchant.storeDescription"),
                children: (
                  <>
                    <TextInput
                      style={[styles.input, styles.descTextArea]}
                      placeholder={t("merchant.descriptionPlaceholder")}
                      placeholderTextColor={theme.colors.gray200}
                      value={storeFormData.description}
                      onChangeText={(text) =>
                        setStoreFormData({
                          ...storeFormData,
                          description: text.slice(0, MAX_DESCRIPTION_LENGTH),
                        })
                      }
                      multiline
                      numberOfLines={4}
                      textAlignVertical="top"
                      maxLength={MAX_DESCRIPTION_LENGTH}
                    />
                    <Text
                      fontSize={11}
                      color="$gray300"
                      mt="$xs"
                      textAlign="right"
                      style={styles.textRegular}
                    >
                      {t("merchant.descCounter", {
                        current: storeFormData.description.length,
                        max: MAX_DESCRIPTION_LENGTH,
                      })}
                    </Text>
                  </>
                ),
              })}

              {/* 销售品牌 —— 主操作：从品牌库选；次操作：手动添加。
                  这样选库内品牌名时拼写一致（"Vetements" 不会被写成
                  "vetements" / "VETEMENTS"），让消费者端搜索/筛选准确。 */}
              {renderEditField({
                icon: "pricetags-outline",
                label: t("merchant.salesBrands"),
                children: (
                  <>
                    <HStack gap="$sm">
                      <Pressable
                        flex={1}
                        py="$sm"
                        rounded="$sm"
                        bg="$black"
                        alignItems="center"
                        onPress={() => setShowBrandSelector(true)}
                      >
                        <HStack alignItems="center" gap="$xs">
                          <Ionicons
                            name="search-outline"
                            size={16}
                            color={theme.colors.white}
                          />
                          <Text
                            fontSize="$sm"
                            color="$white"
                            style={styles.textBold}
                          >
                            {t("merchant.pickFromBrandList")}
                          </Text>
                        </HStack>
                      </Pressable>
                      <Pressable
                        py="$sm"
                        px="$md"
                        rounded="$sm"
                        borderWidth={1}
                        borderColor="$gray200"
                        alignItems="center"
                        onPress={() => setShowCustomBrandInput((v) => !v)}
                      >
                        <Text fontSize="$sm" color="$gray500" style={styles.textRegular}>
                          {t("merchant.addCustomBrand")}
                        </Text>
                      </Pressable>
                    </HStack>

                    {showCustomBrandInput && (
                      <HStack gap="$sm" mt="$sm" alignItems="center">
                        <TextInput
                          style={[styles.input, { flex: 1 }]}
                          placeholder={t("merchant.addBrandName")}
                          placeholderTextColor={theme.colors.gray200}
                          value={newBrand}
                          onChangeText={setNewBrand}
                          returnKeyType="done"
                          onSubmitEditing={() => {
                            const v = newBrand.trim();
                            if (!v) return;
                            if (storeFormData.brands.includes(v)) {
                              setNewBrand("");
                              return;
                            }
                            setStoreFormData({
                              ...storeFormData,
                              brands: [...storeFormData.brands, v],
                            });
                            setNewBrand("");
                          }}
                          autoFocus
                        />
                        <Pressable
                          style={styles.addBtn}
                          onPress={() => {
                            const v = newBrand.trim();
                            if (!v || storeFormData.brands.includes(v)) {
                              setNewBrand("");
                              return;
                            }
                            setStoreFormData({
                              ...storeFormData,
                              brands: [...storeFormData.brands, v],
                            });
                            setNewBrand("");
                          }}
                        >
                          <Ionicons name="add" size={20} color={theme.colors.white} />
                        </Pressable>
                      </HStack>
                    )}

                    {storeFormData.brands.length > 0 && (
                      <HStack flexWrap="wrap" gap="$xs" mt="$sm">
                        {storeFormData.brands.map((b, idx) => (
                          <Box key={`${b}-${idx}`} style={styles.chipBrand}>
                            <Text fontSize="$sm" color="#1976D2" style={styles.textRegular}>
                              {b}
                            </Text>
                            <Pressable
                              ml="$xs"
                              hitSlop={8}
                              onPress={() => {
                                setStoreFormData({
                                  ...storeFormData,
                                  brands: storeFormData.brands.filter((_, i) => i !== idx),
                                });
                              }}
                            >
                              <Ionicons name="close-circle" size={16} color="#1976D2" />
                            </Pressable>
                          </Box>
                        ))}
                      </HStack>
                    )}
                  </>
                ),
              })}

              {/* 风格标签 —— 上面是常用风格预设 chip，一点即加；
                  下面保留自由输入，支持长尾自定义。 */}
              {renderEditField({
                icon: "color-palette-outline",
                label: t("merchant.styleTags"),
                children: (
                  <>
                    <Text
                      fontSize={11}
                      color="$gray300"
                      mb="$xs"
                      style={styles.textRegular}
                    >
                      {t("merchant.stylePresets")}
                    </Text>
                    <HStack flexWrap="wrap" gap="$xs">
                      {STYLE_PRESETS.map((preset) => {
                        const added = storeFormData.style.includes(preset);
                        return (
                          <Pressable
                            key={preset}
                            style={[
                              styles.presetChip,
                              added && styles.presetChipDisabled,
                            ]}
                            disabled={added}
                            onPress={() => {
                              setStoreFormData({
                                ...storeFormData,
                                style: [...storeFormData.style, preset],
                              });
                            }}
                          >
                            <Text
                              fontSize={12}
                              color={added ? "$gray300" : "$gray500"}
                              style={styles.textRegular}
                            >
                              {added ? `✓ ${preset}` : `+ ${preset}`}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </HStack>

                    <HStack gap="$sm" mt="$sm" alignItems="center">
                      <TextInput
                        style={[styles.input, { flex: 1 }]}
                        placeholder={t("merchant.addStyleTag")}
                        placeholderTextColor={theme.colors.gray200}
                        value={newStyle}
                        onChangeText={setNewStyle}
                        returnKeyType="done"
                        onSubmitEditing={() => {
                          const v = newStyle.trim();
                          if (!v) return;
                          if (storeFormData.style.includes(v)) {
                            setNewStyle("");
                            return;
                          }
                          setStoreFormData({
                            ...storeFormData,
                            style: [...storeFormData.style, v],
                          });
                          setNewStyle("");
                        }}
                      />
                      <Pressable
                        style={styles.addBtn}
                        onPress={() => {
                          const v = newStyle.trim();
                          if (!v || storeFormData.style.includes(v)) {
                            setNewStyle("");
                            return;
                          }
                          setStoreFormData({
                            ...storeFormData,
                            style: [...storeFormData.style, v],
                          });
                          setNewStyle("");
                        }}
                      >
                        <Ionicons name="add" size={20} color={theme.colors.white} />
                      </Pressable>
                    </HStack>

                    {storeFormData.style.length > 0 && (
                      <HStack flexWrap="wrap" gap="$xs" mt="$sm">
                        {storeFormData.style.map((s, idx) => (
                          <Box key={`${s}-${idx}`} style={styles.chipStyle}>
                            <Text fontSize="$sm" color="#C2185B" style={styles.textRegular}>
                              {s}
                            </Text>
                            <Pressable
                              ml="$xs"
                              hitSlop={8}
                              onPress={() => {
                                setStoreFormData({
                                  ...storeFormData,
                                  style: storeFormData.style.filter((_, i) => i !== idx),
                                });
                              }}
                            >
                              <Ionicons name="close-circle" size={16} color="#C2185B" />
                            </Pressable>
                          </Box>
                        ))}
                      </HStack>
                    )}
                  </>
                ),
              })}

              {/* 取消 / 保存 */}
              <HStack gap="$sm" mt="$md">
                <Pressable
                  flex={1}
                  py="$md"
                  rounded="$sm"
                  borderWidth={1}
                  borderColor="$gray200"
                  alignItems="center"
                  onPress={() => {
                    setIsEditingStore(false);
                    if (buyerStore) {
                      setStoreFormData({
                        name: buyerStore.name || "",
                        address: buyerStore.address || "",
                        phone: buyerStore.phone || [],
                        hours: buyerStore.hours || "",
                        description: buyerStore.description || "",
                        rest: buyerStore.rest || "",
                        brands: buyerStore.brands || [],
                        style: buyerStore.style || [],
                      });
                      const parsed = parseHoursRange(buyerStore.hours || "");
                      setOpenTime(parsed?.open || "");
                      setCloseTime(parsed?.close || "");
                    }
                    setNewPhone("");
                    setNewBrand("");
                    setNewStyle("");
                    setShowCustomBrandInput(false);
                  }}
                >
                  <Text fontSize="$md" fontWeight="$semibold" color="$black" style={styles.textBold}>
                    {t("common.cancel")}
                  </Text>
                </Pressable>
                <Pressable
                  flex={1}
                  py="$md"
                  rounded="$sm"
                  bg="$black"
                  alignItems="center"
                  onPress={handleSaveStore}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator  color={theme.colors.white} />
                  ) : (
                    <Text fontSize="$md" fontWeight="$semibold" color="$white" style={styles.textBold}>
                      {t("common.save")}
                    </Text>
                  )}
                </Pressable>
              </HStack>
            </VStack>
          ) : (
            <VStack gap="$md">
              {/* 店铺名称 */}
              <HStack alignItems="center" gap="$sm">
                <Ionicons name="storefront-outline" size={18} color={theme.colors.gray400} />
                <VStack flex={1}>
                  <Text fontSize="$xs" color="$gray300" style={styles.textRegular}>
                    {t("merchant.storeName")}
                  </Text>
                  <Text fontSize="$md" color="$black" style={styles.textRegular}>
                    {buyerStore?.name || t("merchant.notSet")}
                  </Text>
                </VStack>
              </HStack>

              {/* 地址 */}
              <HStack alignItems="flex-start" gap="$sm">
                <Ionicons name="location-outline" size={18} color={theme.colors.gray400} style={{ marginTop: 2 }} />
                <VStack flex={1}>
                  <Text fontSize="$xs" color="$gray300" style={styles.textRegular}>
                    {t("store.address")}
                  </Text>
                  <Text fontSize="$md" color="$black" style={styles.textRegular}>
                    {buyerStore?.address || t("merchant.notSet")}
                  </Text>
                </VStack>
              </HStack>

              {/* 联系电话 */}
              <HStack alignItems="flex-start" gap="$sm">
                <Ionicons name="call-outline" size={18} color={theme.colors.gray400} style={{ marginTop: 2 }} />
                <VStack flex={1}>
                  <Text fontSize="$xs" color="$gray300" style={styles.textRegular}>
                    {t("merchant.contactPhone")}
                  </Text>
                  {buyerStore?.phone && buyerStore.phone.length > 0 ? (
                    buyerStore.phone.map((p, idx) => (
                      <Text key={idx} fontSize="$md" color="$black" style={styles.textRegular}>
                        {p}
                      </Text>
                    ))
                  ) : (
                    <Text fontSize="$md" color="$gray200" style={styles.textRegular}>
                      {t("merchant.notSet")}
                    </Text>
                  )}
                </VStack>
              </HStack>

              {/* 营业时间 */}
              <HStack alignItems="center" gap="$sm">
                <Ionicons name="time-outline" size={18} color={theme.colors.gray400} />
                <VStack flex={1}>
                  <Text fontSize="$xs" color="$gray300" style={styles.textRegular}>
                    {t("merchant.businessHours")}
                  </Text>
                  <Text fontSize="$md" color="$black" style={styles.textRegular}>
                    {buyerStore?.hours || t("merchant.notSet")}
                  </Text>
                </VStack>
              </HStack>

              {/* 休息日 */}
              <HStack alignItems="center" gap="$sm">
                <Ionicons name="calendar-outline" size={18} color={theme.colors.gray400} />
                <VStack flex={1}>
                  <Text fontSize="$xs" color="$gray300" style={styles.textRegular}>
                    {t("merchant.restDay")}
                  </Text>
                  <Text fontSize="$md" color="$black" style={styles.textRegular}>
                    {buyerStore?.rest || t("merchant.notSet")}
                  </Text>
                </VStack>
              </HStack>

              {/* 店铺描述 */}
              {buyerStore?.description && (
                <HStack alignItems="flex-start" gap="$sm">
                  <Ionicons name="document-text-outline" size={18} color={theme.colors.gray400} style={{ marginTop: 2 }} />
                  <VStack flex={1}>
                    <Text fontSize="$xs" color="$gray300" style={styles.textRegular}>
                      {t("merchant.storeDescription")}
                    </Text>
                    <Text fontSize="$md" color="$black" style={styles.textRegular}>
                      {buyerStore.description}
                    </Text>
                  </VStack>
                </HStack>
              )}

              {/* 销售品牌 */}
              {buyerStore?.brands && buyerStore.brands.length > 0 && (
                <VStack gap="$xs">
                  <HStack alignItems="center" gap="$sm">
                    <Ionicons name="pricetags-outline" size={18} color={theme.colors.gray400} />
                    <Text fontSize="$xs" color="$gray300" style={styles.textRegular}>
                      {t("merchant.salesBrands")}
                    </Text>
                  </HStack>
                  <HStack flexWrap="wrap" gap="$xs" ml={26}>
                    {buyerStore.brands.map((b, idx) => (
                      <Box key={idx} bg="#E3F2FD" px="$sm" py="$xs" rounded="$sm">
                        <Text fontSize="$sm" color="#1976D2" style={styles.textRegular}>
                          {b}
                        </Text>
                      </Box>
                    ))}
                  </HStack>
                </VStack>
              )}

              {/* 风格标签 */}
              {buyerStore?.style && buyerStore.style.length > 0 && (
                <VStack gap="$xs">
                  <HStack alignItems="center" gap="$sm">
                    <Ionicons name="color-palette-outline" size={18} color={theme.colors.gray400} />
                    <Text fontSize="$xs" color="$gray300" style={styles.textRegular}>
                      {t("merchant.styleTags")}
                    </Text>
                  </HStack>
                  <HStack flexWrap="wrap" gap="$xs" ml={26}>
                    {buyerStore.style.map((s, idx) => (
                      <Box key={idx} bg="#FCE4EC" px="$sm" py="$xs" rounded="$sm">
                        <Text fontSize="$sm" color="#C2185B" style={styles.textRegular}>
                          {s}
                        </Text>
                      </Box>
                    ))}
                  </HStack>
                </VStack>
              )}
            </VStack>
          )}
        </Box>
      </VStack>
    );
  };

  // 渲染内容
  const renderContent = () => {
    switch (activeTab) {
      case "info":
        return renderStoreInfo();
      case "banner":
        return renderBanners();
      case "announcement":
        return renderAnnouncements();
      case "activity":
        return renderActivities();
      case "discount":
        return renderDiscounts();
      case "post":
        return renderStorePosts();
    }
  };

  // 渲染编辑表单
  const renderEditForm = () => {
    switch (editType) {
      case "banner":
        return (
          <VStack gap="$md">
            <VStack gap="$xs">
              <HStack alignItems="center" justifyContent="space-between">
                <Text fontSize="$sm" color="$gray300" style={styles.textRegular}>
                  {t("merchant.bannerImageLabel")}
                </Text>
                <Text fontSize={11} color="$gray200" style={styles.textRegular}>
                  {t("merchant.bannerImageHint")}
                </Text>
              </HStack>
              {/* 图片选择区：
                  - 16:9 aspect ratio，对齐消费者端 BannerCarousel 的展示比例，
                    让商家所见即所得；
                  - 已选图：完整覆盖 + 半透明叠加层提供"更换 / 移除"的二级操作，
                    避免在小屏上把按钮塞到图片外面；
                  - 空态：虚线边框 + 居中加号 + 提示语，比之前的纯灰背景视觉
                    引导更明确。 */}
              <Pressable
                style={styles.bannerPicker}
                onPress={() => pickImage("imageUrl")}
                disabled={uploadingField === "imageUrl"}
              >
                {uploadingField === "imageUrl" ? (
                  <VStack flex={1} justifyContent="center" alignItems="center">
                    <ActivityIndicator color={theme.colors.black} />
                    <Text fontSize="$sm" color="$gray300" mt="$sm" style={styles.textRegular}>
                      {t("merchant.uploading")}
                    </Text>
                  </VStack>
                ) : formData.imageUrl ? (
                  <>
                    <OptimizedImage
                      uri={formData.imageUrl}
                      size={ImageSize.MEDIUM}
                      style={StyleSheet.absoluteFillObject}
                      contentFit="cover"
                      lazy={true}
                    />
                    <HStack
                      style={styles.bannerPickerOverlay}
                      gap="$sm"
                      alignItems="center"
                      justifyContent="center"
                    >
                      <Pressable
                        style={styles.bannerPickerOverlayBtn}
                        onPress={() => pickImage("imageUrl")}
                      >
                        <Ionicons
                          name="camera-outline"
                          size={14}
                          color={theme.colors.white}
                        />
                        <Text style={styles.bannerPickerOverlayText}>
                          {t("merchant.replaceImage")}
                        </Text>
                      </Pressable>
                      <Pressable
                        style={styles.bannerPickerOverlayBtn}
                        onPress={() =>
                          setFormData({ ...formData, imageUrl: "" })
                        }
                      >
                        <Ionicons
                          name="trash-outline"
                          size={14}
                          color={theme.colors.white}
                        />
                        <Text style={styles.bannerPickerOverlayText}>
                          {t("common.delete")}
                        </Text>
                      </Pressable>
                    </HStack>
                  </>
                ) : (
                  <VStack flex={1} justifyContent="center" alignItems="center" gap="$xs">
                    <Box
                      w={48}
                      h={48}
                      rounded="$full"
                      bg="$gray100"
                      justifyContent="center"
                      alignItems="center"
                    >
                      <Ionicons
                        name="add"
                        size={28}
                        color={theme.colors.gray400}
                      />
                    </Box>
                    <Text fontSize="$sm" color="$gray400" style={styles.textRegular}>
                      {t("merchant.tapSelectImage")}
                    </Text>
                    <Text fontSize={11} color="$gray200" style={styles.textRegular}>
                      {t("merchant.bannerImageHint")}
                    </Text>
                  </VStack>
                )}
              </Pressable>
            </VStack>

            <VStack>
              <Text fontSize="$sm" color="$gray300" mb="$xs" style={styles.textRegular}>
                {t("merchant.titleLabel")}
              </Text>
              <TextInput
                style={styles.input}
                placeholder={t("merchant.bannerTitlePlaceholder")}
                placeholderTextColor={theme.colors.gray200}
                value={formData.title}
                onChangeText={(text) => setFormData({ ...formData, title: text })}
              />
            </VStack>

            <VStack>
              <Text fontSize="$sm" color="$gray300" mb="$xs" style={styles.textRegular}>
                {t("merchant.linkUrl")}
              </Text>
              <TextInput
                style={styles.input}
                placeholder={t("merchant.linkUrlPlaceholder")}
                placeholderTextColor={theme.colors.gray200}
                value={formData.linkUrl}
                onChangeText={(text) => setFormData({ ...formData, linkUrl: text })}
              />
            </VStack>

            {renderLinkedPostPicker(formData.linkedPostId ?? null, (id) =>
              setFormData({ ...formData, linkedPostId: id }),
            )}
          </VStack>
        );

      case "announcement":
        return (
          <VStack gap="$md">
            <VStack>
              <Text fontSize="$sm" color="$gray300" mb="$xs" style={styles.textRegular}>
                {t("merchant.announcementTitleLabel")}
              </Text>
              <TextInput
                style={styles.input}
                placeholder={t("merchant.announcementTitlePlaceholder")}
                placeholderTextColor={theme.colors.gray200}
                value={formData.title}
                onChangeText={(text) => setFormData({ ...formData, title: text })}
              />
            </VStack>

            <VStack>
              <Text fontSize="$sm" color="$gray300" mb="$xs" style={styles.textRegular}>
                {t("merchant.announcementContentLabel")}
              </Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder={t("merchant.announcementContentPlaceholder")}
                placeholderTextColor={theme.colors.gray200}
                value={formData.content}
                onChangeText={(text) => setFormData({ ...formData, content: text })}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
              />
            </VStack>

            <Pressable
              flexDirection="row"
              alignItems="center"
              gap="$sm"
              onPress={() => setFormData({ ...formData, isPinned: !formData.isPinned })}
            >
              <Box
                w={20}
                h={20}
                rounded="$sm"
                borderWidth={1}
                borderColor={formData.isPinned ? "$black" : "$gray200"}
                bg={formData.isPinned ? "$black" : "$white"}
                justifyContent="center"
                alignItems="center"
              >
                {formData.isPinned && (
                  <Ionicons name="checkmark" size={14} color={theme.colors.white} />
                )}
              </Box>
              <Text fontSize="$sm" color="$black" style={styles.textRegular}>
                {t("merchant.pinAnnouncement")}
              </Text>
            </Pressable>

            {renderLinkedPostPicker(formData.linkedPostId ?? null, (id) =>
              setFormData({ ...formData, linkedPostId: id }),
            )}
          </VStack>
        );

      case "activity":
        return (
          <VStack gap="$md">
            <VStack>
              <Text fontSize="$sm" color="$gray300" mb="$xs" style={styles.textRegular}>
                {t("merchant.coverImage")}
              </Text>
              <Pressable
                h={120}
                bg="$gray50"
                rounded="$md"
                justifyContent="center"
                alignItems="center"
                overflow="hidden"
                onPress={() => pickImage("coverImage")}
                disabled={uploadingField === "coverImage"}
              >
                {uploadingField === "coverImage" ? (
                  <VStack alignItems="center">
                    <ActivityIndicator color={theme.colors.black} />
                    <Text fontSize="$sm" color="$gray300" mt="$sm" style={styles.textRegular}>
                      {t("merchant.uploading")}
                    </Text>
                  </VStack>
                ) : formData.coverImage ? (
                  <OptimizedImage
                    uri={formData.coverImage}
                    size={ImageSize.MEDIUM}
                    style={styles.formImage}
                    contentFit="cover"
                    lazy={true}
                  />
                ) : (
                  <VStack alignItems="center">
                    <Ionicons name="image-outline" size={32} color={theme.colors.gray300} />
                    <Text fontSize="$sm" color="$gray300" mt="$sm" style={styles.textRegular}>
                      {t("merchant.tapSelectCover")}
                    </Text>
                  </VStack>
                )}
              </Pressable>
            </VStack>

            <VStack>
              <Text fontSize="$sm" color="$gray300" mb="$xs" style={styles.textRegular}>
                {t("merchant.activityTitleLabel")}
              </Text>
              <TextInput
                style={styles.input}
                placeholder={t("merchant.activityTitlePlaceholder")}
                placeholderTextColor={theme.colors.gray200}
                value={formData.title}
                onChangeText={(text) => setFormData({ ...formData, title: text })}
              />
            </VStack>

            <VStack>
              <Text fontSize="$sm" color="$gray300" mb="$xs" style={styles.textRegular}>
                {t("merchant.activityDescLabel")}
              </Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder={t("merchant.activityDescPlaceholder")}
                placeholderTextColor={theme.colors.gray200}
                value={formData.description}
                onChangeText={(text) => setFormData({ ...formData, description: text })}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </VStack>

            <VStack>
              <Text fontSize="$sm" color="$gray300" mb="$xs" style={styles.textRegular}>
                {t("merchant.activityLocationLabel")}
              </Text>
              <TextInput
                style={styles.input}
                placeholder={t("merchant.activityLocationPlaceholder")}
                placeholderTextColor={theme.colors.gray200}
                value={formData.location}
                onChangeText={(text) => setFormData({ ...formData, location: text })}
              />
            </VStack>

            <VStack>
              <Text fontSize="$sm" color="$gray300" mb="$xs" style={styles.textRegular}>
                {t("merchant.activityTypeLabel")}
              </Text>
              <HStack flexWrap="wrap" gap="$sm">
                {ACTIVITY_TYPES.map((type) => (
                  <Pressable
                    key={type.value}
                    px="$md"
                    py="$sm"
                    rounded="$sm"
                    bg={formData.activityType === type.value ? "$black" : "$gray100"}
                    onPress={() => setFormData({ ...formData, activityType: type.value })}
                  >
                    <Text
                      fontSize="$sm"
                      color={formData.activityType === type.value ? "$white" : "$black"}
                      style={styles.textRegular}
                    >
                      {type.label}
                    </Text>
                  </Pressable>
                ))}
              </HStack>
            </VStack>

            <Pressable
              flexDirection="row"
              alignItems="center"
              gap="$sm"
              onPress={() =>
                setFormData({ ...formData, needRegistration: !formData.needRegistration })
              }
            >
              <Box
                w={20}
                h={20}
                rounded="$sm"
                borderWidth={1}
                borderColor={formData.needRegistration ? "$black" : "$gray200"}
                bg={formData.needRegistration ? "$black" : "$white"}
                justifyContent="center"
                alignItems="center"
              >
                {formData.needRegistration && (
                  <Ionicons name="checkmark" size={14} color={theme.colors.white} />
                )}
              </Box>
              <Text fontSize="$sm" color="$black" style={styles.textRegular}>
                {t("merchant.needRegistration")}
              </Text>
            </Pressable>

            {formData.needRegistration && (
              <VStack>
              <Text fontSize="$sm" color="$gray300" mb="$xs" style={styles.textRegular}>
                {t("merchant.registrationLimit")}
              </Text>
                <TextInput
                  style={styles.input}
                  placeholder={t("merchant.registrationLimitPlaceholder")}
                  placeholderTextColor={theme.colors.gray200}
                  value={formData.registrationLimit?.toString() || ""}
                  onChangeText={(text) =>
                    setFormData({
                      ...formData,
                      registrationLimit: text ? parseInt(text, 10) : undefined,
                    })
                  }
                  keyboardType="number-pad"
                />
              </VStack>
            )}

            {renderLinkedPostPicker(formData.linkedPostId ?? null, (id) =>
              setFormData({ ...formData, linkedPostId: id }),
            )}
          </VStack>
        );

      case "discount":
        return (
          <VStack gap="$md">
            <VStack>
              <Text fontSize="$sm" color="$gray300" mb="$xs" style={styles.textRegular}>
                {t("merchant.coverImage")}
              </Text>
              <Pressable
                h={120}
                bg="$gray50"
                rounded="$md"
                justifyContent="center"
                alignItems="center"
                overflow="hidden"
                onPress={() => pickImage("coverImage")}
                disabled={uploadingField === "coverImage"}
              >
                {uploadingField === "coverImage" ? (
                  <VStack alignItems="center">
                    <ActivityIndicator color={theme.colors.black} />
                    <Text fontSize="$sm" color="$gray300" mt="$sm" style={styles.textRegular}>
                      {t("merchant.uploading")}
                    </Text>
                  </VStack>
                ) : formData.coverImage ? (
                  <OptimizedImage
                    uri={formData.coverImage}
                    size={ImageSize.MEDIUM}
                    style={styles.formImage}
                    contentFit="cover"
                    lazy={true}
                  />
                ) : (
                  <VStack alignItems="center">
                    <Ionicons name="image-outline" size={32} color={theme.colors.gray300} />
                    <Text fontSize="$sm" color="$gray300" mt="$sm" style={styles.textRegular}>
                      {t("merchant.tapSelectCover")}
                    </Text>
                  </VStack>
                )}
              </Pressable>
            </VStack>

            <VStack>
              <Text fontSize="$sm" color="$gray300" mb="$xs" style={styles.textRegular}>
                {t("merchant.discountTitleLabel")}
              </Text>
              <TextInput
                style={styles.input}
                placeholder={t("merchant.discountTitlePlaceholder")}
                placeholderTextColor={theme.colors.gray200}
                value={formData.title}
                onChangeText={(text) => setFormData({ ...formData, title: text })}
              />
            </VStack>

            <VStack>
              <Text fontSize="$sm" color="$gray300" mb="$xs" style={styles.textRegular}>
                {t("merchant.discountTypeLabel")}
              </Text>
              <HStack flexWrap="wrap" gap="$sm">
                {DISCOUNT_TYPES.map((type) => (
                  <Pressable
                    key={type.value}
                    px="$md"
                    py="$sm"
                    rounded="$sm"
                    bg={formData.discountType === type.value ? "$black" : "$gray100"}
                    onPress={() => setFormData({ ...formData, discountType: type.value })}
                  >
                    <Text
                      fontSize="$sm"
                      color={formData.discountType === type.value ? "$white" : "$black"}
                      style={styles.textRegular}
                    >
                      {type.label}
                    </Text>
                  </Pressable>
                ))}
              </HStack>
            </VStack>

            <VStack>
              <Text fontSize="$sm" color="$gray300" mb="$xs" style={styles.textRegular}>
                {t("merchant.discountDetailLabel")}
              </Text>
              <TextInput
                style={styles.input}
                placeholder={t("merchant.discountDetailPlaceholder")}
                placeholderTextColor={theme.colors.gray200}
                value={formData.discountValue}
                onChangeText={(text) => setFormData({ ...formData, discountValue: text })}
              />
            </VStack>

            <VStack>
              <Text fontSize="$sm" color="$gray300" mb="$xs" style={styles.textRegular}>
                {t("merchant.discountDescLabel")}
              </Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder={t("merchant.discountDescPlaceholder")}
                placeholderTextColor={theme.colors.gray200}
                value={formData.description}
                onChangeText={(text) => setFormData({ ...formData, description: text })}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </VStack>

            <Pressable
              flexDirection="row"
              alignItems="center"
              gap="$sm"
              onPress={() => setFormData({ ...formData, needCode: !formData.needCode })}
            >
              <Box
                w={20}
                h={20}
                rounded="$sm"
                borderWidth={1}
                borderColor={formData.needCode ? "$black" : "$gray200"}
                bg={formData.needCode ? "$black" : "$white"}
                justifyContent="center"
                alignItems="center"
              >
                {formData.needCode && (
                  <Ionicons name="checkmark" size={14} color={theme.colors.white} />
                )}
              </Box>
              <Text fontSize="$sm" color="$black" style={styles.textRegular}>
                {t("merchant.needCode")}
              </Text>
            </Pressable>

            {formData.needCode && (
              <VStack>
                <Text fontSize="$sm" color="$gray300" mb="$xs" style={styles.textRegular}>
                  {t("merchant.discountCodeLabel")}
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder={t("merchant.discountCodePlaceholder")}
                  placeholderTextColor={theme.colors.gray200}
                  value={formData.discountCode}
                  onChangeText={(text) => setFormData({ ...formData, discountCode: text })}
                />
              </VStack>
            )}

            {renderLinkedPostPicker(formData.linkedPostId ?? null, (id) =>
              setFormData({ ...formData, linkedPostId: id }),
            )}
          </VStack>
        );
    }
  };

  // 获取编辑模态框标题
  //
  // 历史 bug：英文环境下出现 "EditBanner"（"Edit" 与 "Banner" 之间没有空格），
  // 因为 `merchant.add` 在 EN 文案里有 trailing space（"Add "），而
  // `common.edit` 是 "Edit"（无 trailing），直接 concat 就丢空格。
  //
  // 修复：把 action 先 trim() 标准化，再用空格分隔统一拼接，最后 trim()
  // 兜底；中文输出会变成 "编辑 Banner"，多一空格但比 "EditBanner" 可读。
  const getEditModalTitle = () => {
    const action = (editItem ? t("common.edit") : t("merchant.add")).trim();
    const typeLabels: Record<string, string> = {
      info: t("merchant.storeInfo"),
      banner: "Banner",
      announcement: t("merchant.announcement"),
      activity: t("merchant.activity"),
      discount: t("merchant.discount"),
      // 买手店帖子（migration 055）— modal 不会被打开（openEditModal 直接
      // navigate 到 PublishLookbook）, 但保留 label 以防后续重构。
      post: t("merchant.tabPost"),
    };
    return `${action} ${typeLabels[editType] || ""}`.trim();
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <ScreenHeader
          title={t("merchant.title")}
          showBackButton
          onBackPress={() => navigation.goBack()}
        />
        <VStack flex={1} justifyContent="center" alignItems="center">
          <ActivityIndicator  color={theme.colors.black} />
          <Text color="$gray300" mt="$md" style={styles.textRegular}>
            {t("common.loading")}
          </Text>
        </VStack>
      </SafeAreaView>
    );
  }

  if (!merchant) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <ScreenHeader
          title={t("merchant.title")}
          showBackButton
          onBackPress={() => navigation.goBack()}
        />
        <VStack flex={1} justifyContent="center" alignItems="center" px="$lg">
          <Ionicons name="storefront-outline" size={64} color={theme.colors.gray200} />
          <Text
            color="$gray300"
            mt="$md"
            textAlign="center"
            style={styles.textRegular}
          >
            {t("merchant.notVerified")}
          </Text>
          <Text
            fontSize="$sm"
            color="$gray200"
            mt="$sm"
            textAlign="center"
            style={styles.textRegular}
          >
            {t("merchant.applyFirst")}
          </Text>
        </VStack>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader
        title={t("merchant.title")}
        showBackButton
        onBackPress={() => navigation.goBack()}
      />

      {/* Tab 切换 */}
      {renderTabs()}

      {/* 内容列表 */}
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.black}
          />
        }
      >
        {renderContent()}
      </ScrollView>

      {/* 添加按钮 - 店铺信息 Tab 不显示 */}
      {activeTab !== "info" && (
        <Box px="$lg" py="$md" bg="$white" borderTopWidth={1} borderTopColor="$gray100">
          <Pressable
            py="$md"
            rounded="$sm"
            bg="$black"
            alignItems="center"
            onPress={() => openEditModal(activeTab)}
          >
            <HStack alignItems="center" gap="$sm">
              <Ionicons name="add" size={20} color={theme.colors.white} />
              <Text
                fontSize="$md"
                fontWeight="$semibold"
                color="$white"
                style={styles.textBold}
              >
                {t("merchant.add")}{TABS.find((tab) => tab.key === activeTab)?.label}
              </Text>
            </HStack>
          </Pressable>
        </Box>
      )}

      {/* 编辑模态框 */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="fade"
        onRequestClose={closeEditModal}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <Box flex={1} bg="rgba(0,0,0,0.4)" justifyContent="flex-end">
            <TouchableWithoutFeedback onPress={closeEditModal}>
              <Box flex={1} />
            </TouchableWithoutFeedback>
            <Box
              bg="$white"
              borderTopLeftRadius={24}
              borderTopRightRadius={24}
              maxHeight="90%"
            >
              {/* 模态框头部 */}
              <HStack
                px="$lg"
                py="$md"
                justifyContent="between"
                alignItems="center"
                borderBottomWidth={1}
                borderBottomColor="$gray100"
              >
                <Pressable onPress={closeEditModal}>
                  <Text fontSize="$md" color="$gray300" style={styles.textRegular}>
                    {t("common.cancel")}
                  </Text>
                </Pressable>
                <Text fontSize="$lg" fontWeight="$bold" color="$black" style={styles.textBold}>
                  {getEditModalTitle()}
                </Text>
                <Pressable onPress={handleSave} disabled={isSubmitting}>
                  {isSubmitting ? (
                    <ActivityIndicator  color={theme.colors.black} />
                  ) : (
                    <Text fontSize="$md" fontWeight="$semibold" color="$black" style={styles.textBold}>
                      {t("common.save")}
                    </Text>
                  )}
                </Pressable>
              </HStack>

              {/* 表单内容 */}
              <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
                {renderEditForm()}
              </ScrollView>
            </Box>
          </Box>
        </KeyboardAvoidingView>
      </Modal>

      {/* 品牌库选择器 —— 用于店铺信息编辑表单的"销售品牌"快速添加。
          消费者发帖流程也用同一个组件，统一品牌数据来源。 */}
      <BrandSelectorModal
        visible={showBrandSelector}
        brands={displayedBrands}
        searchQuery={brandSearchQuery}
        isLoading={isLoadingBrands}
        hasMore={hasMoreBrands}
        onSearchChange={setBrandSearchQuery}
        onSearch={searchBrands}
        onSelectBrand={handlePickBrand}
        onClose={() => setShowBrandSelector(false)}
        onLoadMore={loadMoreBrands}
      />
    </SafeAreaView>
  );
};

// 字体常量
const FONT_REGULAR = "PlayfairDisplay-Regular";
const FONT_BOLD = "PlayfairDisplay-Bold";

const makeStyles = (t: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: t.colors.background,
  },
  scrollView: {
    flex: 1,
  },
  // Banner 列表卡片图：用 16:9 (与消费者端 BannerCarousel 一致)，避免硬编码
  // 高度在不同屏宽下显得过高/过矮。
  bannerImage: {
    width: "100%",
    aspectRatio: 16 / 9,
    overflow: "hidden",
  },
  // 编辑表单里的图片选择器：同样 16:9 占位 + 虚线边框 + 灰底，明确"可点击
  // 选图"的可供性。空态/加载中/有图叠加层共用同一个外壳。
  bannerPicker: {
    width: "100%",
    aspectRatio: 16 / 9,
    backgroundColor: t.colors.gray50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: t.colors.border,
    borderStyle: "dashed",
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  bannerPickerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.0)",
  },
  bannerPickerOverlayBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  bannerPickerOverlayText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: FONT_REGULAR,
  },
  activityImage: {
    width: "100%",
    height: 120,
  },
  discountImage: {
    width: "100%",
    height: 100,
  },
  formImage: {
    width: "100%",
    height: "100%",
  },
  modalContent: {
    padding: t.spacing.lg,
    paddingBottom: 40,
  },
  input: {
    backgroundColor: t.colors.gray50,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: t.colors.text,
    fontFamily: FONT_REGULAR,
  },
  multilineInput: {
    minHeight: 64,
    paddingTop: 12,
  },
  // 描述区文本框：高度比通用 textArea 矮一点，给计数器留位置不显得拥挤。
  descTextArea: {
    minHeight: 88,
    paddingTop: 12,
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  // 营业时间两个 HH:MM 输入：固定居中、字体稍大些便于辨认。
  timeInput: {
    textAlign: "center",
    fontSize: 16,
    paddingVertical: 12,
  },
  // 圆角加号按钮（与左侧 input 同高度）：去掉旧的内联 style 拼装，复用此 class。
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: t.colors.text,
    alignItems: "center",
    justifyContent: "center",
  },
  // 已选项 chip 三种配色：phone 中性灰、brand 蓝、style 粉。
  // 把 "padding+rounded+row+center" 这套属性集中起来，比每处再写一遍干净很多。
  chipNeutral: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: t.colors.gray100,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  chipBrand: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E3F2FD",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  chipStyle: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FCE4EC",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  // 预设 chip：常用时段、常用风格的"快速填充"按钮 —— 边框轻、低存在感，
  // 视觉上不抢主输入框的焦点。
  presetChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: t.colors.border,
    backgroundColor: t.colors.card,
  },
  presetChipDisabled: {
    backgroundColor: t.colors.gray50,
    borderColor: t.colors.border,
  },
  // 周一～周日 chip：未选灰底，已选黑底白字 —— 高对比让用户明确"哪几天闭店"。
  dayChip: {
    minWidth: 44,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: t.colors.gray50,
    alignItems: "center",
    justifyContent: "center",
  },
  dayChipActive: {
    backgroundColor: t.colors.text,
  },
  textRegular: {
    fontFamily: FONT_REGULAR,
  },
  textBold: {
    fontFamily: FONT_BOLD,
  },
  // Tab label 用 RN 原生 Text 渲染，所以这里手动还原 gluestack `<Text>` 的
  // 默认字体（PlayfairDisplay）+ 我们想要的 size / 行高 / 居中。
  // `width: '100%'` 让 numberOfLines 在 Pressable 等分布局下生效（不约束
  // 宽度，长 label 会无限撑开 Pressable 把箭头/边框挤变形）。
  tabLabel: {
    width: "100%",
    marginTop: 4,
    fontSize: 11,
    lineHeight: 14,
    fontFamily: FONT_REGULAR,
    textAlign: "center",
  },
});

export default MerchantManageScreen;
