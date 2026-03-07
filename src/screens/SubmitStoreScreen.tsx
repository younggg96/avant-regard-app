/**
 * 用户提交买手店页面
 * 布局风格与其他 Publish 页面保持一致
 */
import React, { useState } from "react";
import {
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  Image,
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
import { useAuthStore } from "../store/authStore";
import {
  submitStore,
  UserSubmittedStoreCreate,
} from "../services/buyerStoreService";

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
  const navigation = useNavigation();
  const { user } = useAuthStore();

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [latitude, setLatitude] = useState<number | undefined>();
  const [longitude, setLongitude] = useState<number | undefined>();
  const [brands, setBrands] = useState("");
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [phone, setPhone] = useState("");
  const [hours, setHours] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<string[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  const getCurrentLocation = async () => {
    try {
      setIsLocating(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.show("提示: 需要位置权限来获取店铺坐标");
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setLatitude(location.coords.latitude);
      setLongitude(location.coords.longitude);
      Alert.show("已获取当前位置坐标");
    } catch (error) {
      Alert.show("提示: 无法获取位置，请手动输入或稍后重试");
    } finally {
      setIsLocating(false);
    }
  };

  const pickImages = async () => {
    try {
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
      Alert.show("提示: 选择图片失败");
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
      Alert.show("提示: 请输入店铺名称");
      return false;
    }
    if (!address.trim()) {
      Alert.show("提示: 请输入详细地址");
      return false;
    }
    if (!city.trim()) {
      Alert.show("提示: 请输入所在城市");
      return false;
    }
    if (!country.trim()) {
      Alert.show("提示: 请选择所在国家");
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!user) {
      Alert.show("提示: 请先登录");
      return;
    }

    if (!validateForm()) return;

    try {
      setIsSubmitting(true);

      const data: UserSubmittedStoreCreate = {
        name: name.trim(),
        address: address.trim(),
        city: city.trim(),
        country: country.trim(),
        latitude,
        longitude,
        brands: brands
          .split(/[,，、]/)
          .map((b) => b.trim())
          .filter((b) => b),
        style: selectedStyles,
        phone: phone
          .split(/[,，、]/)
          .map((p) => p.trim())
          .filter((p) => p),
        hours: hours.trim() || undefined,
        description: description.trim() || undefined,
        images,
      };

      await submitStore(data);

      Alert.alert("提交成功", "您的买手店信息已提交，等待平台审核", [
        {
          text: "好的",
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error: any) {
      Alert.show("提交失败: " + (error.message || "请稍后重试"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScreenHeader
        title="提交买手店"
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
                发现了一家好店？快来分享给其他用户吧！提交后将由平台审核，审核通过后将展示给所有用户。
              </Text>
            </HStack>
          </Box>

          {/* 基本信息 */}
          <Box mx="$md" mb="$md">
            <Text fontSize="$md" fontWeight="$bold" color="$black">
              基本信息
            </Text>
          </Box>

          {/* 店铺名称 */}
          <Box mx="$md" mb="$md">
            <HStack mb="$sm" alignItems="center">
              <Text color="$gray600" fontSize="$sm">
                店铺名称
              </Text>
              <Text color="$red500" fontSize="$sm" ml="$xs">
                *
              </Text>
            </HStack>
            <Input
              value={name}
              onChangeText={setName}
              placeholder="输入店铺名称"
              placeholderTextColor={theme.colors.gray400}
              variant="filled"
              maxLength={100}
            />
          </Box>

          {/* 国家选择 */}
          <Box mx="$md" mb="$md">
            <HStack mb="$sm" alignItems="center">
              <Text color="$gray600" fontSize="$sm">
                所在国家
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
                所在城市
              </Text>
              <Text color="$red500" fontSize="$sm" ml="$xs">
                *
              </Text>
            </HStack>
            <Input
              value={city}
              onChangeText={setCity}
              placeholder="如：上海、东京、巴黎"
              placeholderTextColor={theme.colors.gray400}
              variant="filled"
              maxLength={50}
            />
          </Box>

          {/* 详细地址 */}
          <Box mx="$md" mb="$md">
            <HStack mb="$sm" alignItems="center">
              <Text color="$gray600" fontSize="$sm">
                详细地址
              </Text>
              <Text color="$red500" fontSize="$sm" ml="$xs">
                *
              </Text>
            </HStack>
            <Input
              value={address}
              onChangeText={setAddress}
              placeholder="输入详细地址，方便其他用户找到"
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
                位置坐标（可选）
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
                  获取当前位置
                </Text>
              </Pressable>
            </HStack>
            {latitude && longitude ? (
              <Box bg="$gray100" rounded="$md" p="$sm">
                <Text fontSize="$sm" color="$gray500">
                  纬度: {latitude.toFixed(6)}, 经度: {longitude.toFixed(6)}
                </Text>
              </Box>
            ) : (
              <Text fontSize="$xs" color="$gray400">
                点击右上角按钮获取当前位置，或留空由平台补充
              </Text>
            )}
          </Box>

          {/* 详细信息 */}
          <Box mx="$md" mb="$md">
            <Text fontSize="$md" fontWeight="$bold" color="$black">
              详细信息
            </Text>
          </Box>

          {/* 风格标签 */}
          <Box mx="$md" mb="$md">
            <HStack mb="$sm" alignItems="center">
              <Text color="$gray600" fontSize="$sm">
                风格标签（最多选5个）
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

          {/* 销售品牌 */}
          <Box mx="$md" mb="$md">
            <HStack mb="$sm" alignItems="center">
              <Text color="$gray600" fontSize="$sm">
                销售品牌
              </Text>
            </HStack>
            <Input
              value={brands}
              onChangeText={setBrands}
              placeholder="用逗号分隔，如：Rick Owens, Guidi, CCP"
              placeholderTextColor={theme.colors.gray400}
              variant="filled"
            />
          </Box>

          {/* 联系电话 */}
          <Box mx="$md" mb="$md">
            <HStack mb="$sm" alignItems="center">
              <Text color="$gray600" fontSize="$sm">
                联系电话
              </Text>
            </HStack>
            <Input
              value={phone}
              onChangeText={setPhone}
              placeholder="多个号码用逗号分隔"
              placeholderTextColor={theme.colors.gray400}
              variant="filled"
              keyboardType="phone-pad"
            />
          </Box>

          {/* 营业时间 */}
          <Box mx="$md" mb="$md">
            <HStack mb="$sm" alignItems="center">
              <Text color="$gray600" fontSize="$sm">
                营业时间
              </Text>
            </HStack>
            <Input
              value={hours}
              onChangeText={setHours}
              placeholder="如：11:00-21:00，周一休息"
              placeholderTextColor={theme.colors.gray400}
              variant="filled"
              maxLength={100}
            />
          </Box>

          {/* 店铺描述 */}
          <Box mx="$md" mb="$md">
            <HStack mb="$sm" alignItems="center">
              <Text color="$gray600" fontSize="$sm">
                店铺描述
              </Text>
            </HStack>
            <Input
              value={description}
              onChangeText={setDescription}
              placeholder="介绍一下这家店的特色..."
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
          <Box mx="$md" mb="$xl">
            <HStack mb="$sm" alignItems="center">
              <Text color="$gray600" fontSize="$sm">
                店铺图片（最多6张）
              </Text>
            </HStack>
            <HStack flexWrap="wrap" gap="$sm">
              {images.map((uri, index) => (
                <Box key={index} position="relative">
                  <Image source={{ uri }} style={styles.imagePreview} />
                  <Pressable
                    position="absolute"
                    top={-8}
                    right={-8}
                    w={24}
                    h={24}
                    rounded="$sm"
                    bg="$black"
                    justifyContent="center"
                    alignItems="center"
                    onPress={() => removeImage(index)}
                  >
                    <Ionicons name="close" size={14} color={theme.colors.white} />
                  </Pressable>
                </Box>
              ))}
              {images.length < 6 && (
                <Pressable
                  w={80}
                  h={80}
                  rounded="$md"
                  bg="$gray100"
                  justifyContent="center"
                  alignItems="center"
                  borderWidth={1}
                  borderColor="$gray200"
                  borderStyle="dashed"
                  onPress={pickImages}
                >
                  <Ionicons
                    name="camera-outline"
                    size={24}
                    color={theme.colors.gray400}
                  />
                  <Text fontSize="$xs" color="$gray400" mt="$xs">
                    添加图片
                  </Text>
                </Pressable>
              )}
            </HStack>
          </Box>

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
                  提交审核
                </Text>
              )}
            </Pressable>
          </Box>
        </ScrollView>
      </KeyboardAvoidingView>
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
  imagePreview: {
    width: 80,
    height: 80,
    borderRadius: theme.borderRadius.md,
  },
});

export default SubmitStoreScreen;
