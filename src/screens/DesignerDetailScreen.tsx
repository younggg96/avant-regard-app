import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { apiClient } from "@avant-regard/core/src/api/client";
import { mockData } from "@avant-regard/core/src/mocks/seeds";
import { theme } from "../theme";
import { useFavoriteStore } from "../store/favoriteStore";
import ReviewForm from "../components/ReviewForm";
import BrandHistoryCard from "../components/BrandHistoryCard";
import { useAlert } from "../components/AlertProvider";

const { width } = Dimensions.get("window");
const COVER_HEIGHT = width * 0.6;

const DesignerDetailScreen = ({ route }: any) => {
  const navigation = useNavigation();
  const { id } = route.params;
  const { addFavorite, removeFavorite, isFavorite } = useFavoriteStore();
  const { showAlert, showSuccess } = useAlert();

  const [isFollowed, setIsFollowed] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);

  const { data: designer, isLoading } = useQuery({
    queryKey: ["designer", id],
    queryFn: () => apiClient.getDesigner(id),
  });

  const designerData = designer?.data;
  const reviews = mockData.designerReviews.filter((r) => r.designerId === id);
  const brandHistory = mockData.designerBrandHistory.filter(
    (b) => b.designerId === id
  );
  const isDesignerFavorited = designerData
    ? isFavorite(designerData.id)
    : false;

  const handleFollow = () => {
    setIsFollowed(!isFollowed);
    showSuccess(
      isFollowed ? "Unfollowed" : "Following",
      `You are ${isFollowed ? "no longer following" : "now following"} ${
        designerData?.name
      }`
    );
  };

  const handleSubmitReview = async (rating: number, comment: string) => {
    // Mock API call - replace with real implementation
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // In real app, this would post to API and refresh data
    console.log("Review submitted:", { rating, comment, designerId: id });
  };

  const handleFavorite = () => {
    if (!designerData) return;

    if (isDesignerFavorited) {
      removeFavorite(designerData.id);
    } else {
      addFavorite({
        id: designerData.id,
        type: "designer",
        name: designerData.name,
        data: designerData,
      });
    }
  };

  const renderStars = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;

    for (let i = 0; i < fullStars; i++) {
      stars.push(
        <Ionicons key={i} name="star" size={16} color={theme.colors.accent} />
      );
    }

    if (hasHalfStar) {
      stars.push(
        <Ionicons
          key="half"
          name="star-half"
          size={16}
          color={theme.colors.accent}
        />
      );
    }

    const emptyStars = 5 - Math.ceil(rating);
    for (let i = 0; i < emptyStars; i++) {
      stars.push(
        <Ionicons
          key={`empty-${i}`}
          name="star-outline"
          size={16}
          color={theme.colors.gray300}
        />
      );
    }

    return stars;
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!designerData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Designer not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Cover Image */}
        <View style={styles.coverContainer}>
          <Image
            source={{
              uri: designerData.coverImageUrl || designerData.imageUrl,
            }}
            style={styles.coverImage}
            defaultSource={require("../../assets/placeholder.png")}
          />
          <View style={styles.coverOverlay}>
            <View style={styles.coverActions}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleFavorite}
              >
                <Ionicons
                  name={isDesignerFavorited ? "heart" : "heart-outline"}
                  size={24}
                  color={
                    isDesignerFavorited
                      ? theme.colors.accent
                      : theme.colors.white
                  }
                />
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionButton}>
                <Ionicons
                  name="share-outline"
                  size={24}
                  color={theme.colors.white}
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Designer Profile */}
        <View style={styles.profileSection}>
          <View style={styles.profileHeader}>
            <View style={styles.profileImageContainer}>
              <Image
                source={{ uri: designerData.imageUrl }}
                style={styles.profileImage}
                defaultSource={require("../../assets/placeholder.png")}
              />
            </View>

            <View style={styles.profileInfo}>
              <Text style={styles.designerName}>{designerData.name}</Text>
              {designerData.aliases && designerData.aliases.length > 0 && (
                <Text style={styles.designerAliases}>
                  {designerData.aliases.join(" / ")}
                </Text>
              )}

              <View style={styles.metaInfo}>
                <Text style={styles.metaText}>
                  {designerData.country} • Founded {designerData.foundedYear}
                </Text>
              </View>

              {/* Rating */}
              <View style={styles.ratingContainer}>
                <View style={styles.starsContainer}>
                  {renderStars(designerData.rating || 0)}
                </View>
                <Text style={styles.ratingText}>
                  {designerData.rating?.toFixed(1)} ({designerData.reviewCount}{" "}
                  reviews)
                </Text>
              </View>

              {/* Stats */}
              <View style={styles.statsContainer}>
                <Text style={styles.statText}>
                  {designerData.followerCount?.toLocaleString()} followers
                </Text>
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity
              style={[
                styles.followButton,
                isFollowed && styles.followButtonActive,
              ]}
              onPress={handleFollow}
            >
              <Ionicons
                name={isFollowed ? "checkmark" : "add"}
                size={16}
                color={isFollowed ? theme.colors.white : theme.colors.black}
              />
              <Text
                style={[
                  styles.followButtonText,
                  isFollowed && styles.followButtonTextActive,
                ]}
              >
                {isFollowed ? "Following" : "Follow"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.reviewButton}
              onPress={() => setShowReviewForm(true)}
            >
              <Ionicons
                name="star-outline"
                size={16}
                color={theme.colors.black}
              />
              <Text style={styles.reviewButtonText}>Write Review</Text>
            </TouchableOpacity>
          </View>

          {/* Bio */}
          <View style={styles.bioSection}>
            <Text style={styles.bioText}>{designerData.bio}</Text>
          </View>
        </View>

        {/* Brand History Section */}
        {brandHistory.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>BRAND PARTICIPATION</Text>
            <Text style={styles.sectionDescription}>
              Brands and houses where {designerData.name} has contributed their
              creative vision
            </Text>

            {brandHistory
              .sort((a, b) => {
                // Sort by active status first, then by start year (descending)
                if (a.isActive && !b.isActive) return -1;
                if (!a.isActive && b.isActive) return 1;
                return b.startYear - a.startYear;
              })
              .map((brand) => (
                <BrandHistoryCard
                  key={brand.id}
                  brandHistory={brand}
                  onPress={() => {
                    showAlert(
                      brand.brandName,
                      `${brand.role} (${brand.startYear}${
                        brand.endYear ? `-${brand.endYear}` : "-Present"
                      })\n\n${brand.description}`,
                      [{ text: "OK" }],
                      "business",
                      theme.colors.accent
                    );
                  }}
                />
              ))}
          </View>
        )}

        {/* Collections Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>COLLECTIONS</Text>
          <TouchableOpacity style={styles.sectionItem}>
            <Text style={styles.sectionItemText}>View All Collections</Text>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={theme.colors.gray400}
            />
          </TouchableOpacity>
        </View>

        {/* Reviews Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>REVIEWS ({reviews.length})</Text>
            <TouchableOpacity onPress={() => setShowReviewForm(true)}>
              <Text style={styles.sectionAction}>Write Review</Text>
            </TouchableOpacity>
          </View>

          {reviews.slice(0, 3).map((review) => {
            const user = mockData.users.find((u) => u.id === review.userId);
            return (
              <View key={review.id} style={styles.reviewItem}>
                <View style={styles.reviewHeader}>
                  <View style={styles.reviewUser}>
                    <View style={styles.reviewAvatar}>
                      <Text style={styles.reviewAvatarText}>
                        {user?.nickname.slice(0, 2).toUpperCase()}
                      </Text>
                    </View>
                    <View>
                      <Text style={styles.reviewUserName}>
                        {user?.nickname}
                      </Text>
                      <View style={styles.reviewStars}>
                        {renderStars(review.rating)}
                      </View>
                    </View>
                  </View>
                  <Text style={styles.reviewDate}>
                    {new Date(review.createdAt).toLocaleDateString()}
                  </Text>
                </View>

                <Text style={styles.reviewComment}>{review.comment}</Text>

                <View style={styles.reviewActions}>
                  <TouchableOpacity style={styles.helpfulButton}>
                    <Ionicons
                      name="thumbs-up-outline"
                      size={14}
                      color={theme.colors.gray400}
                    />
                    <Text style={styles.helpfulText}>
                      Helpful ({review.helpful})
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}

          {reviews.length > 3 && (
            <TouchableOpacity style={styles.viewAllReviews}>
              <Text style={styles.viewAllReviewsText}>View All Reviews</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      <ReviewForm
        visible={showReviewForm}
        onClose={() => setShowReviewForm(false)}
        designerName={designerData.name}
        onSubmit={handleSubmitReview}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    ...theme.typography.body,
    color: theme.colors.gray400,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    ...theme.typography.body,
    color: theme.colors.error,
  },
  coverContainer: {
    position: "relative",
    height: COVER_HEIGHT,
  },
  coverImage: {
    width: "100%",
    height: "100%",
    backgroundColor: theme.colors.gray100,
  },
  coverOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    justifyContent: "space-between",
    padding: theme.spacing.md,
  },
  backButton: {
    alignSelf: "flex-start",
    padding: theme.spacing.sm,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: theme.borderRadius.full,
  },
  coverActions: {
    flexDirection: "row",
    alignSelf: "flex-end",
    gap: theme.spacing.sm,
  },
  actionButton: {
    padding: theme.spacing.sm,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: theme.borderRadius.full,
  },
  profileSection: {
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray100,
  },
  profileHeader: {
    flexDirection: "row",
    marginBottom: theme.spacing.lg,
  },
  profileImageContainer: {
    marginRight: theme.spacing.md,
    marginTop: -theme.spacing.xxl,
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: theme.colors.white,
    backgroundColor: theme.colors.gray100,
  },
  profileInfo: {
    flex: 1,
    paddingTop: theme.spacing.sm,
  },
  designerName: {
    ...theme.typography.h1,
    color: theme.colors.black,
    marginBottom: theme.spacing.xs,
  },
  designerAliases: {
    ...theme.typography.bodySmall,
    color: theme.colors.gray400,
    fontStyle: "italic",
    marginBottom: theme.spacing.sm,
  },
  metaInfo: {
    marginBottom: theme.spacing.sm,
  },
  metaText: {
    ...theme.typography.caption,
    color: theme.colors.gray400,
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: theme.spacing.xs,
  },
  starsContainer: {
    flexDirection: "row",
    marginRight: theme.spacing.sm,
  },
  ratingText: {
    ...theme.typography.caption,
    color: theme.colors.gray400,
  },
  statsContainer: {
    marginTop: theme.spacing.xs,
  },
  statText: {
    ...theme.typography.caption,
    color: theme.colors.gray400,
  },
  actionButtonsContainer: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  followButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.black,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.white,
  },
  followButtonActive: {
    backgroundColor: theme.colors.black,
  },
  followButtonText: {
    ...theme.typography.button,
    color: theme.colors.black,
    marginLeft: theme.spacing.xs,
    fontSize: 14,
  },
  followButtonTextActive: {
    color: theme.colors.white,
  },
  reviewButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.white,
  },
  reviewButtonText: {
    ...theme.typography.button,
    color: theme.colors.black,
    marginLeft: theme.spacing.xs,
    fontSize: 14,
  },
  bioSection: {
    marginBottom: theme.spacing.lg,
  },
  bioText: {
    ...theme.typography.body,
    color: theme.colors.gray500,
    lineHeight: 24,
  },
  section: {
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray100,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    ...theme.typography.caption,
    color: theme.colors.gray400,
    letterSpacing: 1,
  },
  sectionDescription: {
    ...theme.typography.bodySmall,
    color: theme.colors.gray500,
    marginBottom: theme.spacing.md,
    lineHeight: 18,
  },
  sectionAction: {
    ...theme.typography.caption,
    color: theme.colors.black,
    textDecorationLine: "underline",
  },
  sectionItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: theme.spacing.sm,
  },
  sectionItemText: {
    ...theme.typography.body,
    color: theme.colors.black,
  },
  reviewItem: {
    marginBottom: theme.spacing.lg,
  },
  reviewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: theme.spacing.sm,
  },
  reviewUser: {
    flexDirection: "row",
    alignItems: "center",
  },
  reviewAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.black,
    justifyContent: "center",
    alignItems: "center",
    marginRight: theme.spacing.sm,
  },
  reviewAvatarText: {
    ...theme.typography.caption,
    color: theme.colors.white,
    fontWeight: "500",
  },
  reviewUserName: {
    ...theme.typography.bodySmall,
    color: theme.colors.black,
    fontWeight: "500",
    marginBottom: 2,
  },
  reviewStars: {
    flexDirection: "row",
  },
  reviewDate: {
    ...theme.typography.caption,
    color: theme.colors.gray400,
  },
  reviewComment: {
    ...theme.typography.bodySmall,
    color: theme.colors.gray500,
    lineHeight: 20,
    marginBottom: theme.spacing.sm,
  },
  reviewActions: {
    flexDirection: "row",
  },
  helpfulButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    backgroundColor: theme.colors.gray100,
    borderRadius: theme.borderRadius.sm,
  },
  helpfulText: {
    ...theme.typography.caption,
    color: theme.colors.gray400,
    marginLeft: theme.spacing.xs,
  },
  viewAllReviews: {
    alignItems: "center",
    paddingVertical: theme.spacing.md,
  },
  viewAllReviewsText: {
    ...theme.typography.bodySmall,
    color: theme.colors.black,
    textDecorationLine: "underline",
  },
});

export default DesignerDetailScreen;
