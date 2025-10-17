import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  StyleSheet,
  Dimensions,
  ScrollView as RNScrollView,
  ActivityIndicator,
  TouchableOpacity,
  View,
  Image as RNImage,
  Share,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  Keyboard,
  TouchableWithoutFeedback,
  Modal,
  FlatList,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRoute, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Box, Text, Pressable, HStack, VStack, Image } from "../components/ui";
import { theme } from "../theme";
import { Post } from "../components/PostCard";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface PostDetailRouteParams {
  postId?: string;
  post?: Post;
}

// 模拟评论数据
interface Comment {
  id: string;
  userName: string;
  userAvatar: string;
  content: string;
  timestamp: string;
  likes: number;
  isLiked?: boolean;
}

const mockComments: Comment[] = [
  {
    id: "comment-1",
    userName: "时尚达人小美",
    userAvatar: "https://picsum.photos/id/213/40/40",
    content: "这个系列真的太棒了！设计师的创意完全超出了我的想象。",
    timestamp: "1小时前",
    likes: 23,
    isLiked: false,
  },
  {
    id: "comment-2",
    userName: "Fashion Lover",
    userAvatar: "https://picsum.photos/id/227/40/40",
    content: "配色很高级，期待能看到更多这样的作品。",
    timestamp: "3小时前",
    likes: 15,
    isLiked: true,
  },
  {
    id: "comment-3",
    userName: "设计师Emma",
    userAvatar: "https://picsum.photos/id/239/40/40",
    content: "作为同行，必须点赞！工艺水准真的很高。",
    timestamp: "5小时前",
    likes: 42,
    isLiked: false,
  },
];

const PostDetailScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const params = route.params as PostDetailRouteParams;
  const scrollViewRef = useRef<RNScrollView>(null);
  const commentInputRef = useRef<TextInput>(null);

  // 这里应该根据postId从API获取post数据，暂时使用传入的post
  const [post, setPost] = useState<Post | null>(params.post || null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [comments, setComments] = useState<Comment[]>(mockComments);
  const [commentInput, setCommentInput] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isCommentFocused, setIsCommentFocused] = useState(false);
  const [fullscreenVisible, setFullscreenVisible] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const fullscreenFlatListRef = useRef<FlatList>(null);

  // 监听键盘事件
  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (e) => {
        console.log("Keyboard showing, height:", e.endCoordinates.height);
        setKeyboardHeight(e.endCoordinates.height);
      }
    );

    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => {
        console.log("Keyboard hiding");
        setKeyboardHeight(0);
        // 不自动关闭 focused 状态，让用户手动关闭
      }
    );

    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, []);

  // 处理输入框点击
  const handleInputPress = useCallback(() => {
    console.log("Input pressed, setting focused to true");
    setIsCommentFocused(true);
    // 延迟聚焦，等待状态更新和UI渲染
    setTimeout(() => {
      console.log("Trying to focus input...");
      if (commentInputRef.current) {
        commentInputRef.current.focus();
        console.log("Input focused");
      } else {
        console.log("Input ref is null");
      }
    }, 100);
  }, []);

  // 处理输入框失去焦点
  const handleInputBlur = useCallback(() => {
    if (!commentInput) {
      setIsCommentFocused(false);
    }
  }, [commentInput]);

  // 处理点击遮罩层
  const handleOverlayPress = useCallback(() => {
    Keyboard.dismiss();
    commentInputRef.current?.blur();
    setIsCommentFocused(false);
  }, []);

  // 处理打开全屏图片
  const handleOpenFullscreen = useCallback((index: number) => {
    setCurrentImageIndex(index);
    setFullscreenVisible(true);
  }, []);

  // 处理关闭全屏图片
  const handleCloseFullscreen = useCallback(() => {
    setFullscreenVisible(false);
  }, []);

  // 处理点赞
  const handleLike = useCallback(() => {
    if (!post) return;

    setPost((prev) => {
      if (!prev) return null;
      const currentLikes = prev.engagement?.likes || 0;
      const currentIsLiked = prev.engagement?.isLiked || false;

      return {
        ...prev,
        engagement: {
          ...prev.engagement,
          likes: currentIsLiked ? currentLikes - 1 : currentLikes + 1,
          isLiked: !currentIsLiked,
        },
      } as Post;
    });
  }, [post]);

  // 处理收藏
  const handleSave = useCallback(() => {
    if (!post) return;

    setPost((prev) => {
      if (!prev) return null;
      const currentSaves = prev.engagement?.saves || 0;
      const currentIsSaved = prev.engagement?.isSaved || false;

      return {
        ...prev,
        engagement: {
          ...prev.engagement,
          saves: currentIsSaved ? currentSaves - 1 : currentSaves + 1,
          isSaved: !currentIsSaved,
        },
      } as Post;
    });
  }, [post]);

  // 处理分享
  const handleShare = useCallback(async () => {
    if (!post) return;

    try {
      await Share.share({
        message: `查看这篇精彩内容：${
          post.content?.title || ""
        }\n分享自 AVANT REGARD`,
        title: post.content?.title,
      });
    } catch (error) {
      console.error("分享失败:", error);
    }
  }, [post]);

  // 处理关注
  const handleFollow = useCallback(() => {
    setIsFollowing((prev) => !prev);
    Alert.alert("成功", isFollowing ? "已取消关注" : "已关注");
  }, [isFollowing]);

  // 处理评论点赞
  const handleCommentLike = useCallback((commentId: string) => {
    setComments((prev) =>
      prev.map((comment) =>
        comment.id === commentId
          ? {
              ...comment,
              isLiked: !comment.isLiked,
              likes: comment.isLiked ? comment.likes - 1 : comment.likes + 1,
            }
          : comment
      )
    );
  }, []);

  // 处理提交评论
  const handleSubmitComment = useCallback(() => {
    if (!commentInput.trim()) return;

    // 关闭键盘和输入框
    Keyboard.dismiss();
    setIsCommentFocused(false);
    setIsSubmittingComment(true);

    // 模拟API调用
    setTimeout(() => {
      const newComment: Comment = {
        id: `comment-${Date.now()}`,
        userName: "我",
        userAvatar: "https://picsum.photos/id/251/40/40",
        content: commentInput,
        timestamp: "刚刚",
        likes: 0,
        isLiked: false,
      };

      setComments((prev) => [newComment, ...prev]);
      setCommentInput("");
      setIsSubmittingComment(false);

      // 显示成功提示
      Alert.alert("成功", "评论已发布");

      // 滚动到评论区顶部，显示新评论
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }, 500);
  }, [commentInput]);

  if (!post) {
    return (
      <SafeAreaView style={styles.container}>
        <Box flex={1} justifyContent="center" alignItems="center">
          <Text color="$gray600" fontSize="$md">
            帖子不存在
          </Text>
        </Box>
      </SafeAreaView>
    );
  }

  const images = post.content?.images || [];
  const displayLikes = post.engagement?.likes || 0;
  const displaySaves = post.engagement?.saves || 0;
  const displayComments = post.engagement?.comments || comments.length;
  const displayIsLiked = post.engagement?.isLiked || false;
  const displayIsSaved = post.engagement?.isSaved || false;

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        {/* Header with Author Info - Single Row */}
        <HStack
          px="$md"
          py="$sm"
          alignItems="center"
          justifyContent="between"
          bg="$white"
          borderBottomWidth={1}
          borderBottomColor="$gray100"
        >
          {/* Left: Back + Author Info */}
          <HStack space="sm" alignItems="center" flex={1}>
            <Pressable onPress={() => navigation.goBack()} p="$xs">
              <Ionicons
                name="arrow-back"
                size={24}
                color={theme.colors.black}
              />
            </Pressable>

            <Image
              source={{ uri: post.author.avatar }}
              style={styles.headerAvatar}
            />

            <VStack flex={1}>
              <HStack space="xs" alignItems="center">
                <Text
                  fontSize="$sm"
                  fontWeight="$semibold"
                  color="$black"
                  numberOfLines={1}
                >
                  {post.author.name}
                </Text>
              </HStack>
              <Text fontSize="$xs" color="$gray600">
                {post.timestamp}
              </Text>
            </VStack>
          </HStack>

          {/* Right: Follow + Share */}
          <HStack space="xs" alignItems="center">
            <Pressable
              onPress={handleFollow}
              px="$md"
              py="$xs"
              bg={isFollowing ? "$gray100" : "$black"}
              rounded="$md"
            >
              <Text
                fontSize="$xs"
                fontWeight="$semibold"
                color={isFollowing ? "$black" : "$white"}
              >
                {isFollowing ? "已关注" : "关注"}
              </Text>
            </Pressable>

            <Pressable onPress={handleShare} pl="$sm">
              <Ionicons
                name="share-outline"
                size={20}
                color={theme.colors.black}
              />
            </Pressable>
          </HStack>
        </HStack>

        {/* Content */}
        <RNScrollView
          ref={scrollViewRef}
          showsVerticalScrollIndicator={false}
          style={styles.scrollView}
        >
          {/* Title and Description Section */}
          <VStack
            px="$md"
            py="$md"
            space="md"
            borderBottomWidth={1}
            borderBottomColor="$gray100"
          >
            {/* Title */}
            <Text fontSize="$xl" fontWeight="$bold" color="$black">
              {post.content?.title}
            </Text>

            {/* Description */}
            {post.content?.description && (
              <Text
                fontSize="$md"
                color="$gray800"
                lineHeight="$lg"
                style={{ letterSpacing: 0.3 }}
              >
                {post.content.description}
              </Text>
            )}

            {/* Type-specific content */}
            {post.type === "lookbook" && (post.brandName || post.season) && (
              <VStack space="xs" mt="$xs">
                {post.brandName && (
                  <HStack space="xs" alignItems="center">
                    <Ionicons
                      name="business-outline"
                      size={16}
                      color={theme.colors.gray600}
                    />
                    <Text fontSize="$sm" color="$gray600">
                      品牌: {post.brandName}
                    </Text>
                  </HStack>
                )}
                {post.season && (
                  <HStack space="xs" alignItems="center">
                    <Ionicons
                      name="calendar-outline"
                      size={16}
                      color={theme.colors.gray600}
                    />
                    <Text fontSize="$sm" color="$gray600">
                      系列: {post.season}
                    </Text>
                  </HStack>
                )}
              </VStack>
            )}

            {post.type === "article" && post.readTime && (
              <HStack space="xs" alignItems="center" mt="$xs">
                <Ionicons
                  name="time-outline"
                  size={16}
                  color={theme.colors.gray600}
                />
                <Text fontSize="$sm" color="$gray600">
                  {post.readTime}
                </Text>
              </HStack>
            )}

            {post.type === "review" && post.rating !== undefined && (
              <HStack space="xs" alignItems="center" mt="$xs">
                <Ionicons name="star" size={16} color={theme.colors.accent} />
                <Text fontSize="$sm" color="$gray800" fontWeight="$medium">
                  评分: {post.rating}/5
                </Text>
              </HStack>
            )}
          </VStack>

          {/* Image Grid - 3 columns */}
          {images.length > 0 && (
            <View style={styles.imageGrid}>
              {images.map((image, index) => (
                <Pressable
                  key={index}
                  style={styles.gridImageWrapper}
                  onPress={() => handleOpenFullscreen(index)}
                >
                  <RNImage
                    source={{ uri: image }}
                    style={styles.gridImage}
                    resizeMode="cover"
                  />
                </Pressable>
              ))}
            </View>
          )}

          {/* Additional Content */}
          {post.type === "outfit" && (
            <VStack px="$md" py="$md" space="md">
              {/* Outfit Items */}
              {post.items && post.items.length > 0 && (
                <VStack space="md" mt="$lg">
                  <Text fontSize="$lg" fontWeight="$semibold" color="$black">
                    搭配单品
                  </Text>
                  {post.items.map((item) => (
                    <Pressable key={item.id}>
                      <HStack
                        space="md"
                        p="$md"
                        bg="$gray50"
                        rounded="$md"
                        alignItems="center"
                      >
                        <Image
                          source={{ uri: item.imageUrl }}
                          style={styles.itemImage}
                        />
                        <VStack flex={1} space="xs">
                          <Text
                            fontSize="$md"
                            fontWeight="$semibold"
                            color="$black"
                          >
                            {item.name}
                          </Text>
                          <Text fontSize="$sm" color="$gray600">
                            {item.brand}
                          </Text>
                          <Text
                            fontSize="$md"
                            fontWeight="$bold"
                            color="$accent"
                          >
                            {item.price}
                          </Text>
                        </VStack>
                        <Ionicons
                          name="chevron-forward"
                          size={20}
                          color={theme.colors.gray400}
                        />
                      </HStack>
                    </Pressable>
                  ))}
                </VStack>
              )}
            </VStack>
          )}

          {/* Comments Section */}
          <VStack
            space="md"
            px="$md"
            py="$lg"
            mt="$md"
            borderTopWidth={8}
            borderTopColor="$gray100"
          >
            <Text fontSize="$lg" fontWeight="$semibold" color="$black">
              评论 ({comments.length})
            </Text>

            {/* Comments List */}
            {comments.map((comment) => (
              <HStack key={comment.id} space="sm" mt="$md">
                <Image
                  source={{ uri: comment.userAvatar }}
                  style={styles.commentAvatar}
                />
                <VStack flex={1} space="xs">
                  <HStack justifyContent="between" alignItems="center">
                    <Text fontSize="$sm" fontWeight="$semibold" color="$black">
                      {comment.userName}
                    </Text>
                    <Text fontSize="$xs" color="$gray600">
                      {comment.timestamp}
                    </Text>
                  </HStack>
                  <Text fontSize="$sm" color="$gray800" lineHeight="$md">
                    {comment.content}
                  </Text>
                  <HStack space="md" mt="$xs">
                    <Pressable onPress={() => handleCommentLike(comment.id)}>
                      <HStack space="xs" alignItems="center">
                        <Ionicons
                          name={comment.isLiked ? "heart" : "heart-outline"}
                          size={16}
                          color={
                            comment.isLiked ? "#FF3040" : theme.colors.gray400
                          }
                        />
                        <Text
                          fontSize="$xs"
                          color={comment.isLiked ? "#FF3040" : "$gray600"}
                        >
                          {comment.likes}
                        </Text>
                      </HStack>
                    </Pressable>
                    <Pressable>
                      <Text fontSize="$xs" color="$gray600">
                        回复
                      </Text>
                    </Pressable>
                  </HStack>
                </VStack>
              </HStack>
            ))}
          </VStack>

          {/* Bottom spacing */}
          <Box height={80} />
        </RNScrollView>

        {/* Gray Overlay when focused */}
        {isCommentFocused && (
          <TouchableWithoutFeedback onPress={handleOverlayPress}>
            <View style={styles.overlay} />
          </TouchableWithoutFeedback>
        )}

        {/* Fixed Bottom Bar with Engagement + Input */}
        <View
          style={[
            styles.bottomBar,
            isCommentFocused && styles.bottomBarExpanded,
          ]}
        >
          {/* Expanded Input Area when focused */}
          {isCommentFocused && (
            <View style={styles.expandedInputContainer}>
              <View style={styles.expandedTextInputWrapper}>
                <TextInput
                  ref={commentInputRef}
                  style={styles.expandedTextInput}
                  placeholder="写评论..."
                  placeholderTextColor={theme.colors.gray600}
                  value={commentInput}
                  onChangeText={(text) => {
                    const singleLineText = text.replace(/[\r\n]/g, "");
                    setCommentInput(singleLineText);
                  }}
                  onBlur={handleInputBlur}
                  maxLength={500}
                  returnKeyType="send"
                  onSubmitEditing={handleSubmitComment}
                  multiline={false}
                />
                <TouchableOpacity
                  onPress={handleSubmitComment}
                  disabled={isSubmittingComment || !commentInput.trim()}
                  style={styles.expandedSendButton}
                >
                  {isSubmittingComment ? (
                    <ActivityIndicator
                      size="small"
                      color={theme.colors.accent}
                    />
                  ) : (
                    <Ionicons
                      name="send"
                      size={20}
                      color={
                        commentInput.trim()
                          ? theme.colors.accent
                          : theme.colors.gray400
                      }
                    />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Compact Bottom Bar */}
          <View style={styles.compactBottomBar}>
            {/* Engagement Icons */}
            {!isCommentFocused && (
              <View style={styles.engagementSection}>
                <Pressable onPress={handleLike} style={styles.engagementButton}>
                  <VStack alignItems="center" space="xs">
                    <Ionicons
                      name={displayIsLiked ? "heart" : "heart-outline"}
                      size={20}
                      color={displayIsLiked ? "#FF3040" : theme.colors.gray600}
                    />
                    <Text
                      fontSize="$xs"
                      color={displayIsLiked ? "#FF3040" : "$gray600"}
                      fontWeight="$medium"
                    >
                      {displayLikes}
                    </Text>
                  </VStack>
                </Pressable>

                <Pressable onPress={handleSave} style={styles.engagementButton}>
                  <VStack alignItems="center" space="xs">
                    <Ionicons
                      name={displayIsSaved ? "bookmark" : "bookmark-outline"}
                      size={20}
                      color={
                        displayIsSaved
                          ? theme.colors.accent
                          : theme.colors.gray600
                      }
                    />
                    <Text
                      fontSize="$xs"
                      color={displayIsSaved ? "$accent" : "$gray600"}
                      fontWeight="$medium"
                    >
                      {displaySaves}
                    </Text>
                  </VStack>
                </Pressable>

                <Pressable style={styles.engagementButton}>
                  <VStack alignItems="center" space="xs">
                    <Ionicons
                      name="chatbubble-outline"
                      size={20}
                      color={theme.colors.gray600}
                    />
                    <Text fontSize="$xs" color="$gray600" fontWeight="$medium">
                      {displayComments}
                    </Text>
                  </VStack>
                </Pressable>
              </View>
            )}

            {/* Comment Input */}
            {!isCommentFocused && (
              <TouchableOpacity
                onPress={handleInputPress}
                style={styles.compactInputWrapper}
                activeOpacity={0.7}
              >
                <Text fontSize="$sm" color="$gray600">
                  写评论...
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Fullscreen Image Viewer */}
      <Modal
        visible={fullscreenVisible}
        transparent={true}
        onRequestClose={handleCloseFullscreen}
        animationType="fade"
      >
        <View style={styles.fullscreenContainer}>
          <StatusBar hidden />

          {/* Close Button */}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleCloseFullscreen}
          >
            <Ionicons name="close" size={30} color="#fff" />
          </TouchableOpacity>

          {/* Image Counter */}
          <View style={styles.imageCounter}>
            <Text style={styles.imageCounterText}>
              {currentImageIndex + 1} / {images.length}
            </Text>
          </View>

          {/* Image Carousel */}
          <FlatList
            ref={fullscreenFlatListRef}
            data={images}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={currentImageIndex}
            getItemLayout={(data, index) => ({
              length: SCREEN_WIDTH,
              offset: SCREEN_WIDTH * index,
              index,
            })}
            onMomentumScrollEnd={(event) => {
              const newIndex = Math.round(
                event.nativeEvent.contentOffset.x / SCREEN_WIDTH
              );
              setCurrentImageIndex(newIndex);
            }}
            renderItem={({ item }) => (
              <View style={styles.fullscreenImageWrapper}>
                <RNImage
                  source={{ uri: item }}
                  style={styles.fullscreenImage}
                  resizeMode="contain"
                />
              </View>
            )}
            keyExtractor={(item, index) => `fullscreen-${index}`}
          />
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  scrollView: {
    flex: 1,
  },
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 1.25, // 4:5 aspect ratio
    backgroundColor: theme.colors.gray100,
  },
  imageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 2,
  },
  gridImageWrapper: {
    width: "33.333%",
    aspectRatio: 0.8, // 4:5 ratio
    padding: 2,
  },
  gridImage: {
    width: "100%",
    height: "100%",
    backgroundColor: theme.colors.gray100,
  },
  headerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.gray100,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.gray100,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.gray100,
  },
  itemImage: {
    width: 80,
    height: 100,
    borderRadius: 8,
    backgroundColor: theme.colors.gray100,
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    zIndex: 1,
  },
  bottomBar: {
    backgroundColor: theme.colors.white,
    zIndex: 2,
  },
  bottomBarExpanded: {
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 5,
  },
  expandedInputContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    backgroundColor: theme.colors.white,
  },
  expandedTextInputWrapper: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: theme.colors.gray100,
    borderRadius: 20,
    padding: 16,
    height: 80,
  },
  expandedTextInput: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.black,
  },
  expandedSendButton: {
    padding: 6,
    alignSelf: "flex-end",
  },
  compactBottomBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  engagementSection: {
    flexDirection: "row",
    alignItems: "center",
  },
  engagementButton: {
    padding: 4,
    marginRight: 20,
  },
  compactInputWrapper: {
    flex: 1,
    marginLeft: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: theme.colors.gray100,
    borderRadius: 20,
    height: 36,
    justifyContent: "center",
  },
  doneButton: {
    marginLeft: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  fullscreenContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 1)",
    justifyContent: "center",
    alignItems: "center",
  },
  closeButton: {
    position: "absolute",
    top: Platform.OS === "ios" ? 50 : 20,
    right: 20,
    zIndex: 10,
    padding: 8,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 20,
  },
  imageCounter: {
    position: "absolute",
    top: Platform.OS === "ios" ? 50 : 20,
    left: 20,
    zIndex: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 20,
  },
  imageCounterText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  fullscreenImageWrapper: {
    width: SCREEN_WIDTH,
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  fullscreenImage: {
    width: SCREEN_WIDTH,
    height: "100%",
  },
});

export default PostDetailScreen;
