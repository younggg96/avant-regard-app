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
  ContentStatus,
  ActivityType,
  DiscountType,
} from "../services/storeMerchantService";

type RouteParams = {
  MerchantManage: {
    merchantId?: number;
  };
};

type TabType = "banner" | "announcement" | "activity" | "discount";

const TABS: { key: TabType; label: string; icon: string }[] = [
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
  const [activeTab, setActiveTab] = useState<TabType>("banner");

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
    }
  }, [merchant, loadContent]);

  // 下拉刷新
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadContent();
    setIsRefreshing(false);
  };

  // 打开编辑模态框
  const openEditModal = (type: TabType, item?: any) => {
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

  // 渲染内容
  const renderContent = () => {
    switch (activeTab) {
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
    const typeLabels = {
      banner: "Banner",
      announcement: "公告",
      activity: "活动",
      discount: "折扣",
    };
    return `${action}${typeLabels[editType]}`;
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

      {/* 添加按钮 */}
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

      {/* 编辑模态框 */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="slide"
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
    backgroundColor: theme.colors.gray50,
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
