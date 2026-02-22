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
import { adminService, AdminBrand, AdminBrandImage, UpdateBrandParams } from "../../services/adminService";
import { sharedStyles } from "./adminStyles";
import { pickAndUploadImage } from "./adminUtils";

const BrandManagementTab = () => {
  const [brands, setBrands] = useState<AdminBrand[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingBrand, setEditingBrand] = useState<AdminBrand | null>(null);
  const [editForm, setEditForm] = useState<UpdateBrandParams>({});
  const [brandImages, setBrandImages] = useState<AdminBrandImage[]>([]);
  const [brandImagesLoading, setBrandImagesLoading] = useState(false);
  const [brandImageUploading, setBrandImageUploading] = useState(false);

  const fetchBrands = useCallback(async (p: number = 1, kw?: string) => {
    try {
      setLoading(true);
      const result = await adminService.getAdminBrands(kw, p, 50);
      setBrands(result.brands);
      setTotal(result.total);
      setPage(result.page);
    } catch (error) {
      console.error("获取品牌列表失败:", error);
      Alert.alert("错误", error instanceof Error ? error.message : "获取品牌列表失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBrands(1, keyword);
  }, [fetchBrands]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchBrands(1, keyword);
    setRefreshing(false);
  }, [fetchBrands, keyword]);

  const handleSearch = () => {
    fetchBrands(1, keyword);
  };

  const handleOpenEdit = (brand: AdminBrand) => {
    setEditingBrand(brand);
    setEditForm({
      name: brand.name,
      category: brand.category || "",
      foundedYear: brand.foundedYear || "",
      founder: brand.founder || "",
      country: brand.country || "",
      website: brand.website || "",
    });
    setEditModalVisible(true);
    loadBrandImages(brand.id);
  };

  const loadBrandImages = async (brandId: number) => {
    try {
      setBrandImagesLoading(true);
      const result = await adminService.getBrandImagesAdmin(brandId);
      setBrandImages(result.images);
    } catch {
      setBrandImages([]);
    } finally {
      setBrandImagesLoading(false);
    }
  };

  const handleAdminUploadBrandImage = async () => {
    if (!editingBrand) return;
    try {
      setBrandImageUploading(true);
      const url = await pickAndUploadImage([3, 4]);
      if (url) {
        await adminService.adminUploadBrandImage(editingBrand.id, url);
        loadBrandImages(editingBrand.id);
      }
    } catch (error) {
      Alert.alert("错误", error instanceof Error ? error.message : "上传失败");
    } finally {
      setBrandImageUploading(false);
    }
  };

  const handleDeleteBrandImage = async (imageId: number) => {
    Alert.alert("确认删除", "确定要删除这张图片吗？", [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
        style: "destructive",
        onPress: async () => {
          try {
            await adminService.deleteBrandImage(imageId);
            setBrandImages((prev) => prev.filter((img) => img.id !== imageId));
          } catch (error) {
            Alert.alert("错误", error instanceof Error ? error.message : "删除失败");
          }
        },
      },
    ]);
  };

  const handleToggleImageSelected = async (img: AdminBrandImage) => {
    const newSelected = !img.isSelected;
    try {
      await adminService.toggleBrandImageSelected(img.id, newSelected);
      setBrandImages((prev) =>
        prev.map((i) => (i.id === img.id ? { ...i, isSelected: newSelected } : i))
      );
    } catch (error) {
      Alert.alert("错误", error instanceof Error ? error.message : "操作失败");
    }
  };

  const handleSave = async () => {
    if (!editingBrand) return;
    try {
      setActionLoading(true);
      await adminService.updateAdminBrand(editingBrand.id, editForm);
      Alert.alert("成功", "品牌信息已更新");
      setEditModalVisible(false);
      fetchBrands(page, keyword);
    } catch (error) {
      Alert.alert("错误", error instanceof Error ? error.message : "更新失败");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = (brand: AdminBrand) => {
    Alert.alert("确认删除", `确定要删除品牌「${brand.name}」吗？此操作不可撤销。`, [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
        style: "destructive",
        onPress: async () => {
          try {
            setActionLoading(true);
            await adminService.deleteAdminBrand(brand.id);
            Alert.alert("已删除", `品牌「${brand.name}」已删除`);
            fetchBrands(page, keyword);
          } catch (error) {
            Alert.alert("错误", error instanceof Error ? error.message : "删除失败");
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const totalPages = Math.ceil(total / 50);
  const selectedCount = brandImages.filter((i) => i.isSelected).length;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={sharedStyles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Search */}
        <View style={styles.searchRow}>
          <TextInput
            style={[sharedStyles.modalInput, styles.searchInput]}
            placeholder="搜索品牌名称..."
            placeholderTextColor={theme.colors.gray300}
            value={keyword}
            onChangeText={setKeyword}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
            <Ionicons name="search" size={18} color={theme.colors.white} />
          </TouchableOpacity>
        </View>

        <Text style={styles.totalText}>共 {total} 个品牌</Text>

        {loading ? (
          <View style={sharedStyles.loadingContainer}>
            <ActivityIndicator size="small" color={theme.colors.black} />
            <Text style={sharedStyles.loadingText}>加载中...</Text>
          </View>
        ) : brands.length === 0 ? (
          <View style={sharedStyles.emptyContainer}>
            <Ionicons name="pricetag-outline" size={48} color={theme.colors.gray200} />
            <Text style={sharedStyles.emptyText}>暂无品牌数据</Text>
          </View>
        ) : (
          brands.map((brand) => (
            <View key={brand.id} style={sharedStyles.postCard}>
              <View style={sharedStyles.postHeader}>
                <Text style={sharedStyles.postTitle} numberOfLines={1}>{brand.name}</Text>
                <Text style={sharedStyles.postDate}>ID: {brand.id}</Text>
              </View>

              {brand.coverImage && (
                <Image source={{ uri: brand.coverImage }} style={styles.brandImage} resizeMode="cover" />
              )}

              <View style={styles.brandMeta}>
                {brand.category && <Text style={sharedStyles.postContent} numberOfLines={1}>分类: {brand.category}</Text>}
                {brand.founder && <Text style={sharedStyles.postContent} numberOfLines={1}>创始人: {brand.founder}</Text>}
                {brand.country && <Text style={sharedStyles.postContent} numberOfLines={1}>国家: {brand.country}</Text>}
                {brand.foundedYear && <Text style={sharedStyles.postContent} numberOfLines={1}>创立年份: {brand.foundedYear}</Text>}
              </View>

              <View style={sharedStyles.actionButtons}>
                <TouchableOpacity
                  style={[sharedStyles.actionButton, sharedStyles.viewButton]}
                  onPress={() => handleOpenEdit(brand)}
                >
                  <Ionicons name="create-outline" size={18} color={theme.colors.black} />
                  <Text style={[sharedStyles.actionButtonText, { color: theme.colors.black }]}>编辑</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[sharedStyles.actionButton, sharedStyles.deletePostButton]}
                  onPress={() => handleDelete(brand)}
                  disabled={actionLoading}
                >
                  <Ionicons name="trash-outline" size={18} color={theme.colors.white} />
                  <Text style={sharedStyles.actionButtonText}>删除</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}

        {total > 50 && (
          <View style={styles.pagination}>
            <TouchableOpacity
              disabled={page <= 1}
              onPress={() => fetchBrands(page - 1, keyword)}
              style={{ opacity: page <= 1 ? 0.3 : 1 }}
            >
              <Ionicons name="chevron-back" size={24} color={theme.colors.black} />
            </TouchableOpacity>
            <Text style={styles.paginationText}>第 {page} 页 / 共 {totalPages} 页</Text>
            <TouchableOpacity
              disabled={page >= totalPages}
              onPress={() => fetchBrands(page + 1, keyword)}
              style={{ opacity: page >= totalPages ? 0.3 : 1 }}
            >
              <Ionicons name="chevron-forward" size={24} color={theme.colors.black} />
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Edit Brand Modal */}
      <Modal visible={editModalVisible} transparent animationType="fade" onRequestClose={() => setEditModalVisible(false)}>
        <View style={sharedStyles.modalOverlay}>
          <View style={[sharedStyles.modalContent, styles.editModalContent]}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={sharedStyles.modalTitle}>编辑品牌</Text>

              {/* Brand Images - selectable grid */}
              <Text style={sharedStyles.formLabel}>
                品牌展示图片（已选 {selectedCount} 张）
              </Text>
              <Text style={styles.imageHint}>点击图片勾选/取消，勾选的图片将展示在品牌详情页轮播中</Text>
              {brandImagesLoading ? (
                <ActivityIndicator size="small" color={theme.colors.black} style={{ marginVertical: 12 }} />
              ) : brandImages.length === 0 ? (
                <View style={styles.noImagesHint}>
                  <Ionicons name="images-outline" size={24} color={theme.colors.gray200} />
                  <Text style={styles.noImagesText}>暂无已审核图片，请先在「图片审核」中通过图片</Text>
                </View>
              ) : (
                <View style={styles.brandImagesGrid}>
                  {brandImages.map((img) => (
                    <TouchableOpacity
                      key={img.id}
                      style={[styles.brandImageItem, img.isSelected && styles.brandImageItemSelected]}
                      onPress={() => handleToggleImageSelected(img)}
                      onLongPress={() => handleDeleteBrandImage(img.id)}
                      activeOpacity={0.7}
                    >
                      <Image source={{ uri: img.imageUrl }} style={styles.brandImageThumb} resizeMode="cover" />
                      <View style={[styles.checkboxOverlay, img.isSelected && styles.checkboxOverlaySelected]}>
                        <Ionicons
                          name={img.isSelected ? "checkmark-circle" : "ellipse-outline"}
                          size={22}
                          color={img.isSelected ? "#3B82F6" : "rgba(255,255,255,0.7)"}
                        />
                      </View>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    style={styles.brandImageAddBtn}
                    onPress={handleAdminUploadBrandImage}
                    disabled={brandImageUploading}
                  >
                    {brandImageUploading ? (
                      <ActivityIndicator size="small" color={theme.colors.gray300} />
                    ) : (
                      <Ionicons name="add" size={28} color={theme.colors.gray300} />
                    )}
                  </TouchableOpacity>
                </View>
              )}

              <Text style={sharedStyles.formLabel}>品牌名称</Text>
              <TextInput
                style={sharedStyles.modalInput}
                placeholder="品牌名称"
                placeholderTextColor={theme.colors.gray300}
                value={editForm.name || ""}
                onChangeText={(v) => setEditForm((f) => ({ ...f, name: v }))}
              />

              <View style={styles.fieldRow}>
                <View style={{ flex: 1 }}>
                  <Text style={sharedStyles.formLabel}>分类</Text>
                  <TextInput
                    style={sharedStyles.modalInput}
                    placeholder="高定/成衣/配饰"
                    placeholderTextColor={theme.colors.gray300}
                    value={editForm.category || ""}
                    onChangeText={(v) => setEditForm((f) => ({ ...f, category: v }))}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={sharedStyles.formLabel}>国家</Text>
                  <TextInput
                    style={sharedStyles.modalInput}
                    placeholder="例如: 法国"
                    placeholderTextColor={theme.colors.gray300}
                    value={editForm.country || ""}
                    onChangeText={(v) => setEditForm((f) => ({ ...f, country: v }))}
                  />
                </View>
              </View>

              <View style={styles.fieldRow}>
                <View style={{ flex: 1 }}>
                  <Text style={sharedStyles.formLabel}>创始人</Text>
                  <TextInput
                    style={sharedStyles.modalInput}
                    placeholder="创始人"
                    placeholderTextColor={theme.colors.gray300}
                    value={editForm.founder || ""}
                    onChangeText={(v) => setEditForm((f) => ({ ...f, founder: v }))}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={sharedStyles.formLabel}>创立年份</Text>
                  <TextInput
                    style={sharedStyles.modalInput}
                    placeholder="例如: 1988"
                    placeholderTextColor={theme.colors.gray300}
                    value={editForm.foundedYear || ""}
                    onChangeText={(v) => setEditForm((f) => ({ ...f, foundedYear: v }))}
                    keyboardType="number-pad"
                    maxLength={4}
                  />
                </View>
              </View>

              <Text style={sharedStyles.formLabel}>官方网站</Text>
              <TextInput
                style={sharedStyles.modalInput}
                placeholder="https://..."
                placeholderTextColor={theme.colors.gray300}
                value={editForm.website || ""}
                onChangeText={(v) => setEditForm((f) => ({ ...f, website: v }))}
                autoCapitalize="none"
                keyboardType="url"
              />

              <View style={sharedStyles.modalButtons}>
                <TouchableOpacity style={[sharedStyles.modalButton, sharedStyles.modalCancelButton]} onPress={() => setEditModalVisible(false)}>
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
                    <Text style={sharedStyles.modalConfirmText}>保存修改</Text>
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
  searchRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    marginBottom: 0,
  },
  searchButton: {
    backgroundColor: theme.colors.black,
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  totalText: {
    paddingBottom: 8,
    fontSize: 12,
    color: theme.colors.gray400,
  },
  brandImage: {
    width: "100%",
    height: 120,
    borderRadius: 8,
    marginBottom: 8,
  },
  brandMeta: {
    gap: 2,
    marginBottom: 8,
  },
  pagination: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 16,
    gap: 16,
  },
  paginationText: {
    fontSize: 14,
    color: theme.colors.gray500,
  },
  editModalContent: {
    height: "85%",
    width: "92%",
    padding: theme.spacing.lg,
  },
  fieldRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: theme.spacing.sm,
  },
  imageHint: {
    fontSize: 12,
    color: theme.colors.gray300,
    marginBottom: 8,
  },
  noImagesHint: {
    alignItems: "center",
    paddingVertical: 20,
    gap: 6,
  },
  noImagesText: {
    fontSize: 12,
    color: theme.colors.gray300,
    textAlign: "center",
  },
  brandImagesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  brandImageItem: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
  },
  brandImageItemSelected: {
    borderColor: "#3B82F6",
  },
  brandImageThumb: {
    width: "100%",
    height: "100%",
    backgroundColor: theme.colors.gray100,
  },
  checkboxOverlay: {
    position: "absolute",
    top: 3,
    right: 3,
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 11,
  },
  checkboxOverlaySelected: {
    backgroundColor: "rgba(255,255,255,0.9)",
  },
  brandImageAddBtn: {
    width: 80,
    height: 80,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.gray50,
  },
});

export default BrandManagementTab;
