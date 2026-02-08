import React from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  FlatList,
  ActivityIndicator,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../../theme";
import { Gender } from "../../../services/userInfoService";
import { FormData, BrandOption } from "../types";
import { PROVINCES, AGE_RANGES } from "../constants";
import { styles } from "../styles";
import { Alert } from "../../../utils/Alert";

interface ProfileFormProps {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  showLocationPicker: boolean;
  setShowLocationPicker: (show: boolean) => void;
  showAgePicker: boolean;
  setShowAgePicker: (show: boolean) => void;
  // 品牌选择相关
  showBrandPicker: boolean;
  setShowBrandPicker: (show: boolean) => void;
  brandOptions: BrandOption[];
  loadingBrands: boolean;
  loadingMoreBrands: boolean;
  hasMoreBrands: boolean;
  brandSearchKeyword: string;
  onBrandSearch: (keyword: string) => void;
  onLoadMoreBrands: () => void;
}

export const ProfileForm: React.FC<ProfileFormProps> = ({
  formData,
  setFormData,
  showLocationPicker,
  setShowLocationPicker,
  showAgePicker,
  setShowAgePicker,
  showBrandPicker,
  setShowBrandPicker,
  brandOptions,
  loadingBrands,
  loadingMoreBrands,
  hasMoreBrands,
  brandSearchKeyword,
  onBrandSearch,
  onLoadMoreBrands,
}) => {
  // 切换品牌选择
  const handleToggleBrand = (brandId: number) => {
    const currentIds = formData.favoriteBrandIds || [];
    if (currentIds.includes(brandId)) {
      setFormData({
        ...formData,
        favoriteBrandIds: currentIds.filter((id) => id !== brandId),
      });
    } else {
      if (currentIds.length >= 5) {
        Alert.show("提示: 最多选择 5 个品牌");
        return;
      }
      setFormData({
        ...formData,
        favoriteBrandIds: [...currentIds, brandId],
      });
    }
  };

  // 获取已选品牌名称
  const getSelectedBrandNames = () => {
    const selectedIds = formData.favoriteBrandIds || [];
    return brandOptions
      .filter((b) => selectedIds.includes(b.id))
      .map((b) => b.name)
      .join(", ");
  };
  return (
    <View style={styles.formContainer}>
      {/* 提示文字 */}
      <View style={styles.profileHintContainer}>
        <Ionicons name="information-circle-outline" size={18} color={theme.colors.gray400} />
        <Text style={styles.profileHintText}>
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
          value={formData.bio}
          onChangeText={(text) =>
            setFormData({ ...formData, bio: text })
          }
          maxLength={200}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
        <Text style={styles.charCount}>{formData.bio.length}/200</Text>
      </View>

      {/* 所在地选择 */}
      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>所在地</Text>
        <TouchableOpacity
          style={styles.pickerButton}
          onPress={() => setShowLocationPicker(!showLocationPicker)}
        >
          <Text
            style={
              formData.location ? styles.pickerText : styles.pickerPlaceholder
            }
          >
            {formData.location || "请选择您的所在地"}
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
                    formData.location === province &&
                    styles.pickerOptionSelected,
                  ]}
                  onPress={() => {
                    setFormData({ ...formData, location: province });
                    setShowLocationPicker(false);
                  }}
                >
                  <Text
                    style={[
                      styles.pickerOptionText,
                      formData.location === province &&
                      styles.pickerOptionTextSelected,
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
          ].map((gender) => (
            <TouchableOpacity
              key={gender.value}
              style={[
                styles.genderOption,
                formData.gender === gender.value &&
                styles.genderOptionSelected,
              ]}
              onPress={() =>
                setFormData({ ...formData, gender: gender.value })
              }
            >
              <Text
                style={[
                  styles.genderOptionText,
                  formData.gender === gender.value &&
                  styles.genderOptionTextSelected,
                ]}
              >
                {gender.label}
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
          <Text
            style={
              formData.age ? styles.pickerText : styles.pickerPlaceholder
            }
          >
            {formData.age || "请选择您的年龄段"}
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
              {AGE_RANGES.map((age) => (
                <TouchableOpacity
                  key={age}
                  style={[
                    styles.pickerOption,
                    formData.age === age && styles.pickerOptionSelected,
                  ]}
                  onPress={() => {
                    setFormData({ ...formData, age: age });
                    setShowAgePicker(false);
                  }}
                >
                  <Text
                    style={[
                      styles.pickerOptionText,
                      formData.age === age && styles.pickerOptionTextSelected,
                    ]}
                  >
                    {age}岁
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
          value={formData.preference}
          onChangeText={(text) =>
            setFormData({ ...formData, preference: text })
          }
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
              formData.favoriteBrandIds?.length > 0
                ? styles.pickerText
                : styles.pickerPlaceholder
            }
            numberOfLines={2}
          >
            {formData.favoriteBrandIds?.length > 0
              ? getSelectedBrandNames()
              : "选择您喜欢的品牌"}
          </Text>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.gray400} />
        </TouchableOpacity>
        {formData.favoriteBrandIds?.length > 0 && (
          <Text style={styles.brandSelectedCount}>
            已选择 {formData.favoriteBrandIds.length}/5
          </Text>
        )}
      </View>

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
              选择喜欢的品牌（{formData.favoriteBrandIds?.length || 0}/5）
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
              onChangeText={onBrandSearch}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {brandSearchKeyword.length > 0 && (
              <TouchableOpacity onPress={() => onBrandSearch("")}>
                <Ionicons name="close-circle" size={18} color={theme.colors.gray400} />
              </TouchableOpacity>
            )}
          </View>

          {loadingBrands ? (
            <View style={styles.brandLoadingContainer}>
              <Image
                source={require("../../../../assets/gif/profile-loading.gif")}
                style={styles.loadingGif}
                resizeMode="contain"
              />
            </View>
          ) : (
            <FlatList
              data={brandOptions}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => {
                const isSelected = formData.favoriteBrandIds?.includes(item.id);
                return (
                  <TouchableOpacity
                    style={[
                      styles.brandItem,
                      isSelected && styles.brandItemSelected,
                    ]}
                    onPress={() => handleToggleBrand(item.id)}
                  >
                    <View style={styles.brandInfo}>
                      <Text
                        style={[
                          styles.brandName,
                          isSelected && styles.brandNameSelected,
                        ]}
                      >
                        {item.name}
                      </Text>
                      {item.category && (
                        <Text style={styles.brandCategory}>{item.category}</Text>
                      )}
                    </View>
                    <View
                      style={[
                        styles.brandCheckbox,
                        isSelected && styles.brandCheckboxSelected,
                      ]}
                    >
                      {isSelected && (
                        <Ionicons name="checkmark" size={16} color={theme.colors.white} />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              }}
              showsVerticalScrollIndicator={false}
              onEndReached={onLoadMoreBrands}
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
                    <Text style={styles.brandLoadMoreText}>加载更多...</Text>
                  </View>
                ) : hasMoreBrands && brandOptions.length > 0 ? (
                  <View style={styles.brandLoadMoreContainer}>
                    <Text style={styles.brandLoadMoreHint}>上滑加载更多</Text>
                  </View>
                ) : brandOptions.length > 0 ? (
                  <View style={styles.brandLoadMoreContainer}>
                    <Text style={styles.brandLoadMoreHint}>已加载全部品牌</Text>
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
    </View>
  );
};
