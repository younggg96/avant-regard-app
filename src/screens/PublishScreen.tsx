import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme";
import ScreenHeader from "../components/ScreenHeader";

type ContentType = "lookbook" | "outfit" | "review" | "article";

interface ContentOption {
  id: ContentType;
  title: string;
  subtitle: string;
}

const PublishScreen = () => {
  const navigation = useNavigation();
  const [selectedType, setSelectedType] = useState<ContentType | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");

  const contentOptions: ContentOption[] = [
    {
      id: "lookbook",
      title: "发布Lookbook",
      subtitle: "分享时装系列或造型集合",
    },
    {
      id: "outfit",
      title: "分享搭配",
      subtitle: "展示个人穿搭或搭配建议",
    },
    {
      id: "review",
      title: "单品评价",
      subtitle: "对时尚单品进行专业点评",
    },
    {
      id: "article",
      title: "时尚文章",
      subtitle: "发表时尚观点或趋势分析",
    },
  ];

  const handlePublish = () => {
    if (!selectedType || !title.trim()) {
      Alert.alert("提示", "请选择内容类型并填写标题");
      return;
    }

    // Here you would typically send the data to your backend
    Alert.alert("发布成功", "您的内容已成功发布！", [
      {
        text: "确定",
        onPress: () => {
          // Reset form and navigate back
          setSelectedType(null);
          setTitle("");
          setDescription("");
          setTags("");
          navigation.goBack();
        },
      },
    ]);
  };

  if (!selectedType) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <ScreenHeader
          title="创建内容"
          subtitle="选择您要发布的内容类型"
          showCloseButton
        />

        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.contentContainer}
        >
          {contentOptions.map((option) => (
            <TouchableOpacity
              key={option.id}
              style={styles.optionItem}
              onPress={() => setSelectedType(option.id)}
              activeOpacity={0.7}
            >
              <View style={styles.optionInfo}>
                <Text style={styles.optionTitle}>{option.title}</Text>
                <Text style={styles.optionSubtitle}>{option.subtitle}</Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={theme.colors.gray400}
              />
            </TouchableOpacity>
          ))}
        </ScrollView>
      </SafeAreaView>
    );
  }

  const selectedOption = contentOptions.find(
    (option) => option.id === selectedType
  )!;

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScreenHeader
        title={selectedOption.title}
        showBackButton
        rightActions={[
          {
            icon: "save",
            onPress: handlePublish,
          },
        ]}
      />

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
      >
        {/* Title Input */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>标题 *</Text>
          <TextInput
            style={styles.titleInput}
            placeholder="为您的内容添加一个吸引人的标题"
            placeholderTextColor={theme.colors.gray400}
            value={title}
            onChangeText={setTitle}
            multiline
          />
        </View>

        {/* Image Upload Section */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>添加图片</Text>
          <TouchableOpacity style={styles.imageUpload} activeOpacity={0.8}>
            <Ionicons
              name="camera-outline"
              size={32}
              color={theme.colors.gray400}
            />
            <Text style={styles.imageUploadText}>点击上传图片</Text>
            <Text style={styles.imageUploadSubtext}>支持JPG, PNG格式</Text>
          </TouchableOpacity>
        </View>

        {/* Description Input */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>描述</Text>
          <TextInput
            style={styles.descriptionInput}
            placeholder="详细描述您的内容..."
            placeholderTextColor={theme.colors.gray400}
            value={description}
            onChangeText={setDescription}
            multiline
            textAlignVertical="top"
          />
        </View>

        {/* Tags Input */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>标签</Text>
          <TextInput
            style={styles.tagsInput}
            placeholder="添加相关标签，用逗号分隔"
            placeholderTextColor={theme.colors.gray400}
            value={tags}
            onChangeText={setTags}
          />
          <Text style={styles.tagsHint}>例如: 时尚, 搭配, 春夏, 经典</Text>
        </View>

        {/* Category specific options */}
        {selectedType === "outfit" && (
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>搭配场合</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.occasionTags}
            >
              {["日常", "工作", "约会", "派对", "正式", "度假"].map(
                (occasion) => (
                  <TouchableOpacity
                    key={occasion}
                    style={styles.occasionTag}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.occasionTagText}>{occasion}</Text>
                  </TouchableOpacity>
                )
              )}
            </ScrollView>
          </View>
        )}
      </ScrollView>
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
    marginTop: theme.spacing.md,
  },
  contentContainer: {
    paddingBottom: theme.spacing.lg,
  },
  optionItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray100,
  },
  optionInfo: {
    flex: 1,
  },
  optionTitle: {
    ...theme.typography.body,
    fontSize: 17,
    fontWeight: "400",
    color: theme.colors.black,
    marginBottom: 2,
  },
  optionSubtitle: {
    ...theme.typography.bodySmall,
    fontSize: 14,
    color: theme.colors.gray500,
  },
  inputSection: {
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  inputLabel: {
    ...theme.typography.h3,
    color: theme.colors.black,
    marginBottom: theme.spacing.sm,
  },
  titleInput: {
    ...theme.typography.body,
    color: theme.colors.black,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    minHeight: 60,
  },
  imageUpload: {
    borderWidth: 2,
    borderColor: theme.colors.gray200,
    borderStyle: "dashed",
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.xxl,
    alignItems: "center",
    justifyContent: "center",
  },
  imageUploadText: {
    ...theme.typography.body,
    color: theme.colors.gray400,
    marginTop: theme.spacing.sm,
  },
  imageUploadSubtext: {
    ...theme.typography.caption,
    color: theme.colors.gray400,
    marginTop: theme.spacing.xs,
  },
  descriptionInput: {
    ...theme.typography.body,
    color: theme.colors.black,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    minHeight: 120,
  },
  tagsInput: {
    ...theme.typography.body,
    color: theme.colors.black,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
  },
  tagsHint: {
    ...theme.typography.caption,
    color: theme.colors.gray400,
    marginTop: theme.spacing.xs,
  },
  occasionTags: {
    maxHeight: 50,
  },
  occasionTag: {
    backgroundColor: theme.colors.gray100,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.full,
    marginRight: theme.spacing.sm,
  },
  occasionTagText: {
    ...theme.typography.bodySmall,
    color: theme.colors.gray600,
  },
});

export default PublishScreen;
