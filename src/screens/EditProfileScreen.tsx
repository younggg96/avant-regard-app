import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  Modal,
  FlatList,
} from "react-native";
import { Alert } from "../utils/Alert";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { theme } from "../theme";
import { useAuthStore } from "../store/authStore";
import ScreenHeader from "../components/ScreenHeader";
import { userInfoService } from "../services/userInfoService";

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
  const navigation = useNavigation();
  const { user, updateProfile } = useAuthStore();

  // 表单数据
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [avatar, setAvatar] = useState("");

  // UI 状态
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showProvinceModal, setShowProvinceModal] = useState(false);

  // 从 API 加载用户信息
  useEffect(() => {
    const loadUserInfo = async () => {
      if (!user?.userId) {
        setInitialLoading(false);
        return;
      }

      try {
        const userInfo = await userInfoService.getUserInfo(user.userId);
        // 设置表单数据
        setUsername(userInfo.username || user.username || "");
        setBio(userInfo.bio || "");
        setLocation(userInfo.location || "");
        setAvatar(userInfo.avatarUrl || user.avatar || "");
      } catch (error) {
        console.error("加载用户信息失败:", error);
        // 使用本地数据作为后备
        setUsername(user.username || "");
        setBio(user.bio || "");
        setLocation(user.location || "");
        setAvatar(user.avatar || "");
      } finally {
        setInitialLoading(false);
      }
    };

    loadUserInfo();
  }, [user?.userId]);

  // 保存用户资料
  const handleSave = async () => {
    if (!username.trim()) {
      Alert.show("提示: 请输入用户名");
      return;
    }

    if (!user?.userId) {
      Alert.show("错误: 用户未登录");
      return;
    }

    setLoading(true);
    try {
      // 调用 API 更新用户资料
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
        avatar: updatedInfo.avatarUrl || avatar,
      });

      Alert.show("成功: 个人资料已更新", "", 1000);
      setTimeout(() => navigation.goBack(), 1000);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "更新失败，请重试";
      Alert.show("错误: " + message);
    } finally {
      setLoading(false);
    }
  };

  // 选择并上传头像
  const handlePickImage = async () => {
    if (!user?.userId) {
      Alert.show("错误: 用户未登录");
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.show("权限不足: 需要访问相册权限来更换头像");
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
        Alert.show("头像上传成功");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "上传失败";
      Alert.show("头像上传失败: " + message);
      // 恢复原来的头像
      setAvatar(previousAvatar);
    } finally {
      setUploadingAvatar(false);
    }
  };

  // 选择省份
  const handleSelectProvince = (province: string) => {
    setLocation(province);
    setShowProvinceModal(false);
  };

  // 加载中页面
  if (initialLoading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <ScreenHeader title="编辑个人资料" showBack={true} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.black} />
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader
        title="编辑个人资料"
        showBack={true}
        rightActions={[
          {
            icon: loading ? "hourglass-outline" : "checkmark",
            onPress: handleSave,
          },
        ]}
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* 头像区域 */}
        <View style={styles.avatarSection}>
          <TouchableOpacity
            style={styles.avatarContainer}
            onPress={handlePickImage}
            disabled={uploadingAvatar}
          >
            <Image
              source={{
                uri:
                  avatar ||
                  "https://api.dicebear.com/7.x/avataaars/png?seed=default",
              }}
              style={styles.avatar}
            />
            {uploadingAvatar ? (
              <View style={styles.avatarLoadingOverlay}>
                <ActivityIndicator size="small" color={theme.colors.white} />
              </View>
            ) : (
              <View style={styles.avatarEditIcon}>
                <Ionicons name="camera" size={20} color={theme.colors.white} />
              </View>
            )}
          </TouchableOpacity>
          <Text style={styles.avatarHint}>
            {uploadingAvatar ? "上传中..." : "点击更换头像"}
          </Text>
        </View>

        {/* 表单区域 */}
        <View style={styles.formSection}>
          {/* 用户名 */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>用户名 *</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="请输入用户名"
              placeholderTextColor={theme.colors.gray400}
              maxLength={20}
            />
          </View>

          {/* 个人简介 */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>个人简介</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={bio}
              onChangeText={setBio}
              placeholder="介绍一下自己..."
              placeholderTextColor={theme.colors.gray400}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              maxLength={200}
            />
            <Text style={styles.charCount}>{bio.length}/200</Text>
          </View>

          {/* 所在地 */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>所在地</Text>
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
                {location || "请选择所在省份"}
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

      {/* 省份选择弹窗 */}
      <Modal
        visible={showProvinceModal}
        animationType="slide"
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
            onPress={() => {}}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>选择所在省份</Text>
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
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
    color: theme.colors.gray500,
  },
  // 头像区域
  avatarSection: {
    alignItems: "center",
    paddingVertical: 32,
    backgroundColor: theme.colors.gray50,
  },
  avatarContainer: {
    position: "relative",
    marginBottom: 12,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: theme.colors.gray200,
  },
  avatarEditIcon: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.black,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: theme.colors.white,
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
    color: theme.colors.gray500,
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
    color: theme.colors.black,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: theme.colors.black,
    backgroundColor: theme.colors.white,
  },
  textArea: {
    height: 100,
    paddingTop: 12,
  },
  charCount: {
    fontSize: 12,
    color: theme.colors.gray400,
    textAlign: "right",
    marginTop: 4,
  },
  // 选择器
  selectInput: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: theme.colors.white,
  },
  selectInputText: {
    fontSize: 15,
    color: theme.colors.black,
  },
  selectInputPlaceholder: {
    color: theme.colors.gray400,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: theme.colors.white,
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
    borderBottomColor: theme.colors.gray100,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: theme.colors.black,
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
    borderBottomColor: theme.colors.gray100,
  },
  provinceItemSelected: {
    backgroundColor: theme.colors.gray50,
  },
  provinceItemText: {
    fontSize: 15,
    color: theme.colors.black,
  },
  provinceItemTextSelected: {
    fontWeight: "600",
  },
});

export default EditProfileScreen;
