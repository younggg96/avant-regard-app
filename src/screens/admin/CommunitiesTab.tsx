import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  RefreshControl,
  Alert,
  Modal,
  ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../theme";
import {
  adminService,
  AdminCommunity,
  CommunityCategory,
  CreateCommunityParams,
  UpdateCommunityParams,
} from "../../services/adminService";
import { Post } from "../../services/postService";
import { sharedStyles } from "./adminStyles";
import { formatDate, pickAndUploadImage } from "./adminUtils";
import { Box, HStack, Text, Input, Button, ButtonText, Pressable, ScrollView, OptimizedImage } from "../../components/ui";
import { ImageSize } from "../../utils/imageUtils";

const CATEGORY_NAMES: Record<CommunityCategory, string> = {
  GENERAL: "综合",
  FASHION: "时尚",
  LIFESTYLE: "生活方式",
  BEAUTY: "美妆",
  CULTURE: "文化",
};

const CommunitiesTab = () => {
  const navigation = useNavigation();
  const [communities, setCommunities] = useState<AdminCommunity[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Edit modal
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCommunity, setEditingCommunity] = useState<AdminCommunity | null>(null);
  const [form, setForm] = useState<CreateCommunityParams & { isActive?: boolean }>({
    name: "",
    slug: "",
    description: "",
    iconUrl: "",
    coverUrl: "",
    category: "GENERAL",
    isOfficial: false,
    sortOrder: 0,
  });
  const [iconUploading, setIconUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);

  // Posts modal
  const [selectedCommunityId, setSelectedCommunityId] = useState<number | null>(null);
  const [selectedCommunityName, setSelectedCommunityName] = useState("");
  const [communityPosts, setCommunityPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postsPage, setPostsPage] = useState(1);
  const [postsTotalPages, setPostsTotalPages] = useState(0);
  const [postsTotal, setPostsTotal] = useState(0);
  const [postsModalVisible, setPostsModalVisible] = useState(false);

  const fetchCommunities = useCallback(async () => {
    try {
      setLoading(true);
      const result = await adminService.getAllCommunities(true);
      setCommunities(result);
    } catch (error) {
      console.error("获取社区列表失败:", error);
      Alert.alert("错误", error instanceof Error ? error.message : "获取社区列表失败");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCommunityPosts = useCallback(async (communityId: number, page: number = 1) => {
    try {
      setPostsLoading(true);
      const result = await adminService.getCommunityPosts(communityId, page, 20);
      setCommunityPosts(result.posts);
      setPostsPage(result.page);
      setPostsTotalPages(result.totalPages);
      setPostsTotal(result.total);
    } catch (error) {
      console.error("获取社区帖子失败:", error);
      Alert.alert("错误", error instanceof Error ? error.message : "获取社区帖子失败");
    } finally {
      setPostsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCommunities();
  }, [fetchCommunities]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchCommunities();
    setRefreshing(false);
  }, [fetchCommunities]);

  const handleOpenCreateModal = () => {
    setEditingCommunity(null);
    setForm({
      name: "",
      slug: "",
      description: "",
      iconUrl: "",
      coverUrl: "",
      category: "GENERAL",
      isOfficial: false,
      sortOrder: communities.length,
    });
    setModalVisible(true);
  };

  const handleOpenEditModal = (community: AdminCommunity) => {
    setEditingCommunity(community);
    setForm({
      name: community.name,
      slug: community.slug,
      description: community.description || "",
      iconUrl: community.iconUrl || "",
      coverUrl: community.coverUrl || "",
      category: community.category,
      isOfficial: community.isOfficial,
      sortOrder: community.sortOrder,
      isActive: community.isActive,
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      Alert.alert("错误", "请输入社区名称");
      return;
    }
    if (!form.slug.trim()) {
      Alert.alert("错误", "请输入社区标识（slug）");
      return;
    }
    if (!/^[a-z0-9-]+$/.test(form.slug)) {
      Alert.alert("错误", "社区标识只能包含小写字母、数字和连字符");
      return;
    }
    try {
      setActionLoading(true);
      if (editingCommunity) {
        const updateParams: UpdateCommunityParams = {
          name: form.name,
          description: form.description,
          iconUrl: form.iconUrl,
          coverUrl: form.coverUrl,
          category: form.category,
          isOfficial: form.isOfficial,
          sortOrder: form.sortOrder,
          isActive: form.isActive,
        };
        await adminService.updateCommunity(editingCommunity.id, updateParams);
        Alert.alert("成功", "社区更新成功");
      } else {
        await adminService.createCommunity(form);
        Alert.alert("成功", "社区创建成功");
      }
      setModalVisible(false);
      fetchCommunities();
    } catch (error) {
      Alert.alert("错误", error instanceof Error ? error.message : "操作失败");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (communityId: number, communityName: string) => {
    Alert.alert("确认删除", `确定要删除社区"${communityName}"吗？\n\n此操作将同时删除该社区下的所有帖子，不可撤销！`, [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
        style: "destructive",
        onPress: async () => {
          try {
            setActionLoading(true);
            await adminService.deleteCommunity(communityId);
            Alert.alert("成功", "社区已删除");
            fetchCommunities();
          } catch (error) {
            Alert.alert("错误", error instanceof Error ? error.message : "删除失败");
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const handleToggleStatus = async (community: AdminCommunity) => {
    try {
      setActionLoading(true);
      await adminService.updateCommunity(community.id, { isActive: !community.isActive });
      Alert.alert("成功", `社区已${community.isActive ? "禁用" : "启用"}`);
      fetchCommunities();
    } catch (error) {
      Alert.alert("错误", error instanceof Error ? error.message : "操作失败");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUploadIcon = async () => {
    try {
      setIconUploading(true);
      const url = await pickAndUploadImage([1, 1]);
      if (url) {
        setForm((prev) => ({ ...prev, iconUrl: url }));
        Alert.alert("成功", "图标上传成功");
      }
    } catch (error) {
      Alert.alert("错误", error instanceof Error ? error.message : "图标上传失败");
    } finally {
      setIconUploading(false);
    }
  };

  const handleUploadCover = async () => {
    try {
      setCoverUploading(true);
      const url = await pickAndUploadImage([16, 9]);
      if (url) {
        setForm((prev) => ({ ...prev, coverUrl: url }));
        Alert.alert("成功", "封面上传成功");
      }
    } catch (error) {
      Alert.alert("错误", error instanceof Error ? error.message : "封面上传失败");
    } finally {
      setCoverUploading(false);
    }
  };

  const handleOpenCommunityPosts = (community: AdminCommunity) => {
    setSelectedCommunityId(community.id);
    setSelectedCommunityName(community.name);
    setCommunityPosts([]);
    setPostsPage(1);
    setPostsTotalPages(0);
    setPostsTotal(0);
    setPostsModalVisible(true);
    fetchCommunityPosts(community.id, 1);
  };

  const handleDeleteCommunityPost = async (postId: number) => {
    if (!selectedCommunityId) return;
    Alert.alert("确认删除", "确定要删除这篇帖子吗？此操作不可撤销。", [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
        style: "destructive",
        onPress: async () => {
          try {
            setActionLoading(true);
            await adminService.deleteCommunityPost(selectedCommunityId, postId);
            Alert.alert("成功", "帖子已删除");
            fetchCommunityPosts(selectedCommunityId, postsPage);
            fetchCommunities();
          } catch (error) {
            Alert.alert("错误", error instanceof Error ? error.message : "删除失败");
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const renderCommunityCard = (community: AdminCommunity) => (
    <Box key={community.id} style={styles.communityCard}>
      {community.coverUrl ? (
        <OptimizedImage
          uri={community.coverUrl}
          size={ImageSize.MEDIUM}
          style={styles.communityCoverImage}
          contentFit="cover"
          lazy={true}
        />
      ) : (
        <Box style={[styles.communityCoverImage, styles.communityCoverPlaceholder]}>
          <Ionicons name="image-outline" size={32} color={theme.colors.gray300} />
        </Box>
      )}

      <Box style={[styles.communityStatusBadge, community.isActive ? styles.communityStatusActive : styles.communityStatusInactive]}>
        <Text style={styles.communityStatusText}>{community.isActive ? "启用" : "禁用"}</Text>
      </Box>

      {community.isOfficial && (
        <Box style={styles.communityOfficialBadge}>
          <Text style={styles.communityOfficialText}>官方</Text>
        </Box>
      )}

      <Box style={styles.communityInfo}>
        <HStack style={styles.communityHeader}>
          {community.iconUrl ? (
            <OptimizedImage
              uri={community.iconUrl}
              size={ImageSize.THUMBNAIL}
              style={styles.communityIcon}
              contentFit="cover"
              lazy={true}
            />
          ) : (
            <Box style={[styles.communityIcon, styles.communityIconPlaceholder]}>
              <Text style={styles.communityIconText}>{community.name[0]}</Text>
            </Box>
          )}
          <Box style={styles.communityTitleContainer}>
            <Text style={styles.communityTitle} numberOfLines={1}>{community.name}</Text>
            <Text style={styles.communitySlug}>/{community.slug}</Text>
          </Box>
        </HStack>

        {community.description && (
          <Text style={styles.communityDescription} numberOfLines={2}>{community.description}</Text>
        )}

        <HStack style={styles.communityMeta}>
          <HStack style={styles.communityMetaItem}>
            <Ionicons name="people-outline" size={14} color={theme.colors.gray400} />
            <Text style={styles.communityMetaText}>{community.memberCount} 成员</Text>
          </HStack>
          <HStack style={styles.communityMetaItem}>
            <Ionicons name="document-text-outline" size={14} color={theme.colors.gray400} />
            <Text style={styles.communityMetaText}>{community.postCount} 帖子</Text>
          </HStack>
          <HStack style={styles.communityMetaItem}>
            <Text style={styles.communityCategory}>{CATEGORY_NAMES[community.category]}</Text>
          </HStack>
        </HStack>
      </Box>

      <HStack style={styles.communityActions}>
        <Pressable style={[styles.communityActionBtn, styles.communityPostsBtn]} onPress={() => handleOpenCommunityPosts(community)} disabled={actionLoading}>
          <Ionicons name="list-outline" size={18} color={theme.colors.white} />
          <Text style={styles.communityActionText}>帖子</Text>
        </Pressable>
        <Pressable style={[styles.communityActionBtn, styles.communityEditBtn]} onPress={() => handleOpenEditModal(community)} disabled={actionLoading}>
          <Ionicons name="create-outline" size={18} color={theme.colors.white} />
          <Text style={styles.communityActionText}>编辑</Text>
        </Pressable>
        <Pressable style={[styles.communityActionBtn, community.isActive ? styles.communityDisableBtn : styles.communityEnableBtn]} onPress={() => handleToggleStatus(community)} disabled={actionLoading}>
          <Ionicons name={community.isActive ? "eye-off-outline" : "eye-outline"} size={18} color={theme.colors.white} />
        </Pressable>
        <Pressable style={[styles.communityActionBtn, styles.communityDeleteBtn]} onPress={() => handleDelete(community.id, community.name)} disabled={actionLoading}>
          <Ionicons name="trash-outline" size={18} color={theme.colors.white} />
        </Pressable>
      </HStack>
    </Box>
  );

  return (
    <Box style={{ flex: 1 }}>
      <ScrollView
        style={styles.communitiesList}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Pressable style={styles.addCommunityButton} onPress={handleOpenCreateModal}>
          <Ionicons name="add-circle-outline" size={24} color={theme.colors.white} />
          <Text style={styles.addCommunityButtonText}>创建社区</Text>
        </Pressable>

        {loading && communities.length === 0 ? (
          <Box style={sharedStyles.loadingContainer}>
            <ActivityIndicator color={theme.colors.black} />
            <Text style={sharedStyles.loadingText}>加载中...</Text>
          </Box>
        ) : communities.length === 0 ? (
          <Box style={sharedStyles.emptyContainer}>
            <Ionicons name="people-outline" size={48} color={theme.colors.gray300} />
            <Text style={sharedStyles.emptyText}>暂无社区</Text>
            <Text style={sharedStyles.emptySubtext}>点击上方按钮创建社区</Text>
          </Box>
        ) : (
          <>
            <Box style={styles.communitiesHeader}>
              <Text style={styles.communitiesHeaderText}>共 {communities.length} 个社区</Text>
            </Box>
            {communities.map(renderCommunityCard)}
          </>
        )}
        <Box style={{ height: 40 }} />
      </ScrollView>

      {/* Community Edit Modal */}
      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <Box style={sharedStyles.modalOverlay}>
          <Box style={[sharedStyles.modalContent, styles.communityModalContent]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={sharedStyles.modalTitle}>{editingCommunity ? "编辑社区" : "创建社区"}</Text>

              <Text style={sharedStyles.formLabel}>社区图标</Text>
              <HStack style={styles.communityFormImageRow}>
                {form.iconUrl ? (
                  <OptimizedImage
                    uri={form.iconUrl}
                    size={ImageSize.THUMBNAIL}
                    style={styles.communityFormIcon}
                    contentFit="cover"
                    lazy={true}
                  />
                ) : (
                  <Box style={[styles.communityFormIcon, styles.communityFormIconPlaceholder]}>
                    <Ionicons name="image-outline" size={24} color={theme.colors.gray300} />
                  </Box>
                )}
                <Pressable style={sharedStyles.uploadSmallButton} onPress={handleUploadIcon} disabled={iconUploading}>
                  {iconUploading ? (
                    <ActivityIndicator color={theme.colors.white} size="small" />
                  ) : (
                    <Text style={sharedStyles.uploadSmallButtonText}>{form.iconUrl ? "更换图标" : "上传图标"}</Text>
                  )}
                </Pressable>
              </HStack>

              <Text style={sharedStyles.formLabel}>社区封面</Text>
              {form.coverUrl ? (
                <OptimizedImage
                  uri={form.coverUrl}
                  size={ImageSize.MEDIUM}
                  style={styles.communityFormCover}
                  contentFit="cover"
                  lazy={true}
                />
              ) : (
                <Box style={[styles.communityFormCover, styles.communityFormCoverPlaceholder]}>
                  <Ionicons name="image-outline" size={32} color={theme.colors.gray300} />
                </Box>
              )}
              <Pressable style={sharedStyles.uploadImageButton} onPress={handleUploadCover} disabled={coverUploading}>
                {coverUploading ? (
                  <ActivityIndicator color={theme.colors.white} size="small" />
                ) : (
                  <>
                    <Ionicons name="cloud-upload-outline" size={20} color={theme.colors.white} />
                    <Text style={sharedStyles.uploadImageButtonText}>{form.coverUrl ? "更换封面" : "上传封面"}</Text>
                  </>
                )}
              </Pressable>

              <Text style={sharedStyles.formLabel}>社区名称 *</Text>
              <Input
                style={sharedStyles.modalInput}
                placeholder="输入社区名称"
                placeholderTextColor={theme.colors.gray300}
                value={form.name}
                onChangeText={(text: string) => setForm((prev) => ({ ...prev, name: text }))}
                variant="outline"
                size="md"
              />

              <Text style={sharedStyles.formLabel}>社区标识（slug）*</Text>
              <Input
                style={sharedStyles.modalInput}
                placeholder="输入社区标识（小写字母、数字、连字符）"
                placeholderTextColor={theme.colors.gray300}
                value={form.slug}
                onChangeText={(text: string) => setForm((prev) => ({ ...prev, slug: text.toLowerCase() }))}
                autoCapitalize="none"
                editable={!editingCommunity}
                variant="outline"
                size="md"
              />
              {editingCommunity && <Text style={sharedStyles.formHint}>创建后不可修改</Text>}

              <Text style={sharedStyles.formLabel}>社区描述</Text>
              <Input
                style={[sharedStyles.modalInput, { minHeight: 80 }]}
                placeholder="输入社区描述（可选）"
                placeholderTextColor={theme.colors.gray300}
                value={form.description}
                onChangeText={(text: string) => setForm((prev) => ({ ...prev, description: text }))}
                multiline
                numberOfLines={3}
                variant="outline"
                size="md"
              />

              <Text style={sharedStyles.formLabel}>社区分类</Text>
              <Box style={sharedStyles.linkTypeContainer}>
                {(Object.keys(CATEGORY_NAMES) as CommunityCategory[]).map((category) => (
                  <Pressable
                    key={category}
                    style={[sharedStyles.linkTypeButton, form.category === category && sharedStyles.linkTypeButtonActive]}
                    onPress={() => setForm((prev) => ({ ...prev, category }))}
                  >
                    <Text style={[sharedStyles.linkTypeButtonText, form.category === category && sharedStyles.linkTypeButtonTextActive]}>
                      {CATEGORY_NAMES[category]}
                    </Text>
                  </Pressable>
                ))}
              </Box>

              <Text style={sharedStyles.formLabel}>排序（数字越大越靠前）</Text>
              <Input
                style={sharedStyles.modalInput}
                placeholder="输入排序数字"
                placeholderTextColor={theme.colors.gray300}
                value={String(form.sortOrder || 0)}
                onChangeText={(text: string) => setForm((prev) => ({ ...prev, sortOrder: parseInt(text) || 0 }))}
                keyboardType="numeric"
                variant="outline"
                size="md"
              />

              <Pressable style={sharedStyles.statusToggle} onPress={() => setForm((prev) => ({ ...prev, isOfficial: !prev.isOfficial }))}>
                <Text style={sharedStyles.formLabel}>官方社区</Text>
                <Box style={[sharedStyles.statusToggleSwitch, form.isOfficial && sharedStyles.statusToggleSwitchActive]}>
                  <Box style={[sharedStyles.statusToggleThumb, form.isOfficial && sharedStyles.statusToggleThumbActive]} />
                </Box>
              </Pressable>

              {editingCommunity && (
                <Pressable style={sharedStyles.statusToggle} onPress={() => setForm((prev) => ({ ...prev, isActive: !prev.isActive }))}>
                  <Text style={sharedStyles.formLabel}>启用状态</Text>
                  <Box style={[sharedStyles.statusToggleSwitch, form.isActive && sharedStyles.statusToggleSwitchActive]}>
                    <Box style={[sharedStyles.statusToggleThumb, form.isActive && sharedStyles.statusToggleThumbActive]} />
                  </Box>
                </Pressable>
              )}

              <Box style={sharedStyles.modalButtons}>
                <Button variant="outline" size="sm" onPress={() => setModalVisible(false)}>
                  <ButtonText style={{ color: theme.colors.gray400 }}>取消</ButtonText>
                </Button>
                <Button
                  size="sm"
                  onPress={handleSave}
                  disabled={actionLoading}
                  isLoading={actionLoading}
                >
                  <ButtonText>{editingCommunity ? "保存修改" : "创建社区"}</ButtonText>
                </Button>
              </Box>
            </ScrollView>
          </Box>
        </Box>
      </Modal>

      {/* Community Posts Modal */}
      <Modal visible={postsModalVisible} transparent animationType="fade" onRequestClose={() => setPostsModalVisible(false)}>
        <Box style={sharedStyles.modalOverlay}>
          <Box style={[sharedStyles.modalContent, styles.communityPostsModalContent]}>
            <HStack style={styles.communityPostsHeader}>
              <Pressable style={styles.communityPostsCloseBtn} onPress={() => setPostsModalVisible(false)}>
                <Ionicons name="close" size={24} color={theme.colors.black} />
              </Pressable>
              <Text style={styles.communityPostsTitle}>{selectedCommunityName} 的帖子</Text>
              <Text style={styles.communityPostsCount}>共 {postsTotal} 篇</Text>
            </HStack>

            {postsLoading && communityPosts.length === 0 ? (
              <Box style={sharedStyles.loadingContainer}>
                <ActivityIndicator color={theme.colors.black} size="small" />
                <Text style={sharedStyles.loadingText}>加载中...</Text>
              </Box>
            ) : communityPosts.length === 0 ? (
              <Box style={sharedStyles.emptyContainer}>
                <Ionicons name="document-text-outline" size={48} color={theme.colors.gray300} />
                <Text style={sharedStyles.emptyText}>该社区暂无帖子</Text>
              </Box>
            ) : (
              <ScrollView style={styles.communityPostsList}>
                {communityPosts.map((post) => (
                  <HStack key={post.id} style={styles.communityPostCard}>
                    <Box style={styles.communityPostInfo}>
                      <Text style={styles.communityPostId}>#{post.id}</Text>
                      <Text style={styles.communityPostTitle} numberOfLines={2}>{post.title}</Text>
                      <HStack style={styles.communityPostMeta}>
                        <Text style={styles.communityPostAuthor}>{post.username}</Text>
                        <Text style={styles.communityPostDate}>{formatDate(post.createdAt)}</Text>
                      </HStack>
                    </Box>
                    <HStack style={styles.communityPostActions}>
                      <Pressable
                        style={styles.communityPostViewBtn}
                        onPress={() => {
                          setPostsModalVisible(false);
                          (navigation as any).navigate("PostDetail", { postId: post.id });
                        }}
                      >
                        <Ionicons name="eye-outline" size={18} color={theme.colors.black} />
                      </Pressable>
                      <Pressable style={styles.communityPostDeleteBtn} onPress={() => handleDeleteCommunityPost(post.id)} disabled={actionLoading}>
                        <Ionicons name="trash-outline" size={18} color={theme.colors.white} />
                      </Pressable>
                    </HStack>
                  </HStack>
                ))}

                {postsTotalPages > 1 && (
                  <HStack justifyContent="center" space="md" style={sharedStyles.paginationContainer}>
                    <Pressable
                      disabled={postsPage <= 1}
                      onPress={() => selectedCommunityId && postsPage > 1 && fetchCommunityPosts(selectedCommunityId, postsPage - 1)}
                      style={{ opacity: postsPage <= 1 ? 0.3 : 1 }}
                    >
                      <Ionicons name="chevron-back" size={24} color={theme.colors.black} />
                    </Pressable>
                    <Text style={sharedStyles.pageInfo}>第 {postsPage} 页 / 共 {postsTotalPages} 页</Text>
                    <Pressable
                      disabled={postsPage >= postsTotalPages}
                      onPress={() => selectedCommunityId && postsPage < postsTotalPages && fetchCommunityPosts(selectedCommunityId, postsPage + 1)}
                      style={{ opacity: postsPage >= postsTotalPages ? 0.3 : 1 }}
                    >
                      <Ionicons name="chevron-forward" size={24} color={theme.colors.black} />
                    </Pressable>
                  </HStack>
                )}
              </ScrollView>
            )}
          </Box>
        </Box>
      </Modal>
    </Box>
  );
};

const styles = StyleSheet.create({
  communitiesList: {
    flex: 1,
    padding: theme.spacing.md,
  },
  addCommunityButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.black,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  addCommunityButtonText: {
    ...theme.typography.button,
    color: theme.colors.white,
  },
  communitiesHeader: {
    marginBottom: theme.spacing.md,
  },
  communitiesHeaderText: {
    ...theme.typography.bodySmall,
    color: theme.colors.gray400,
  },
  communityCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    overflow: "hidden",
    marginBottom: theme.spacing.md,
    ...theme.shadows.sm,
  },
  communityCoverImage: {
    width: "100%",
    height: 100,
    backgroundColor: theme.colors.gray100,
  },
  communityCoverPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  communityStatusBadge: {
    position: "absolute",
    top: theme.spacing.sm,
    right: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
  },
  communityStatusActive: {
    backgroundColor: theme.colors.success,
  },
  communityStatusInactive: {
    backgroundColor: theme.colors.gray400,
  },
  communityStatusText: {
    ...theme.typography.caption,
    color: theme.colors.white,
    fontWeight: "600",
  },
  communityOfficialBadge: {
    position: "absolute",
    top: theme.spacing.sm,
    left: theme.spacing.sm,
    backgroundColor: "#FFD700",
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
  },
  communityOfficialText: {
    ...theme.typography.caption,
    color: theme.colors.black,
    fontWeight: "600",
  },
  communityInfo: {
    padding: theme.spacing.md,
  },
  communityHeader: {
    alignItems: "center",
    marginBottom: theme.spacing.sm,
  },
  communityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.gray100,
  },
  communityIconPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  communityIconText: {
    ...theme.typography.h4,
    color: theme.colors.gray400,
  },
  communityTitleContainer: {
    flex: 1,
    marginLeft: theme.spacing.sm,
  },
  communityTitle: {
    ...theme.typography.h4,
    color: theme.colors.black,
  },
  communitySlug: {
    ...theme.typography.caption,
    color: theme.colors.gray300,
  },
  communityDescription: {
    ...theme.typography.bodySmall,
    color: theme.colors.gray400,
    marginBottom: theme.spacing.sm,
  },
  communityMeta: {
    alignItems: "center",
    gap: theme.spacing.md,
  },
  communityMetaItem: {
    alignItems: "center",
    gap: 4,
  },
  communityMetaText: {
    ...theme.typography.caption,
    color: theme.colors.gray400,
  },
  communityCategory: {
    ...theme.typography.caption,
    color: theme.colors.white,
    backgroundColor: theme.colors.black,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: "hidden",
  },
  communityActions: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray100,
  },
  communityActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: theme.spacing.sm,
    gap: 4,
  },
  communityActionText: {
    ...theme.typography.caption,
    color: theme.colors.white,
    fontWeight: "600",
  },
  communityPostsBtn: {
    backgroundColor: "#3B82F6",
  },
  communityEditBtn: {
    backgroundColor: theme.colors.black,
  },
  communityEnableBtn: {
    backgroundColor: theme.colors.success,
  },
  communityDisableBtn: {
    backgroundColor: "#F59E0B",
  },
  communityDeleteBtn: {
    backgroundColor: theme.colors.error,
  },
  communityModalContent: {
    height: "85%",
    width: "92%",
    padding: theme.spacing.lg,
  },
  communityFormImageRow: {
    alignItems: "center",
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  communityFormIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.colors.gray100,
  },
  communityFormIconPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  communityFormCover: {
    width: "100%",
    height: 120,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.gray100,
    marginBottom: theme.spacing.sm,
  },
  communityFormCoverPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  communityPostsModalContent: {
    height: "80%",
    width: "92%",
    padding: 0,
  },
  communityPostsHeader: {
    alignItems: "center",
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray100,
  },
  communityPostsCloseBtn: {
    padding: theme.spacing.xs,
  },
  communityPostsTitle: {
    ...theme.typography.h4,
    color: theme.colors.black,
    flex: 1,
    marginLeft: theme.spacing.sm,
  },
  communityPostsCount: {
    ...theme.typography.caption,
    color: theme.colors.gray400,
  },
  communityPostsList: {
    flex: 1,
    padding: theme.spacing.md,
  },
  communityPostCard: {
    alignItems: "center",
    backgroundColor: theme.colors.gray50,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  communityPostInfo: {
    flex: 1,
  },
  communityPostId: {
    ...theme.typography.caption,
    color: theme.colors.gray300,
    marginBottom: 2,
  },
  communityPostTitle: {
    ...theme.typography.bodySmall,
    color: theme.colors.black,
    fontWeight: "500",
    marginBottom: 4,
  },
  communityPostMeta: {
    gap: theme.spacing.sm,
  },
  communityPostAuthor: {
    ...theme.typography.caption,
    color: theme.colors.gray400,
  },
  communityPostDate: {
    ...theme.typography.caption,
    color: theme.colors.gray300,
  },
  communityPostActions: {
    gap: theme.spacing.xs,
  },
  communityPostViewBtn: {
    backgroundColor: theme.colors.gray200,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
  },
  communityPostDeleteBtn: {
    backgroundColor: theme.colors.error,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
  },
});

export default CommunitiesTab;
