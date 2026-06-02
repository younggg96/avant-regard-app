import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  LayoutChangeEvent,
} from "react-native";
import { useTranslation } from "react-i18next";
import { Alert } from "../utils/Alert";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { theme, useThemedStyles, type AppTheme } from "../theme";
import { useAuthStore } from "../store/authStore";
import ScreenHeader from "../components/ScreenHeader";
import KeyboardFriend from "../components/KeyboardFriend";
import { userInfoService, Gender } from "../services/userInfoService";
import { brandService, Brand } from "../services/brandService";
import { OptimizedImage } from "../components/ui/OptimizedImage";
import { ImageSize } from "../utils/imageUtils";

// Brand 选项类型
interface BrandOption {
  id: number;
  name: string;
  category: string | null;
}

/**
 * ImagePicker gives us a local `file:///var/mobile/.../ImagePicker/xxx.jpg`
 * URI. We must upload that to CDN first and only persist the returned remote
 * URL. If the user tries to save before the upload finishes (or if it fails
 * silently), the local URI would otherwise get written into the DB and then
 * crash `next/image` on web (hostname "" is not configured).
 *
 * This guard is the single chokepoint for profile writes: anything that isn't
 * a real http(s) URL is treated as "no change" (server keeps its existing
 * value) instead of being persisted.
 */
const isPersistableRemoteUrl = (url: string): boolean =>
  /^https?:\/\//i.test(url.trim());

// 性别选项
const GENDER_KEYS: { value: Gender; key: string }[] = [
  { value: "MALE", key: "auth.male" },
  { value: "FEMALE", key: "auth.female" },
  { value: "OTHER", key: "auth.other" },
];

// 中国所有省份列表
const PROVINCES = [
  "北京市",
  "天津市",
  "上海市",
  "重庆市",
  "河北省",
  "山西省",
  "辽宁省",
  "吉林省",
  "黑龙江省",
  "江苏省",
  "浙江省",
  "安徽省",
  "福建省",
  "江西省",
  "山东省",
  "河南省",
  "湖北省",
  "湖南省",
  "广东省",
  "海南省",
  "四川省",
  "贵州省",
  "云南省",
  "陕西省",
  "甘肃省",
  "青海省",
  "台湾省",
  "内蒙古自治区",
  "广西壮族自治区",
  "西藏自治区",
  "宁夏回族自治区",
  "新疆维吾尔自治区",
  "香港特别行政区",
  "澳门特别行政区",
];

const EditProfileScreen = () => {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { user, updateProfile } = useAuthStore();
  const styles = useThemedStyles(makeStyles);

  // 表单数据
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [avatar, setAvatar] = useState("");
  const [cover, setCover] = useState("");
  const [gender, setGender] = useState<Gender>("OTHER");
  const [age, setAge] = useState<string>("");
  const [preference, setPreference] = useState("");
  const [selectedBrandIds, setSelectedBrandIds] = useState<number[]>([]);

  // 品牌选项（从 API 加载）
  const [brandOptions, setBrandOptions] = useState<BrandOption[]>([]);
  const [loadingBrands, setLoadingBrands] = useState(false);
  const [brandPage, setBrandPage] = useState(1);
  const [hasMoreBrands, setHasMoreBrands] = useState(true);
  const [loadingMoreBrands, setLoadingMoreBrands] = useState(false);
  const [brandSearchKeyword, setBrandSearchKeyword] = useState("");
  const brandPageSize = 50;

  // UI 状态
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [showProvinceModal, setShowProvinceModal] = useState(false);
  const [showGenderModal, setShowGenderModal] = useState(false);
  const [showBrandModal, setShowBrandModal] = useState(false);

  // 输入框引用
  const usernameInputRef = useRef<TextInput>(null);
  const bioInputRef = useRef<TextInput>(null);

  // ScrollView 引用和输入框位置跟踪
  const scrollViewRef = useRef<ScrollView>(null);
  const inputPositions = useRef<{ [key: string]: number }>({});

  // 记录输入框位置
  const handleInputLayout = (key: string) => (event: LayoutChangeEvent) => {
    inputPositions.current[key] = event.nativeEvent.layout.y;
  };

  // 输入框获得焦点时滚动到可见区域
  const scrollToInput = (key: string) => {
    const yOffset = inputPositions.current[key];
    if (yOffset !== undefined && scrollViewRef.current) {
      // 滚动到输入框位置，预留一些顶部空间
      scrollViewRef.current.scrollTo({
        y: Math.max(0, yOffset - 120),
        animated: true,
      });
    }
  };

  // 加载品牌数据（支持分页和搜索）
  const loadBrands = async (page: number = 1, keyword: string = "", reset: boolean = false) => {
    if (page === 1) {
      setLoadingBrands(true);
    } else {
      setLoadingMoreBrands(true);
    }

    try {
      const response = await brandService.getBrands({
        page,
        pageSize: brandPageSize,
        keyword: keyword || undefined,
      });

      const options: BrandOption[] = response.brands.map((b) => ({
        id: b.id,
        name: b.name,
        category: b.category || null,
      }));

      if (reset || page === 1) {
        setBrandOptions(options);
      } else {
        setBrandOptions((prev) => [...prev, ...options]);
      }

      // 检查是否还有更多数据
      const totalLoaded = page * brandPageSize;
      setHasMoreBrands(totalLoaded < response.total);
      setBrandPage(page);
    } catch (error) {
      console.error("Failed to load brands:", error);
    } finally {
      setLoadingBrands(false);
      setLoadingMoreBrands(false);
    }
  };

  // 加载更多品牌
  const loadMoreBrands = () => {
    if (loadingMoreBrands || !hasMoreBrands) return;
    loadBrands(brandPage + 1, brandSearchKeyword);
  };

  const handleBrandSearch = (keyword: string) => {
    setBrandSearchKeyword(keyword);
    if (!keyword.trim()) {
      setBrandPage(1);
      setHasMoreBrands(true);
      loadBrands(1, "", true);
    }
  };

  const handleBrandSearchSubmit = () => {
    setBrandPage(1);
    setHasMoreBrands(true);
    loadBrands(1, brandSearchKeyword, true);
  };

  // 初始加载品牌
  useEffect(() => {
    loadBrands(1, "", true);
  }, []);

  // 从 API 加载用户信息
  useEffect(() => {
    const loadData = async () => {
      if (!user?.userId) {
        setInitialLoading(false);
        return;
      }

      // 尝试加载完整用户资料
      try {
        const userProfile = await userInfoService.getUserProfile(user.userId);
        // 设置表单数据
        setUsername(userProfile.username || user.username || "");
        setBio(userProfile.bio || "");
        setLocation(userProfile.location || "");
        setAvatar(userProfile.avatarUrl || user.avatar || "");
        setCover(userProfile.coverUrl || "");
        setGender(userProfile.gender || "OTHER");
        setAge(userProfile.age ? String(userProfile.age) : "");
        setPreference(userProfile.preference || "");
        setSelectedBrandIds(userProfile.followedBrandIds || []);
      } catch (error) {
        console.warn("加载完整用户资料失败，尝试加载基本信息:", error);

        // 回退：尝试加载基本用户信息
        try {
          const userInfo = await userInfoService.getUserInfo(user.userId);
          setUsername(userInfo.username || user.username || "");
          setBio(userInfo.bio || "");
          setLocation(userInfo.location || "");
          setAvatar(userInfo.avatarUrl || user.avatar || "");
          setCover(userInfo.coverUrl || "");
        } catch (fallbackError) {
          console.warn("加载基本用户信息也失败，使用本地数据:", fallbackError);
          // 使用本地数据作为后备
          setUsername(user.username || "");
          setBio(user.bio || "");
          setLocation(user.location || "");
          setAvatar(user.avatar || "");
          setCover("");
        }
      }

      setInitialLoading(false);
    };

    loadData();
  }, [user?.userId]);

  // 保存用户资料
  const handleSave = async () => {
    if (!username.trim()) {
      Alert.show(t("editProfile.usernameRequired"));
      return;
    }

    if (!user?.userId) {
      Alert.show(t("editProfile.loginRequired"));
      return;
    }

    // Block save while an avatar/cover upload is still in-flight. Otherwise
    // the save payload would carry the local `file://` URI and poison the
    // stored profile. (See `isPersistableRemoteUrl` for the second defence.)
    if (uploadingAvatar || uploadingCover) {
      Alert.show(t("editProfile.uploadInProgress"));
      return;
    }

    // 验证年龄
    const ageNum = age ? parseInt(age, 10) : 0;
    if (age && (isNaN(ageNum) || ageNum < 0 || ageNum > 150)) {
      Alert.show(t("editProfile.invalidAge"));
      return;
    }

    setLoading(true);
    try {
      // Only persist avatar / cover if they are real CDN URLs. If the state
      // still holds a local `file://` URI (e.g. upload failed earlier), skip
      // the field entirely — backend treats the absence as "no change".
      const avatarUrlForSave = isPersistableRemoteUrl(avatar)
        ? avatar
        : undefined;
      const coverUrlForSave = isPersistableRemoteUrl(cover) ? cover : undefined;

      // 尝试调用 API 更新用户完整资料
      const updatedInfo = await userInfoService.updateUserProfile(user.userId, {
        username: username.trim(),
        bio: bio.trim(),
        location: location,
        avatarUrl: avatarUrlForSave,
        coverUrl: coverUrlForSave,
        gender: gender,
        age: ageNum,
        preference: preference.trim(),
        followedBrandIds: selectedBrandIds,
      });

      // 更新本地状态（仅保留服务端返回的远端 URL，避免把 file:// 写回 store）
      updateProfile({
        username: updatedInfo.username,
        bio: updatedInfo.bio,
        location: updatedInfo.location,
        avatar: updatedInfo.avatarUrl || avatarUrlForSave || undefined,
      });

      Alert.show(t("editProfile.saveSuccess"), "", 1000);
      setTimeout(() => navigation.goBack(), 1000);
    } catch (error) {
      console.warn("更新完整资料失败，尝试更新基本信息:", error);

      // 回退：尝试更新基本用户信息
      try {
        const updatedInfo = await userInfoService.updateUserInfo(user.userId, {
          username: username.trim(),
          bio: bio.trim(),
          location: location,
        });

        // 更新本地状态
        updateProfile({
          username: updatedInfo.username,
          bio: updatedInfo.bio,
          location: updatedInfo.location,
          avatar:
            updatedInfo.avatarUrl ||
            (isPersistableRemoteUrl(avatar) ? avatar : undefined),
        });

        Alert.show(t("editProfile.saveSuccess"), "", 1000);
        setTimeout(() => navigation.goBack(), 1000);
      } catch (fallbackError) {
        const message =
          fallbackError instanceof Error
            ? fallbackError.message
            : t("editProfile.saveFailed");
        Alert.show(message);
      }
    } finally {
      setLoading(false);
    }
  };

  // 选择并上传头像
  const handlePickImage = async () => {
    if (!user?.userId) {
      Alert.show(t("editProfile.loginRequired"));
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.show(t("common.photoPermissionRequired"));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled) return;

    const imageUri = result.assets[0].uri;
    const previousAvatar = avatar;

    // 先显示本地图片
    setAvatar(imageUri);
    setUploadingAvatar(true);

    try {
      // 上传到服务器
      const updatedInfo = await userInfoService.uploadAvatar(
        user.userId,
        imageUri
      );

      if (updatedInfo.avatarUrl) {
        setAvatar(updatedInfo.avatarUrl);
        // 更新本地存储
        updateProfile({ avatar: updatedInfo.avatarUrl });
        Alert.show(t("editProfile.avatarUploadSuccess"));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : t("common.uploadFailed");
      Alert.show(message);
      // 恢复原来的头像
      setAvatar(previousAvatar);
    } finally {
      setUploadingAvatar(false);
    }
  };

  // 选择并上传封面图片
  const handlePickCoverImage = async () => {
    if (!user?.userId) {
      Alert.show(t("editProfile.loginRequired"));
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.show(t("common.photoPermissionRequired"));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (result.canceled) return;

    const imageUri = result.assets[0].uri;
    const previousCover = cover;

    // 先显示本地图片
    setCover(imageUri);
    setUploadingCover(true);

    try {
      // 上传到服务器
      const updatedInfo = await userInfoService.uploadCover(
        user.userId,
        imageUri
      );

      if (updatedInfo.coverUrl) {
        setCover(updatedInfo.coverUrl);
        Alert.show(t("editProfile.coverUploadSuccess"));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : t("common.uploadFailed");
      Alert.show(message);
      // 恢复原来的封面
      setCover(previousCover);
    } finally {
      setUploadingCover(false);
    }
  };

  // 选择省份
  const handleSelectProvince = (province: string) => {
    setLocation(province);
    setShowProvinceModal(false);
  };

  // 选择性别
  const handleSelectGender = (selectedGender: Gender) => {
    setGender(selectedGender);
    setShowGenderModal(false);
  };

  // 获取性别标签
  const getGenderLabel = (value: Gender) => {
    const key = GENDER_KEYS.find((opt) => opt.value === value)?.key || "auth.other";
    return t(key);
  };

  // 切换品牌选择
  const handleToggleBrand = (brandId: number) => {
    setSelectedBrandIds((prev) => {
      if (prev.includes(brandId)) {
        return prev.filter((id) => id !== brandId);
      } else {
        if (prev.length >= 5) {
          Alert.show(t("profileReminder.maxBrandsHint"));
          return prev;
        }
        return [...prev, brandId];
      }
    });
  };

  // 获取已选品牌名称
  const getSelectedBrandNames = () => {
    return brandOptions
      .filter((b) => selectedBrandIds.includes(b.id))
      .map((b) => b.name)
      .join(", ");
  };

  // 加载中页面
  if (initialLoading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <ScreenHeader title={t("editProfile.title")} showBack={true} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={theme.colors.black} />
          <Text style={styles.loadingText}>{t("common.loading")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader
        title={t("editProfile.title")}
        showBack={true}
        rightActions={[
          {
            icon:
              loading || uploadingAvatar || uploadingCover
                ? "hourglass-outline"
                : "checkmark",
            onPress: handleSave,
          },
        ]}
      />

      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          {/* 头像区域 */}
          <View style={styles.avatarSection}>
            <TouchableOpacity
              style={styles.avatarContainer}
              onPress={handlePickImage}
              disabled={uploadingAvatar}
            >
              {avatar ? (
                <OptimizedImage
                  uri={avatar}
                  size={ImageSize.THUMBNAIL}
                  style={styles.avatar}
                  contentFit="cover"
                  lazy={false}
                />
              ) : (
                <View style={[styles.avatar, styles.avatarEmpty]}>
                  <Text style={styles.avatarEmptyText}>
                    {username?.slice(0, 2).toUpperCase() || "AG"}
                  </Text>
                </View>
              )}
              {uploadingAvatar ? (
                <View style={styles.avatarLoadingOverlay}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                </View>
              ) : (
                <View style={styles.avatarEditIcon}>
                  <Ionicons
                    name="camera"
                    size={20}
                    color={theme.colors.white}
                  />
                </View>
              )}
            </TouchableOpacity>
            <Text style={styles.avatarHint}>
              {uploadingAvatar ? t("publish.uploading") : t("editProfile.changeAvatar")}
            </Text>
          </View>
          {/* 封面图片区域 */}
          <View style={styles.coverSection}>
            <TouchableOpacity
              style={styles.coverContainer}
              onPress={handlePickCoverImage}
              disabled={uploadingCover}
            >
              {cover ? (
                <OptimizedImage
                  uri={cover}
                  size={ImageSize.LARGE}
                  style={styles.coverImage}
                  contentFit="cover"
                  lazy={false}
                />
              ) : (
                <View style={styles.coverPlaceholder}>
                  <Ionicons
                    name="image-outline"
                    size={32}
                    color={theme.colors.gray400}
                  />
                  <Text style={styles.coverPlaceholderText}>{t("editProfile.addCoverImage")}</Text>
                </View>
              )}
              {uploadingCover ? (
                <View style={styles.coverLoadingOverlay}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={styles.coverLoadingText}>{t("publish.uploading")}</Text>
                </View>
              ) : (
                <View style={styles.coverEditIcon}>
                  <Ionicons
                    name="camera"
                    size={18}
                    color={theme.colors.white}
                  />
                </View>
              )}
            </TouchableOpacity>
            <Text style={styles.coverHint}>
              {uploadingCover ? t("publish.uploading") : t("editProfile.changeCoverHint")}
            </Text>
          </View>
          {/* 表单区域 */}
          <View style={styles.formSection}>
            {/* 用户名 */}
            <View
              style={styles.inputGroup}
              onLayout={handleInputLayout("username")}
            >
              <Text style={styles.label}>{t("editProfile.username")} *</Text>
              <TextInput
                ref={usernameInputRef}
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                placeholder={t("auth.usernamePlaceholder")}
                placeholderTextColor={theme.colors.gray400}
                maxLength={20}
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => bioInputRef.current?.focus()}
                onFocus={() => scrollToInput("username")}
                autoComplete="username"
                textContentType="username"
              />
            </View>

            {/* 个人简介 */}
            <View style={styles.inputGroup} onLayout={handleInputLayout("bio")}>
              <Text style={styles.label}>{t("editProfile.bio")}</Text>
              <TextInput
                ref={bioInputRef}
                style={[styles.input, styles.textArea]}
                value={bio}
                onChangeText={setBio}
                placeholder={t("auth.bioPlaceholder")}
                placeholderTextColor={theme.colors.gray400}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                maxLength={200}
                returnKeyType="default"
                blurOnSubmit={false}
                onFocus={() => scrollToInput("bio")}
              />
              <Text style={styles.charCount}>{bio.length}/200</Text>
            </View>

            {/* 所在地 */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t("editProfile.location")}</Text>
              <TouchableOpacity
                style={styles.selectInput}
                onPress={() => setShowProvinceModal(true)}
              >
                <Text
                  style={[
                    styles.selectInputText,
                    !location && styles.selectInputPlaceholder,
                  ]}
                >
                  {location || t("editProfile.selectProvince")}
                </Text>
                <Ionicons
                  name="chevron-down"
                  size={20}
                  color={theme.colors.gray400}
                />
              </TouchableOpacity>
            </View>

            {/* 性别 */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t("editProfile.gender")}</Text>
              <TouchableOpacity
                style={styles.selectInput}
                onPress={() => setShowGenderModal(true)}
              >
                <Text style={styles.selectInputText}>
                  {getGenderLabel(gender)}
                </Text>
                <Ionicons
                  name="chevron-down"
                  size={20}
                  color={theme.colors.gray400}
                />
              </TouchableOpacity>
            </View>

            {/* 年龄 */}
            <View style={styles.inputGroup} onLayout={handleInputLayout("age")}>
              <Text style={styles.label}>{t("editProfile.age")}</Text>
              <TextInput
                style={styles.input}
                value={age}
                onChangeText={setAge}
                placeholder={t("editProfile.agePlaceholder")}
                placeholderTextColor={theme.colors.gray400}
                keyboardType="number-pad"
                maxLength={3}
                returnKeyType="next"
                onFocus={() => scrollToInput("age")}
              />
            </View>

            {/* 偏好 */}
            <View
              style={styles.inputGroup}
              onLayout={handleInputLayout("preference")}
            >
              <Text style={styles.label}>{t("editProfile.preference")}</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={preference}
                onChangeText={setPreference}
                placeholder={t("auth.preferencePlaceholder")}
                placeholderTextColor={theme.colors.gray400}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                maxLength={200}
                returnKeyType="default"
                blurOnSubmit={false}
                onFocus={() => scrollToInput("preference")}
              />
              <Text style={styles.charCount}>{preference.length}/200</Text>
            </View>

            {/* 关注的品牌 */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t("editProfile.favBrands")}</Text>
              <TouchableOpacity
                style={styles.selectInput}
                onPress={() => setShowBrandModal(true)}
              >
                <Text
                  style={[
                    styles.selectInputText,
                    selectedBrandIds.length === 0 &&
                    styles.selectInputPlaceholder,
                  ]}
                  numberOfLines={2}
                >
                  {selectedBrandIds.length > 0
                    ? getSelectedBrandNames()
                    : t("auth.brandPlaceholder")}
                </Text>
                <Ionicons
                  name="chevron-down"
                  size={20}
                  color={theme.colors.gray400}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* 底部留白 */}
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* 省份选择弹窗 */}
      <Modal
        visible={showProvinceModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowProvinceModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowProvinceModal(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={styles.modalContainer}
            onPress={() => { }}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t("editProfile.selectProvince")}</Text>
              <TouchableOpacity
                onPress={() => setShowProvinceModal(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color={theme.colors.black} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={PROVINCES}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.provinceItem,
                    location === item && styles.provinceItemSelected,
                  ]}
                  onPress={() => handleSelectProvince(item)}
                >
                  <Text
                    style={[
                      styles.provinceItemText,
                      location === item && styles.provinceItemTextSelected,
                    ]}
                  >
                    {item}
                  </Text>
                  {location === item && (
                    <Ionicons
                      name="checkmark"
                      size={20}
                      color={theme.colors.black}
                    />
                  )}
                </TouchableOpacity>
              )}
              showsVerticalScrollIndicator={false}
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* 性别选择弹窗 */}
      <Modal
        visible={showGenderModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowGenderModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowGenderModal(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={styles.genderModalContainer}
            onPress={() => { }}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t("editProfile.gender")}</Text>
              <TouchableOpacity
                onPress={() => setShowGenderModal(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color={theme.colors.black} />
              </TouchableOpacity>
            </View>
            {GENDER_KEYS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.provinceItem,
                  gender === option.value && styles.provinceItemSelected,
                ]}
                onPress={() => handleSelectGender(option.value)}
              >
                <Text
                  style={[
                    styles.provinceItemText,
                    gender === option.value && styles.provinceItemTextSelected,
                  ]}
                >
                  {t(option.key)}
                </Text>
                {gender === option.value && (
                  <Ionicons
                    name="checkmark"
                    size={20}
                    color={theme.colors.black}
                  />
                )}
              </TouchableOpacity>
            ))}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* 品牌选择弹窗 */}
      <Modal
        visible={showBrandModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowBrandModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowBrandModal(false)}
        >
          <KeyboardFriend mode="sheet" style={styles.modalContainer}>
            <TouchableOpacity activeOpacity={1} onPress={() => { }}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {t("profileReminder.selectBrandsTitle", { count: selectedBrandIds.length })}
              </Text>
              <TouchableOpacity
                onPress={() => setShowBrandModal(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color={theme.colors.black} />
              </TouchableOpacity>
            </View>

            {/* 搜索框 */}
            <View style={styles.brandSearchContainer}>
              <Ionicons name="search" size={18} color={theme.colors.gray400} />
              <TextInput
                style={styles.brandSearchInput}
                placeholder={t("auth.searchBrandPlaceholder")}
                placeholderTextColor={theme.colors.gray400}
                value={brandSearchKeyword}
                onChangeText={handleBrandSearch}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                onSubmitEditing={handleBrandSearchSubmit}
              />
              {brandSearchKeyword.length > 0 && (
                <TouchableOpacity onPress={() => handleBrandSearch("")}>
                  <Ionicons name="close-circle" size={18} color={theme.colors.gray400} />
                </TouchableOpacity>
              )}
            </View>

            {loadingBrands ? (
              <View style={styles.brandLoadingContainer}>
                <ActivityIndicator size="small" color={theme.colors.black} />
                <Text style={styles.brandLoadingText}>{t("common.loading")}</Text>
              </View>
            ) : (
              <FlatList
                data={brandOptions}
                keyExtractor={(item) => String(item.id)}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => {
                  const isSelected = selectedBrandIds.includes(item.id);
                  return (
                    <TouchableOpacity
                      style={[
                        styles.designerItem,
                        isSelected && styles.designerItemSelected,
                      ]}
                      onPress={() => handleToggleBrand(item.id)}
                    >
                      <View style={styles.designerInfo}>
                        <Text
                          style={[
                            styles.brandName,
                            isSelected && styles.designerNameSelected,
                          ]}
                        >
                          {item.name}
                        </Text>
                        {item.category && (
                          <Text style={styles.brandCategory}>
                            {item.category}
                          </Text>
                        )}
                      </View>
                      <View
                        style={[
                          styles.checkbox,
                          isSelected && styles.checkboxSelected,
                        ]}
                      >
                        {isSelected && (
                          <Ionicons
                            name="checkmark"
                            size={16}
                            color={theme.colors.white}
                          />
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                }}
                showsVerticalScrollIndicator={false}
                onEndReached={loadMoreBrands}
                onEndReachedThreshold={0.3}
                ListEmptyComponent={
                  <View style={styles.emptyList}>
                    <Text style={styles.emptyListText}>
                      {brandSearchKeyword ? t("auth.noBrandMatch") : t("auth.noBrands")}
                    </Text>
                  </View>
                }
                ListFooterComponent={
                  loadingMoreBrands ? (
                    <View style={styles.loadMoreContainer}>
                      <ActivityIndicator size="small" color={theme.colors.black} />
                      <Text style={styles.loadMoreText}>{t("common.loadMore")}</Text>
                    </View>
                  ) : hasMoreBrands && brandOptions.length > 0 ? (
                    <View style={styles.loadMoreContainer}>
                      <Text style={styles.loadMoreHint}>{t("auth.scrollForMore")}</Text>
                    </View>
                  ) : brandOptions.length > 0 ? (
                    <View style={styles.loadMoreContainer}>
                      <Text style={styles.loadMoreHint}>{t("auth.allBrandsLoaded")}</Text>
                    </View>
                  ) : null
                }
              />
            )}
            <TouchableOpacity
              style={styles.confirmButton}
              onPress={() => setShowBrandModal(false)}
            >
              <Text style={styles.confirmButtonText}>{t("common.confirm")}</Text>
            </TouchableOpacity>
            </TouchableOpacity>
          </KeyboardFriend>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: t.colors.background,
  },
  keyboardAvoid: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: t.colors.gray500,
  },
  // 头像区域
  avatarSection: {
    alignItems: "center",
    paddingVertical: 32,
  },
  avatarContainer: {
    position: "relative",
    marginBottom: 12,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: t.colors.skeleton,
  },
  avatarEmpty: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: t.colors.gray100,
  },
  avatarEmptyText: {
    fontSize: 28,
    fontWeight: "600",
    color: t.colors.gray400,
  },
  avatarEditIcon: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: t.colors.text,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: t.colors.card,
  },
  avatarLoadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 50,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarHint: {
    fontSize: 13,
    color: t.colors.gray500,
  },
  // 封面区域
  coverSection: {
    alignItems: "center",
    paddingTop: 16,
    paddingHorizontal: 20,
  },
  coverContainer: {
    width: "100%",
    height: 160,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: t.colors.gray100,
    position: "relative",
  },
  coverImage: {
    width: "100%",
    height: "100%",
  },
  coverPlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: t.colors.gray100,
  },
  coverPlaceholderText: {
    marginTop: 8,
    fontSize: 14,
    color: t.colors.gray400,
  },
  coverEditIcon: {
    position: "absolute",
    bottom: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  coverLoadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  coverLoadingText: {
    marginTop: 8,
    fontSize: 13,
    color: "#FFFFFF",
  },
  coverHint: {
    marginTop: 8,
    fontSize: 13,
    color: t.colors.gray500,
    textAlign: "center",
  },
  // 表单区域
  formSection: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: t.colors.text,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: t.colors.inputBorder,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: t.colors.text,
    backgroundColor: t.colors.inputBackground,
  },
  textArea: {
    height: 100,
    paddingTop: 12,
  },
  charCount: {
    fontSize: 12,
    color: t.colors.gray400,
    textAlign: "right",
    marginTop: 4,
  },
  // 选择器
  selectInput: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: t.colors.inputBorder,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: t.colors.inputBackground,
  },
  selectInputText: {
    fontSize: 15,
    color: t.colors.text,
  },
  selectInputPlaceholder: {
    color: t.colors.gray400,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: t.colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "70%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.border,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: t.colors.text,
  },
  modalCloseButton: {
    padding: 4,
  },
  provinceItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.colors.divider,
  },
  provinceItemSelected: {
    backgroundColor: t.colors.gray50,
  },
  provinceItemText: {
    fontSize: 15,
    color: t.colors.text,
  },
  provinceItemTextSelected: {
    fontWeight: "600",
  },
  selectedCount: {
    fontSize: 12,
    color: t.colors.gray500,
    marginTop: 6,
  },
  // 性别弹窗
  genderModalContainer: {
    backgroundColor: t.colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  // 设计师选择
  designerItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.colors.divider,
  },
  designerItemSelected: {
    backgroundColor: t.colors.gray50,
  },
  designerInfo: {
    flex: 1,
  },
  brandName: {
    fontSize: 15,
    color: t.colors.text,
  },
  designerNameSelected: {
    fontWeight: "600",
  },
  brandCategory: {
    fontSize: 12,
    color: t.colors.gray500,
    marginTop: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: t.colors.gray300,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxSelected: {
    backgroundColor: t.colors.text,
    borderColor: t.colors.text,
  },
  emptyList: {
    padding: 40,
    alignItems: "center",
  },
  emptyListText: {
    fontSize: 14,
    color: t.colors.gray500,
  },
  // 品牌搜索
  brandSearchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: t.colors.gray50,
    borderRadius: 10,
    gap: 8,
  },
  brandSearchInput: {
    flex: 1,
    fontSize: 15,
    color: t.colors.text,
    paddingVertical: 0,
  },
  brandLoadingContainer: {
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  brandLoadingText: {
    marginTop: 8,
    fontSize: 14,
    color: t.colors.gray500,
  },
  loadMoreContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 8,
  },
  loadMoreText: {
    fontSize: 13,
    color: t.colors.gray500,
  },
  loadMoreHint: {
    fontSize: 12,
    color: t.colors.gray400,
  },
  confirmButton: {
    margin: 20,
    backgroundColor: t.colors.text,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: t.colors.textInverted,
  },
});

export default EditProfileScreen;
