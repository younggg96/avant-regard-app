import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  Dimensions,
  FlatList,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRoute, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme";
import { Alert } from "../utils/Alert";

const { width: screenWidth } = Dimensions.get("window");

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
  designerName?: string;
}

const AllCommentsScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const params = route.params as AllCommentsParams;
  const { collection, designerName } = params;

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

  const renderStars = (rating: number, size: number = 14) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Ionicons
          key={i}
          name={i <= rating ? "star" : "star-outline"}
          size={size}
          color={i <= rating ? theme.colors.black : theme.colors.gray400}
        />
      );
    }
    return stars;
  };

  const renderWritingStars = (rating: number) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <TouchableOpacity key={i} onPress={() => setNewCommentRating(i)}>
          <Ionicons
            name={i <= rating ? "star" : "star-outline"}
            size={24}
            color={i <= rating ? theme.colors.black : theme.colors.gray400}
          />
        </TouchableOpacity>
      );
    }
    return stars;
  };

  const handleSubmitComment = () => {
    if (newCommentText.trim().length < 10) {
      Alert.show("提示", "评论内容至少需要10个字符");
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
    Alert.show("成功", "评论发布成功！");
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
            <Image
              source={{ uri: comment.userAvatar }}
              style={styles.userAvatar}
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
          <Text style={styles.writeCommentButtonText}>写评论...</Text>
        </TouchableOpacity>
      );
    }

    return (
      <View style={styles.writeCommentExpanded}>
        <View style={styles.ratingSection}>
          <Text style={styles.ratingLabel}>评分:</Text>
          <View style={styles.writingStars}>
            {renderWritingStars(newCommentRating)}
          </View>
        </View>

        <TextInput
          style={styles.commentInput}
          placeholder="分享你的看法..."
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
            <Text style={styles.cancelSubmitButtonText}>取消</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.submitButton}
            onPress={handleSubmitComment}
          >
            <Text style={styles.submitButtonText}>发布</Text>
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
        <Text style={styles.headerTitle}>所有评论 ({comments.length})</Text>
        <View style={styles.headerRight} />
      </View>

      <View style={styles.collectionInfo}>
        <Image
          source={{ uri: collection.coverImage }}
          style={styles.collectionThumbnail}
          resizeMode="cover"
        />
        <View style={styles.collectionTextInfo}>
          <Text style={styles.collectionTitle}>
            {collection.title} - {collection.season} {collection.year}
          </Text>
          {designerName && (
            <Text style={styles.designerName}>by {designerName}</Text>
          )}
        </View>
      </View>

      <FlatList
        data={comments}
        renderItem={renderComment}
        keyExtractor={(item) => item.id}
        style={styles.commentsList}
        contentContainerStyle={styles.commentsListContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons
              name="chatbubbles-outline"
              size={48}
              color={theme.colors.gray400}
            />
            <Text style={styles.emptyText}>暂无评论</Text>
            <Text style={styles.emptySubtext}>成为第一个评论的人吧！</Text>
          </View>
        }
      />

      <View style={styles.writeCommentContainer}>
        {renderWriteCommentSection()}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray100,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: __DEV__ ? "Georgia" : "PlayfairDisplay-Bold",
    color: theme.colors.black,
  },
  headerRight: {
    width: 40,
  },
  collectionInfo: {
    flexDirection: "row",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray100,
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
    fontFamily: __DEV__ ? "Georgia" : "PlayfairDisplay-Bold",
    color: theme.colors.black,
    marginBottom: 4,
    lineHeight: 22,
  },
  designerName: {
    fontSize: 14,
    fontFamily: __DEV__ ? "System" : "Inter-Regular",
    color: theme.colors.gray600,
  },
  writeCommentContainer: {
    backgroundColor: theme.colors.white,
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray100,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  writeCommentButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.gray50,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  writeCommentButtonText: {
    fontSize: 16,
    fontFamily: __DEV__ ? "System" : "Inter-Regular",
    color: theme.colors.gray600,
    marginLeft: 8,
    flex: 1,
  },
  writeCommentExpanded: {
    backgroundColor: theme.colors.gray50,
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
    fontFamily: __DEV__ ? "System" : "Inter-Medium",
    color: theme.colors.black,
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
    fontFamily: __DEV__ ? "System" : "Inter-Regular",
    color: theme.colors.black,
    backgroundColor: theme.colors.white,
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
    backgroundColor: theme.colors.gray100,
  },
  cancelSubmitButtonText: {
    fontSize: 16,
    fontFamily: __DEV__ ? "System" : "Inter-Medium",
    color: theme.colors.gray600,
  },
  submitButton: {
    backgroundColor: theme.colors.black,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  submitButtonText: {
    fontSize: 16,
    fontFamily: __DEV__ ? "System" : "Inter-Medium",
    color: theme.colors.white,
  },
  commentsList: {
    flex: 1,
  },
  commentsListContent: {
    paddingBottom: 20,
  },
  commentCard: {
    backgroundColor: theme.colors.white,
    marginHorizontal: 20,
    marginVertical: 6,
    padding: 16,
    borderRadius: 12,
    shadowColor: theme.colors.black,
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
    backgroundColor: theme.colors.gray200,
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
    fontFamily: __DEV__ ? "System" : "Inter-Medium",
    color: theme.colors.black,
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
    fontFamily: __DEV__ ? "System" : "Inter-Regular",
    color: theme.colors.gray600,
  },
  commentContent: {
    fontSize: 15,
    fontFamily: __DEV__ ? "System" : "Inter-Regular",
    color: theme.colors.black,
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
    fontFamily: __DEV__ ? "System" : "Inter-Medium",
    color: theme.colors.gray600,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    fontFamily: __DEV__ ? "System" : "Inter-Regular",
    color: theme.colors.gray400,
    marginTop: 8,
  },
});

export default AllCommentsScreen;
