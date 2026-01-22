/**
 * 商家入驻审核页面（管理员）
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
  getPendingMerchants,
  reviewMerchant,
} from "../services/storeMerchantService";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const MerchantReviewScreen = () => {
  const navigation = useNavigation();
  const queryClient = useQueryClient();

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
  const detailModalAnim = React.useRef(new Animated.Value(0)).current;

  // 查询待审核商家列表
  const {
    data,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ["pending-merchants", page],
    queryFn: () => getPendingMerchants(page, 20),
  });

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
    Animated.timing(detailModalAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  // 关闭详情弹窗
  const closeDetailModal = () => {
    Animated.timing(detailModalAnim, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setShowDetailModal(false);
      setSelectedMerchant(null);
    });
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
        return { bg: "#FFF3E0", text: "#FF9800" };
      case "APPROVED":
        return { bg: "#E8F5E9", text: "#4CAF50" };
      case "REJECTED":
        return { bg: "#FFEBEE", text: "#F44336" };
      default:
        return { bg: "#F5F5F5", text: "#9E9E9E" };
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

    return (
      <Pressable
        bg="$white"
        rounded="$lg"
        p="$md"
        mb="$md"
        borderWidth={1}
        borderColor="$gray100"
        onPress={() => openDetailModal(item)}
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
              待审核
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
    return (
      <VStack flex={1} justifyContent="center" alignItems="center" py="$2xl">
        <Ionicons
          name="checkmark-circle-outline"
          size={64}
          color={theme.colors.gray200}
        />
        <Text fontSize="$lg" fontWeight="$medium" color="$black" mt="$md">
          暂无待审核的商家申请
        </Text>
        <Text color="$gray300" mt="$sm">
          所有商家入驻申请已处理完毕
        </Text>
      </VStack>
    );
  };

  if (isLoading && !isRefetching) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <ScreenHeader
          title="商家入驻审核"
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
        title="商家入驻审核"
        subtitle={`${total} 条待审核`}
        showBackButton
        onBackPress={() => navigation.goBack()}
      />

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
        animationType="none"
        onRequestClose={closeDetailModal}
      >
        <Box flex={1} bg="rgba(0,0,0,0.4)" justifyContent="flex-end">
          <TouchableWithoutFeedback onPress={closeDetailModal}>
            <Box flex={1} />
          </TouchableWithoutFeedback>
          <Animated.View
            style={[
              styles.modalContent,
              {
                transform: [
                  {
                    translateY: detailModalAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [600, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <Box w={40} h={4} bg="$gray200" rounded="$sm" alignSelf="center" mb="$md" />

            {selectedMerchant && (
              <ScrollView showsVerticalScrollIndicator={false}>
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
                <VStack mb="$md">
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
                </VStack>

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
                <HStack gap="$sm" mt="$md">
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
              </ScrollView>
            )}
          </Animated.View>
        </Box>
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
  modalContent: {
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: 34,
    maxHeight: "85%",
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
});

export default MerchantReviewScreen;
