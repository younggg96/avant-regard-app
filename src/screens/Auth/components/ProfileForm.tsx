import React from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../../theme";
import { Gender } from "../../../services/userInfoService";
import { FormData } from "../types";
import { PROVINCES, AGE_RANGES } from "../constants";
import { styles } from "../styles";

interface ProfileFormProps {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  showLocationPicker: boolean;
  setShowLocationPicker: (show: boolean) => void;
  showAgePicker: boolean;
  setShowAgePicker: (show: boolean) => void;
}

export const ProfileForm: React.FC<ProfileFormProps> = ({
  formData,
  setFormData,
  showLocationPicker,
  setShowLocationPicker,
  showAgePicker,
  setShowAgePicker,
}) => {
  return (
    <View style={styles.formContainer}>
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
        <Text style={styles.inputLabel}>时尚偏好（选填）</Text>
        <TextInput
          style={[styles.input, styles.preferenceInput]}
          placeholder="例如：极简主义、街头风格、复古..."
          value={formData.preference}
          onChangeText={(text) =>
            setFormData({ ...formData, preference: text })
          }
          maxLength={100}
          multiline
        />
      </View>
    </View>
  );
};
