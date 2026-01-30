import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme";
import { useAuthStore } from "../store/authStore";
import { userInfoService, Gender } from "../services/userInfoService";
import { brandService } from "../services/brandService";
import { Alert } from "../utils/Alert";

// 品牌选项类型
interface BrandOption {
  id: number;
  name: string;
  category: string | null;
}

// 中国省份列表
const PROVINCES = [
  "北京", "上海", "天津", "重庆", "河北", "山西", "辽宁", "吉林", "黑龙江",
  "江苏", "浙江", "安徽", "福建", "江西", "山东", "河南", "湖北", "湖南",
  "广东", "海南", "四川", "贵州", "云南", "陕西", "甘肃", "青海", "台湾",
  "内蒙古", "广西", "西藏", "宁夏", "新疆", "香港", "澳门", "海外",
];

// 年龄段选项
const AGE_RANGES = ["18-24", "25-30", "31-35", "36-40", "41-45", "46-50", "50+"];

interface ProfileReminderModalProps {
  visible: boolean;
  onClose: () => void;
}

const ProfileReminderModal: React.FC<ProfileReminderModalProps> = ({
  visible,
  onClose,
}) => {
  const { user, setProfileCompleted, updateLastProfileReminderTime } = useAuthStore();

  // 表单状态
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [gender, setGender] = useState<Gender | "">("");
  const [age, setAge] = useState("");
  const [preference, setPreference] = useState("");
  const [favoriteBrandIds, setFavoriteBrandIds] = useState<number[]>([]);

  // UI 状态
  const [loading, setLoading] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showAgePicker, setShowAgePicker] = useState(false);
  const [showBrandPicker, setShowBrandPicker] = useState(false);

  // 品牌相关状态
  const [brandOptions, setBrandOptions] = useState<BrandOption[]>([]);
  const [loadingBrands, setLoadingBrands] = useState(false);
  const [loadingMoreBrands, setLoadingMoreBrands] = useState(false);
  const [brandPage, setBrandPage] = useState(1);
  const [hasMoreBrands, setHasMoreBrands] = useState(true);
  const [brandSearchKeyword, setBrandSearchKeyword] = useState("");
  const brandPageSize = 50;

  // 加载品牌
  const loadBrands = useCallback(
    async (page: number = 1, keyword: string = "", reset: boolean = false) => {
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

        const totalLoaded = page * brandPageSize;
        setHasMoreBrands(totalLoaded < response.total);
        setBrandPage(page);
      } catch (error) {
        console.error("Failed to load brands:", error);
      } finally {
        setLoadingBrands(false);
        setLoadingMoreBrands(false);
      }
    },
    []
  );

  // 加载更多品牌
  const loadMoreBrands = useCallback(() => {
    if (loadingMoreBrands || !hasMoreBrands) return;
    loadBrands(brandPage + 1, brandSearchKeyword);
  }, [loadingMoreBrands, hasMoreBrands, brandPage, brandSearchKeyword, loadBrands]);

  // 搜索品牌
  const handleBrandSearch = useCallback(
    (keyword: string) => {
      setBrandSearchKeyword(keyword);
      setBrandPage(1);
      setHasMoreBrands(true);
      loadBrands(1, keyword, true);
    },
    [loadBrands]
  );

  // 当显示品牌选择器时加载品牌
  useEffect(() => {
    if (showBrandPicker && brandOptions.length === 0) {
      loadBrands(1, "", true);
    }
  }, [showBrandPicker, brandOptions.length, loadBrands]);

  // 切换品牌选择
  const handleToggleBrand = (brandId: number) => {
    if (favoriteBrandIds.includes(brandId)) {
      setFavoriteBrandIds(favoriteBrandIds.filter((id) => id !== brandId));
    } else {
      if (favoriteBrandIds.length >= 5) {
        Alert.show("提示: 最多选择 5 个品牌");
        return;
      }
      setFavoriteBrandIds([...favoriteBrandIds, brandId]);
    }
  };

  // 获取已选品牌名称
  const getSelectedBrandNames = () => {
    return brandOptions
      .filter((b) => favoriteBrandIds.includes(b.id))
      .map((b) => b.name)
      .join(", ");
  };

  // 稍后填写
  const handleLater = () => {
    updateLastProfileReminderTime();
    onClose();
  };

  // 提交资料
  const handleSubmit = async () => {
    if (!user?.userId) {
      Alert.show("错误: 用户未登录");
      return;
    }

    setLoading(true);
    try {
      // 计算年龄值
      let ageValue = 0;
      if (age) {
        if (age === "50+") {
          ageValue = 55;
        } else {
          const ageParts = age.split("-");
          if (ageParts.length === 2) {
            ageValue = Math.floor((parseInt(ageParts[0]) + parseInt(ageParts[1])) / 2);
          }
        }
      }

      // 构建更新数据
      const updateData: {
        location?: string;
        gender?: Gender;
        age?: number;
        preference?: string;
        bio?: string;
      } = {};

      if (location) updateData.location = location;
      if (gender) updateData.gender = gender as Gender;
      if (ageValue > 0) updateData.age = ageValue;
      if (preference) updateData.preference = preference;
      if (bio) updateData.bio = bio;

      // 调用更新接口
      if (Object.keys(updateData).length > 0) {
        await userInfoService.updateUserProfile(user.userId, updateData);
      }

      // 标记资料已完善
      setProfileCompleted(true);
      Alert.show("资料已保存", "", 1000);
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : "保存失败，请重试";
      Alert.show("保存失败: " + message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="pageSheet"
      onRequestClose={handleLater}
    >
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={styles.keyboardAvoid}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* 头部 */}
            <View style={styles.header}>
              <Text style={styles.title}>完善个人资料</Text>
              <Text style={styles.subtitle}>让我们更好地了解您</Text>
            </View>

            {/* 提示文字 */}
            <View style={styles.hintContainer}>
              <Ionicons name="information-circle-outline" size={18} color={theme.colors.gray400} />
              <Text style={styles.hintText}>
                以下信息均为选填，您可以随时在设置中修改
              </Text>
            </View>

            {/* 个人简介 */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>个人简介</Text>
              <TextInput
                style={[styles.input, styles.bioInput]}
                placeholder="介绍一下自己..."
                placeholderTextColor={theme.colors.gray400}
                value={bio}
                onChangeText={setBio}
                maxLength={200}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
              <Text style={styles.charCount}>{bio.length}/200</Text>
            </View>

            {/* 所在地选择 */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>所在地</Text>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => setShowLocationPicker(!showLocationPicker)}
              >
                <Text style={location ? styles.pickerText : styles.pickerPlaceholder}>
                  {location || "请选择您的所在地"}
                </Text>
                <Ionicons
                  name={showLocationPicker ? "chevron-up" : "chevron-down"}
                  size={20}
                  color={theme.colors.gray400}
                />
              </TouchableOpacity>
              {showLocationPicker && (
                <View style={styles.pickerOptionsContainer}>
                  <ScrollView style={styles.pickerOptions} nestedScrollEnabled>
                    {PROVINCES.map((province) => (
                      <TouchableOpacity
                        key={province}
                        style={[
                          styles.pickerOption,
                          location === province && styles.pickerOptionSelected,
                        ]}
                        onPress={() => {
                          setLocation(province);
                          setShowLocationPicker(false);
                        }}
                      >
                        <Text
                          style={[
                            styles.pickerOptionText,
                            location === province && styles.pickerOptionTextSelected,
                          ]}
                        >
                          {province}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            {/* 性别选择 */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>性别</Text>
              <View style={styles.genderContainer}>
                {[
                  { value: "MALE" as Gender, label: "男" },
                  { value: "FEMALE" as Gender, label: "女" },
                  { value: "OTHER" as Gender, label: "其他" },
                ].map((g) => (
                  <TouchableOpacity
                    key={g.value}
                    style={[
                      styles.genderOption,
                      gender === g.value && styles.genderOptionSelected,
                    ]}
                    onPress={() => setGender(g.value)}
                  >
                    <Text
                      style={[
                        styles.genderOptionText,
                        gender === g.value && styles.genderOptionTextSelected,
                      ]}
                    >
                      {g.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* 年龄段选择 */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>年龄段</Text>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => setShowAgePicker(!showAgePicker)}
              >
                <Text style={age ? styles.pickerText : styles.pickerPlaceholder}>
                  {age ? `${age}岁` : "请选择您的年龄段"}
                </Text>
                <Ionicons
                  name={showAgePicker ? "chevron-up" : "chevron-down"}
                  size={20}
                  color={theme.colors.gray400}
                />
              </TouchableOpacity>
              {showAgePicker && (
                <View style={styles.pickerOptionsContainer}>
                  <ScrollView style={styles.pickerOptionsSmall} nestedScrollEnabled>
                    {AGE_RANGES.map((a) => (
                      <TouchableOpacity
                        key={a}
                        style={[styles.pickerOption, age === a && styles.pickerOptionSelected]}
                        onPress={() => {
                          setAge(a);
                          setShowAgePicker(false);
                        }}
                      >
                        <Text
                          style={[
                            styles.pickerOptionText,
                            age === a && styles.pickerOptionTextSelected,
                          ]}
                        >
                          {a}岁
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            {/* 时尚偏好 */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>时尚偏好</Text>
              <TextInput
                style={[styles.input, styles.preferenceInput]}
                placeholder="例如：极简主义、街头风格、复古..."
                placeholderTextColor={theme.colors.gray400}
                value={preference}
                onChangeText={setPreference}
                maxLength={100}
                multiline
              />
            </View>

            {/* 喜欢的品牌 */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>喜欢的品牌（最多5个）</Text>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => setShowBrandPicker(true)}
              >
                <Text
                  style={
                    favoriteBrandIds.length > 0 ? styles.pickerText : styles.pickerPlaceholder
                  }
                  numberOfLines={2}
                >
                  {favoriteBrandIds.length > 0 ? getSelectedBrandNames() : "选择您喜欢的品牌"}
                </Text>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.gray400} />
              </TouchableOpacity>
              {favoriteBrandIds.length > 0 && (
                <Text style={styles.selectedCount}>已选择 {favoriteBrandIds.length}/5</Text>
              )}
            </View>

            {/* 按钮区域 */}
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.mainButton, loading && styles.mainButtonDisabled]}
                onPress={handleSubmit}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={theme.colors.white} />
                ) : (
                  <Text style={styles.mainButtonText}>保存</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.laterButton} onPress={handleLater}>
                <Text style={styles.laterButtonText}>稍后填写</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* 品牌选择 Modal */}
      <Modal
        visible={showBrandPicker}
        animationType="fade"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowBrandPicker(false)}
      >
        <View style={styles.brandModalContainer}>
          <View style={styles.brandModalHeader}>
            <Text style={styles.brandModalTitle}>
              选择喜欢的品牌（{favoriteBrandIds.length}/5）
            </Text>
            <TouchableOpacity
              onPress={() => setShowBrandPicker(false)}
              style={styles.brandModalCloseButton}
            >
              <Ionicons name="close" size={24} color={theme.colors.black} />
            </TouchableOpacity>
          </View>

          {/* 搜索框 */}
          <View style={styles.brandSearchContainer}>
            <Ionicons name="search" size={18} color={theme.colors.gray400} />
            <TextInput
              style={styles.brandSearchInput}
              placeholder="搜索品牌..."
              placeholderTextColor={theme.colors.gray400}
              value={brandSearchKeyword}
              onChangeText={handleBrandSearch}
              autoCapitalize="none"
              autoCorrect={false}
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
              <Text style={styles.brandLoadingText}>加载中...</Text>
            </View>
          ) : (
            <FlatList
              data={brandOptions}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => {
                const isSelected = favoriteBrandIds.includes(item.id);
                return (
                  <TouchableOpacity
                    style={[styles.brandItem, isSelected && styles.brandItemSelected]}
                    onPress={() => handleToggleBrand(item.id)}
                  >
                    <View style={styles.brandInfo}>
                      <Text style={[styles.brandName, isSelected && styles.brandNameSelected]}>
                        {item.name}
                      </Text>
                      {item.category && (
                        <Text style={styles.brandCategory}>{item.category}</Text>
                      )}
                    </View>
                    <View
                      style={[styles.brandCheckbox, isSelected && styles.brandCheckboxSelected]}
                    >
                      {isSelected && (
                        <Ionicons name="checkmark" size={16} color={theme.colors.white} />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              }}
              showsVerticalScrollIndicator={false}
              onEndReached={loadMoreBrands}
              onEndReachedThreshold={0.3}
              ListEmptyComponent={
                <View style={styles.brandEmptyList}>
                  <Text style={styles.brandEmptyText}>
                    {brandSearchKeyword ? "没有找到匹配的品牌" : "暂无品牌"}
                  </Text>
                </View>
              }
              ListFooterComponent={
                loadingMoreBrands ? (
                  <View style={styles.brandLoadMoreContainer}>
                    <ActivityIndicator size="small" color={theme.colors.black} />
                  </View>
                ) : null
              }
            />
          )}

          <TouchableOpacity
            style={styles.brandConfirmButton}
            onPress={() => setShowBrandPicker(false)}
          >
            <Text style={styles.brandConfirmButtonText}>确定</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontFamily: "PlayfairDisplay-Bold",
    color: theme.colors.black,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter-Regular",
    color: theme.colors.gray400,
  },
  hintContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
    borderRadius: 10,
    padding: 12,
    marginBottom: 24,
    gap: 8,
  },
  hintText: {
    fontSize: 13,
    fontFamily: "Inter-Regular",
    color: theme.colors.gray500,
    flex: 1,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 13,
    fontFamily: "Inter-Medium",
    color: theme.colors.black,
    marginBottom: 8,
  },
  input: {
    fontSize: 16,
    fontFamily: "Inter-Regular",
    color: theme.colors.black,
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  bioInput: {
    minHeight: 100,
    textAlignVertical: "top",
    paddingTop: 12,
  },
  preferenceInput: {
    minHeight: 80,
    textAlignVertical: "top",
    paddingTop: 12,
  },
  charCount: {
    fontSize: 12,
    fontFamily: "Inter-Regular",
    color: theme.colors.gray400,
    textAlign: "right",
    marginTop: 4,
  },
  pickerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  pickerText: {
    fontSize: 16,
    fontFamily: "Inter-Regular",
    color: theme.colors.black,
    flex: 1,
  },
  pickerPlaceholder: {
    fontSize: 16,
    fontFamily: "Inter-Regular",
    color: theme.colors.gray400,
    flex: 1,
  },
  pickerOptionsContainer: {
    marginTop: 8,
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    overflow: "hidden",
  },
  pickerOptions: {
    maxHeight: 200,
  },
  pickerOptionsSmall: {
    maxHeight: 150,
  },
  pickerOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E8E8E8",
  },
  pickerOptionSelected: {
    backgroundColor: theme.colors.black,
  },
  pickerOptionText: {
    fontSize: 14,
    fontFamily: "Inter-Regular",
    color: theme.colors.black,
  },
  pickerOptionTextSelected: {
    color: theme.colors.white,
    fontFamily: "Inter-Medium",
  },
  genderContainer: {
    flexDirection: "row",
    gap: 12,
  },
  genderOption: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  genderOptionSelected: {
    backgroundColor: theme.colors.black,
    borderColor: theme.colors.black,
  },
  genderOptionText: {
    fontSize: 15,
    fontFamily: "Inter-Medium",
    color: theme.colors.gray400,
  },
  genderOptionTextSelected: {
    color: theme.colors.white,
  },
  selectedCount: {
    fontSize: 12,
    fontFamily: "Inter-Regular",
    color: theme.colors.gray500,
    marginTop: 6,
  },
  buttonContainer: {
    marginTop: 24,
    gap: 12,
  },
  mainButton: {
    backgroundColor: theme.colors.black,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: "center",
  },
  mainButtonDisabled: {
    backgroundColor: "#E8E8E8",
  },
  mainButtonText: {
    fontSize: 16,
    fontFamily: "Inter-Bold",
    color: theme.colors.white,
  },
  laterButton: {
    paddingVertical: 14,
    alignItems: "center",
  },
  laterButtonText: {
    fontSize: 14,
    fontFamily: "Inter-Medium",
    color: theme.colors.gray400,
    textDecorationLine: "underline",
  },
  // 品牌选择 Modal 样式
  brandModalContainer: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  brandModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E8E8E8",
  },
  brandModalTitle: {
    fontSize: 17,
    fontFamily: "Inter-Bold",
    color: theme.colors.black,
  },
  brandModalCloseButton: {
    padding: 4,
  },
  brandSearchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#F5F5F5",
    borderRadius: 10,
    gap: 8,
  },
  brandSearchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter-Regular",
    color: theme.colors.black,
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
    fontFamily: "Inter-Regular",
    color: theme.colors.gray500,
  },
  brandItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  brandItemSelected: {
    backgroundColor: "#F8F8F8",
  },
  brandInfo: {
    flex: 1,
  },
  brandName: {
    fontSize: 15,
    fontFamily: "Inter-Regular",
    color: theme.colors.black,
  },
  brandNameSelected: {
    fontFamily: "Inter-Medium",
  },
  brandCategory: {
    fontSize: 12,
    fontFamily: "Inter-Regular",
    color: theme.colors.gray500,
    marginTop: 2,
  },
  brandCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme.colors.gray300,
    justifyContent: "center",
    alignItems: "center",
  },
  brandCheckboxSelected: {
    backgroundColor: theme.colors.black,
    borderColor: theme.colors.black,
  },
  brandEmptyList: {
    padding: 40,
    alignItems: "center",
  },
  brandEmptyText: {
    fontSize: 14,
    fontFamily: "Inter-Regular",
    color: theme.colors.gray500,
  },
  brandLoadMoreContainer: {
    paddingVertical: 16,
    alignItems: "center",
  },
  brandConfirmButton: {
    margin: 20,
    backgroundColor: theme.colors.black,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
  },
  brandConfirmButtonText: {
    fontSize: 16,
    fontFamily: "Inter-Bold",
    color: theme.colors.white,
  },
});

export default ProfileReminderModal;
