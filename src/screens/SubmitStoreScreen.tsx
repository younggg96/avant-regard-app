/**
 * 用户提交买手店页面
 * 遵循 iOS Human Interface Guidelines 设计规范
 */
import React, { useState, useCallback } from "react";
import {
  StyleSheet,
  TextInput,
  Alert,
  Keyboard,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
} from "react-native";
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
  VStack,
  ScrollView,
} from "../components/ui";
import { theme } from "../theme";
import ScreenHeader from "../components/ScreenHeader";
import { useAuthStore } from "../store/authStore";
import {
  submitStore,
  UserSubmittedStoreCreate,
} from "../services/buyerStoreService";

// 常用风格标签
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

// 常用国家
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

  // 表单状态
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

  // 获取当前位置
  const getCurrentLocation = async () => {
    try {
      setIsLocating(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("权限提示", "需要位置权限来获取店铺坐标");
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setLatitude(location.coords.latitude);
      setLongitude(location.coords.longitude);
      Alert.alert("成功", "已获取当前位置坐标");
    } catch (error) {
      Alert.alert("错误", "无法获取位置，请手动输入或稍后重试");
    } finally {
      setIsLocating(false);
    }
  };

  // 选择图片
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
      Alert.alert("错误", "选择图片失败");
    }
  };

  // 移除图片
  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  // 切换风格选择
  const toggleStyle = (style: string) => {
    setSelectedStyles((prev) =>
      prev.includes(style)
        ? prev.filter((s) => s !== style)
        : [...prev, style].slice(0, 5)
    );
  };

  // 验证表单
  const validateForm = (): boolean => {
    if (!name.trim()) {
      Alert.alert("提示", "请输入店铺名称");
      return false;
    }
    if (!address.trim()) {
      Alert.alert("提示", "请输入详细地址");
      return false;
    }
    if (!city.trim()) {
      Alert.alert("提示", "请输入所在城市");
      return false;
    }
    if (!country.trim()) {
      Alert.alert("提示", "请选择所在国家");
      return false;
    }
    return true;
  };

  // 提交表单
  const handleSubmit = async () => {
    if (!user) {
      Alert.alert("提示", "请先登录");
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
      Alert.alert("提交失败", error.message || "请稍后重试");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader
        title="提交买手店"
        showBackButton
        onBackPress={() => navigation.goBack()}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* 提示信息 */}
            <Box bg="$gray50" rounded="$lg" p="$md" mb="$lg">
              <HStack alignItems="center" mb="$sm">
                <Ionicons
                  name="information-circle"
                  size={20}
                  color={theme.colors.gray300}
                />
                <Text color="$gray300" fontSize="$sm" fontWeight="$medium" ml="$xs">
                  温馨提示
                </Text>
              </HStack>
              <Text color="$gray300" fontSize="$sm" lineHeight={20}>
                发现了一家好店？快来分享给其他用户吧！提交后将由平台审核，审核通过后将展示给所有用户。
              </Text>
            </Box>

            {/* 基本信息 */}
            <Text fontSize="$md" fontWeight="$bold" color="$black" mb="$md">
              基本信息
            </Text>

            {/* 店铺名称 */}
            <VStack mb="$md">
              <Text fontSize="$sm" color="$gray300" mb="$xs">
                店铺名称 <Text color="$error">*</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="输入店铺名称"
                placeholderTextColor={theme.colors.gray200}
                value={name}
                onChangeText={setName}
                maxLength={100}
              />
            </VStack>

            {/* 国家选择 */}
            <VStack mb="$md">
              <Text fontSize="$sm" color="$gray300" mb="$xs">
                所在国家 <Text color="$error">*</Text>
              </Text>
              <HStack flexWrap="wrap" gap="$xs">
                {COUNTRY_OPTIONS.map((c) => (
                  <Pressable
                    key={c}
                    px="$md"
                    py="$sm"
                    rounded="$full"
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
            </VStack>

            {/* 城市 */}
            <VStack mb="$md">
              <Text fontSize="$sm" color="$gray300" mb="$xs">
                所在城市 <Text color="$error">*</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="如：上海、东京、巴黎"
                placeholderTextColor={theme.colors.gray200}
                value={city}
                onChangeText={setCity}
                maxLength={50}
              />
            </VStack>

            {/* 详细地址 */}
            <VStack mb="$md">
              <Text fontSize="$sm" color="$gray300" mb="$xs">
                详细地址 <Text color="$error">*</Text>
              </Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="输入详细地址，方便其他用户找到"
                placeholderTextColor={theme.colors.gray200}
                value={address}
                onChangeText={setAddress}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </VStack>

            {/* 位置坐标 */}
            <VStack mb="$lg">
              <HStack justifyContent="between" alignItems="center" mb="$xs">
                <Text fontSize="$sm" color="$gray300">
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
                  <Text fontSize="$sm" color="$gray300">
                    纬度: {latitude.toFixed(6)}, 经度: {longitude.toFixed(6)}
                  </Text>
                </Box>
              ) : (
                <Text fontSize="$xs" color="$gray200">
                  点击右上角按钮获取当前位置，或留空由平台补充
                </Text>
              )}
            </VStack>

            {/* 详细信息 */}
            <Text fontSize="$md" fontWeight="$bold" color="$black" mb="$md">
              详细信息
            </Text>

            {/* 风格标签 */}
            <VStack mb="$md">
              <Text fontSize="$sm" color="$gray300" mb="$xs">
                风格标签（最多选5个）
              </Text>
              <HStack flexWrap="wrap" gap="$xs">
                {STYLE_OPTIONS.map((style) => (
                  <Pressable
                    key={style}
                    px="$md"
                    py="$sm"
                    rounded="$full"
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
            </VStack>

            {/* 销售品牌 */}
            <VStack mb="$md">
              <Text fontSize="$sm" color="$gray300" mb="$xs">
                销售品牌
              </Text>
              <TextInput
                style={styles.input}
                placeholder="用逗号分隔，如：Rick Owens, Guidi, CCP"
                placeholderTextColor={theme.colors.gray200}
                value={brands}
                onChangeText={setBrands}
              />
            </VStack>

            {/* 联系电话 */}
            <VStack mb="$md">
              <Text fontSize="$sm" color="$gray300" mb="$xs">
                联系电话
              </Text>
              <TextInput
                style={styles.input}
                placeholder="多个号码用逗号分隔"
                placeholderTextColor={theme.colors.gray200}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
            </VStack>

            {/* 营业时间 */}
            <VStack mb="$md">
              <Text fontSize="$sm" color="$gray300" mb="$xs">
                营业时间
              </Text>
              <TextInput
                style={styles.input}
                placeholder="如：11:00-21:00，周一休息"
                placeholderTextColor={theme.colors.gray200}
                value={hours}
                onChangeText={setHours}
                maxLength={100}
              />
            </VStack>

            {/* 店铺描述 */}
            <VStack mb="$md">
              <Text fontSize="$sm" color="$gray300" mb="$xs">
                店铺描述
              </Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="介绍一下这家店的特色..."
                placeholderTextColor={theme.colors.gray200}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                maxLength={500}
              />
              <Text fontSize="$xs" color="$gray200" mt="$xs" textAlign="right">
                {description.length}/500
              </Text>
            </VStack>

            {/* 店铺图片 */}
            <VStack mb="$xl">
              <Text fontSize="$sm" color="$gray300" mb="$xs">
                店铺图片（最多6张）
              </Text>
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
                      rounded="$full"
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
                      color={theme.colors.gray300}
                    />
                    <Text fontSize="$xs" color="$gray300" mt="$xs">
                      添加图片
                    </Text>
                  </Pressable>
                )}
              </HStack>
            </VStack>

            {/* 提交按钮 */}
            <Pressable
              w="100%"
              py="$md"
              rounded="$full"
              bg={isSubmitting ? "$gray200" : "$black"}
              alignItems="center"
              justifyContent="center"
              onPress={handleSubmit}
              disabled={isSubmitting}
              mb="$xl"
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color={theme.colors.white} />
              ) : (
                <Text fontSize="$md" fontWeight="$bold" color="$white">
                  提交审核
                </Text>
              )}
            </Pressable>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  scrollContent: {
    padding: theme.spacing.lg,
  },
  input: {
    backgroundColor: theme.colors.gray100,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm + 2,
    fontSize: 15,
    color: theme.colors.black,
    minHeight: 48,
  },
  textArea: {
    minHeight: 80,
    paddingTop: theme.spacing.sm + 2,
  },
  imagePreview: {
    width: 80,
    height: 80,
    borderRadius: theme.borderRadius.md,
  },
});

export default SubmitStoreScreen;
