import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme";
import { useAuthStore } from "../store/authStore";
import { useAlert } from "./AlertProvider";

interface ReviewFormProps {
  visible: boolean;
  onClose: () => void;
  designerName: string;
  onSubmit: (rating: number, comment: string) => void;
}

const ReviewForm: React.FC<ReviewFormProps> = ({
  visible,
  onClose,
  designerName,
  onSubmit,
}) => {
  const { user } = useAuthStore();
  const { showError, showSuccess } = useAlert();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      showError("Error", "Please select a rating");
      return;
    }

    if (comment.trim().length < 10) {
      showError("Error", "Please write at least 10 characters");
      return;
    }

    setIsSubmitting(true);

    try {
      await onSubmit(rating, comment.trim());
      setRating(0);
      setComment("");
      onClose();
      showSuccess("Success", "Your review has been submitted!");
    } catch (error) {
      showError("Error", "Failed to submit review. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStarRating = () => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <TouchableOpacity
          key={i}
          onPress={() => setRating(i)}
          style={styles.starButton}
        >
          <Ionicons
            name={i <= rating ? "star" : "star-outline"}
            size={32}
            color={i <= rating ? theme.colors.accent : theme.colors.gray300}
          />
        </TouchableOpacity>
      );
    }
    return stars;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={theme.colors.black} />
          </TouchableOpacity>

          <Text style={styles.title}>Write Review</Text>

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={isSubmitting || rating === 0}
            style={[
              styles.submitButton,
              (isSubmitting || rating === 0) && styles.submitButtonDisabled,
            ]}
          >
            <Text
              style={[
                styles.submitButtonText,
                (isSubmitting || rating === 0) &&
                  styles.submitButtonTextDisabled,
              ]}
            >
              {isSubmitting ? "Posting..." : "Post"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <Text style={styles.designerName}>{designerName}</Text>

          <View style={styles.ratingSection}>
            <Text style={styles.ratingLabel}>
              How would you rate this designer?
            </Text>
            <View style={styles.starsContainer}>{renderStarRating()}</View>
            {rating > 0 && (
              <Text style={styles.ratingDescription}>
                {rating === 1 && "Poor"}
                {rating === 2 && "Fair"}
                {rating === 3 && "Good"}
                {rating === 4 && "Very Good"}
                {rating === 5 && "Excellent"}
              </Text>
            )}
          </View>

          <View style={styles.commentSection}>
            <Text style={styles.commentLabel}>Share your thoughts</Text>
            <TextInput
              style={styles.commentInput}
              value={comment}
              onChangeText={setComment}
              placeholder={`What do you think about ${designerName}'s work? Share your experience with their designs, quality, and aesthetic...`}
              placeholderTextColor={theme.colors.gray300}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />
            <Text style={styles.characterCount}>
              {comment.length}/500 characters
            </Text>
          </View>

          <View style={styles.guidelines}>
            <Text style={styles.guidelinesTitle}>Review Guidelines</Text>
            <Text style={styles.guidelinesText}>
              • Focus on the designer's aesthetic and craftsmanship{"\n"}• Be
              respectful and constructive{"\n"}• Share specific experiences with
              their pieces{"\n"}• Help others discover great fashion
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray100,
  },
  closeButton: {
    padding: theme.spacing.sm,
  },
  title: {
    ...theme.typography.h3,
    color: theme.colors.black,
  },
  submitButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.black,
    borderRadius: theme.borderRadius.sm,
  },
  submitButtonDisabled: {
    backgroundColor: theme.colors.gray200,
  },
  submitButtonText: {
    ...theme.typography.button,
    color: theme.colors.white,
    fontSize: 14,
  },
  submitButtonTextDisabled: {
    color: theme.colors.gray400,
  },
  content: {
    flex: 1,
    padding: theme.spacing.md,
  },
  designerName: {
    ...theme.typography.h2,
    color: theme.colors.black,
    textAlign: "center",
    marginBottom: theme.spacing.xl,
  },
  ratingSection: {
    alignItems: "center",
    marginBottom: theme.spacing.xxl,
  },
  ratingLabel: {
    ...theme.typography.body,
    color: theme.colors.black,
    marginBottom: theme.spacing.md,
  },
  starsContainer: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  starButton: {
    padding: theme.spacing.xs,
  },
  ratingDescription: {
    ...theme.typography.bodySmall,
    color: theme.colors.accent,
    fontWeight: "500",
  },
  commentSection: {
    marginBottom: theme.spacing.xl,
  },
  commentLabel: {
    ...theme.typography.bodySmall,
    color: theme.colors.black,
    marginBottom: theme.spacing.sm,
    fontWeight: "500",
  },
  commentInput: {
    ...theme.typography.body,
    borderWidth: 1,
    borderColor: theme.colors.gray200,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    color: theme.colors.black,
    backgroundColor: theme.colors.white,
    minHeight: 120,
  },
  characterCount: {
    ...theme.typography.caption,
    color: theme.colors.gray400,
    textAlign: "right",
    marginTop: theme.spacing.xs,
  },
  guidelines: {
    backgroundColor: theme.colors.gray100,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
  },
  guidelinesTitle: {
    ...theme.typography.bodySmall,
    color: theme.colors.black,
    fontWeight: "500",
    marginBottom: theme.spacing.sm,
  },
  guidelinesText: {
    ...theme.typography.caption,
    color: theme.colors.gray500,
    lineHeight: 16,
  },
});

export default ReviewForm;
