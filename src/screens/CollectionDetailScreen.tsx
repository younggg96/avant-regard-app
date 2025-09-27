import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Dimensions,
  Share,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRoute, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme";
import designersData from "../data/data.json";

const { width: screenWidth } = Dimensions.get("window");

interface Collection {
  id: string;
  title: string;
  season: string;
  year: string;
  coverImage: string;
  imageCount: number;
  city?: string | null;
  author?: string | null;
  reviewText?: string | null;
  showUrl?: string;
}

interface ShowImage {
  image_url: string;
  image_type: string;
}

interface CollectionDetailParams {
  collection: Collection;
  designerName?: string;
  images?: ShowImage[];
}

const CollectionDetailScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const params = route.params as CollectionDetailParams;
  const { collection, designerName, images } = params;

  const [collectionImages, setCollectionImages] = useState<ShowImage[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    if (images) {
      setCollectionImages(images);
    } else {
      // Try to find images from the data
      const dataArray = designersData as any[];
      const designerData = dataArray.find((d: any) =>
        d.designer.toLowerCase().includes(designerName?.toLowerCase() || "")
      );

      if (designerData && designerData.shows) {
        const show = designerData.shows.find(
          (s: any) =>
            s.review_title === collection.title ||
            s.season === collection.season
        );
        if (show && show.images) {
          setCollectionImages(show.images);
        }
      }
    }
  }, [collection, designerName, images]);

  const handleShare = async () => {
    try {
      await Share.share({
        message: `查看这个精彩的时装系列：${collection.title} - ${collection.season} ${collection.year}`,
        url: collection.showUrl || "",
      });
    } catch (error) {
      console.log("分享失败:", error);
    }
  };

  const handleOpenUrl = async () => {
    if (collection.showUrl) {
      try {
        const supported = await Linking.canOpenURL(collection.showUrl);
        if (supported) {
          await Linking.openURL(collection.showUrl);
        }
      } catch (error) {
        console.log("无法打开链接:", error);
      }
    }
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Ionicons name="arrow-back" size={24} color={theme.colors.black} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
        <Ionicons name="share-outline" size={24} color={theme.colors.black} />
      </TouchableOpacity>
    </View>
  );

  const renderMainImage = () => (
    <View style={styles.imageContainer}>
      <Image
        source={{
          uri:
            collectionImages[currentImageIndex]?.image_url ||
            collection.coverImage,
        }}
        style={styles.mainImage}
        resizeMode="cover"
      />
      {collectionImages.length > 1 && (
        <View style={styles.imageCounter}>
          <Text style={styles.imageCounterText}>
            {currentImageIndex + 1} / {collectionImages.length}
          </Text>
        </View>
      )}
    </View>
  );

  const renderImageThumbnails = () => {
    if (collectionImages.length <= 1) return null;

    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.thumbnailContainer}
        contentContainerStyle={styles.thumbnailContent}
      >
        {collectionImages.map((image, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.thumbnail,
              currentImageIndex === index && styles.activeThumbnail,
            ]}
            onPress={() => setCurrentImageIndex(index)}
          >
            <Image
              source={{ uri: image.image_url }}
              style={styles.thumbnailImage}
              resizeMode="cover"
            />
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  };

  const renderCollectionInfo = () => (
    <View style={styles.infoContainer}>
      <Text style={styles.title}>{collection.title}</Text>
      <Text style={styles.subtitle}>
        {collection.season} {collection.year}
      </Text>

      <View style={styles.metaInfo}>
        {collection.city && (
          <View style={styles.metaItem}>
            <Ionicons
              name="location-outline"
              size={16}
              color={theme.colors.gray600}
            />
            <Text style={styles.metaText}>{collection.city}</Text>
          </View>
        )}

        {collection.author && (
          <View style={styles.metaItem}>
            <Ionicons
              name="person-outline"
              size={16}
              color={theme.colors.gray600}
            />
            <Text style={styles.metaText}>评论者：{collection.author}</Text>
          </View>
        )}

        <View style={styles.metaItem}>
          <Ionicons
            name="images-outline"
            size={16}
            color={theme.colors.gray600}
          />
          <Text style={styles.metaText}>
            {collectionImages.length || collection.imageCount} 张图片
          </Text>
        </View>
      </View>

      {collection.showUrl && (
        <TouchableOpacity style={styles.urlButton} onPress={handleOpenUrl}>
          <Ionicons
            name="link-outline"
            size={20}
            color={theme.colors.primary}
          />
          <Text style={styles.urlButtonText}>查看官方链接</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderReview = () => {
    if (!collection.reviewText) return null;

    return (
      <View style={styles.reviewContainer}>
        <Text style={styles.reviewTitle}>评论</Text>
        <Text style={styles.reviewText}>{collection.reviewText}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {renderHeader()}
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {renderMainImage()}
        {renderImageThumbnails()}
        {renderCollectionInfo()}
        {renderReview()}
      </ScrollView>
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
  shareButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  imageContainer: {
    position: "relative",
  },
  mainImage: {
    width: screenWidth,
    height: screenWidth * 1.2,
  },
  imageCounter: {
    position: "absolute",
    top: 16,
    right: 16,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  imageCounterText: {
    color: theme.colors.white,
    fontSize: 12,
    fontFamily: __DEV__ ? "System" : "Inter-Medium",
  },
  thumbnailContainer: {
    marginTop: 16,
  },
  thumbnailContent: {
    paddingHorizontal: 20,
  },
  thumbnail: {
    marginRight: 12,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
  },
  activeThumbnail: {
    borderColor: theme.colors.primary,
  },
  thumbnailImage: {
    width: 60,
    height: 80,
  },
  infoContainer: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontFamily: __DEV__ ? "Georgia" : "PlayfairDisplay-Bold",
    color: theme.colors.black,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: __DEV__ ? "System" : "Inter-Medium",
    color: theme.colors.gray600,
    marginBottom: 16,
  },
  metaInfo: {
    marginBottom: 20,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  metaText: {
    fontSize: 14,
    fontFamily: __DEV__ ? "System" : "Inter-Regular",
    color: theme.colors.gray600,
    marginLeft: 8,
  },
  urlButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.gray50,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  urlButtonText: {
    fontSize: 14,
    fontFamily: __DEV__ ? "System" : "Inter-Medium",
    color: theme.colors.primary,
    marginLeft: 8,
  },
  reviewContainer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray100,
  },
  reviewTitle: {
    fontSize: 18,
    fontFamily: __DEV__ ? "Georgia" : "PlayfairDisplay-Bold",
    color: theme.colors.black,
    marginBottom: 12,
  },
  reviewText: {
    fontSize: 16,
    fontFamily: __DEV__ ? "System" : "Inter-Regular",
    color: theme.colors.gray800,
    lineHeight: 24,
  },
});

export default CollectionDetailScreen;
