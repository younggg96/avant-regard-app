import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRoute, useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { theme, useThemedStyles, type AppTheme } from "../theme";
import { Alert } from "../utils/Alert";
import { OptimizedImage } from "../components/ui/OptimizedImage";
import { ImageSize } from "../utils/imageUtils";
import HalfStarRating from "../components/HalfStarRating";

interface Comment {
  id: string;
  userName: string;
  userAvatar?: string;
  rating: number;
  content: string;
  date: string;
}

interface Collection {
  id: string;
  title: string;
  season: string;
  year: string;
  coverImage: string;
  comments?: Comment[];
}

interface AllCommentsParams {
  collection: Collection;
  brandName?: string;
}

const AllCommentsScreen = () => {
  const { t } = useTranslation();
  const route = useRoute();
  const navigation = useNavigation();
  const styles = useThemedStyles(makeStyles);
  const params = route.params as AllCommentsParams;
  const { collection, brandName } = params;

  const [comments, setComments] = useState<Comment[]>([]);
  const [isWritingComment, setIsWritingComment] = useState(false);
  const [newCommentText, setNewCommentText] = useState("");
  const [newCommentRating, setNewCommentRating] = useState(5);
  const [refreshing, setRefreshing] = useState(false);

  // 模拟评论数据
  const mockComments: Comment[] = [
    {
      id: "1",
      userName: "时尚达人小美",
      userAvatar: "https://via.placeholder.com/50",
      rating: 5,
      content:
        "这个系列真的太棒了！设计师的创意完全超出了我的想象，每一件作品都展现了对细节的极致追求。色彩搭配非常和谐，整体风格既现代又不失经典。",
      date: "2024-01-15",
    },
    {
      id: "2",
      userName: "Fashion_Lover_2024",
      rating: 4,
      content:
        "整体很不错，特别是色彩搭配很有新意。不过有几件单品感觉还可以更大胆一些，期待设计师下一季的作品。",
      date: "2024-01-14",
    },
    {
      id: "3",
      userName: "设计师Emma",
      userAvatar: "https://via.placeholder.com/50",
      rating: 5,
      content:
        "作为同行，我必须说这个系列的工艺水准真的很高。面料选择和剪裁都很考究，值得学习！每个细节都能看出设计师的用心。",
      date: "2024-01-13",
    },
    {
      id: "4",
      userName: "时装周观众",
      rating: 4,
      content:
        "现场看效果更震撼，模特的演绎也很到位。整个系列很好地诠释了品牌的理念。",
      date: "2024-01-12",
    },
    {
      id: "5",
      userName: "潮流博主Cici",
      userAvatar: "https://via.placeholder.com/50",
      rating: 3,
      content:
        "有些单品很不错，但整体感觉缺乏一些突破性的设计。希望能看到更多创新元素。",
      date: "2024-01-11",
    },
    {
      id: "6",
      userName: "时尚编辑Alice",
      userAvatar: "https://via.placeholder.com/50",
      rating: 5,
      content:
        "这季的设计真的让人眼前一亮！从配饰到成衣都能感受到设计师对时尚的独特理解。特别喜欢那几件外套的设计。",
      date: "2024-01-10",
    },
    {
      id: "7",
      userName: "学生小李",
      userAvatar: "https://via.placeholder.com/50",
      rating: 2,
      content:
        "个人觉得价格偏高，性价比不是很好。设计确实不错，但对学生来说不太友好。",
      date: "2024-01-09",
    },
    {
      id: "8",
      userName: "收藏家老王",
      userAvatar: "https://via.placeholder.com/50",
      rating: 5,
      content:
        "已经收藏了这个系列的几件单品，质量非常好。这个设计师的作品一直都很有收藏价值。",
      date: "2024-01-08",
    },
  ];

  useEffect(() => {
    setComments(mockComments);
  }, []);

  const renderStars = (rating: number, size: number = 14) => (
    <HalfStarRating
      rating={rating}
      size={size}
      color={theme.colors.black}
      inactiveColor={theme.colors.gray400}
      gap={0}
    />
  );

  const renderWritingStars = (rating: number) => (
    <HalfStarRating
      rating={rating}
      size={24}
      interactive
      onRatingChange={setNewCommentRating}
      color={theme.colors.black}
      inactiveColor={theme.colors.gray400}
      gap={8}
    />
  );

  const handleSubmitComment = () => {
    if (newCommentText.trim().length < 10) {
      Alert.show(t("post.commentMinLength"));
      return;
    }

    const newComment: Comment = {
      id: Date.now().toString(),
      userName: "我",
      rating: newCommentRating,
      content: newCommentText,
      date: new Date().toISOString().split("T")[0],
    };

    setComments((prev) => [newComment, ...prev]);
    setNewCommentText("");
    setNewCommentRating(5);
    setIsWritingComment(false);
    Alert.show(t("post.commentSuccess"));
  };

  const onRefresh = async () => {
    setRefreshing(true);
    // 模拟刷新延迟
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  };

  const renderComment = ({ item: comment }: { item: Comment }) => (
    <View style={styles.commentCard}>
      <View style={styles.commentHeader}>
        <View style={styles.userInfo}>
          {comment.userAvatar ? (
            <OptimizedImage
              uri={comment.userAvatar}
              size={ImageSize.THUMBNAIL}
              style={styles.userAvatar}
              contentFit="cover"
              lazy={true}
            />
          ) : (
            <View style={[styles.userAvatar, styles.placeholderAvatar]}>
              <Ionicons name="person" size={20} color={theme.colors.gray600} />
            </View>
          )}
          <View style={styles.userDetails}>
            <View style={styles.userNameRow}>
              <Text style={styles.userName}>{comment.userName}</Text>
            </View>
            <View style={styles.metaRow}>
              <View style={styles.commentStars}>
                {renderStars(comment.rating)}
              </View>
              <Text style={styles.commentDate}>{comment.date}</Text>
            </View>
          </View>
        </View>
      </View>

      <Text style={styles.commentContent}>{comment.content}</Text>
    </View>
  );

  const renderWriteCommentSection = () => {
    if (!isWritingComment) {
      return (
        <TouchableOpacity
          style={styles.writeCommentButton}
          onPress={() => setIsWritingComment(true)}
        >
          <Ionicons
            name="create-outline"
            size={20}
            color={theme.colors.gray600}
          />
          <Text style={styles.writeCommentButtonText}>{t("post.writeComment")}</Text>
        </TouchableOpacity>
      );
    }

    return (
      <View style={styles.writeCommentExpanded}>
        <View style={styles.ratingSection}>
          <Text style={styles.ratingLabel}>{t("post.rating")}:</Text>
          <View style={styles.writingStars}>
            {renderWritingStars(newCommentRating)}
          </View>
        </View>

        <TextInput
          style={styles.commentInput}
          placeholder={t("post.commentPlaceholder")}
          multiline
          numberOfLines={3}
          value={newCommentText}
          onChangeText={setNewCommentText}
          maxLength={500}
          autoFocus
        />

        <View style={styles.commentSubmitActions}>
          <TouchableOpacity
            style={styles.cancelSubmitButton}
            onPress={() => {
              setIsWritingComment(false);
              setNewCommentText("");
              setNewCommentRating(5);
            }}
          >
            <Text style={styles.cancelSubmitButtonText}>{t("common.cancel")}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.submitButton}
            onPress={handleSubmitComment}
          >
            <Text style={styles.submitButtonText}>{t("common.submit")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("post.comments")} ({comments.length})</Text>
        <View style={styles.headerRight} />
      </View>

      <View style={styles.collectionInfo}>
        <OptimizedImage
          uri={collection.coverImage}
          size={ImageSize.LARGE}
          style={styles.collectionThumbnail}
          contentFit="cover"
          lazy={false}
        />
        <View style={styles.collectionTextInfo}>
          <Text style={styles.collectionTitle}>
            {collection.title} - {collection.season} {collection.year}
          </Text>
          {brandName && (
            <Text style={styles.brandName}>by {brandName}</Text>
          )}
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <FlatList
          data={comments}
          renderItem={renderComment}
          keyExtractor={(item) => item.id}
          style={styles.commentsList}
          contentContainerStyle={styles.commentsListContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh}  />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons
                name="chatbubbles-outline"
                size={48}
                color={theme.colors.gray400}
              />
              <Text style={styles.emptyText}>{t("post.noComments")}</Text>
              <Text style={styles.emptySubtext}>{t("post.beFirstComment")}</Text>
            </View>
          }
        />

        <View style={styles.writeCommentContainer}>
          {renderWriteCommentSection()}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.colors.background,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: t.colors.border,
    },
    backButton: {
      padding: 8,
    },
    headerTitle: {
      fontSize: 18,
      fontFamily: "PlayfairDisplay-Bold",
      color: t.colors.text,
    },
    headerRight: {
      width: 40,
    },
    collectionInfo: {
      flexDirection: "row",
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: t.colors.border,
      alignItems: "center",
    },
    collectionThumbnail: {
      width: 80,
      height: 80,
      borderRadius: 8,
      marginRight: 16,
    },
    collectionTextInfo: {
      flex: 1,
    },
    collectionTitle: {
      fontSize: 16,
      fontFamily: "PlayfairDisplay-Bold",
      color: t.colors.text,
      marginBottom: 4,
      lineHeight: 22,
    },
    brandName: {
      fontSize: 14,
      fontFamily: __DEV__ ? "Georgia" : "PlayfairDisplay-Regular",
      color: t.colors.gray600,
    },
    writeCommentContainer: {
      backgroundColor: t.colors.card,
      borderTopWidth: 1,
      borderTopColor: t.colors.border,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    writeCommentButton: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: t.colors.gray50,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 12,
    },
    writeCommentButtonText: {
      fontSize: 16,
      fontFamily: __DEV__ ? "Georgia" : "PlayfairDisplay-Regular",
      color: t.colors.gray600,
      marginLeft: 8,
      flex: 1,
    },
    writeCommentExpanded: {
      backgroundColor: t.colors.gray50,
      padding: 16,
      borderRadius: 12,
      elevation: 3,
    },
    ratingSection: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 16,
    },
    ratingLabel: {
      fontSize: 16,
      fontFamily: __DEV__ ? "Georgia" : "PlayfairDisplay-Medium",
      color: t.colors.text,
      marginRight: 12,
    },
    writingStars: {
      flexDirection: "row",
      gap: 8,
    },
    commentInput: {
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      fontFamily: __DEV__ ? "Georgia" : "PlayfairDisplay-Regular",
      color: t.colors.text,
      backgroundColor: t.colors.inputBackground,
      textAlignVertical: "top",
      minHeight: 100,
      marginBottom: 16,
    },
    commentSubmitActions: {
      flexDirection: "row",
      justifyContent: "space-between",
    },
    cancelSubmitButton: {
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 8,
      backgroundColor: t.colors.gray100,
    },
    cancelSubmitButtonText: {
      fontSize: 16,
      fontFamily: __DEV__ ? "Georgia" : "PlayfairDisplay-Medium",
      color: t.colors.gray600,
    },
    submitButton: {
      backgroundColor: t.colors.text,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 8,
    },
    submitButtonText: {
      fontSize: 16,
      fontFamily: __DEV__ ? "Georgia" : "PlayfairDisplay-Medium",
      color: t.colors.textInverted,
    },
    commentsList: {
      flex: 1,
    },
    commentsListContent: {
      paddingBottom: 20,
    },
    commentCard: {
      backgroundColor: t.colors.card,
      marginHorizontal: 20,
      marginVertical: 6,
      padding: 16,
      borderRadius: 12,
      shadowColor: "#000",
      shadowOffset: {
        width: 0,
        height: 1,
      },
      shadowOpacity: 0.08,
      shadowRadius: 3,
      elevation: 2,
    },
    commentHeader: {
      marginBottom: 12,
    },
    userInfo: {
      flexDirection: "row",
      alignItems: "flex-start",
    },
    userAvatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      marginRight: 12,
    },
    placeholderAvatar: {
      backgroundColor: t.colors.gray200,
      justifyContent: "center",
      alignItems: "center",
    },
    userDetails: {
      flex: 1,
    },
    userNameRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 4,
    },
    userName: {
      fontSize: 15,
      fontFamily: __DEV__ ? "Georgia" : "PlayfairDisplay-Medium",
      color: t.colors.text,
    },
    metaRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    commentStars: {
      flexDirection: "row",
      marginRight: 8,
      gap: 0,
    },
    commentDate: {
      fontSize: 12,
      fontFamily: __DEV__ ? "Georgia" : "PlayfairDisplay-Regular",
      color: t.colors.gray600,
    },
    commentContent: {
      fontSize: 15,
      fontFamily: __DEV__ ? "Georgia" : "PlayfairDisplay-Regular",
      color: t.colors.text,
      lineHeight: 21,
      marginTop: 8,
    },
    emptyContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 60,
    },
    emptyText: {
      fontSize: 18,
      fontFamily: __DEV__ ? "Georgia" : "PlayfairDisplay-Medium",
      color: t.colors.gray600,
      marginTop: 16,
    },
    emptySubtext: {
      fontSize: 14,
      fontFamily: __DEV__ ? "Georgia" : "PlayfairDisplay-Regular",
      color: t.colors.gray400,
      marginTop: 8,
    },
  });

export default AllCommentsScreen;
