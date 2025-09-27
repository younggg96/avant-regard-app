import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Dimensions,
  Share,
  Modal,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRoute, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme";

const { width: screenWidth } = Dimensions.get("window");

interface Look {
  id: string;
  image: string;
  title: string;
  description: string;
  likes: number;
  isLiked: boolean;
  imageType?: string;
}

interface LookDetailParams {
  look: Look;
  designerName?: string;
  collectionTitle?: string;
}

const LookDetailScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const params = route.params as LookDetailParams;
  const { look, designerName, collectionTitle } = params;

  const [currentLook, setCurrentLook] = useState<Look>(look);
  const [isImageModalVisible, setIsImageModalVisible] = useState(false);

  const handleLike = useCallback(() => {
    setCurrentLook((prev) => ({
      ...prev,
      isLiked: !prev.isLiked,
      likes: prev.isLiked ? prev.likes - 1 : prev.likes + 1,
    }));
  }, []);

  const handleShare = async () => {
    try {
      await Share.share({
        message: `查看这个精彩的造型：${currentLook.title}${
          designerName ? ` - ${designerName}` : ""
        }`,
      });
    } catch (error) {
      console.log("分享失败:", error);
    }
  };

  const handleImagePress = useCallback(() => {
    console.log("Image pressed - opening modal");
    setIsImageModalVisible(true);
  }, []);

  const handleCloseImageModal = useCallback(() => {
    setIsImageModalVisible(false);
  }, []);

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Ionicons name="arrow-back" size={24} color={theme.colors.white} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
        <Ionicons name="share-outline" size={24} color={theme.colors.white} />
      </TouchableOpacity>
    </View>
  );

  const renderImage = () => (
    <TouchableOpacity
      onPress={handleImagePress}
      activeOpacity={0.9}
      style={styles.imageContainer}
    >
      <Image
        source={{ uri: currentLook.image }}
        style={styles.mainImage}
        resizeMode="cover"
      />
      <View style={styles.imageOverlay} pointerEvents="box-none">
        {renderHeader()}
        <View style={styles.imageActions}>
          <TouchableOpacity style={styles.likeButton} onPress={handleLike}>
            <Ionicons
              name={currentLook.isLiked ? "heart" : "heart-outline"}
              size={28}
              color={currentLook.isLiked ? "#ff4757" : theme.colors.white}
            />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderLookInfo = () => (
    <View style={styles.infoContainer}>
      <View style={styles.titleSection}>
        <Text style={styles.title}>{currentLook.title}</Text>
        {designerName && <Text style={styles.designer}>by {designerName}</Text>}
        {collectionTitle && (
          <Text style={styles.collection}>来自 {collectionTitle}</Text>
        )}
      </View>

      <View style={styles.statsSection}>
        <View style={styles.statItem}>
          <Ionicons name="heart" size={16} color="#ff4757" />
          <Text style={styles.statText}>
            {currentLook.likes.toLocaleString()} 个赞
          </Text>
        </View>
        {currentLook.imageType && (
          <View style={styles.statItem}>
            <Ionicons
              name="pricetag-outline"
              size={16}
              color={theme.colors.gray600}
            />
            <Text style={styles.statText}>{currentLook.imageType}</Text>
          </View>
        )}
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[
            styles.actionButton,
            styles.likeActionButton,
            currentLook.isLiked && styles.likedActionButton,
          ]}
          onPress={handleLike}
        >
          <Ionicons
            name={currentLook.isLiked ? "heart" : "heart-outline"}
            size={20}
            color={
              currentLook.isLiked ? theme.colors.white : theme.colors.gray600
            }
          />
          <Text
            style={[
              styles.actionButtonText,
              currentLook.isLiked && styles.likedActionButtonText,
            ]}
          >
            {currentLook.isLiked ? "已点赞" : "点赞"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.shareActionButton]}
          onPress={handleShare}
        >
          <Ionicons
            name="share-outline"
            size={20}
            color={theme.colors.gray600}
          />
          <Text style={styles.shareActionButtonText}>分享</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderRelatedSection = () => (
    <View style={styles.relatedSection}>
      <Text style={styles.relatedTitle}>相关推荐</Text>
      <Text style={styles.relatedSubtitle}>探索更多精彩造型</Text>
      <TouchableOpacity
        style={styles.exploreButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.exploreButtonText}>返回浏览更多</Text>
        <Ionicons name="arrow-forward" size={16} color={theme.colors.gray600} />
      </TouchableOpacity>
    </View>
  );

  const renderImageModal = () => (
    <Modal
      visible={isImageModalVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleCloseImageModal}
    >
      <StatusBar hidden={true} />
      <View style={styles.modalContainer}>
        <TouchableOpacity
          style={styles.modalBackdrop}
          onPress={handleCloseImageModal}
          activeOpacity={1}
        >
          <View style={styles.modalContent}>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={handleCloseImageModal}
            >
              <Ionicons name="close" size={28} color={theme.colors.white} />
            </TouchableOpacity>
            <Image
              source={{ uri: currentLook.image }}
              style={styles.modalImage}
              resizeMode="contain"
            />
          </View>
        </TouchableOpacity>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {renderImage()}
        {renderLookInfo()}
      </ScrollView>
      {renderImageModal()}
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
  imageContainer: {
    position: "relative",
    height: screenWidth * 1.3,
    width: screenWidth,
  },
  mainImage: {
    width: screenWidth,
    height: "100%",
  },
  imageOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.1)",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 12,
  },
  backButton: {
    padding: 8,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    borderRadius: 20,
  },
  shareButton: {
    padding: 8,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    borderRadius: 20,
  },
  imageActions: {
    position: "absolute",
    bottom: 20,
    right: 20,
  },
  likeButton: {
    padding: 12,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    borderRadius: 25,
  },
  infoContainer: {
    padding: 20,
  },
  titleSection: {
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontFamily: __DEV__ ? "Georgia" : "PlayfairDisplay-Bold",
    color: theme.colors.black,
    marginBottom: 4,
  },
  designer: {
    fontSize: 16,
    fontFamily: __DEV__ ? "System" : "Inter-Medium",
    color: theme.colors.gray600,
    marginBottom: 4,
  },
  collection: {
    fontSize: 14,
    fontFamily: __DEV__ ? "System" : "Inter-Regular",
    color: theme.colors.gray500,
  },
  statsSection: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.colors.gray100,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 20,
  },
  statText: {
    fontSize: 14,
    fontFamily: __DEV__ ? "System" : "Inter-Medium",
    color: theme.colors.gray600,
    marginLeft: 6,
  },
  descriptionSection: {
    marginBottom: 24,
  },
  descriptionTitle: {
    fontSize: 18,
    fontFamily: __DEV__ ? "Georgia" : "PlayfairDisplay-Bold",
    color: theme.colors.black,
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    fontFamily: __DEV__ ? "System" : "Inter-Regular",
    color: theme.colors.gray600,
    lineHeight: 24,
  },
  actionButtons: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  likeActionButton: {
    borderColor: theme.colors.gray600,
    backgroundColor: theme.colors.white,
  },
  likedActionButton: {
    backgroundColor: "#ff4757",
    borderColor: "#ff4757",
  },
  shareActionButton: {
    borderColor: theme.colors.gray300,
    backgroundColor: theme.colors.white,
  },
  actionButtonText: {
    fontSize: 14,
    fontFamily: __DEV__ ? "System" : "Inter-Medium",
    color: theme.colors.gray600,
    marginLeft: 6,
  },
  likedActionButtonText: {
    color: theme.colors.white,
  },
  shareActionButtonText: {
    fontSize: 14,
    fontFamily: __DEV__ ? "System" : "Inter-Medium",
    color: theme.colors.gray600,
    marginLeft: 6,
  },
  relatedSection: {
    padding: 20,
    backgroundColor: theme.colors.gray500,
    alignItems: "center",
  },
  relatedTitle: {
    fontSize: 20,
    fontFamily: __DEV__ ? "Georgia" : "PlayfairDisplay-Bold",
    color: theme.colors.black,
    marginBottom: 4,
  },
  relatedSubtitle: {
    fontSize: 14,
    fontFamily: __DEV__ ? "System" : "Inter-Regular",
    color: theme.colors.gray600,
    marginBottom: 16,
  },
  exploreButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: theme.colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.gray600,
  },
  exploreButtonText: {
    fontSize: 14,
    fontFamily: __DEV__ ? "System" : "Inter-Medium",
    color: theme.colors.gray600,
    marginRight: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalBackdrop: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  modalCloseButton: {
    position: "absolute",
    top: 60,
    right: 20,
    zIndex: 1,
    padding: 8,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 20,
  },
  modalImage: {
    width: "100%",
    height: "100%",
  },
});

export default LookDetailScreen;
