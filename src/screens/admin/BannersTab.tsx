import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Image,
  Alert,
  TextInput,
  Modal,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../theme";
import {
  Banner,
  getAllBanners,
  createBanner,
  updateBanner,
  deleteBanner,
  toggleBannerStatus,
} from "../../services/bannerService";
import { sharedStyles } from "./adminStyles";
import { getLinkTypeName, pickAndUploadImage } from "./adminUtils";

const BannersTab = () => {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [form, setForm] = useState({
    title: "",
    subtitle: "",
    image_url: "",
    link_type: "NONE" as string,
    link_value: "",
    sort_order: 0,
    is_active: true,
  });

  const fetchBanners = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getAllBanners();
      setBanners(result);
    } catch (error) {
      console.error("获取 Banner 列表失败:", error);
      Alert.alert("错误", error instanceof Error ? error.message : "获取 Banner 列表失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBanners();
  }, [fetchBanners]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchBanners();
    setRefreshing(false);
  }, [fetchBanners]);

  const handleOpenCreateModal = () => {
    setEditingBanner(null);
    setForm({
      title: "",
      subtitle: "",
      image_url: "",
      link_type: "NONE",
      link_value: "",
      sort_order: banners.length,
      is_active: true,
    });
    setModalVisible(true);
  };

  const handleOpenEditModal = (banner: Banner) => {
    setEditingBanner(banner);
    setForm({
      title: banner.title,
      subtitle: banner.subtitle || "",
      image_url: banner.imageUrl,
      link_type: banner.linkType,
      link_value: banner.linkValue || "",
      sort_order: banner.sortOrder,
      is_active: banner.isActive,
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      Alert.alert("错误", "请输入 Banner 标题");
      return;
    }
    if (!form.image_url.trim()) {
      Alert.alert("错误", "请上传或输入图片 URL");
      return;
    }
    try {
      setActionLoading(true);
      if (editingBanner) {
        await updateBanner(editingBanner.id, form);
        Alert.alert("成功", "Banner 更新成功");
      } else {
        await createBanner(form);
        Alert.alert("成功", "Banner 创建成功");
      }
      setModalVisible(false);
      fetchBanners();
    } catch (error) {
      Alert.alert("错误", error instanceof Error ? error.message : "操作失败");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (bannerId: number) => {
    Alert.alert("确认删除", "确定要删除这个 Banner 吗？", [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
        style: "destructive",
        onPress: async () => {
          try {
            setActionLoading(true);
            await deleteBanner(bannerId);
            Alert.alert("成功", "Banner 已删除");
            fetchBanners();
          } catch (error) {
            Alert.alert("错误", error instanceof Error ? error.message : "删除失败");
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const handleToggleStatus = async (banner: Banner) => {
    try {
      setActionLoading(true);
      await toggleBannerStatus(banner.id);
      Alert.alert("成功", `Banner 已${banner.isActive ? "禁用" : "启用"}`);
      fetchBanners();
    } catch (error) {
      Alert.alert("错误", error instanceof Error ? error.message : "操作失败");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUploadImage = async () => {
    try {
      setImageUploading(true);
      const url = await pickAndUploadImage([16, 9]);
      if (url) {
        setForm((prev) => ({ ...prev, image_url: url }));
        Alert.alert("成功", "图片上传成功");
      }
    } catch (error) {
      Alert.alert("错误", error instanceof Error ? error.message : "图片上传失败");
    } finally {
      setImageUploading(false);
    }
  };

  const renderBannerCard = (banner: Banner) => (
    <View key={banner.id} style={styles.bannerCard}>
      <Image source={{ uri: banner.imageUrl }} style={styles.bannerPreviewImage} resizeMode="cover" />
      <View style={[styles.bannerStatusBadge, banner.isActive ? styles.bannerStatusActive : styles.bannerStatusInactive]}>
        <Text style={styles.bannerStatusText}>{banner.isActive ? "启用" : "禁用"}</Text>
      </View>
      <View style={styles.bannerInfo}>
        <Text style={styles.bannerTitle} numberOfLines={1}>{banner.title}</Text>
        {banner.subtitle && <Text style={styles.bannerSubtitle} numberOfLines={1}>{banner.subtitle}</Text>}
        <View style={styles.bannerMeta}>
          <Text style={styles.bannerMetaText}>
            链接: {getLinkTypeName(banner.linkType)}
            {banner.linkValue && ` → ${banner.linkValue}`}
          </Text>
          <Text style={styles.bannerMetaText}>排序: {banner.sortOrder}</Text>
        </View>
      </View>
      <View style={styles.bannerActions}>
        <TouchableOpacity style={[styles.bannerActionBtn, styles.bannerEditBtn]} onPress={() => handleOpenEditModal(banner)} disabled={actionLoading}>
          <Ionicons name="create-outline" size={18} color={theme.colors.white} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.bannerActionBtn, banner.isActive ? styles.bannerDisableBtn : styles.bannerEnableBtn]} onPress={() => handleToggleStatus(banner)} disabled={actionLoading}>
          <Ionicons name={banner.isActive ? "eye-off-outline" : "eye-outline"} size={18} color={theme.colors.white} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.bannerActionBtn, styles.bannerDeleteBtn]} onPress={() => handleDelete(banner.id)} disabled={actionLoading}>
          <Ionicons name="trash-outline" size={18} color={theme.colors.white} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={styles.bannersList}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <TouchableOpacity style={styles.addBannerButton} onPress={handleOpenCreateModal}>
          <Ionicons name="add-circle-outline" size={24} color={theme.colors.white} />
          <Text style={styles.addBannerButtonText}>添加 Banner</Text>
        </TouchableOpacity>

        {loading && banners.length === 0 ? (
          <View style={sharedStyles.loadingContainer}>
            <ActivityIndicator color={theme.colors.black} />
            <Text style={sharedStyles.loadingText}>加载中...</Text>
          </View>
        ) : banners.length === 0 ? (
          <View style={sharedStyles.emptyContainer}>
            <Ionicons name="images-outline" size={48} color={theme.colors.gray300} />
            <Text style={sharedStyles.emptyText}>暂无 Banner</Text>
            <Text style={sharedStyles.emptySubtext}>点击上方按钮添加轮播图</Text>
          </View>
        ) : (
          <>
            <View style={styles.bannersHeader}>
              <Text style={styles.bannersHeaderText}>共 {banners.length} 个 Banner</Text>
            </View>
            {banners.map(renderBannerCard)}
          </>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Banner Edit Modal */}
      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={sharedStyles.modalOverlay}>
          <View style={[sharedStyles.modalContent, styles.bannerModalContent]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={sharedStyles.modalTitle}>
                {editingBanner ? "编辑 Banner" : "创建 Banner"}
              </Text>

              {form.image_url ? (
                <Image source={{ uri: form.image_url }} style={styles.bannerFormPreview} resizeMode="cover" />
              ) : (
                <View style={styles.bannerFormPlaceholder}>
                  <Ionicons name="image-outline" size={48} color={theme.colors.gray300} />
                  <Text style={styles.bannerFormPlaceholderText}>点击下方按钮上传图片</Text>
                </View>
              )}

              <TouchableOpacity style={sharedStyles.uploadImageButton} onPress={handleUploadImage} disabled={imageUploading}>
                {imageUploading ? (
                  <ActivityIndicator color={theme.colors.white} size="small" />
                ) : (
                  <>
                    <Ionicons name="cloud-upload-outline" size={20} color={theme.colors.white} />
                    <Text style={sharedStyles.uploadImageButtonText}>
                      {form.image_url ? "更换图片" : "上传图片"}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <Text style={sharedStyles.formLabel}>标题 *</Text>
              <TextInput
                style={sharedStyles.modalInput}
                placeholder="输入 Banner 标题"
                placeholderTextColor={theme.colors.gray300}
                value={form.title}
                onChangeText={(text) => setForm((prev) => ({ ...prev, title: text }))}
              />

              <Text style={sharedStyles.formLabel}>副标题</Text>
              <TextInput
                style={sharedStyles.modalInput}
                placeholder="输入副标题（可选）"
                placeholderTextColor={theme.colors.gray300}
                value={form.subtitle}
                onChangeText={(text) => setForm((prev) => ({ ...prev, subtitle: text }))}
              />

              <Text style={sharedStyles.formLabel}>链接类型</Text>
              <View style={sharedStyles.linkTypeContainer}>
                {["NONE", "POST", "BRAND", "SHOW", "EXTERNAL"].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[sharedStyles.linkTypeButton, form.link_type === type && sharedStyles.linkTypeButtonActive]}
                    onPress={() => setForm((prev) => ({ ...prev, link_type: type }))}
                  >
                    <Text style={[sharedStyles.linkTypeButtonText, form.link_type === type && sharedStyles.linkTypeButtonTextActive]}>
                      {getLinkTypeName(type)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {form.link_type !== "NONE" && (
                <>
                  <Text style={sharedStyles.formLabel}>
                    {form.link_type === "POST" && "帖子 ID"}
                    {form.link_type === "BRAND" && "品牌标识"}
                    {form.link_type === "SHOW" && "秀场 ID"}
                    {form.link_type === "EXTERNAL" && "外部链接 URL"}
                  </Text>
                  <TextInput
                    style={sharedStyles.modalInput}
                    placeholder={
                      form.link_type === "POST" ? "输入帖子 ID" :
                      form.link_type === "BRAND" ? "输入品牌标识（如 CHANEL）" :
                      form.link_type === "SHOW" ? "输入秀场 ID" :
                      "输入完整 URL（https://...）"
                    }
                    placeholderTextColor={theme.colors.gray300}
                    value={form.link_value}
                    onChangeText={(text) => setForm((prev) => ({ ...prev, link_value: text }))}
                    autoCapitalize={form.link_type === "EXTERNAL" ? "none" : "characters"}
                  />
                </>
              )}

              <Text style={sharedStyles.formLabel}>排序（数字越小越靠前）</Text>
              <TextInput
                style={sharedStyles.modalInput}
                placeholder="输入排序数字"
                placeholderTextColor={theme.colors.gray300}
                value={String(form.sort_order)}
                onChangeText={(text) => setForm((prev) => ({ ...prev, sort_order: parseInt(text) || 0 }))}
                keyboardType="numeric"
              />

              <TouchableOpacity style={sharedStyles.statusToggle} onPress={() => setForm((prev) => ({ ...prev, is_active: !prev.is_active }))}>
                <Text style={sharedStyles.formLabel}>启用状态</Text>
                <View style={[sharedStyles.statusToggleSwitch, form.is_active && sharedStyles.statusToggleSwitchActive]}>
                  <View style={[sharedStyles.statusToggleThumb, form.is_active && sharedStyles.statusToggleThumbActive]} />
                </View>
              </TouchableOpacity>

              <View style={sharedStyles.modalButtons}>
                <TouchableOpacity style={[sharedStyles.modalButton, sharedStyles.modalCancelButton]} onPress={() => setModalVisible(false)}>
                  <Text style={sharedStyles.modalCancelText}>取消</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[sharedStyles.modalButton, sharedStyles.modalConfirmButton, { backgroundColor: theme.colors.black }]}
                  onPress={handleSave}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <ActivityIndicator color={theme.colors.white} size="small" />
                  ) : (
                    <Text style={sharedStyles.modalConfirmText}>{editingBanner ? "保存修改" : "创建 Banner"}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  bannersList: {
    flex: 1,
    padding: theme.spacing.md,
  },
  addBannerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.black,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  addBannerButtonText: {
    ...theme.typography.button,
    color: theme.colors.white,
  },
  bannersHeader: {
    marginBottom: theme.spacing.md,
  },
  bannersHeaderText: {
    ...theme.typography.bodySmall,
    color: theme.colors.gray400,
  },
  bannerCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    overflow: "hidden",
    marginBottom: theme.spacing.md,
    ...theme.shadows.sm,
  },
  bannerPreviewImage: {
    width: "100%",
    height: 120,
    backgroundColor: theme.colors.gray100,
  },
  bannerStatusBadge: {
    position: "absolute",
    top: theme.spacing.sm,
    right: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
  },
  bannerStatusActive: {
    backgroundColor: theme.colors.success,
  },
  bannerStatusInactive: {
    backgroundColor: theme.colors.gray400,
  },
  bannerStatusText: {
    ...theme.typography.caption,
    color: theme.colors.white,
    fontWeight: "600",
  },
  bannerInfo: {
    padding: theme.spacing.md,
  },
  bannerTitle: {
    ...theme.typography.h4,
    color: theme.colors.black,
    marginBottom: 4,
  },
  bannerSubtitle: {
    ...theme.typography.bodySmall,
    color: theme.colors.gray400,
    marginBottom: theme.spacing.sm,
  },
  bannerMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  bannerMetaText: {
    ...theme.typography.caption,
    color: theme.colors.gray300,
  },
  bannerActions: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray100,
  },
  bannerActionBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: theme.spacing.md,
  },
  bannerEditBtn: {
    backgroundColor: theme.colors.black,
  },
  bannerEnableBtn: {
    backgroundColor: theme.colors.success,
  },
  bannerDisableBtn: {
    backgroundColor: "#F59E0B",
  },
  bannerDeleteBtn: {
    backgroundColor: theme.colors.error,
  },
  bannerModalContent: {
    maxHeight: "90%",
    width: "95%",
    maxWidth: 500,
  },
  bannerFormPreview: {
    width: "100%",
    height: 160,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
    backgroundColor: theme.colors.gray100,
  },
  bannerFormPlaceholder: {
    width: "100%",
    height: 160,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.gray100,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing.md,
  },
  bannerFormPlaceholderText: {
    ...theme.typography.bodySmall,
    color: theme.colors.gray300,
    marginTop: theme.spacing.sm,
  },
});

export default BannersTab;
