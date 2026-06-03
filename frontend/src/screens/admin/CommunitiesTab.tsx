import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  RefreshControl,
  Alert,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { theme, useThemedStyles, type AppTheme } from "../../theme";
import {
  adminService,
  AdminCommunity,
  CommunityCategory,
  CreateCommunityParams,
  UpdateCommunityParams,
} from "../../services/adminService";
import { Post } from "../../services/postService";
import { useSharedStyles } from "./adminStyles";
import { formatDate, pickAndUploadImage } from "./adminUtils";
import { Box, HStack, Text, Input, Button, ButtonText, Pressable, ScrollView, OptimizedImage } from "../../components/ui";
import { ImageSize } from "../../utils/imageUtils";
import { FullscreenImageViewer } from "../../components/PostDetail";

const getCategoryNames = (t: (key: string) => string): Record<CommunityCategory, string> => ({
  GENERAL: t("admin.categoryGeneral"),
  FASHION: t("admin.categoryFashion"),
  LIFESTYLE: t("admin.categoryLifestyle"),
  BEAUTY: t("admin.categoryBeauty"),
  CULTURE: t("admin.categoryCulture"),
});

const CommunitiesTab = () => {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const styles = useThemedStyles(makeStyles);
  const sharedStyles = useSharedStyles();
  const CATEGORY_NAMES = getCategoryNames(t);
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

  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [detailCommunity, setDetailCommunity] = useState<AdminCommunity | null>(null);
  const [fullscreenVisible, setFullscreenVisible] = useState(false);
  const [fullscreenImages, setFullscreenImages] = useState<string[]>([]);
  const [fullscreenIndex, setFullscreenIndex] = useState(0);

  const fetchCommunities = useCallback(async () => {
    try {
      setLoading(true);
      const result = await adminService.getAllCommunities(true);
      setCommunities(result);
    } catch (error) {
      console.error("fetchCommunities error:", error);
      Alert.alert(t("admin.error"), error instanceof Error ? error.message : t("admin.operationFailed"));
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
      console.error("fetchCommunityPosts error:", error);
      Alert.alert(t("admin.error"), error instanceof Error ? error.message : t("admin.fetchPostsFailed"));
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
      Alert.alert(t("admin.error"), t("admin.communityNameRequired"));
      return;
    }
    if (!form.slug.trim()) {
      Alert.alert(t("admin.error"), t("admin.communitySlugRequired"));
      return;
    }
    if (!/^[a-z0-9-]+$/.test(form.slug)) {
      Alert.alert(t("admin.error"), t("admin.communitySlugFormat"));
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
        Alert.alert(t("common.success"), t("admin.communityUpdated"));
      } else {
        await adminService.createCommunity(form);
        Alert.alert(t("common.success"), t("admin.communityCreated"));
      }
      setModalVisible(false);
      fetchCommunities();
    } catch (error) {
      Alert.alert(t("admin.error"), error instanceof Error ? error.message : t("admin.operationFailed"));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (communityId: number, communityName: string) => {
    Alert.alert(t("admin.confirmDelete"), t("admin.confirmDeleteCommunity", { name: communityName }), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: async () => {
          try {
            setActionLoading(true);
            await adminService.deleteCommunity(communityId);
            Alert.alert(t("common.success"), t("admin.communityDeleted"));
            fetchCommunities();
          } catch (error) {
            Alert.alert(t("admin.error"), error instanceof Error ? error.message : t("admin.deleteFailed"));
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
      Alert.alert(t("common.success"), community.isActive ? t("admin.communityDisabled") : t("admin.communityEnabled"));
      fetchCommunities();
    } catch (error) {
      Alert.alert(t("admin.error"), error instanceof Error ? error.message : t("admin.operationFailed"));
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
        Alert.alert(t("common.success"), t("admin.iconUploaded"));
      }
    } catch (error) {
      Alert.alert(t("admin.error"), error instanceof Error ? error.message : t("admin.uploadFailed"));
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
        Alert.alert(t("common.success"), t("admin.coverUploaded"));
      }
    } catch (error) {
      Alert.alert(t("admin.error"), error instanceof Error ? error.message : t("admin.uploadFailed"));
    } finally {
      setCoverUploading(false);
    }
  };

  const handleOpenCommunityDetail = (community: AdminCommunity) => {
    setDetailCommunity(community);
    setDetailModalVisible(true);
  };

  const openCoverFullscreen = (coverUrl?: string | null) => {
    if (!coverUrl) return;
    setFullscreenImages([coverUrl]);
    setFullscreenIndex(0);
    setFullscreenVisible(true);
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
    Alert.alert(t("admin.confirmDelete"), t("admin.confirmDeletePost"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: async () => {
          try {
            setActionLoading(true);
            await adminService.deleteCommunityPost(selectedCommunityId, postId);
            Alert.alert(t("common.success"), t("admin.postDeleted"));
            fetchCommunityPosts(selectedCommunityId, postsPage);
            fetchCommunities();
          } catch (error) {
            Alert.alert(t("admin.error"), error instanceof Error ? error.message : t("admin.deleteFailed"));
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  };

  const renderCommunityCard = (community: AdminCommunity) => (
    <Box key={community.id} style={styles.communityCard}>
      <Pressable onPress={() => handleOpenCommunityDetail(community)}>
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
            <Ionicons name="image-outline" size={28} color={theme.colors.gray300} />
          </Box>
        )}
      </Pressable>

      <Box style={[styles.communityStatusBadge, community.isActive ? styles.communityStatusActive : styles.communityStatusInactive]}>
        <Text style={styles.communityStatusText}>{community.isActive ? t("admin.communityActiveLabel") : t("admin.communityInactiveLabel")}</Text>
      </Box>

      {community.isOfficial && (
        <Box style={styles.communityOfficialBadge}>
          <Text style={styles.communityOfficialText}>{t("admin.communityOfficial")}</Text>
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
            <Ionicons name="people-outline" size={12} color={theme.colors.gray400} />
            <Text style={styles.communityMetaText}>{community.memberCount} {t("community.members")}</Text>
          </HStack>
          <HStack style={styles.communityMetaItem}>
            <Ionicons name="document-text-outline" size={12} color={theme.colors.gray400} />
            <Text style={styles.communityMetaText}>{community.postCount} {t("community.posts")}</Text>
          </HStack>
          <HStack style={styles.communityMetaItem}>
            <Text style={styles.communityCategory}>{CATEGORY_NAMES[community.category]}</Text>
          </HStack>
        </HStack>
      </Box>

      <HStack style={styles.communityActions}>
        <Pressable style={[styles.communityActionBtn, styles.communityPostsBtn]} onPress={() => handleOpenCommunityPosts(community)} disabled={actionLoading}>
          <Ionicons name="list-outline" size={16} color={theme.colors.white} />
          <Text style={styles.communityActionText}>{t("admin.posts")}</Text>
        </Pressable>
        <Pressable style={[styles.communityActionBtn, styles.communityEditBtn]} onPress={() => handleOpenEditModal(community)} disabled={actionLoading}>
          <Ionicons name="create-outline" size={16} color={theme.colors.white} />
          <Text style={styles.communityActionText}>{t("common.edit")}</Text>
        </Pressable>
        <Pressable style={[styles.communityActionBtn, community.isActive ? styles.communityDisableBtn : styles.communityEnableBtn]} onPress={() => handleToggleStatus(community)} disabled={actionLoading}>
          <Ionicons name={community.isActive ? "eye-off-outline" : "eye-outline"} size={16} color={theme.colors.white} />
        </Pressable>
        <Pressable style={[styles.communityActionBtn, styles.communityDeleteBtn]} onPress={() => handleDelete(community.id, community.name)} disabled={actionLoading}>
          <Ionicons name="trash-outline" size={16} color={theme.colors.white} />
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
          <Ionicons name="add-circle-outline" size={20} color={theme.colors.white} />
          <Text style={styles.addCommunityButtonText}>{t("admin.createCommunity")}</Text>
        </Pressable>

        {loading && communities.length === 0 ? (
          <Box style={sharedStyles.loadingContainer}>
            <ActivityIndicator color={theme.colors.black} />
            <Text style={sharedStyles.loadingText}>{t("common.loading")}</Text>
          </Box>
        ) : communities.length === 0 ? (
          <Box style={sharedStyles.emptyContainer}>
            <Ionicons name="people-outline" size={40} color={theme.colors.gray300} />
            <Text style={sharedStyles.emptyText}>{t("admin.noCommunities")}</Text>
            <Text style={sharedStyles.emptySubtext}>{t("admin.noCommunitiesHint")}</Text>
          </Box>
        ) : (
          <>
            <Box style={styles.communitiesHeader}>
              <Text style={styles.communitiesHeaderText}>{t("admin.totalCommunities", { count: communities.length })}</Text>
            </Box>
            {communities.map(renderCommunityCard)}
          </>
        )}
        <Box style={{ height: 40 }} />
      </ScrollView>

      {/* Community Edit Modal */}
      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
        <Box style={sharedStyles.modalOverlay}>
          <Box style={[sharedStyles.modalContent, styles.communityModalContent]}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
              <Text style={sharedStyles.modalTitle}>{editingCommunity ? t("admin.editCommunity") : t("admin.createCommunity")}</Text>

              <Text style={sharedStyles.formLabel}>{t("admin.communityIcon")}</Text>
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
                    <Ionicons name="image-outline" size={20} color={theme.colors.gray300} />
                  </Box>
                )}
                <Pressable style={sharedStyles.uploadSmallButton} onPress={handleUploadIcon} disabled={iconUploading}>
                  {iconUploading ? (
                    <ActivityIndicator color={theme.colors.white} size="small" />
                  ) : (
                    <Text style={sharedStyles.uploadSmallButtonText}>{form.iconUrl ? t("admin.changeIcon") : t("admin.uploadIcon")}</Text>
                  )}
                </Pressable>
              </HStack>

              <Text style={sharedStyles.formLabel}>{t("admin.communityCover")}</Text>
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
                  <Ionicons name="image-outline" size={28} color={theme.colors.gray300} />
                </Box>
              )}
              <Pressable style={sharedStyles.uploadImageButton} onPress={handleUploadCover} disabled={coverUploading}>
                {coverUploading ? (
                  <ActivityIndicator color={theme.colors.white} size="small" />
                ) : (
                  <>
                    <Ionicons name="cloud-upload-outline" size={18} color={theme.colors.white} />
                    <Text style={sharedStyles.uploadImageButtonText}>{form.coverUrl ? t("admin.changeCover") : t("admin.uploadCover")}</Text>
                  </>
                )}
              </Pressable>

              <Text style={sharedStyles.formLabel}>{t("admin.communityNameLabel")}</Text>
              <Input
                style={sharedStyles.modalInput}
                placeholder={t("admin.communityNamePlaceholder")}
                placeholderTextColor={theme.colors.gray300}
                value={form.name}
                onChangeText={(text: string) => setForm((prev) => ({ ...prev, name: text }))}
                variant="outline"
                size="md"
              />

              <Text style={sharedStyles.formLabel}>{t("admin.communitySlugLabel")}</Text>
              <Input
                style={sharedStyles.modalInput}
                placeholder={t("admin.communitySlugPlaceholder")}
                placeholderTextColor={theme.colors.gray300}
                value={form.slug}
                onChangeText={(text: string) => setForm((prev) => ({ ...prev, slug: text.toLowerCase() }))}
                autoCapitalize="none"
                editable={!editingCommunity}
                variant="outline"
                size="md"
              />
              {editingCommunity && <Text style={sharedStyles.formHint}>{t("admin.communitySlugImmutable")}</Text>}

              <Text style={sharedStyles.formLabel}>{t("admin.description")}</Text>
              <Input
                style={[sharedStyles.modalInput, { minHeight: 80 }]}
                placeholder={t("admin.communityDescPlaceholder")}
                placeholderTextColor={theme.colors.gray300}
                value={form.description}
                onChangeText={(text: string) => setForm((prev) => ({ ...prev, description: text }))}
                multiline
                numberOfLines={3}
                variant="outline"
                size="md"
              />

              <Text style={sharedStyles.formLabel}>{t("admin.category")}</Text>
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

              <Text style={sharedStyles.formLabel}>{t("admin.sortOrder")}</Text>
              <Input
                style={sharedStyles.modalInput}
                placeholder={t("admin.sortOrderPlaceholder")}
                placeholderTextColor={theme.colors.gray300}
                value={String(form.sortOrder || 0)}
                onChangeText={(text: string) => setForm((prev) => ({ ...prev, sortOrder: parseInt(text) || 0 }))}
                keyboardType="numeric"
                variant="outline"
                size="md"
              />

              <Pressable style={sharedStyles.statusToggle} onPress={() => setForm((prev) => ({ ...prev, isOfficial: !prev.isOfficial }))}>
                <Text style={sharedStyles.formLabel}>{t("admin.communityOfficial")}</Text>
                <Box style={[sharedStyles.statusToggleSwitch, form.isOfficial && sharedStyles.statusToggleSwitchActive]}>
                  <Box style={[sharedStyles.statusToggleThumb, form.isOfficial && sharedStyles.statusToggleThumbActive]} />
                </Box>
              </Pressable>

              {editingCommunity && (
                <Pressable style={sharedStyles.statusToggle} onPress={() => setForm((prev) => ({ ...prev, isActive: !prev.isActive }))}>
                  <Text style={sharedStyles.formLabel}>{t("admin.activeStatus")}</Text>
                  <Box style={[sharedStyles.statusToggleSwitch, form.isActive && sharedStyles.statusToggleSwitchActive]}>
                    <Box style={[sharedStyles.statusToggleThumb, form.isActive && sharedStyles.statusToggleThumbActive]} />
                  </Box>
                </Pressable>
              )}

              <Box style={sharedStyles.modalButtons}>
                <Button variant="outline" size="sm" onPress={() => setModalVisible(false)}>
                  <ButtonText style={{ color: theme.colors.gray400 }}>{t("common.cancel")}</ButtonText>
                </Button>
                <Button
                  size="sm"
                  onPress={handleSave}
                  disabled={actionLoading}
                  isLoading={actionLoading}
                >
                  <ButtonText>{editingCommunity ? t("admin.saveChanges") : t("admin.createCommunity")}</ButtonText>
                </Button>
              </Box>
            </ScrollView>
          </Box>
        </Box>
        </KeyboardAvoidingView>
      </Modal>

      {/* Community Posts Modal */}
      <Modal visible={postsModalVisible} transparent animationType="fade" onRequestClose={() => setPostsModalVisible(false)}>
        <Box style={sharedStyles.modalOverlay}>
          <Box style={[sharedStyles.modalContent, styles.communityPostsModalContent]}>
            <HStack style={styles.communityPostsHeader}>
              <Pressable style={styles.communityPostsCloseBtn} onPress={() => setPostsModalVisible(false)}>
                <Ionicons name="close" size={22} color={theme.colors.black} />
              </Pressable>
              <Text style={styles.communityPostsTitle}>{selectedCommunityName}</Text>
              <Text style={styles.communityPostsCount}>{t("admin.totalPosts", { count: postsTotal })}</Text>
            </HStack>

            {postsLoading && communityPosts.length === 0 ? (
              <Box style={sharedStyles.loadingContainer}>
                <ActivityIndicator color={theme.colors.black} size="small" />
                <Text style={sharedStyles.loadingText}>{t("common.loading")}</Text>
              </Box>
            ) : communityPosts.length === 0 ? (
              <Box style={sharedStyles.emptyContainer}>
                <Ionicons name="document-text-outline" size={40} color={theme.colors.gray300} />
                <Text style={sharedStyles.emptyText}>{t("admin.noPosts")}</Text>
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
                        <Ionicons name="eye-outline" size={16} color={theme.colors.black} />
                      </Pressable>
                      <Pressable style={styles.communityPostDeleteBtn} onPress={() => handleDeleteCommunityPost(post.id)} disabled={actionLoading}>
                        <Ionicons name="trash-outline" size={16} color={theme.colors.white} />
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
                    <Text style={sharedStyles.pageInfo}>{t("admin.pagination", { page: postsPage, total: postsTotalPages })}</Text>
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

      {/* Community Detail Modal */}
      <Modal
        visible={detailModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <Box style={sharedStyles.modalOverlay}>
          <Box style={[sharedStyles.modalContent, styles.communityDetailModalContent]}>
            {detailCommunity ? (
              <>
                <HStack style={styles.communityDetailHeader}>
                  <Text style={styles.communityDetailTitle} numberOfLines={1}>
                    {detailCommunity.name}
                  </Text>
                  <Pressable
                    style={styles.communityDetailCloseBtn}
                    onPress={() => setDetailModalVisible(false)}
                  >
                    <Ionicons name="close" size={20} color={theme.colors.text} />
                  </Pressable>
                </HStack>

                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.communityDetailScroll}
                >
                  {detailCommunity.coverUrl ? (
                    <Pressable onPress={() => openCoverFullscreen(detailCommunity.coverUrl)}>
                      <OptimizedImage
                        uri={detailCommunity.coverUrl}
                        size={ImageSize.LARGE}
                        style={styles.communityDetailCover}
                        contentFit="cover"
                        lazy={true}
                      />
                    </Pressable>
                  ) : (
                    <Box
                      style={[
                        styles.communityDetailCover,
                        styles.communityCoverPlaceholder,
                      ]}
                    >
                      <Ionicons name="image-outline" size={32} color={theme.colors.gray300} />
                    </Box>
                  )}

                  <HStack style={styles.communityDetailIdentity}>
                    {detailCommunity.iconUrl ? (
                      <OptimizedImage
                        uri={detailCommunity.iconUrl}
                        size={ImageSize.THUMBNAIL}
                        style={styles.communityDetailIcon}
                        contentFit="cover"
                        lazy={true}
                      />
                    ) : (
                      <Box
                        style={[
                          styles.communityDetailIcon,
                          styles.communityIconPlaceholder,
                        ]}
                      >
                        <Text style={styles.communityIconText}>
                          {detailCommunity.name[0]}
                        </Text>
                      </Box>
                    )}
                    <Box style={{ flex: 1 }}>
                      <Text style={styles.communityTitle}>{detailCommunity.name}</Text>
                      <Text style={styles.communitySlug}>/{detailCommunity.slug}</Text>
                    </Box>
                  </HStack>

                  <HStack style={styles.communityDetailBadges}>
                    <Box
                      style={[
                        styles.communityDetailBadge,
                        detailCommunity.isActive
                          ? styles.communityStatusActive
                          : styles.communityStatusInactive,
                      ]}
                    >
                      <Text style={styles.communityStatusText}>
                        {detailCommunity.isActive
                          ? t("admin.communityActiveLabel")
                          : t("admin.communityInactiveLabel")}
                      </Text>
                    </Box>
                    {detailCommunity.isOfficial ? (
                      <Box style={[styles.communityDetailBadge, styles.communityOfficialBadge]}>
                        <Text style={styles.communityOfficialText}>
                          {t("admin.communityOfficial")}
                        </Text>
                      </Box>
                    ) : null}
                    <Box style={[styles.communityDetailBadge, styles.communityDetailCategoryBadge]}>
                      <Text style={styles.communityDetailCategoryText}>
                        {CATEGORY_NAMES[detailCommunity.category]}
                      </Text>
                    </Box>
                  </HStack>

                  <Text style={styles.communityDetailSectionTitle}>
                    {t("admin.communityIntro")}
                  </Text>
                  <Text style={styles.communityDetailDescription}>
                    {detailCommunity.description?.trim()
                      ? detailCommunity.description
                      : t("admin.communityNoDescription")}
                  </Text>

                  <Box style={styles.communityDetailMetaCard}>
                    <HStack style={styles.communityDetailMetaRow}>
                      <Text style={styles.communityDetailMetaLabel}>
                        {t("community.members")}
                      </Text>
                      <Text style={styles.communityDetailMetaValue}>
                        {detailCommunity.memberCount}
                      </Text>
                    </HStack>
                    <HStack style={styles.communityDetailMetaRow}>
                      <Text style={styles.communityDetailMetaLabel}>
                        {t("community.posts")}
                      </Text>
                      <Text style={styles.communityDetailMetaValue}>
                        {detailCommunity.postCount}
                      </Text>
                    </HStack>
                    <HStack style={styles.communityDetailMetaRow}>
                      <Text style={styles.communityDetailMetaLabel}>
                        {t("admin.sortOrder")}
                      </Text>
                      <Text style={styles.communityDetailMetaValue}>
                        {detailCommunity.sortOrder}
                      </Text>
                    </HStack>
                    <HStack style={styles.communityDetailMetaRow}>
                      <Text style={styles.communityDetailMetaLabel}>
                        {t("admin.communityIdLabel")}
                      </Text>
                      <Text style={styles.communityDetailMetaValue}>
                        #{detailCommunity.id}
                      </Text>
                    </HStack>
                    {detailCommunity.createdAt ? (
                      <HStack style={styles.communityDetailMetaRow}>
                        <Text style={styles.communityDetailMetaLabel}>
                          {t("admin.communityCreatedAt")}
                        </Text>
                        <Text style={styles.communityDetailMetaValue}>
                          {formatDate(detailCommunity.createdAt)}
                        </Text>
                      </HStack>
                    ) : null}
                    {detailCommunity.updatedAt ? (
                      <HStack style={styles.communityDetailMetaRow}>
                        <Text style={styles.communityDetailMetaLabel}>
                          {t("admin.communityUpdatedAt")}
                        </Text>
                        <Text style={styles.communityDetailMetaValue}>
                          {formatDate(detailCommunity.updatedAt)}
                        </Text>
                      </HStack>
                    ) : null}
                  </Box>

                  <HStack style={styles.communityDetailActions}>
                    <Button
                      size="sm"
                      style={{ flex: 1 }}
                      onPress={() => {
                        setDetailModalVisible(false);
                        handleOpenCommunityPosts(detailCommunity);
                      }}
                    >
                      <ButtonText>{t("admin.posts")}</ButtonText>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      style={{ flex: 1 }}
                      onPress={() => {
                        setDetailModalVisible(false);
                        handleOpenEditModal(detailCommunity);
                      }}
                    >
                      <ButtonText style={{ color: theme.colors.text }}>
                        {t("common.edit")}
                      </ButtonText>
                    </Button>
                  </HStack>
                </ScrollView>
              </>
            ) : null}
          </Box>
        </Box>
      </Modal>

      {fullscreenImages.length > 0 ? (
        <FullscreenImageViewer
          visible={fullscreenVisible}
          images={fullscreenImages}
          currentIndex={fullscreenIndex}
          onClose={() => setFullscreenVisible(false)}
          onIndexChange={setFullscreenIndex}
        />
      ) : null}
    </Box>
  );
};

const makeStyles = (t: AppTheme) => StyleSheet.create({
  communitiesList: {
    flex: 1,
    padding: 10,
  },
  addCommunityButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.text,
    paddingVertical: 8,
    borderRadius: 4,
    marginBottom: 10,
    gap: t.spacing.sm,
  },
  addCommunityButtonText: {
    ...t.typography.button,
    fontSize: 13,
    lineHeight: 17,
    color: t.colors.textInverted,
  },
  communitiesHeader: {
    marginBottom: t.spacing.sm,
  },
  communitiesHeaderText: {
    ...t.typography.bodySmall,
    fontSize: 12,
    lineHeight: 16,
    color: t.colors.gray400,
  },
  communityCard: {
    backgroundColor: t.colors.card,
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 10,
    ...t.shadows.sm,
  },
  communityCoverImage: {
    width: "100%",
    height: 80,
    backgroundColor: t.colors.gray100,
  },
  communityCoverPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  communityStatusBadge: {
    position: "absolute",
    top: t.spacing.sm,
    right: t.spacing.sm,
    paddingHorizontal: t.spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
  },
  communityStatusActive: {
    backgroundColor: t.colors.success,
  },
  communityStatusInactive: {
    backgroundColor: t.colors.gray400,
  },
  communityStatusText: {
    ...t.typography.caption,
    fontSize: 11,
    lineHeight: 14,
    color: t.colors.textInverted,
    fontWeight: "600",
  },
  communityOfficialBadge: {
    position: "absolute",
    top: t.spacing.sm,
    left: t.spacing.sm,
    backgroundColor: "#FFD700",
    paddingHorizontal: t.spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
  },
  communityOfficialText: {
    ...t.typography.caption,
    fontSize: 11,
    lineHeight: 14,
    color: "#000000",
    fontWeight: "600",
  },
  communityInfo: {
    padding: 10,
  },
  communityHeader: {
    alignItems: "center",
    marginBottom: 6,
  },
  communityIcon: {
    width: 32,
    height: 32,
    borderRadius: 4,
    backgroundColor: t.colors.gray100,
  },
  communityIconPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  communityIconText: {
    ...t.typography.h4,
    fontSize: 14,
    lineHeight: 18,
    color: t.colors.gray400,
  },
  communityTitleContainer: {
    flex: 1,
    marginLeft: t.spacing.sm,
  },
  communityTitle: {
    ...t.typography.h4,
    fontSize: 14,
    lineHeight: 18,
    color: t.colors.text,
  },
  communitySlug: {
    ...t.typography.caption,
    fontSize: 11,
    lineHeight: 14,
    color: t.colors.gray300,
  },
  communityDescription: {
    ...t.typography.bodySmall,
    fontSize: 12,
    lineHeight: 16,
    color: t.colors.gray400,
    marginBottom: 6,
  },
  communityMeta: {
    alignItems: "center",
    gap: 10,
  },
  communityMetaItem: {
    alignItems: "center",
    gap: 3,
  },
  communityMetaText: {
    ...t.typography.caption,
    fontSize: 11,
    lineHeight: 14,
    color: t.colors.gray400,
  },
  communityCategory: {
    ...t.typography.caption,
    fontSize: 11,
    lineHeight: 14,
    color: t.colors.textInverted,
    backgroundColor: t.colors.text,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: "hidden",
  },
  communityActions: {
    borderTopWidth: 1,
    borderTopColor: t.colors.border,
  },
  communityActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 7,
    gap: 4,
  },
  communityActionText: {
    ...t.typography.caption,
    fontSize: 11,
    lineHeight: 14,
    color: t.colors.textInverted,
    fontWeight: "600",
  },
  communityPostsBtn: {
    backgroundColor: "#3B82F6",
  },
  communityEditBtn: {
    backgroundColor: t.colors.text,
  },
  communityEnableBtn: {
    backgroundColor: t.colors.success,
  },
  communityDisableBtn: {
    backgroundColor: "#F59E0B",
  },
  communityDeleteBtn: {
    backgroundColor: t.colors.error,
  },
  communityModalContent: {
    height: "85%",
    width: "92%",
    padding: 12,
  },
  communityFormImageRow: {
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  communityFormIcon: {
    width: 48,
    height: 48,
    borderRadius: 4,
    backgroundColor: t.colors.gray100,
  },
  communityFormIconPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  communityFormCover: {
    width: "100%",
    height: 100,
    borderRadius: 4,
    backgroundColor: t.colors.gray100,
    marginBottom: 6,
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
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.border,
  },
  communityPostsCloseBtn: {
    padding: t.spacing.xs,
  },
  communityPostsTitle: {
    ...t.typography.h4,
    fontSize: 14,
    lineHeight: 18,
    color: t.colors.text,
    flex: 1,
    marginLeft: t.spacing.sm,
  },
  communityPostsCount: {
    ...t.typography.caption,
    fontSize: 11,
    lineHeight: 14,
    color: t.colors.gray400,
  },
  communityPostsList: {
    flex: 1,
    padding: 10,
  },
  communityPostCard: {
    alignItems: "center",
    backgroundColor: t.colors.gray50,
    borderRadius: 4,
    padding: 10,
    marginBottom: 6,
  },
  communityPostInfo: {
    flex: 1,
  },
  communityPostId: {
    ...t.typography.caption,
    fontSize: 11,
    lineHeight: 14,
    color: t.colors.gray300,
    marginBottom: 2,
  },
  communityPostTitle: {
    ...t.typography.bodySmall,
    fontSize: 12,
    lineHeight: 16,
    color: t.colors.text,
    fontWeight: "500",
    marginBottom: 3,
  },
  communityPostMeta: {
    gap: t.spacing.sm,
  },
  communityPostAuthor: {
    ...t.typography.caption,
    fontSize: 11,
    lineHeight: 14,
    color: t.colors.gray400,
  },
  communityPostDate: {
    ...t.typography.caption,
    fontSize: 11,
    lineHeight: 14,
    color: t.colors.gray300,
  },
  communityPostActions: {
    gap: t.spacing.xs,
  },
  communityPostViewBtn: {
    backgroundColor: t.colors.gray200,
    padding: 7,
    borderRadius: 4,
  },
  communityPostDeleteBtn: {
    backgroundColor: t.colors.error,
    padding: 7,
    borderRadius: 4,
  },
  communityDetailModalContent: {
    height: "88%",
    width: "92%",
    padding: 10,
  },
  communityDetailHeader: {
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  communityDetailTitle: {
    ...t.typography.h4,
    fontSize: 15,
    lineHeight: 20,
    color: t.colors.text,
    flex: 1,
    marginRight: t.spacing.sm,
  },
  communityDetailCloseBtn: {
    padding: t.spacing.xs,
  },
  communityDetailScroll: {
    paddingBottom: t.spacing.lg,
  },
  communityDetailCover: {
    width: "100%",
    height: 140,
    borderRadius: 4,
    backgroundColor: t.colors.gray100,
    marginBottom: 10,
  },
  communityDetailIdentity: {
    alignItems: "center",
    marginBottom: 6,
  },
  communityDetailIcon: {
    width: 40,
    height: 40,
    borderRadius: 4,
    backgroundColor: t.colors.gray100,
    marginRight: t.spacing.sm,
  },
  communityDetailBadges: {
    flexWrap: "wrap",
    gap: t.spacing.xs,
    marginBottom: 10,
  },
  communityDetailBadge: {
    paddingHorizontal: t.spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
  },
  communityDetailCategoryBadge: {
    backgroundColor: t.colors.text,
  },
  communityDetailCategoryText: {
    ...t.typography.caption,
    fontSize: 11,
    lineHeight: 14,
    color: t.colors.textInverted,
    fontWeight: "600",
  },
  communityDetailSectionTitle: {
    ...t.typography.bodySmall,
    fontSize: 12,
    lineHeight: 16,
    color: t.colors.gray300,
    fontWeight: "600",
    marginBottom: t.spacing.xs,
  },
  communityDetailDescription: {
    ...t.typography.body,
    fontSize: 13,
    lineHeight: 18,
    color: t.colors.text,
    marginBottom: 10,
  },
  communityDetailMetaCard: {
    backgroundColor: t.colors.surface,
    borderRadius: 4,
    padding: 10,
    marginBottom: 10,
    gap: 6,
  },
  communityDetailMetaRow: {
    justifyContent: "space-between",
    alignItems: "center",
  },
  communityDetailMetaLabel: {
    ...t.typography.bodySmall,
    fontSize: 12,
    lineHeight: 16,
    color: t.colors.gray400,
  },
  communityDetailMetaValue: {
    ...t.typography.bodySmall,
    fontSize: 12,
    lineHeight: 16,
    color: t.colors.text,
    fontWeight: "500",
  },
  communityDetailActions: {
    gap: t.spacing.sm,
  },
});

export default CommunitiesTab;
