/**
 * 商家入驻审核与管理页面（管理员）
 * 遵循 iOS Human Interface Guidelines 设计规范
 */
import React, { useState, useCallback } from "react";
import {
  StyleSheet,
  FlatList,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Modal,
  TextInput,
  Animated,
  TouchableWithoutFeedback,
  Image,
  Linking,
  View,
  ScrollView as RNScrollView,
  Switch,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import {
  Box,
  Text,
  Pressable,
  HStack,
  VStack,
  ScrollView,
} from "../components/ui";
import { theme } from "../theme";
import ScreenHeader from "../components/ScreenHeader";
import {
  MerchantApplicationDetail,
  MerchantAdminUpdateParams,
  getPendingMerchants,
  reviewMerchant,
  getAllMerchants,
  adminUpdateMerchant,
} from "../services/storeMerchantService";
import { useQuery, useQueryClient } from "@tanstack/react-query";

type TabType = "pending" | "approved" | "all";

const MerchantReviewScreen = () => {
  const navigation = useNavigation();
  const queryClient = useQueryClient();

  // Tab 状态
  const [activeTab, setActiveTab] = useState<TabType>("pending");

  const [page, setPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // 拒绝弹窗状态
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedMerchant, setSelectedMerchant] =
    useState<MerchantApplicationDetail | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const rejectModalAnim = React.useRef(new Animated.Value(0)).current;

  // 详情弹窗状态
  const [showDetailModal, setShowDetailModal] = useState(false);

  // 管理弹窗状态
  const [showManageModal, setShowManageModal] = useState(false);
  const [manageMerchant, setManageMerchant] = useState<MerchantApplicationDetail | null>(null);

  // 查询待审核商家列表
  const {
    data: pendingData,
    isLoading: pendingLoading,
    isRefetching: pendingRefetching,
    refetch: refetchPending,
  } = useQuery({
    queryKey: ["pending-merchants", page],
    queryFn: () => getPendingMerchants(page, 20),
    enabled: activeTab === "pending",
  });

  // 查询已入驻商家列表
  const {
    data: approvedData,
    isLoading: approvedLoading,
    isRefetching: approvedRefetching,
    refetch: refetchApproved,
  } = useQuery({
    queryKey: ["approved-merchants", page],
    queryFn: () => getAllMerchants("APPROVED", page, 20),
    enabled: activeTab === "approved",
  });

  // 查询所有商家列表
  const {
    data: allData,
    isLoading: allLoading,
    isRefetching: allRefetching,
    refetch: refetchAll,
  } = useQuery({
    queryKey: ["all-merchants", page],
    queryFn: () => getAllMerchants(undefined, page, 20),
    enabled: activeTab === "all",
  });

  // 根据当前 Tab 选择数据
  const data = activeTab === "pending" ? pendingData : activeTab === "approved" ? approvedData : allData;
  const isLoading = activeTab === "pending" ? pendingLoading : activeTab === "approved" ? approvedLoading : allLoading;
  const isRefetching = activeTab === "pending" ? pendingRefetching : activeTab === "approved" ? approvedRefetching : allRefetching;
  const refetch = activeTab === "pending" ? refetchPending : activeTab === "approved" ? refetchApproved : refetchAll;

  const merchants = data?.merchants || [];
  const total = data?.total || 0;

  // 下拉刷新
  const handleRefresh = async () => {
    setPage(1);
    await refetch();
  };

  // 加载更多
  const handleLoadMore = async () => {
    if (merchants.length < total && !isLoadingMore && !isLoading) {
      setIsLoadingMore(true);
      setPage((prev) => prev + 1);
      setIsLoadingMore(false);
    }
  };

  // 打开详情弹窗
  const openDetailModal = (merchant: MerchantApplicationDetail) => {
    setSelectedMerchant(merchant);
    setShowDetailModal(true);
  };

  // 关闭详情弹窗
  const closeDetailModal = () => {
    setShowDetailModal(false);
    setSelectedMerchant(null);
  };

  // 审核通过
  const handleApprove = async (merchant: MerchantApplicationDetail) => {
    Alert.alert(
      "审核通过",
      `确定要通过该商家的入驻申请吗？\n店铺：${merchant.storeName || merchant.storeId}`,
      [
        { text: "取消", style: "cancel" },
        {
          text: "通过",
          onPress: async () => {
            try {
              setIsSubmitting(true);
              await reviewMerchant(merchant.id, {
                status: "APPROVED",
              });
              Alert.alert("成功", "审核已通过");
              queryClient.invalidateQueries({ queryKey: ["pending-merchants"] });
              closeDetailModal();
            } catch (error: any) {
              Alert.alert("操作失败", error.message || "请稍后重试");
            } finally {
              setIsSubmitting(false);
            }
          },
        },
      ]
    );
  };

  // 打开拒绝弹窗
  const openRejectModal = (merchant: MerchantApplicationDetail) => {
    setSelectedMerchant(merchant);
    setRejectReason("");
    closeDetailModal();
    setTimeout(() => {
      setShowRejectModal(true);
      Animated.timing(rejectModalAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }, 300);
  };

  // 关闭拒绝弹窗
  const closeRejectModal = () => {
    Animated.timing(rejectModalAnim, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setShowRejectModal(false);
      setRejectReason("");
    });
  };

  // 确认拒绝
  const handleConfirmReject = async () => {
    if (!selectedMerchant) return;
    if (!rejectReason.trim()) {
      Alert.alert("提示", "请输入拒绝原因");
      return;
    }

    try {
      setIsSubmitting(true);
      await reviewMerchant(selectedMerchant.id, {
        status: "REJECTED",
        rejectReason: rejectReason.trim(),
      });
      Alert.alert("成功", "已拒绝该申请");
      queryClient.invalidateQueries({ queryKey: ["pending-merchants"] });
      closeRejectModal();
    } catch (error: any) {
      Alert.alert("操作失败", error.message || "请稍后重试");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 获取状态标签颜色
  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDING":
        return { bg: "#FFF3E0", text: "#FF9800", label: "待审核" };
      case "APPROVED":
        return { bg: "#E8F5E9", text: "#4CAF50", label: "已入驻" };
      case "REJECTED":
        return { bg: "#FFEBEE", text: "#F44336", label: "已拒绝" };
      case "SUSPENDED":
        return { bg: "#ECEFF1", text: "#607D8B", label: "已暂停" };
      default:
        return { bg: "#F5F5F5", text: "#9E9E9E", label: status };
    }
  };

  // Tab 切换
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setPage(1);
  };

  // 打开管理弹窗
  const openManageModal = (merchant: MerchantApplicationDetail) => {
    setManageMerchant(merchant);
    setShowManageModal(true);
  };

  // 关闭管理弹窗
  const closeManageModal = () => {
    setShowManageModal(false);
    setManageMerchant(null);
  };

  // 更新商家状态
  const handleUpdateMerchantStatus = async (status: "APPROVED" | "SUSPENDED") => {
    if (!manageMerchant) return;

    const statusLabel = status === "APPROVED" ? "恢复" : "暂停";
    Alert.alert(
      `${statusLabel}商家`,
      `确定要${statusLabel}该商家吗？`,
      [
        { text: "取消", style: "cancel" },
        {
          text: "确定",
          onPress: async () => {
            try {
              setIsSubmitting(true);
              await adminUpdateMerchant(manageMerchant.id, { status });
              Alert.alert("成功", `商家已${statusLabel}`);
              queryClient.invalidateQueries({ queryKey: ["approved-merchants"] });
              queryClient.invalidateQueries({ queryKey: ["all-merchants"] });
              closeManageModal();
            } catch (error: any) {
              Alert.alert("操作失败", error.message || "请稍后重试");
            } finally {
              setIsSubmitting(false);
            }
          },
        },
      ]
    );
  };

  // 更新商家权限
  const handleUpdateMerchantPermission = async (
    permission: "canPostBanner" | "canPostAnnouncement" | "canPostActivity" | "canPostDiscount",
    value: boolean
  ) => {
    if (!manageMerchant) return;

    try {
      setIsSubmitting(true);
      await adminUpdateMerchant(manageMerchant.id, { [permission]: value });
      // 更新本地状态
      setManageMerchant({ ...manageMerchant, [permission]: value });
      queryClient.invalidateQueries({ queryKey: ["approved-merchants"] });
      queryClient.invalidateQueries({ queryKey: ["all-merchants"] });
    } catch (error: any) {
      Alert.alert("操作失败", error.message || "请稍后重试");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 格式化日期
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // 渲染商家申请项
  const renderMerchantItem = ({ item }: { item: MerchantApplicationDetail }) => {
    const statusColor = getStatusColor(item.status);
    const isPending = item.status === "PENDING";

    return (
      <Pressable
        bg="$white"
        rounded="$lg"
        p="$md"
        mb="$md"
        borderWidth={1}
        borderColor="$gray100"
        onPress={() => isPending ? openDetailModal(item) : openManageModal(item)}
        sx={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 4,
          elevation: 2,
        }}
      >
        <HStack justifyContent="between" alignItems="start" mb="$sm">
          <VStack flex={1}>
            <Text fontSize="$lg" fontWeight="$bold" color="$black" numberOfLines={1}>
              {item.storeName || item.storeId}
            </Text>
            {item.storeCity && (
              <Text fontSize="$sm" color="$gray300" mt="$xs">
                {item.storeCity}
              </Text>
            )}
          </VStack>
          <Box bg={statusColor.bg} px="$sm" py="$xs" rounded="$sm">
            <Text fontSize="$xs" fontWeight="$bold" color={statusColor.text}>
              {statusColor.label}
            </Text>
          </Box>
        </HStack>

        {/* 联系人信息 */}
        {item.contactName && (
          <HStack alignItems="center" mb="$xs">
            <Ionicons name="person-outline" size={14} color={theme.colors.gray300} />
            <Text fontSize="$sm" color="$gray300" ml="$xs">
              {item.contactName}
            </Text>
          </HStack>
        )}

        {item.contactPhone && (
          <HStack alignItems="center" mb="$xs">
            <Ionicons name="call-outline" size={14} color={theme.colors.gray300} />
            <Text fontSize="$sm" color="$gray300" ml="$xs">
              {item.contactPhone}
            </Text>
          </HStack>
        )}

        {item.contactEmail && (
          <HStack alignItems="center" mb="$sm">
            <Ionicons name="mail-outline" size={14} color={theme.colors.gray300} />
            <Text fontSize="$sm" color="$gray300" ml="$xs">
              {item.contactEmail}
            </Text>
          </HStack>
        )}

        <HStack
          justifyContent="between"
          alignItems="center"
          mt="$sm"
          pt="$sm"
          borderTopWidth={1}
          borderTopColor="$gray100"
        >
          <HStack alignItems="center">
            <Box
              w={24}
              h={24}
              rounded="$sm"
              bg="$gray100"
              justifyContent="center"
              alignItems="center"
              mr="$xs"
            >
              <Ionicons name="person" size={12} color={theme.colors.gray300} />
            </Box>
            <Text fontSize="$xs" color="$gray300">
              {item.username || `用户 ${item.userId}`}
            </Text>
            <Text fontSize="$xs" color="$gray200" ml="$sm">
              {formatDate(item.createdAt)}
            </Text>
          </HStack>
          <Ionicons name="chevron-forward" size={16} color={theme.colors.gray200} />
        </HStack>
      </Pressable>
    );
  };

  const renderEmpty = () => {
    if (isLoading) return null;

    const emptyMessages = {
      pending: { title: "暂无待审核的商家申请", subtitle: "所有商家入驻申请已处理完毕" },
      approved: { title: "暂无已入驻的商家", subtitle: "还没有商家通过审核入驻" },
      all: { title: "暂无商家数据", subtitle: "目前还没有任何商家申请记录" },
    };

    const msg = emptyMessages[activeTab];

    return (
      <VStack flex={1} justifyContent="center" alignItems="center" py="$2xl">
        <Ionicons
          name={activeTab === "pending" ? "checkmark-circle-outline" : "storefront-outline"}
          size={64}
          color={theme.colors.gray200}
        />
        <Text fontSize="$lg" fontWeight="$medium" color="$black" mt="$md">
          {msg.title}
        </Text>
        <Text color="$gray300" mt="$sm">
          {msg.subtitle}
        </Text>
      </VStack>
    );
  };

  // Tab 标题
  const getTabTitle = () => {
    switch (activeTab) {
      case "pending": return "待审核";
      case "approved": return "已入驻";
      case "all": return "全部";
    }
  };

  if (isLoading && !isRefetching) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <ScreenHeader
          title="商家管理"
          showBackButton
          onBackPress={() => navigation.goBack()}
        />
        <VStack flex={1} justifyContent="center" alignItems="center">
          <ActivityIndicator size="small" color={theme.colors.black} />
          <Text color="$gray300" mt="$md">
            加载中...
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
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "pending" && styles.tabActive]}
          onPress={() => handleTabChange("pending")}
        >
          <Text style={[styles.tabText, activeTab === "pending" && styles.tabTextActive]}>
            待审核
          </Text>
          {pendingData?.total ? (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{pendingData.total}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "approved" && styles.tabActive]}
          onPress={() => handleTabChange("approved")}
        >
          <Text style={[styles.tabText, activeTab === "approved" && styles.tabTextActive]}>
            已入驻
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "all" && styles.tabActive]}
          onPress={() => handleTabChange("all")}
        >
          <Text style={[styles.tabText, activeTab === "all" && styles.tabTextActive]}>
            全部
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={merchants}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderMerchantItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={handleRefresh}
            tintColor={theme.colors.black}
          />
        }
        ListEmptyComponent={renderEmpty}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={
          isLoadingMore ? (
            <Box py="$md" alignItems="center">
              <ActivityIndicator size="small" color={theme.colors.black} />
            </Box>
          ) : null
        }
      />

      {/* 详情弹窗 */}
      <Modal
        visible={showDetailModal}
        transparent
        animationType="fade"
        onRequestClose={closeDetailModal}
      >
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={closeDetailModal}>
            <View style={styles.modalBackdrop} />
          </TouchableWithoutFeedback>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />

            {selectedMerchant && (
              <RNScrollView showsVerticalScrollIndicator={false}>
                {/* 店铺名称 */}
                <Text fontSize="$xl" fontWeight="$bold" color="$black" mb="$xs">
                  {selectedMerchant.storeName || selectedMerchant.storeId}
                </Text>
                {selectedMerchant.storeAddress && (
                  <Text fontSize="$sm" color="$gray300" mb="$md">
                    {selectedMerchant.storeAddress}
                  </Text>
                )}

                {/* 申请者信息 */}
                <Box bg="$gray50" rounded="$md" p="$md" mb="$md">
                  <HStack alignItems="center">
                    <Ionicons
                      name="person-circle-outline"
                      size={20}
                      color={theme.colors.gray300}
                    />
                    <Text fontSize="$sm" color="$gray300" ml="$sm">
                      申请者：{selectedMerchant.username || `用户 ${selectedMerchant.userId}`}
                    </Text>
                    <Text fontSize="$sm" color="$gray200" ml="auto">
                      {formatDate(selectedMerchant.createdAt)}
                    </Text>
                  </HStack>
                </Box>

                {/* 联系信息 */}
                <VStack mb="$md">
                  <Text fontSize="$sm" fontWeight="$semibold" color="$gray300" mb="$sm">
                    联系信息
                  </Text>

                  {selectedMerchant.contactName && (
                    <HStack alignItems="center" mb="$xs">
                      <Ionicons name="person-outline" size={16} color={theme.colors.gray400} />
                      <Text fontSize="$md" color="$black" ml="$sm">
                        {selectedMerchant.contactName}
                      </Text>
                    </HStack>
                  )}

                  {selectedMerchant.contactPhone && (
                    <Pressable
                      onPress={() =>
                        Linking.openURL(`tel:${selectedMerchant.contactPhone}`)
                      }
                    >
                      <HStack alignItems="center" mb="$xs">
                        <Ionicons name="call-outline" size={16} color={theme.colors.gray400} />
                        <Text fontSize="$md" color="$black" ml="$sm">
                          {selectedMerchant.contactPhone}
                        </Text>
                        <Ionicons
                          name="open-outline"
                          size={14}
                          color={theme.colors.gray300}
                          style={{ marginLeft: 4 }}
                        />
                      </HStack>
                    </Pressable>
                  )}

                  {selectedMerchant.contactEmail && (
                    <Pressable
                      onPress={() =>
                        Linking.openURL(`mailto:${selectedMerchant.contactEmail}`)
                      }
                    >
                      <HStack alignItems="center" mb="$xs">
                        <Ionicons name="mail-outline" size={16} color={theme.colors.gray400} />
                        <Text fontSize="$md" color="$black" ml="$sm">
                          {selectedMerchant.contactEmail}
                        </Text>
                        <Ionicons
                          name="open-outline"
                          size={14}
                          color={theme.colors.gray300}
                          style={{ marginLeft: 4 }}
                        />
                      </HStack>
                    </Pressable>
                  )}
                </VStack>

                {/* 营业执照/证明材料 */}
                {selectedMerchant.businessLicense && (
                  <VStack mb="$lg">
                    <Text fontSize="$sm" fontWeight="$semibold" color="$gray300" mb="$sm">
                      证明材料
                    </Text>
                    <Image
                      source={{ uri: selectedMerchant.businessLicense }}
                      style={styles.licenseImage}
                      resizeMode="contain"
                    />
                  </VStack>
                )}

                {/* 商家等级 */}
                {/* <VStack mb="$md">
                  <Text fontSize="$sm" fontWeight="$semibold" color="$gray300" mb="$xs">
                    商家等级
                  </Text>
                  <HStack gap="$sm">
                    <Box bg="$gray100" px="$md" py="$sm" rounded="$sm">
                      <Text fontSize="$sm" color="$black">
                        {selectedMerchant.merchantLevel === "BASIC"
                          ? "基础商家"
                          : selectedMerchant.merchantLevel === "PREMIUM"
                            ? "高级商家"
                            : "VIP商家"}
                      </Text>
                    </Box>
                  </HStack>
                </VStack> */}

                {/* 权限信息 */}
                <VStack mb="$lg">
                  <Text fontSize="$sm" fontWeight="$semibold" color="$gray300" mb="$sm">
                    开通权限
                  </Text>
                  <HStack flexWrap="wrap" gap="$xs">
                    {selectedMerchant.canPostBanner && (
                      <Box bg="#E3F2FD" px="$sm" py="$xs" rounded="$sm">
                        <Text fontSize="$xs" color="#1976D2">
                          Banner
                        </Text>
                      </Box>
                    )}
                    {selectedMerchant.canPostAnnouncement && (
                      <Box bg="#FFF3E0" px="$sm" py="$xs" rounded="$sm">
                        <Text fontSize="$xs" color="#F57C00">
                          公告
                        </Text>
                      </Box>
                    )}
                    {selectedMerchant.canPostActivity && (
                      <Box bg="#E8F5E9" px="$sm" py="$xs" rounded="$sm">
                        <Text fontSize="$xs" color="#388E3C">
                          活动
                        </Text>
                      </Box>
                    )}
                    {selectedMerchant.canPostDiscount && (
                      <Box bg="#FCE4EC" px="$sm" py="$xs" rounded="$sm">
                        <Text fontSize="$xs" color="#C2185B">
                          折扣
                        </Text>
                      </Box>
                    )}
                  </HStack>
                </VStack>

                {/* 操作按钮 */}
                <HStack gap="$sm" mt="$md" mb="$lg">
                  <Pressable
                    flex={1}
                    py="$md"
                    rounded="$sm"
                    borderWidth={1}
                    borderColor="$error"
                    alignItems="center"
                    onPress={() => openRejectModal(selectedMerchant)}
                    disabled={isSubmitting}
                  >
                    <Text fontSize="$md" fontWeight="$semibold" color="$error">
                      拒绝
                    </Text>
                  </Pressable>
                  <Pressable
                    flex={1}
                    py="$md"
                    rounded="$sm"
                    bg="$black"
                    alignItems="center"
                    onPress={() => handleApprove(selectedMerchant)}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <ActivityIndicator size="small" color={theme.colors.white} />
                    ) : (
                      <Text fontSize="$md" fontWeight="$semibold" color="$white">
                        通过
                      </Text>
                    )}
                  </Pressable>
                </HStack>
              </RNScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* 拒绝原因弹窗 */}
      <Modal
        visible={showRejectModal}
        transparent
        animationType="none"
        onRequestClose={closeRejectModal}
      >
        <Box flex={1} bg="rgba(0,0,0,0.4)" justifyContent="center" px="$lg">
          <Animated.View
            style={[
              styles.rejectModalContent,
              {
                opacity: rejectModalAnim,
                transform: [
                  {
                    scale: rejectModalAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.9, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text fontSize="$lg" fontWeight="$bold" color="$black" mb="$md">
              拒绝原因
            </Text>
            <Text fontSize="$sm" color="$gray300" mb="$md">
              请填写拒绝「{selectedMerchant?.storeName || selectedMerchant?.storeId}」入驻的原因：
            </Text>
            <TextInput
              style={styles.rejectInput}
              placeholder="请输入拒绝原因..."
              placeholderTextColor={theme.colors.gray200}
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
              maxLength={200}
            />
            <HStack gap="$sm" mt="$lg">
              <Pressable
                flex={1}
                py="$md"
                rounded="$sm"
                borderWidth={1}
                borderColor="$gray200"
                alignItems="center"
                onPress={closeRejectModal}
              >
                <Text fontSize="$md" fontWeight="$semibold" color="$black">
                  取消
                </Text>
              </Pressable>
              <Pressable
                flex={1}
                py="$md"
                rounded="$sm"
                bg="$error"
                alignItems="center"
                onPress={handleConfirmReject}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color={theme.colors.white} />
                ) : (
                  <Text fontSize="$md" fontWeight="$semibold" color="$white">
                    确认拒绝
                  </Text>
                )}
              </Pressable>
            </HStack>
          </Animated.View>
        </Box>
      </Modal>

      {/* 管理弹窗 */}
      <Modal
        visible={showManageModal}
        transparent
        animationType="fade"
        onRequestClose={closeManageModal}
      >
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={closeManageModal}>
            <View style={styles.modalBackdrop} />
          </TouchableWithoutFeedback>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />

            {manageMerchant && (
              <RNScrollView showsVerticalScrollIndicator={false}>
                {/* 店铺名称 */}
                <Text fontSize="$xl" fontWeight="$bold" color="$black" mb="$xs">
                  {manageMerchant.storeName || manageMerchant.storeId}
                </Text>
                {manageMerchant.storeAddress && (
                  <Text fontSize="$sm" color="$gray300" mb="$md">
                    {manageMerchant.storeAddress}
                  </Text>
                )}

                {/* 状态 */}
                <Box bg="$gray50" rounded="$md" p="$md" mb="$md">
                  <HStack alignItems="center" justifyContent="space-between">
                    <HStack alignItems="center">
                      <Ionicons
                        name="shield-checkmark-outline"
                        size={20}
                        color={theme.colors.gray400}
                      />
                      <Text fontSize="$sm" color="$gray400" ml="$sm">
                        商家状态
                      </Text>
                    </HStack>
                    <Box bg={getStatusColor(manageMerchant.status).bg} px="$sm" py="$xs" rounded="$sm">
                      <Text fontSize="$xs" fontWeight="$bold" color={getStatusColor(manageMerchant.status).text}>
                        {getStatusColor(manageMerchant.status).label}
                      </Text>
                    </Box>
                  </HStack>
                </Box>

                {/* 联系信息 */}
                <VStack mb="$md">
                  <Text fontSize="$sm" fontWeight="$semibold" color="$gray300" mb="$sm">
                    联系信息
                  </Text>

                  {manageMerchant.contactName && (
                    <HStack alignItems="center" mb="$xs">
                      <Ionicons name="person-outline" size={16} color={theme.colors.gray400} />
                      <Text fontSize="$md" color="$black" ml="$sm">
                        {manageMerchant.contactName}
                      </Text>
                    </HStack>
                  )}

                  {manageMerchant.contactPhone && (
                    <Pressable
                      onPress={() =>
                        Linking.openURL(`tel:${manageMerchant.contactPhone}`)
                      }
                    >
                      <HStack alignItems="center" mb="$xs">
                        <Ionicons name="call-outline" size={16} color={theme.colors.gray400} />
                        <Text fontSize="$md" color="$black" ml="$sm">
                          {manageMerchant.contactPhone}
                        </Text>
                      </HStack>
                    </Pressable>
                  )}

                  {manageMerchant.contactEmail && (
                    <Pressable
                      onPress={() =>
                        Linking.openURL(`mailto:${manageMerchant.contactEmail}`)
                      }
                    >
                      <HStack alignItems="center" mb="$xs">
                        <Ionicons name="mail-outline" size={16} color={theme.colors.gray400} />
                        <Text fontSize="$md" color="$black" ml="$sm">
                          {manageMerchant.contactEmail}
                        </Text>
                      </HStack>
                    </Pressable>
                  )}
                </VStack>

                {/* 权限管理 */}
                <VStack mb="$lg">
                  <Text fontSize="$sm" fontWeight="$semibold" color="$gray300" mb="$sm">
                    权限管理
                  </Text>

                  <View style={styles.permissionItem}>
                    <HStack alignItems="center">
                      <Ionicons name="image-outline" size={18} color={theme.colors.gray400} />
                      <Text fontSize="$md" color="$black" ml="$sm">Banner 发布</Text>
                    </HStack>
                    <Switch
                      value={manageMerchant.canPostBanner}
                      onValueChange={(v) => handleUpdateMerchantPermission("canPostBanner", v)}
                      trackColor={{ false: theme.colors.gray200, true: theme.colors.black }}
                      thumbColor={theme.colors.white}
                      disabled={isSubmitting}
                    />
                  </View>

                  <View style={styles.permissionItem}>
                    <HStack alignItems="center">
                      <Ionicons name="megaphone-outline" size={18} color={theme.colors.gray400} />
                      <Text fontSize="$md" color="$black" ml="$sm">公告发布</Text>
                    </HStack>
                    <Switch
                      value={manageMerchant.canPostAnnouncement}
                      onValueChange={(v) => handleUpdateMerchantPermission("canPostAnnouncement", v)}
                      trackColor={{ false: theme.colors.gray200, true: theme.colors.black }}
                      thumbColor={theme.colors.white}
                      disabled={isSubmitting}
                    />
                  </View>

                  <View style={styles.permissionItem}>
                    <HStack alignItems="center">
                      <Ionicons name="calendar-outline" size={18} color={theme.colors.gray400} />
                      <Text fontSize="$md" color="$black" ml="$sm">活动发布</Text>
                    </HStack>
                    <Switch
                      value={manageMerchant.canPostActivity}
                      onValueChange={(v) => handleUpdateMerchantPermission("canPostActivity", v)}
                      trackColor={{ false: theme.colors.gray200, true: theme.colors.black }}
                      thumbColor={theme.colors.white}
                      disabled={isSubmitting}
                    />
                  </View>

                  <View style={styles.permissionItem}>
                    <HStack alignItems="center">
                      <Ionicons name="pricetag-outline" size={18} color={theme.colors.gray400} />
                      <Text fontSize="$md" color="$black" ml="$sm">折扣发布</Text>
                    </HStack>
                    <Switch
                      value={manageMerchant.canPostDiscount}
                      onValueChange={(v) => handleUpdateMerchantPermission("canPostDiscount", v)}
                      trackColor={{ false: theme.colors.gray200, true: theme.colors.black }}
                      thumbColor={theme.colors.white}
                      disabled={isSubmitting}
                    />
                  </View>
                </VStack>

                {/* 操作按钮 */}
                <HStack gap="$sm" mt="$md" mb="$lg">
                  {manageMerchant.status === "APPROVED" ? (
                    <Pressable
                      flex={1}
                      py="$md"
                      rounded="$sm"
                      bg="#FFEBEE"
                      alignItems="center"
                      onPress={() => handleUpdateMerchantStatus("SUSPENDED")}
                      disabled={isSubmitting}
                    >
                      <HStack alignItems="center" gap="$xs">
                        <Ionicons name="pause-circle-outline" size={18} color="#F44336" />
                        <Text fontSize="$md" fontWeight="$semibold" color="#F44336">
                          暂停商家
                        </Text>
                      </HStack>
                    </Pressable>
                  ) : manageMerchant.status === "SUSPENDED" ? (
                    <Pressable
                      flex={1}
                      py="$md"
                      rounded="$sm"
                      bg="#E8F5E9"
                      alignItems="center"
                      onPress={() => handleUpdateMerchantStatus("APPROVED")}
                      disabled={isSubmitting}
                    >
                      <HStack alignItems="center" gap="$xs">
                        <Ionicons name="play-circle-outline" size={18} color="#4CAF50" />
                        <Text fontSize="$md" fontWeight="$semibold" color="#4CAF50">
                          恢复商家
                        </Text>
                      </HStack>
                    </Pressable>
                  ) : null}
                </HStack>
              </RNScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  listContent: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: 34,
    maxHeight: "85%",
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: theme.colors.gray200,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: theme.spacing.md,
  },
  rejectModalContent: {
    backgroundColor: theme.colors.white,
    borderRadius: 16,
    padding: theme.spacing.lg,
  },
  rejectInput: {
    backgroundColor: theme.colors.gray100,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    fontSize: 15,
    color: theme.colors.black,
    minHeight: 100,
    textAlignVertical: "top",
  },
  licenseImage: {
    width: "100%",
    height: 200,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.gray100,
  },
  tabContainer: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray100,
    backgroundColor: theme.colors.white,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: {
    borderBottomColor: theme.colors.black,
  },
  tabText: {
    fontSize: 14,
    color: theme.colors.gray300,
  },
  tabTextActive: {
    color: theme.colors.black,
    fontWeight: "600",
  },
  tabBadge: {
    backgroundColor: theme.colors.error,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 6,
    paddingHorizontal: 6,
  },
  tabBadgeText: {
    color: theme.colors.white,
    fontSize: 12,
    fontWeight: "600",
  },
  permissionItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray100,
  },
});

export default MerchantReviewScreen;
