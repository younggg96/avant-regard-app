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
import { useAuthStore } from "../store/authStore";
import { commentService, PostComment } from "../services/commentService";
import { userInfoService } from "../services/userInfoService";
import { Alert } from "../utils/Alert";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface PostDetailRouteParams {
  postId?: string;
  post?: Post;
  postStatus?: "draft" | "pending" | "published";
}

// 评论显示类型
interface Comment {
  id: string;
  userId: number;
  userName: string;
  userAvatar: string;
  content: string;
  timestamp: string;
  likes: number;
  isLiked?: boolean;
}

// 格式化时间显示
const formatTimestamp = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return "刚刚";
  if (diffMinutes < 60) return `${diffMinutes}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  if (diffDays < 7) return `${diffDays}天前`;

  return date.toLocaleDateString("zh-CN");
};

const PostDetailScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const params = route.params as PostDetailRouteParams;
  const scrollViewRef = useRef<RNScrollView>(null);
  const commentInputRef = useRef<TextInput>(null);
  const { user } = useAuthStore();

  // 这里应该根据postId从API获取post数据，暂时使用传入的post
  const [post, setPost] = useState<Post | null>(params.post || null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const postStatus = params.postStatus || "published";

  // 判断是否是本人的帖子
  const isOwnPost = user?.id === post?.author?.id;
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

  // 加载评论数据
  const loadComments = useCallback(async () => {
    if (!post?.id || postStatus !== "published") return;

    setIsLoadingComments(true);
    try {
      // 获取帖子 ID（可能是字符串或数字）
      const postId =
        typeof post.id === "string" ? parseInt(post.id, 10) : post.id;
      if (isNaN(postId)) return;

      // 获取评论列表
      const apiComments = await commentService.getPostComments(postId);

      // 获取评论者的用户信息（头像等）
      const userIds = [...new Set(apiComments.map((c) => c.userId))];
      const userInfoPromises = userIds.map((id) =>
        userInfoService.getUserInfo(id).catch(() => null)
      );
      const usersInfo = await Promise.all(userInfoPromises);
      const userInfoMap = new Map(
        usersInfo
          .filter((info) => info !== null)
          .map((info) => [info!.userId, info!])
      );

      // 转换为显示格式
      const displayComments: Comment[] = apiComments.map((apiComment) => {
        const userInfo = userInfoMap.get(apiComment.userId);
        return {
          id: String(apiComment.id),
          userId: apiComment.userId,
          userName: userInfo?.username || apiComment.username || "用户",
          userAvatar:
            userInfo?.avatarUrl ||
            `https://api.dicebear.com/7.x/avataaars/png?seed=${apiComment.userId}`,
          content: apiComment.content,
          timestamp: formatTimestamp(apiComment.createdAt),
          likes: apiComment.likeCount || 0,
          isLiked: false, // TODO: 后端暂无此字段
        };
      });

      setComments(displayComments);
    } catch (error) {
      console.error("Error loading comments:", error);
    } finally {
      setIsLoadingComments(false);
    }
  }, [post?.id, postStatus]);

  // 初始化加载评论
  useEffect(() => {
    loadComments();
  }, [loadComments]);

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
    Alert.show("成功", isFollowing ? "已取消关注" : "已关注");
  }, [isFollowing]);

  // 处理点击作者头像
  const handleAuthorPress = useCallback(() => {
    if (!post?.author?.id) return;
    (navigation as any).navigate("UserProfile", {
      userId: parseInt(post.author.id, 10),
      username: post.author.name,
      avatar: post.author.avatar,
    });
  }, [navigation, post]);

  // 处理评论点赞
  const handleCommentLike = useCallback(
    async (commentId: string) => {
      if (!user?.userId) {
        Alert.show("提示", "请先登录");
        return;
      }

      // 先乐观更新 UI
      const targetComment = comments.find((c) => c.id === commentId);
      if (!targetComment) return;

      const newIsLiked = !targetComment.isLiked;
      setComments((prev) =>
        prev.map((comment) =>
          comment.id === commentId
            ? {
                ...comment,
                isLiked: newIsLiked,
                likes: newIsLiked ? comment.likes + 1 : comment.likes - 1,
              }
            : comment
        )
      );

      // 调用 API
      try {
        const numericCommentId = parseInt(commentId, 10);
        if (newIsLiked) {
          await commentService.likeComment(numericCommentId, user.userId);
        } else {
          await commentService.unlikeComment(numericCommentId, user.userId);
        }
      } catch (error) {
        console.error("Error toggling comment like:", error);
        // 回滚 UI
        setComments((prev) =>
          prev.map((comment) =>
            comment.id === commentId
              ? {
                  ...comment,
                  isLiked: !newIsLiked,
                  likes: newIsLiked ? comment.likes - 1 : comment.likes + 1,
                }
              : comment
          )
        );
      }
    },
    [user?.userId, comments]
  );

  // 处理提交评论
  const handleSubmitComment = useCallback(async () => {
    if (!commentInput.trim()) return;

    if (!user?.userId) {
      Alert.show("提示", "请先登录");
      return;
    }

    if (!post?.id) return;

    // 关闭键盘和输入框
    Keyboard.dismiss();
    setIsCommentFocused(false);
    setIsSubmittingComment(true);

    try {
      const postId =
        typeof post.id === "string" ? parseInt(post.id, 10) : post.id;
      if (isNaN(postId)) throw new Error("无效的帖子 ID");

      // 调用 API 发布评论
      const newApiComment = await commentService.createComment(postId, {
        userId: user.userId,
        content: commentInput.trim(),
      });

      // 获取当前用户信息用于显示
      let userAvatar = `https://api.dicebear.com/7.x/avataaars/png?seed=${user.userId}`;
      try {
        const userInfo = await userInfoService.getUserInfo(user.userId);
        if (userInfo?.avatarUrl) {
          userAvatar = userInfo.avatarUrl;
        }
      } catch {
        // 忽略获取用户信息失败
      }

      // 将新评论添加到列表顶部
      const newComment: Comment = {
        id: String(newApiComment.id),
        userId: newApiComment.userId,
        userName: user.username || "我",
        userAvatar: userAvatar,
        content: newApiComment.content,
        timestamp: "刚刚",
        likes: 0,
        isLiked: false,
      };

      setComments((prev) => [newComment, ...prev]);
      setCommentInput("");

      // 显示成功提示
      Alert.show("成功", "评论已发布");

      // 滚动到评论区顶部，显示新评论
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error("Error submitting comment:", error);
      Alert.show(
        "错误",
        error instanceof Error ? error.message : "评论发布失败"
      );
    } finally {
      setIsSubmittingComment(false);
    }
  }, [commentInput, user?.userId, user?.username, post?.id]);

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

  // 判断是否显示评论区：草稿和审核中的帖子不显示评论
  const showComments = postStatus === "published";

  // 处理继续编辑（草稿）
  const handleContinueEdit = useCallback(() => {
    // 根据 post 类型跳转到对应的编辑页面
    Alert.show("编辑", "跳转到编辑页面");
    // TODO: 实现跳转到对应的编辑页面
  }, [post]);

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

            <Pressable onPress={handleAuthorPress}>
              <Image
                source={{ uri: post.author.avatar }}
                style={styles.headerAvatar}
              />
            </Pressable>

            <Pressable onPress={handleAuthorPress} flex={1}>
              <VStack>
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
            </Pressable>
          </HStack>

          {/* Right: Actions based on status */}
          <HStack space="xs" alignItems="center">
            {postStatus === "draft" ? (
              // 草稿状态：显示继续修改按钮
              <Pressable
                onPress={handleContinueEdit}
                px="$md"
                py="$xs"
                bg="$black"
                rounded="$md"
              >
                <Text fontSize="$xs" fontWeight="$semibold" color="$white">
                  继续修改
                </Text>
              </Pressable>
            ) : postStatus === "pending" ? (
              // 审核中状态：显示审核状态标签
              <View
                style={{
                  paddingHorizontal: theme.spacing.md,
                  paddingVertical: theme.spacing.xs,
                  backgroundColor: theme.colors.accent,
                  borderRadius: theme.borderRadius.md,
                }}
              >
                <Text fontSize="$xs" fontWeight="$semibold" color="$white">
                  审核中
                </Text>
              </View>
            ) : (
              // 已发布状态：根据是否是本人决定显示内容
              <>
                {!isOwnPost && (
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
                )}

                <Pressable
                  onPress={handleShare}
                  pl={isOwnPost ? "$none" : "$sm"}
                >
                  <Ionicons
                    name="share-outline"
                    size={20}
                    color={theme.colors.black}
                  />
                </Pressable>
              </>
            )}
          </HStack>
        </HStack>

        {/* Content */}
        <RNScrollView
          ref={scrollViewRef}
          showsVerticalScrollIndicator={false}
          style={styles.scrollView}
        >
          {/* Lookbook: 大图轮播在顶部 */}
          {post.type === "lookbook" && images.length > 0 && (
            <View style={styles.lookbookImageSection}>
              <FlatList
                data={images}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(event) => {
                  const newIndex = Math.round(
                    event.nativeEvent.contentOffset.x / SCREEN_WIDTH
                  );
                  setCurrentImageIndex(newIndex);
                }}
                renderItem={({ item, index }) => (
                  <Pressable
                    onPress={() => handleOpenFullscreen(index)}
                    style={styles.lookbookImageWrapper}
                  >
                    <RNImage
                      source={{ uri: item }}
                      style={styles.lookbookImage}
                      resizeMode="cover"
                    />
                  </Pressable>
                )}
                keyExtractor={(item, index) => `lookbook-img-${index}`}
              />
              {/* 图片指示器 */}
              {images.length > 1 && (
                <View style={styles.imageIndicator}>
                  <Text style={styles.imageIndicatorText}>
                    {currentImageIndex + 1} / {images.length}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Title and Description Section */}
          <VStack
            px="$md"
            py="$md"
            space="md"
            borderBottomWidth={post.type === "lookbook" ? 0 : 1}
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

            {/* Tags for lookbook */}
            {post.type === "lookbook" &&
              post.content?.tags &&
              post.content.tags.length > 0 && (
                <HStack flexWrap="wrap" mt="$sm">
                  {post.content.tags.map((tag, index) => (
                    <View key={index} style={styles.tag}>
                      <Text style={styles.tagText}>#{tag}</Text>
                    </View>
                  ))}
                </HStack>
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

          {/* Image Grid - 3 columns (非 lookbook 类型) */}
          {post.type !== "lookbook" && images.length > 0 && (
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

          {/* Comments Section - Only show for published posts */}
          {showComments && (
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

              {/* Loading State */}
              {isLoadingComments && (
                <Box py="$lg" alignItems="center">
                  <ActivityIndicator
                    size="small"
                    color={theme.colors.gray400}
                  />
                  <Text fontSize="$sm" color="$gray400" mt="$sm">
                    加载评论中...
                  </Text>
                </Box>
              )}

              {/* Empty State */}
              {!isLoadingComments && comments.length === 0 && (
                <Box py="$lg" alignItems="center">
                  <Ionicons
                    name="chatbubble-outline"
                    size={32}
                    color={theme.colors.gray300}
                  />
                  <Text fontSize="$sm" color="$gray400" mt="$sm">
                    暂无评论，快来发表第一条评论吧
                  </Text>
                </Box>
              )}

              {/* Comments List */}
              {!isLoadingComments &&
                comments.map((comment) => (
                  <HStack key={comment.id} space="sm" mt="$md">
                    <Pressable
                      onPress={() =>
                        (navigation as any).navigate("UserProfile", {
                          userId: comment.userId,
                          username: comment.userName,
                          avatar: comment.userAvatar,
                        })
                      }
                    >
                      <Image
                        source={{ uri: comment.userAvatar }}
                        style={styles.commentAvatar}
                      />
                    </Pressable>
                    <VStack flex={1} space="xs">
                      <HStack justifyContent="between" alignItems="center">
                        <Pressable
                          onPress={() =>
                            (navigation as any).navigate("UserProfile", {
                              userId: comment.userId,
                              username: comment.userName,
                              avatar: comment.userAvatar,
                            })
                          }
                        >
                          <Text
                            fontSize="$sm"
                            fontWeight="$semibold"
                            color="$black"
                          >
                            {comment.userName}
                          </Text>
                        </Pressable>
                        <Text fontSize="$xs" color="$gray600">
                          {comment.timestamp}
                        </Text>
                      </HStack>
                      <Text fontSize="$sm" color="$gray800" lineHeight="$md">
                        {comment.content}
                      </Text>
                      <HStack space="md" mt="$xs">
                        <Pressable
                          onPress={() => handleCommentLike(comment.id)}
                        >
                          <HStack space="xs" alignItems="center">
                            <Ionicons
                              name={comment.isLiked ? "heart" : "heart-outline"}
                              size={16}
                              color={
                                comment.isLiked
                                  ? "#FF3040"
                                  : theme.colors.gray400
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
          )}

          {/* Status Message for Draft/Pending */}
          {!showComments && (
            <VStack
              space="md"
              px="$md"
              py="$xl"
              mt="$md"
              alignItems="center"
              borderTopWidth={8}
              borderTopColor="$gray100"
            >
              <Ionicons
                name={
                  postStatus === "draft" ? "create-outline" : "time-outline"
                }
                size={48}
                color={theme.colors.gray300}
              />
              <Text fontSize="$md" color="$gray600" textAlign="center">
                {postStatus === "draft"
                  ? "草稿暂不支持评论，请先完成编辑并发布"
                  : "内容正在审核中，审核通过后可以查看评论"}
              </Text>
            </VStack>
          )}

          {/* Bottom spacing */}
          <Box height={80} />
        </RNScrollView>

        {/* Gray Overlay when focused */}
        {isCommentFocused && showComments && (
          <TouchableWithoutFeedback onPress={handleOverlayPress}>
            <View style={styles.overlay} />
          </TouchableWithoutFeedback>
        )}

        {/* Fixed Bottom Bar with Engagement + Input - Only for published posts */}
        {showComments && (
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
                  <Pressable
                    onPress={handleLike}
                    style={styles.engagementButton}
                  >
                    <VStack alignItems="center" space="xs">
                      <Ionicons
                        name={displayIsLiked ? "heart" : "heart-outline"}
                        size={20}
                        color={
                          displayIsLiked ? "#FF3040" : theme.colors.gray600
                        }
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

                  <Pressable
                    onPress={handleSave}
                    style={styles.engagementButton}
                  >
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
                      <Text
                        fontSize="$xs"
                        color="$gray600"
                        fontWeight="$medium"
                      >
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
        )}
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
  // Lookbook 大图样式
  lookbookImageSection: {
    position: "relative",
    backgroundColor: theme.colors.gray100,
  },
  lookbookImageWrapper: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 1.25, // 4:5 比例
  },
  lookbookImage: {
    width: "100%",
    height: "100%",
    backgroundColor: theme.colors.gray100,
  },
  imageIndicator: {
    position: "absolute",
    bottom: 16,
    right: 16,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  imageIndicatorText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  tag: {
    backgroundColor: theme.colors.gray100,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 8,
  },
  tagText: {
    fontSize: 12,
    color: theme.colors.gray600,
  },
  // 普通图片网格样式
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
