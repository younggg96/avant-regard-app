/**
 * 用户提交买手店页面
 * 布局风格与其他 Publish 页面保持一致
 */
import React, { useState } from "react";
import {
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
} from "react-native";
import { Alert } from "../utils/Alert";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import {
  Box,
  Text,
  Pressable,
  HStack,
  ScrollView,
  Input,
} from "../components/ui";
import { theme } from "../theme";
import ScreenHeader from "../components/ScreenHeader";
import ImageGridSelector from "../components/ImageGridSelector";
import ImagePreviewModal from "../components/ImagePreviewModal";
import BrandSelectorModal from "../components/BrandSelectorModal";
import { useAuthStore } from "../store/authStore";
import {
  submitStore,
  UserSubmittedStoreCreate,
} from "../services/buyerStoreService";
import { uploadImages } from "../services/postService";
import { Brand } from "../services/brandService";
import { useBrandSearch } from "../hooks/useBrandSearch";
import { useTranslation } from "react-i18next";

const STYLE_OPTIONS = [
  "先锋",
  "暗黑",
  "工匠",
  "极简",
  "vintage",
  "archive",
  "中古",
  "日系",
  "女装",
  "哥特",
  "银饰",
  "设计师品牌",
];

const COUNTRY_OPTIONS = [
  "中国",
  "日本",
  "法国",
  "意大利",
  "美国",
  "英国",
  "德国",
  "韩国",
  "其他",
];

const SubmitStoreScreen = () => {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { user } = useAuthStore();

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [latitude, setLatitude] = useState<number | undefined>();
  const [longitude, setLongitude] = useState<number | undefined>();
  // 销售品牌：UI 上以下拉框 + BrandSelectorModal 多选，
  // 提交时再展开成字符串数组（保持后端接口不变）。
  const [selectedBrands, setSelectedBrands] = useState<Brand[]>([]);
  const [brandSelectorVisible, setBrandSelectorVisible] = useState(false);
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [phone, setPhone] = useState("");
  const [hours, setHours] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<string[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [previewImageIndex, setPreviewImageIndex] = useState(0);

  // 品牌搜索（与 V1 publish 屏复用同一 hook，体验完全一致）
  const {
    brands: displayedBrands,
    searchQuery: brandSearchQuery,
    isLoading: isLoadingBrands,
    hasMore: hasMoreBrands,
    setSearchQuery: setBrandSearchQuery,
    search: searchBrands,
    loadMore: loadMoreBrands,
  } = useBrandSearch();

  const MAX_BRANDS = 10;

  const handleSelectBrand = (brand: Brand) => {
    if (selectedBrands.length >= MAX_BRANDS) {
      Alert.show(t("publish.maxBrandsReached", { count: MAX_BRANDS }));
      return;
    }
    if (selectedBrands.some((b) => b.id === brand.id)) {
      Alert.show(t("publish.brandAlreadyAdded"));
      return;
    }
    setSelectedBrands((prev) => [...prev, brand]);
    setBrandSelectorVisible(false);
  };

  const handleRemoveBrand = (id: number | string) => {
    setSelectedBrands((prev) => prev.filter((b) => b.id !== id));
  };

  const getCurrentLocation = async () => {
    try {
      setIsLocating(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.show(t("storeSubmit.locationPermissionRequired"));
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setLatitude(location.coords.latitude);
      setLongitude(location.coords.longitude);
      Alert.show(t("storeSubmit.locationObtained"));
    } catch (error) {
      Alert.show(t("storeSubmit.locationFailed"));
    } finally {
      setIsLocating(false);
    }
  };

  const pickImages = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") { Alert.show(t("storeSubmit.albumPermissionRequired")); return; }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: 6,
      });

      if (!result.canceled) {
        const newImages = result.assets.map((asset) => asset.uri);
        setImages((prev) => [...prev, ...newImages].slice(0, 6));
      }
    } catch (error) {
      Alert.show(t("storeSubmit.imagePickFailed"));
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleStyle = (style: string) => {
    setSelectedStyles((prev) =>
      prev.includes(style)
        ? prev.filter((s) => s !== style)
        : [...prev, style].slice(0, 5)
    );
  };

  const validateForm = (): boolean => {
    if (!name.trim()) {
      Alert.show(t("storeSubmit.nameRequired"));
      return false;
    }
    if (!address.trim()) {
      Alert.show(t("storeSubmit.addressRequired"));
      return false;
    }
    if (!city.trim()) {
      Alert.show(t("storeSubmit.cityRequired"));
      return false;
    }
    if (!country.trim()) {
      Alert.show(t("storeSubmit.countryRequired"));
      return false;
    }
    return true;
  };

  const geocodeAddress = async (): Promise<{
    lat: number;
    lng: number;
  } | null> => {
    try {
      const fullAddress = `${address.trim()}, ${city.trim()}, ${country.trim()}`;
      const results = await Location.geocodeAsync(fullAddress);
      if (results.length > 0) {
        return { lat: results[0].latitude, lng: results[0].longitude };
      }
      const cityOnly = `${city.trim()}, ${country.trim()}`;
      const cityResults = await Location.geocodeAsync(cityOnly);
      if (cityResults.length > 0) {
        return { lat: cityResults[0].latitude, lng: cityResults[0].longitude };
      }
    } catch (error) {
      console.warn("Geocoding failed:", error);
    }
    return null;
  };

  const handleSubmit = async () => {
    if (!user) {
      Alert.show(t("storeSubmit.loginRequired"));
      return;
    }

    if (!validateForm()) return;

    try {
      setIsSubmitting(true);

      let finalLat = latitude;
      let finalLng = longitude;

      if (finalLat == null || finalLng == null) {
        const geocoded = await geocodeAddress();
        if (geocoded) {
          finalLat = geocoded.lat;
          finalLng = geocoded.lng;
        }
      }

      const data: UserSubmittedStoreCreate = {
        name: name.trim(),
        address: address.trim(),
        city: city.trim(),
        country: country.trim(),
        latitude: finalLat,
        longitude: finalLng,
        brands: selectedBrands.map((b) => b.name).filter((n) => n.trim()),
        style: selectedStyles,
        phone: phone
          .split(/[,，、]/)
          .map((p) => p.trim())
          .filter((p) => p),
        hours: hours.trim() || undefined,
        description: description.trim() || undefined,
        images: images.length > 0 ? await uploadImages(images) : [],
      };

      await submitStore(data);

      Alert.show(t("storeSubmit.submitSuccess"), t("storeSubmit.submitSuccessMessage"), 2000);
      setTimeout(() => {
        navigation.goBack();
      }, 1500);
    } catch (error: any) {
      Alert.show(
        t("storeSubmit.submitFailed"),
        error.message || t("storeSubmit.retryLater"),
        3000
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScreenHeader
        title={t("storeSubmit.title")}
        showBackButton
        onBackPress={() => navigation.goBack()}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoidingView}
      >
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          {/* 提示信息 */}
          <Box mx="$md" mt="$md" mb="$lg" p="$md" bg="$gray50" borderRadius="$md">
            <HStack alignItems="center" gap="$sm">
              <Ionicons
                name="information-circle"
                size={20}
                color={theme.colors.gray500}
              />
              <Text color="$gray500" fontSize="$sm" flex={1} lineHeight={20}>
                {t("storeSubmit.description")}
              </Text>
            </HStack>
          </Box>

          {/* 基本信息 */}
          <Box mx="$md" mb="$md">
            <Text fontSize="$md" fontWeight="$bold" color="$black">
              {t("storeSubmit.basicInfo")}
            </Text>
          </Box>

          {/* 店铺名称 */}
          <Box mx="$md" mb="$md">
            <HStack mb="$sm" alignItems="center">
              <Text color="$gray600" fontSize="$sm">
                {t("storeSubmit.storeName")}
              </Text>
              <Text color="$red500" fontSize="$sm" ml="$xs">
                *
              </Text>
            </HStack>
            <Input
              value={name}
              onChangeText={setName}
              placeholder={t("storeSubmit.storeNamePlaceholder")}
              placeholderTextColor={theme.colors.gray400}
              variant="filled"
              maxLength={100}
            />
          </Box>

          {/* 国家选择 */}
          <Box mx="$md" mb="$md">
            <HStack mb="$sm" alignItems="center">
              <Text color="$gray600" fontSize="$sm">
                {t("storeSubmit.country")}
              </Text>
              <Text color="$red500" fontSize="$sm" ml="$xs">
                *
              </Text>
            </HStack>
            <HStack flexWrap="wrap" gap="$xs">
              {COUNTRY_OPTIONS.map((c) => (
                <Pressable
                  key={c}
                  px="$md"
                  py="$sm"
                  rounded="$sm"
                  bg={country === c ? "$black" : "$gray100"}
                  onPress={() => setCountry(c)}
                >
                  <Text
                    fontSize="$sm"
                    color={country === c ? "$white" : "$black"}
                    fontWeight={country === c ? "$medium" : "$normal"}
                  >
                    {c}
                  </Text>
                </Pressable>
              ))}
            </HStack>
          </Box>

          {/* 城市 */}
          <Box mx="$md" mb="$md">
            <HStack mb="$sm" alignItems="center">
              <Text color="$gray600" fontSize="$sm">
                {t("storeSubmit.city")}
              </Text>
              <Text color="$red500" fontSize="$sm" ml="$xs">
                *
              </Text>
            </HStack>
            <Input
              value={city}
              onChangeText={setCity}
              placeholder={t("storeSubmit.cityPlaceholder")}
              placeholderTextColor={theme.colors.gray400}
              variant="filled"
              maxLength={50}
            />
          </Box>

          {/* 详细地址 */}
          <Box mx="$md" mb="$md">
            <HStack mb="$sm" alignItems="center">
              <Text color="$gray600" fontSize="$sm">
                {t("storeSubmit.storeAddress")}
              </Text>
              <Text color="$red500" fontSize="$sm" ml="$xs">
                *
              </Text>
            </HStack>
            <Input
              value={address}
              onChangeText={setAddress}
              placeholder={t("storeSubmit.addressPlaceholder")}
              placeholderTextColor={theme.colors.gray400}
              variant="filled"
              multiline
              numberOfLines={3}
              sx={{
                minHeight: 80,
                textAlignVertical: "top",
              }}
            />
          </Box>

          {/* 位置坐标 */}
          <Box mx="$md" mb="$lg">
            <HStack justifyContent="between" alignItems="center" mb="$xs">
              <Text color="$gray600" fontSize="$sm">
                {t("storeSubmit.coordinates")}
              </Text>
              <Pressable
                flexDirection="row"
                alignItems="center"
                onPress={getCurrentLocation}
                disabled={isLocating}
              >
                {isLocating ? (
                  <ActivityIndicator size="small" color={theme.colors.black} />
                ) : (
                  <Ionicons
                    name="locate"
                    size={16}
                    color={theme.colors.black}
                  />
                )}
                <Text fontSize="$sm" color="$black" fontWeight="$medium" ml="$xs">
                  {t("storeSubmit.getLocation")}
                </Text>
              </Pressable>
            </HStack>
            {latitude && longitude ? (
              <Box bg="$gray100" rounded="$md" p="$sm">
                <Text fontSize="$sm" color="$gray500">
                  {t("storeSubmit.coordinatesDisplay", { lat: latitude.toFixed(6), lng: longitude.toFixed(6) })}
                </Text>
              </Box>
            ) : (
              <Text fontSize="$xs" color="$gray400">
                {t("storeSubmit.coordinatesHint")}
              </Text>
            )}
          </Box>

          {/* 详细信息 */}
          <Box mx="$md" mb="$md">
            <Text fontSize="$md" fontWeight="$bold" color="$black">
              {t("storeSubmit.detailInfo")}
            </Text>
          </Box>

          {/* 风格标签 */}
          <Box mx="$md" mb="$md">
            <HStack mb="$sm" alignItems="center">
              <Text color="$gray600" fontSize="$sm">
                {t("storeSubmit.styleLabel")}
              </Text>
            </HStack>
            <HStack flexWrap="wrap" gap="$xs">
              {STYLE_OPTIONS.map((style) => (
                <Pressable
                  key={style}
                  px="$md"
                  py="$sm"
                  rounded="$sm"
                  bg={selectedStyles.includes(style) ? "$black" : "$gray100"}
                  onPress={() => toggleStyle(style)}
                >
                  <Text
                    fontSize="$sm"
                    color={selectedStyles.includes(style) ? "$white" : "$black"}
                    fontWeight={selectedStyles.includes(style) ? "$medium" : "$normal"}
                  >
                    {style}
                  </Text>
                </Pressable>
              ))}
            </HStack>
          </Box>

          {/* 销售品牌 — 下拉触发 + BrandSelectorModal */}
          <Box mx="$md" mb="$md">
            <HStack mb="$sm" alignItems="center">
              <Text color="$gray600" fontSize="$sm">
                {t("storeSubmit.storeBrands")}
              </Text>
              <Text color="$gray400" fontSize="$xs" ml="$xs">
                {selectedBrands.length}/{MAX_BRANDS}
              </Text>
            </HStack>

            <Pressable
              onPress={() => setBrandSelectorVisible(true)}
              bg="$gray50"
              rounded="$md"
              px="$md"
              h={48}
              flexDirection="row"
              alignItems="center"
              justifyContent="space-between"
            >
              <HStack alignItems="center" gap="$sm" flex={1}>
                <Ionicons
                  name="search"
                  size={18}
                  color={theme.colors.gray400}
                />
                <Text
                  color={selectedBrands.length === 0 ? "$gray400" : "$black"}
                  fontSize="$sm"
                  flex={1}
                  numberOfLines={1}
                >
                  {selectedBrands.length === 0
                    ? t("storeSubmit.brandsDropdownPlaceholder")
                    : t("storeSubmit.brandsSelectedSummary", {
                        count: selectedBrands.length,
                      })}
                </Text>
              </HStack>
              <Ionicons
                name="chevron-down"
                size={18}
                color={theme.colors.gray400}
              />
            </Pressable>

            {/* 已选品牌 chips */}
            {selectedBrands.length > 0 ? (
              <HStack flexWrap="wrap" mt="$sm" gap="$xs">
                {selectedBrands.map((b) => (
                  <Pressable
                    key={`brand-chip-${b.id}`}
                    onPress={() => handleRemoveBrand(b.id)}
                    bg="$black"
                    rounded="$sm"
                    px="$sm"
                    py={4}
                    flexDirection="row"
                    alignItems="center"
                  >
                    <Text color="$white" fontSize="$xs" mr="$xs">
                      {b.name}
                    </Text>
                    <Ionicons
                      name="close"
                      size={12}
                      color={theme.colors.white}
                    />
                  </Pressable>
                ))}
              </HStack>
            ) : null}
          </Box>

          {/* 联系电话 */}
          <Box mx="$md" mb="$md">
            <HStack mb="$sm" alignItems="center">
              <Text color="$gray600" fontSize="$sm">
                {t("storeSubmit.storePhone")}
              </Text>
            </HStack>
            <Input
              value={phone}
              onChangeText={setPhone}
              placeholder={t("storeSubmit.phonePlaceholder")}
              placeholderTextColor={theme.colors.gray400}
              variant="filled"
              keyboardType="phone-pad"
            />
          </Box>

          {/* 营业时间 */}
          <Box mx="$md" mb="$md">
            <HStack mb="$sm" alignItems="center">
              <Text color="$gray600" fontSize="$sm">
                {t("storeSubmit.businessHours")}
              </Text>
            </HStack>
            <Input
              value={hours}
              onChangeText={setHours}
              placeholder={t("storeSubmit.hoursPlaceholder")}
              placeholderTextColor={theme.colors.gray400}
              variant="filled"
              maxLength={100}
            />
          </Box>

          {/* 店铺描述 */}
          <Box mx="$md" mb="$md">
            <HStack mb="$sm" alignItems="center">
              <Text color="$gray600" fontSize="$sm">
                {t("storeSubmit.storeDescription")}
              </Text>
            </HStack>
            <Input
              value={description}
              onChangeText={setDescription}
              placeholder={t("storeSubmit.descriptionPlaceholder")}
              placeholderTextColor={theme.colors.gray400}
              variant="filled"
              multiline
              numberOfLines={4}
              maxLength={500}
              sx={{
                minHeight: 80,
                textAlignVertical: "top",
              }}
            />
          </Box>

          {/* 店铺图片 */}
          <ImageGridSelector
            images={images}
            onImagePress={(index) => {
              setPreviewImageIndex(index);
              setShowImagePreview(true);
            }}
            onRemoveImage={removeImage}
            onAddImage={pickImages}
            maxImages={6}
            label={t("storeSubmit.storeImages")}
          />

          {/* 提交按钮 */}
          <Box mx="$md" mb="$xl">
            <Pressable
              w="100%"
              py="$md"
              rounded="$sm"
              bg={isSubmitting ? "$gray200" : "$black"}
              alignItems="center"
              justifyContent="center"
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color={theme.colors.white} />
              ) : (
                <Text fontSize="$md" fontWeight="$bold" color="$white">
                  {t("storeSubmit.submit")}
                </Text>
              )}
            </Pressable>
          </Box>
        </ScrollView>
      </KeyboardAvoidingView>

      <ImagePreviewModal
        visible={showImagePreview}
        imageUrls={images}
        initialIndex={previewImageIndex}
        onClose={() => setShowImagePreview(false)}
      />

      <BrandSelectorModal
        visible={brandSelectorVisible}
        brands={displayedBrands}
        searchQuery={brandSearchQuery}
        isLoading={isLoadingBrands}
        hasMore={hasMoreBrands}
        onSearchChange={setBrandSearchQuery}
        onSearch={() => searchBrands()}
        onSelectBrand={handleSelectBrand}
        onClose={() => setBrandSelectorVisible(false)}
        onLoadMore={loadMoreBrands}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 100,
  },
});

export default SubmitStoreScreen;
