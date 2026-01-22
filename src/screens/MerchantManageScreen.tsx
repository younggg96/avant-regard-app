/**
 * 商家管理页面
 * 让商家可以管理店铺的 Banner、公告、活动、折扣等内容
 */
import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Image,
  Modal,
  TouchableWithoutFeedback,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import {
  Box,
  Text,
  Pressable,
  HStack,
  VStack,
} from "../components/ui";
import { theme } from "../theme";
import ScreenHeader from "../components/ScreenHeader";
import { useAuthStore } from "../store/authStore";
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

type RouteParams = {
  MerchantManage: {
    merchantId?: number;
  };
};

type TabType = "info" | "banner" | "announcement" | "activity" | "discount";

const TABS: { key: TabType; label: string; icon: string }[] = [
  { key: "info", label: "店铺", icon: "storefront-outline" },
  { key: "banner", label: "Banner", icon: "image-outline" },
  { key: "announcement", label: "公告", icon: "megaphone-outline" },
  { key: "activity", label: "活动", icon: "calendar-outline" },
  { key: "discount", label: "折扣", icon: "pricetag-outline" },
];

const ACTIVITY_TYPES: { value: ActivityType; label: string }[] = [
  { value: "TRUNK_SHOW", label: "Trunk Show" },
  { value: "POP_UP", label: "快闪店" },
  { value: "SALE", label: "特卖会" },
  { value: "EVENT", label: "活动" },
  { value: "OTHER", label: "其他" },
];

const DISCOUNT_TYPES: { value: DiscountType; label: string }[] = [
  { value: "PERCENTAGE", label: "折扣比例" },
  { value: "FIXED", label: "满减优惠" },
  { value: "SPECIAL", label: "特别优惠" },
];

const MerchantManageScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RouteParams, "MerchantManage">>();
  const { user } = useAuthStore();

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

  // 各类内容列表
  const [banners, setBanners] = useState<StoreBanner[]>([]);
  const [announcements, setAnnouncements] = useState<StoreAnnouncement[]>([]);
  const [activities, setActivities] = useState<StoreActivity[]>([]);
  const [discounts, setDiscounts] = useState<StoreDiscount[]>([]);

  // 编辑模态框状态
  const [showEditModal, setShowEditModal] = useState(false);
  const [editType, setEditType] = useState<TabType>("banner");
  const [editItem, setEditItem] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 表单数据
  const [formData, setFormData] = useState<any>({});

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
  const loadContent = useCallback(async () => {
    if (!merchant) return;

    try {
      const [bannersRes, announcementsRes, activitiesRes, discountsRes] =
        await Promise.all([
          getMerchantBanners(merchant.id),
          getMerchantAnnouncements(merchant.id),
          getMerchantActivities(merchant.id),
          getMerchantDiscounts(merchant.id),
        ]);

      setBanners(bannersRes.banners);
      setAnnouncements(announcementsRes.announcements);
      setActivities(activitiesRes.activities);
      setDiscounts(discountsRes.discounts);
    } catch (error) {
      console.error("Load content error:", error);
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
    } catch (error) {
      console.error("Load buyer store error:", error);
    }
  };

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
      Alert.alert("成功", "联系信息已更新");
    } catch (error: any) {
      Alert.alert("保存失败", error.message || "请稍后重试");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 保存店铺信息
  const handleSaveStore = async () => {
    if (!merchant || !buyerStore) return;

    try {
      setIsSubmitting(true);
      const updatedStore = await updateBuyerStore(merchant.storeId, storeFormData);

      // 更新本地状态
      setBuyerStore(updatedStore);
      setIsEditingStore(false);
      setNewPhone("");
      setNewBrand("");
      setNewStyle("");
      Alert.alert("成功", "店铺信息已更新");
    } catch (error: any) {
      Alert.alert("保存失败", error.message || "请稍后重试");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 打开编辑模态框
  const openEditModal = (type: TabType, item?: any) => {
    if (type === "info") {
      setIsEditingInfo(true);
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

  // 选择图片
  const pickImage = async (fieldName: string = "imageUrl") => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: fieldName === "coverImage" ? [16, 9] : [16, 9],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setFormData({ ...formData, [fieldName]: result.assets[0].uri });
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
            Alert.alert("提示", "请选择 Banner 图片");
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
            Alert.alert("提示", "请填写公告标题和内容");
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
            Alert.alert("提示", "请填写活动标题和时间");
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
            Alert.alert("提示", "请填写折扣标题和时间");
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
      Alert.alert("成功", editItem ? "更新成功" : "发布成功");
    } catch (error: any) {
      Alert.alert("操作失败", error.message || "请稍后重试");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 删除内容
  const handleDelete = (type: TabType, id: number) => {
    Alert.alert("确认删除", "删除后无法恢复，确定要删除吗？", [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
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
            }
          } catch (error: any) {
            Alert.alert("删除失败", error.message || "请稍后重试");
          }
        },
      },
    ]);
  };

  // 渲染 Tab 切换
  const renderTabs = () => (
    <HStack bg="$white" borderBottomWidth={1} borderBottomColor="$gray100">
      {TABS.map((tab) => (
        <Pressable
          key={tab.key}
          flex={1}
          py="$md"
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
          <Text
            fontSize="$xs"
            color={activeTab === tab.key ? "$black" : "$gray300"}
            mt="$xs"
            fontWeight={activeTab === tab.key ? "$semibold" : "$regular"}
            style={styles.textRegular}
          >
            {tab.label}
          </Text>
        </Pressable>
      ))}
    </HStack>
  );

  // 渲染 Banner 列表
  const renderBanners = () => (
    <VStack p="$md" gap="$md">
      {banners.length === 0 ? (
        <VStack alignItems="center" py="$xl">
          <Ionicons name="image-outline" size={48} color={theme.colors.gray200} />
          <Text color="$gray300" mt="$md" style={styles.textRegular}>
            暂无 Banner，点击下方按钮添加
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
            {banner.imageUrl && (
              <Image
                source={{ uri: banner.imageUrl }}
                style={styles.bannerImage}
                resizeMode="cover"
              />
            )}
            <HStack p="$md" justifyContent="between" alignItems="center">
              <VStack flex={1}>
                <Text fontSize="$md" fontWeight="$semibold" color="$black" style={styles.textBold}>
                  {banner.title || "无标题"}
                </Text>
                <HStack gap="$sm" mt="$xs">
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
                      {banner.status === "PUBLISHED" ? "已发布" : "草稿"}
                    </Text>
                  </Box>
                  <Text fontSize="$xs" color="$gray300" style={styles.textRegular}>
                    点击 {banner.clickCount}
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
            暂无公告，点击下方按钮添加
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
                      {announcement.status === "PUBLISHED" ? "已发布" : "草稿"}
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
            暂无活动，点击下方按钮添加
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
              <Image
                source={{ uri: activity.coverImage }}
                style={styles.activityImage}
                resizeMode="cover"
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
                          需报名 ({activity.registrationCount}
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
            暂无折扣，点击下方按钮添加
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
              <Image
                source={{ uri: discount.coverImage }}
                style={styles.discountImage}
                resizeMode="cover"
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
                          码: {discount.discountCode}
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
                  店铺ID
                </Text>
                <Text fontSize="$md" fontWeight="$semibold" color="$black" style={styles.textBold}>
                  {merchant.storeId}
                </Text>
              </VStack>
            </HStack>
            <Box bg="#E8F5E9" px="$sm" py="$xs" rounded="$sm">
              <Text fontSize="$xs" fontWeight="$bold" color="#4CAF50">
                已认证
              </Text>
            </Box>
          </HStack>
        </Box>

        {/* 联系信息 */}
        <Box bg="$white" rounded="$lg" p="$md" borderWidth={1} borderColor="$gray100">
          <HStack justifyContent="space-between" alignItems="center" mb="$md">
            <Text fontSize="$md" fontWeight="$semibold" color="$black" style={styles.textBold}>
              联系信息
            </Text>
            {!isEditingInfo && (
              <Pressable onPress={() => setIsEditingInfo(true)}>
                <HStack alignItems="center" gap="$xs">
                  <Ionicons name="create-outline" size={16} color={theme.colors.gray400} />
                  <Text fontSize="$sm" color="$gray400" style={styles.textRegular}>
                    编辑
                  </Text>
                </HStack>
              </Pressable>
            )}
          </HStack>

          {isEditingInfo ? (
            <VStack gap="$md">
              <VStack>
                <Text fontSize="$sm" color="$gray300" mb="$xs" style={styles.textRegular}>
                  联系人姓名
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="请输入联系人姓名"
                  placeholderTextColor={theme.colors.gray200}
                  value={infoFormData.contactName}
                  onChangeText={(text) =>
                    setInfoFormData({ ...infoFormData, contactName: text })
                  }
                />
              </VStack>

              <VStack>
                <Text fontSize="$sm" color="$gray300" mb="$xs" style={styles.textRegular}>
                  联系电话
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="请输入联系电话"
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
                  联系邮箱
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="请输入联系邮箱"
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
                    取消
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
                    <ActivityIndicator size="small" color={theme.colors.white} />
                  ) : (
                    <Text fontSize="$md" fontWeight="$semibold" color="$white" style={styles.textBold}>
                      保存
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
                    联系人
                  </Text>
                  <Text fontSize="$md" color="$black" style={styles.textRegular}>
                    {merchant.contactName || "未设置"}
                  </Text>
                </VStack>
              </HStack>

              <HStack alignItems="center" gap="$sm">
                <Ionicons name="call-outline" size={18} color={theme.colors.gray400} />
                <VStack>
                  <Text fontSize="$xs" color="$gray300" style={styles.textRegular}>
                    联系电话
                  </Text>
                  <Text fontSize="$md" color="$black" style={styles.textRegular}>
                    {merchant.contactPhone || "未设置"}
                  </Text>
                </VStack>
              </HStack>

              <HStack alignItems="center" gap="$sm">
                <Ionicons name="mail-outline" size={18} color={theme.colors.gray400} />
                <VStack>
                  <Text fontSize="$xs" color="$gray300" style={styles.textRegular}>
                    联系邮箱
                  </Text>
                  <Text fontSize="$md" color="$black" style={styles.textRegular}>
                    {merchant.contactEmail || "未设置"}
                  </Text>
                </VStack>
              </HStack>
            </VStack>
          )}
        </Box>

        {/* 权限信息 */}
        <Box bg="$white" rounded="$lg" p="$md" borderWidth={1} borderColor="$gray100">
          <Text fontSize="$md" fontWeight="$semibold" color="$black" mb="$md" style={styles.textBold}>
            已开通权限
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
                    公告
                  </Text>
                </HStack>
              </Box>
            )}
            {merchant.canPostActivity && (
              <Box bg="#E8F5E9" px="$md" py="$sm" rounded="$sm">
                <HStack alignItems="center" gap="$xs">
                  <Ionicons name="calendar-outline" size={14} color="#388E3C" />
                  <Text fontSize="$sm" color="#388E3C" style={styles.textRegular}>
                    活动
                  </Text>
                </HStack>
              </Box>
            )}
            {merchant.canPostDiscount && (
              <Box bg="#FCE4EC" px="$md" py="$sm" rounded="$sm">
                <HStack alignItems="center" gap="$xs">
                  <Ionicons name="pricetag-outline" size={14} color="#C2185B" />
                  <Text fontSize="$sm" color="#C2185B" style={styles.textRegular}>
                    折扣
                  </Text>
                </HStack>
              </Box>
            )}
          </HStack>
        </Box>

        {/* 店铺信息 */}
        <Box bg="$white" rounded="$lg" p="$md" borderWidth={1} borderColor="$gray100">
          <HStack justifyContent="space-between" alignItems="center" mb="$md">
            <Text fontSize="$md" fontWeight="$semibold" color="$black" style={styles.textBold}>
              店铺信息
            </Text>
            {!isEditingStore && (
              <Pressable onPress={() => setIsEditingStore(true)}>
                <HStack alignItems="center" gap="$xs">
                  <Ionicons name="create-outline" size={16} color={theme.colors.gray400} />
                  <Text fontSize="$sm" color="$gray400" style={styles.textRegular}>
                    编辑
                  </Text>
                </HStack>
              </Pressable>
            )}
          </HStack>

          {isEditingStore ? (
            <VStack gap="$md">
              {/* 店铺名称 */}
              <VStack>
                <Text fontSize="$sm" color="$gray300" mb="$xs" style={styles.textRegular}>
                  店铺名称
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="请输入店铺名称"
                  placeholderTextColor={theme.colors.gray200}
                  value={storeFormData.name}
                  onChangeText={(text) =>
                    setStoreFormData({ ...storeFormData, name: text })
                  }
                />
              </VStack>

              {/* 店铺地址 */}
              <VStack>
                <Text fontSize="$sm" color="$gray300" mb="$xs" style={styles.textRegular}>
                  店铺地址
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="请输入店铺地址"
                  placeholderTextColor={theme.colors.gray200}
                  value={storeFormData.address}
                  onChangeText={(text) =>
                    setStoreFormData({ ...storeFormData, address: text })
                  }
                  multiline
                />
              </VStack>

              {/* 联系电话 */}
              <VStack>
                <Text fontSize="$sm" color="$gray300" mb="$xs" style={styles.textRegular}>
                  联系电话
                </Text>
                <HStack gap="$sm" mb="$sm">
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder="添加电话号码"
                    placeholderTextColor={theme.colors.gray200}
                    value={newPhone}
                    onChangeText={setNewPhone}
                    keyboardType="phone-pad"
                  />
                  <Pressable
                    px="$md"
                    bg="$black"
                    rounded="$sm"
                    justifyContent="center"
                    onPress={() => {
                      if (newPhone.trim()) {
                        setStoreFormData({
                          ...storeFormData,
                          phone: [...storeFormData.phone, newPhone.trim()],
                        });
                        setNewPhone("");
                      }
                    }}
                  >
                    <Ionicons name="add" size={20} color={theme.colors.white} />
                  </Pressable>
                </HStack>
                <HStack flexWrap="wrap" gap="$xs">
                  {storeFormData.phone.map((p, idx) => (
                    <Box
                      key={idx}
                      bg="$gray100"
                      px="$sm"
                      py="$xs"
                      rounded="$sm"
                      flexDirection="row"
                      alignItems="center"
                    >
                      <Text fontSize="$sm" color="$black" style={styles.textRegular}>
                        {p}
                      </Text>
                      <Pressable
                        ml="$xs"
                        onPress={() => {
                          setStoreFormData({
                            ...storeFormData,
                            phone: storeFormData.phone.filter((_, i) => i !== idx),
                          });
                        }}
                      >
                        <Ionicons name="close-circle" size={16} color={theme.colors.gray400} />
                      </Pressable>
                    </Box>
                  ))}
                </HStack>
              </VStack>

              {/* 营业时间 */}
              <VStack>
                <Text fontSize="$sm" color="$gray300" mb="$xs" style={styles.textRegular}>
                  营业时间
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="例如：10:00-21:00"
                  placeholderTextColor={theme.colors.gray200}
                  value={storeFormData.hours}
                  onChangeText={(text) =>
                    setStoreFormData({ ...storeFormData, hours: text })
                  }
                />
              </VStack>

              {/* 休息日 */}
              <VStack>
                <Text fontSize="$sm" color="$gray300" mb="$xs" style={styles.textRegular}>
                  休息日
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="例如：周一休息"
                  placeholderTextColor={theme.colors.gray200}
                  value={storeFormData.rest}
                  onChangeText={(text) =>
                    setStoreFormData({ ...storeFormData, rest: text })
                  }
                />
              </VStack>

              {/* 店铺描述 */}
              <VStack>
                <Text fontSize="$sm" color="$gray300" mb="$xs" style={styles.textRegular}>
                  店铺描述
                </Text>
                <TextInput
                  style={[styles.input, { height: 80, textAlignVertical: "top" }]}
                  placeholder="介绍一下您的店铺"
                  placeholderTextColor={theme.colors.gray200}
                  value={storeFormData.description}
                  onChangeText={(text) =>
                    setStoreFormData({ ...storeFormData, description: text })
                  }
                  multiline
                  numberOfLines={3}
                />
              </VStack>

              {/* 销售品牌 */}
              <VStack>
                <Text fontSize="$sm" color="$gray300" mb="$xs" style={styles.textRegular}>
                  销售品牌
                </Text>
                <HStack gap="$sm" mb="$sm">
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder="添加品牌名称"
                    placeholderTextColor={theme.colors.gray200}
                    value={newBrand}
                    onChangeText={setNewBrand}
                  />
                  <Pressable
                    px="$md"
                    bg="$black"
                    rounded="$sm"
                    justifyContent="center"
                    onPress={() => {
                      if (newBrand.trim()) {
                        setStoreFormData({
                          ...storeFormData,
                          brands: [...storeFormData.brands, newBrand.trim()],
                        });
                        setNewBrand("");
                      }
                    }}
                  >
                    <Ionicons name="add" size={20} color={theme.colors.white} />
                  </Pressable>
                </HStack>
                <HStack flexWrap="wrap" gap="$xs">
                  {storeFormData.brands.map((b, idx) => (
                    <Box
                      key={idx}
                      bg="#E3F2FD"
                      px="$sm"
                      py="$xs"
                      rounded="$sm"
                      flexDirection="row"
                      alignItems="center"
                    >
                      <Text fontSize="$sm" color="#1976D2" style={styles.textRegular}>
                        {b}
                      </Text>
                      <Pressable
                        ml="$xs"
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
              </VStack>

              {/* 风格标签 */}
              <VStack>
                <Text fontSize="$sm" color="$gray300" mb="$xs" style={styles.textRegular}>
                  风格标签
                </Text>
                <HStack gap="$sm" mb="$sm">
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder="添加风格标签"
                    placeholderTextColor={theme.colors.gray200}
                    value={newStyle}
                    onChangeText={setNewStyle}
                  />
                  <Pressable
                    px="$md"
                    bg="$black"
                    rounded="$sm"
                    justifyContent="center"
                    onPress={() => {
                      if (newStyle.trim()) {
                        setStoreFormData({
                          ...storeFormData,
                          style: [...storeFormData.style, newStyle.trim()],
                        });
                        setNewStyle("");
                      }
                    }}
                  >
                    <Ionicons name="add" size={20} color={theme.colors.white} />
                  </Pressable>
                </HStack>
                <HStack flexWrap="wrap" gap="$xs">
                  {storeFormData.style.map((s, idx) => (
                    <Box
                      key={idx}
                      bg="#FCE4EC"
                      px="$sm"
                      py="$xs"
                      rounded="$sm"
                      flexDirection="row"
                      alignItems="center"
                    >
                      <Text fontSize="$sm" color="#C2185B" style={styles.textRegular}>
                        {s}
                      </Text>
                      <Pressable
                        ml="$xs"
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
              </VStack>

              {/* 按钮 */}
              <HStack gap="$sm" mt="$sm">
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
                    }
                    setNewPhone("");
                    setNewBrand("");
                    setNewStyle("");
                  }}
                >
                  <Text fontSize="$md" fontWeight="$semibold" color="$black" style={styles.textBold}>
                    取消
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
                    <ActivityIndicator size="small" color={theme.colors.white} />
                  ) : (
                    <Text fontSize="$md" fontWeight="$semibold" color="$white" style={styles.textBold}>
                      保存
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
                    店铺名称
                  </Text>
                  <Text fontSize="$md" color="$black" style={styles.textRegular}>
                    {buyerStore?.name || "未设置"}
                  </Text>
                </VStack>
              </HStack>

              {/* 地址 */}
              <HStack alignItems="flex-start" gap="$sm">
                <Ionicons name="location-outline" size={18} color={theme.colors.gray400} style={{ marginTop: 2 }} />
                <VStack flex={1}>
                  <Text fontSize="$xs" color="$gray300" style={styles.textRegular}>
                    地址
                  </Text>
                  <Text fontSize="$md" color="$black" style={styles.textRegular}>
                    {buyerStore?.address || "未设置"}
                  </Text>
                </VStack>
              </HStack>

              {/* 联系电话 */}
              <HStack alignItems="flex-start" gap="$sm">
                <Ionicons name="call-outline" size={18} color={theme.colors.gray400} style={{ marginTop: 2 }} />
                <VStack flex={1}>
                  <Text fontSize="$xs" color="$gray300" style={styles.textRegular}>
                    联系电话
                  </Text>
                  {buyerStore?.phone && buyerStore.phone.length > 0 ? (
                    buyerStore.phone.map((p, idx) => (
                      <Text key={idx} fontSize="$md" color="$black" style={styles.textRegular}>
                        {p}
                      </Text>
                    ))
                  ) : (
                    <Text fontSize="$md" color="$gray200" style={styles.textRegular}>
                      未设置
                    </Text>
                  )}
                </VStack>
              </HStack>

              {/* 营业时间 */}
              <HStack alignItems="center" gap="$sm">
                <Ionicons name="time-outline" size={18} color={theme.colors.gray400} />
                <VStack flex={1}>
                  <Text fontSize="$xs" color="$gray300" style={styles.textRegular}>
                    营业时间
                  </Text>
                  <Text fontSize="$md" color="$black" style={styles.textRegular}>
                    {buyerStore?.hours || "未设置"}
                  </Text>
                </VStack>
              </HStack>

              {/* 休息日 */}
              <HStack alignItems="center" gap="$sm">
                <Ionicons name="calendar-outline" size={18} color={theme.colors.gray400} />
                <VStack flex={1}>
                  <Text fontSize="$xs" color="$gray300" style={styles.textRegular}>
                    休息日
                  </Text>
                  <Text fontSize="$md" color="$black" style={styles.textRegular}>
                    {buyerStore?.rest || "未设置"}
                  </Text>
                </VStack>
              </HStack>

              {/* 店铺描述 */}
              {buyerStore?.description && (
                <HStack alignItems="flex-start" gap="$sm">
                  <Ionicons name="document-text-outline" size={18} color={theme.colors.gray400} style={{ marginTop: 2 }} />
                  <VStack flex={1}>
                    <Text fontSize="$xs" color="$gray300" style={styles.textRegular}>
                      店铺描述
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
                      销售品牌
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
                      风格标签
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
    }
  };

  // 渲染编辑表单
  const renderEditForm = () => {
    switch (editType) {
      case "banner":
        return (
          <VStack gap="$md">
            <VStack>
              <Text fontSize="$sm" color="$gray300" mb="$xs" style={styles.textRegular}>
                Banner 图片 *
              </Text>
              <Pressable
                h={150}
                bg="$gray50"
                rounded="$md"
                justifyContent="center"
                alignItems="center"
                overflow="hidden"
                onPress={() => pickImage("imageUrl")}
              >
                {formData.imageUrl ? (
                  <Image
                    source={{ uri: formData.imageUrl }}
                    style={styles.formImage}
                    resizeMode="cover"
                  />
                ) : (
                  <VStack alignItems="center">
                    <Ionicons name="image-outline" size={32} color={theme.colors.gray300} />
                    <Text fontSize="$sm" color="$gray300" mt="$sm" style={styles.textRegular}>
                      点击选择图片
                    </Text>
                  </VStack>
                )}
              </Pressable>
            </VStack>

            <VStack>
              <Text fontSize="$sm" color="$gray300" mb="$xs" style={styles.textRegular}>
                标题
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Banner 标题（可选）"
                placeholderTextColor={theme.colors.gray200}
                value={formData.title}
                onChangeText={(text) => setFormData({ ...formData, title: text })}
              />
            </VStack>

            <VStack>
              <Text fontSize="$sm" color="$gray300" mb="$xs" style={styles.textRegular}>
                跳转链接
              </Text>
              <TextInput
                style={styles.input}
                placeholder="点击跳转的链接（可选）"
                placeholderTextColor={theme.colors.gray200}
                value={formData.linkUrl}
                onChangeText={(text) => setFormData({ ...formData, linkUrl: text })}
              />
            </VStack>
          </VStack>
        );

      case "announcement":
        return (
          <VStack gap="$md">
            <VStack>
              <Text fontSize="$sm" color="$gray300" mb="$xs" style={styles.textRegular}>
                公告标题 *
              </Text>
              <TextInput
                style={styles.input}
                placeholder="请输入公告标题"
                placeholderTextColor={theme.colors.gray200}
                value={formData.title}
                onChangeText={(text) => setFormData({ ...formData, title: text })}
              />
            </VStack>

            <VStack>
              <Text fontSize="$sm" color="$gray300" mb="$xs" style={styles.textRegular}>
                公告内容 *
              </Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="请输入公告内容"
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
                置顶公告
              </Text>
            </Pressable>
          </VStack>
        );

      case "activity":
        return (
          <VStack gap="$md">
            <VStack>
              <Text fontSize="$sm" color="$gray300" mb="$xs" style={styles.textRegular}>
                封面图片
              </Text>
              <Pressable
                h={120}
                bg="$gray50"
                rounded="$md"
                justifyContent="center"
                alignItems="center"
                overflow="hidden"
                onPress={() => pickImage("coverImage")}
              >
                {formData.coverImage ? (
                  <Image
                    source={{ uri: formData.coverImage }}
                    style={styles.formImage}
                    resizeMode="cover"
                  />
                ) : (
                  <VStack alignItems="center">
                    <Ionicons name="image-outline" size={32} color={theme.colors.gray300} />
                    <Text fontSize="$sm" color="$gray300" mt="$sm" style={styles.textRegular}>
                      点击选择封面
                    </Text>
                  </VStack>
                )}
              </Pressable>
            </VStack>

            <VStack>
              <Text fontSize="$sm" color="$gray300" mb="$xs" style={styles.textRegular}>
                活动标题 *
              </Text>
              <TextInput
                style={styles.input}
                placeholder="请输入活动标题"
                placeholderTextColor={theme.colors.gray200}
                value={formData.title}
                onChangeText={(text) => setFormData({ ...formData, title: text })}
              />
            </VStack>

            <VStack>
              <Text fontSize="$sm" color="$gray300" mb="$xs" style={styles.textRegular}>
                活动描述
              </Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="请输入活动描述"
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
                活动地点
              </Text>
              <TextInput
                style={styles.input}
                placeholder="请输入活动地点"
                placeholderTextColor={theme.colors.gray200}
                value={formData.location}
                onChangeText={(text) => setFormData({ ...formData, location: text })}
              />
            </VStack>

            <VStack>
              <Text fontSize="$sm" color="$gray300" mb="$xs" style={styles.textRegular}>
                活动类型
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
                需要报名
              </Text>
            </Pressable>

            {formData.needRegistration && (
              <VStack>
                <Text fontSize="$sm" color="$gray300" mb="$xs" style={styles.textRegular}>
                  报名人数限制
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="留空表示不限制"
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
          </VStack>
        );

      case "discount":
        return (
          <VStack gap="$md">
            <VStack>
              <Text fontSize="$sm" color="$gray300" mb="$xs" style={styles.textRegular}>
                封面图片
              </Text>
              <Pressable
                h={120}
                bg="$gray50"
                rounded="$md"
                justifyContent="center"
                alignItems="center"
                overflow="hidden"
                onPress={() => pickImage("coverImage")}
              >
                {formData.coverImage ? (
                  <Image
                    source={{ uri: formData.coverImage }}
                    style={styles.formImage}
                    resizeMode="cover"
                  />
                ) : (
                  <VStack alignItems="center">
                    <Ionicons name="image-outline" size={32} color={theme.colors.gray300} />
                    <Text fontSize="$sm" color="$gray300" mt="$sm" style={styles.textRegular}>
                      点击选择封面
                    </Text>
                  </VStack>
                )}
              </Pressable>
            </VStack>

            <VStack>
              <Text fontSize="$sm" color="$gray300" mb="$xs" style={styles.textRegular}>
                折扣标题 *
              </Text>
              <TextInput
                style={styles.input}
                placeholder="如：春季大促、会员专享"
                placeholderTextColor={theme.colors.gray200}
                value={formData.title}
                onChangeText={(text) => setFormData({ ...formData, title: text })}
              />
            </VStack>

            <VStack>
              <Text fontSize="$sm" color="$gray300" mb="$xs" style={styles.textRegular}>
                折扣类型
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
                折扣详情 *
              </Text>
              <TextInput
                style={styles.input}
                placeholder="如：8折、满1000减200"
                placeholderTextColor={theme.colors.gray200}
                value={formData.discountValue}
                onChangeText={(text) => setFormData({ ...formData, discountValue: text })}
              />
            </VStack>

            <VStack>
              <Text fontSize="$sm" color="$gray300" mb="$xs" style={styles.textRegular}>
                折扣描述
              </Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="描述折扣详情、适用范围等"
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
                需要优惠码
              </Text>
            </Pressable>

            {formData.needCode && (
              <VStack>
                <Text fontSize="$sm" color="$gray300" mb="$xs" style={styles.textRegular}>
                  优惠码
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="请输入优惠码"
                  placeholderTextColor={theme.colors.gray200}
                  value={formData.discountCode}
                  onChangeText={(text) => setFormData({ ...formData, discountCode: text })}
                />
              </VStack>
            )}
          </VStack>
        );
    }
  };

  // 获取编辑模态框标题
  const getEditModalTitle = () => {
    const action = editItem ? "编辑" : "新建";
    const typeLabels: Record<string, string> = {
      info: "店铺信息",
      banner: "Banner",
      announcement: "公告",
      activity: "活动",
      discount: "折扣",
    };
    return `${action}${typeLabels[editType] || ""}`;
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <ScreenHeader
          title="商家管理"
          showBackButton
          onBackPress={() => navigation.goBack()}
        />
        <VStack flex={1} justifyContent="center" alignItems="center">
          <ActivityIndicator size="small" color={theme.colors.black} />
          <Text color="$gray300" mt="$md" style={styles.textRegular}>
            加载中...
          </Text>
        </VStack>
      </SafeAreaView>
    );
  }

  if (!merchant) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <ScreenHeader
          title="商家管理"
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
            您还不是认证商家
          </Text>
          <Text
            fontSize="$sm"
            color="$gray200"
            mt="$sm"
            textAlign="center"
            style={styles.textRegular}
          >
            请先在店铺页面申请商家入驻
          </Text>
        </VStack>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader
        title="商家管理"
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
                添加{TABS.find((t) => t.key === activeTab)?.label}
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
                  取消
                </Text>
              </Pressable>
              <Text fontSize="$lg" fontWeight="$bold" color="$black" style={styles.textBold}>
                {getEditModalTitle()}
              </Text>
              <Pressable onPress={handleSave} disabled={isSubmitting}>
                {isSubmitting ? (
                  <ActivityIndicator size="small" color={theme.colors.black} />
                ) : (
                  <Text fontSize="$md" fontWeight="$semibold" color="$black" style={styles.textBold}>
                    保存
                  </Text>
                )}
              </Pressable>
            </HStack>

            {/* 表单内容 */}
            <ScrollView style={styles.modalContent}>
              {renderEditForm()}
            </ScrollView>
          </Box>
        </Box>
      </Modal>
    </SafeAreaView>
  );
};

// 字体常量
const FONT_REGULAR = "PlayfairDisplay-Regular";
const FONT_BOLD = "PlayfairDisplay-Bold";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  scrollView: {
    flex: 1,
  },
  bannerImage: {
    width: "100%",
    height: 150,
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
    padding: theme.spacing.lg,
    paddingBottom: 40,
  },
  input: {
    backgroundColor: theme.colors.gray50,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: theme.colors.black,
    fontFamily: FONT_REGULAR,
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  textRegular: {
    fontFamily: FONT_REGULAR,
  },
  textBold: {
    fontFamily: FONT_BOLD,
  },
});

export default MerchantManageScreen;
