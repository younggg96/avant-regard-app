import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  ScrollView,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { ImageCropper, AspectRatio } from "./ImageCropper";

interface BatchImageCropperProps {
  sourceUris: string[];
  aspect?: AspectRatio;
  onCancel: () => void;
  onDone: (croppedUris: string[]) => void;
}

const BatchImageCropper: React.FC<BatchImageCropperProps> = ({
  sourceUris,
  aspect = "free",
  onCancel,
  onDone,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [croppedResults, setCroppedResults] = useState<(string | null)[]>(
    () => new Array(sourceUris.length).fill(null)
  );

  const totalCount = sourceUris.length;

  const finishIfAllDone = useCallback(
    (results: (string | null)[]) => {
      const finalUris = results.map((uri, idx) => uri ?? sourceUris[idx]);
      onDone(finalUris);
    },
    [sourceUris, onDone]
  );

  const advanceOrFinish = useCallback(
    (newResults: (string | null)[], fromIndex: number) => {
      const nextUncropped = newResults.findIndex(
        (uri, idx) => uri === null && idx > fromIndex
      );

      if (nextUncropped !== -1) {
        setCurrentIndex(nextUncropped);
      } else {
        const anyUncropped = newResults.findIndex((uri) => uri === null);
        if (anyUncropped !== -1) {
          setCurrentIndex(anyUncropped);
        } else {
          finishIfAllDone(newResults);
        }
      }
    },
    [finishIfAllDone]
  );

  const handleCropDone = useCallback(
    (resultUri: string) => {
      const newResults = [...croppedResults];
      newResults[currentIndex] = resultUri;
      setCroppedResults(newResults);
      advanceOrFinish(newResults, currentIndex);
    },
    [croppedResults, currentIndex, advanceOrFinish]
  );

  const handleCropCancel = useCallback(() => {
    onCancel();
  }, [onCancel]);

  const handleThumbnailPress = useCallback(
    (index: number) => {
      if (croppedResults[currentIndex] !== null || index !== currentIndex) {
        setCurrentIndex(index);
      }
    },
    [croppedResults, currentIndex]
  );

  const handleSkipCrop = useCallback(() => {
    const newResults = [...croppedResults];
    newResults[currentIndex] = sourceUris[currentIndex];
    setCroppedResults(newResults);
    advanceOrFinish(newResults, currentIndex);
  }, [croppedResults, currentIndex, sourceUris, advanceOrFinish]);

  return (
    <View style={styles.container}>
      <View style={styles.cropperWrapper}>
        <ImageCropper
          key={`cropper-${currentIndex}`}
          sourceUri={
            croppedResults[currentIndex] ?? sourceUris[currentIndex]
          }
          aspect={aspect}
          onCancel={handleCropCancel}
          onDone={handleCropDone}
        />
      </View>

      <View style={styles.bottomBar}>
        <View style={styles.progressRow}>
          <Text style={styles.progressText}>
            {currentIndex + 1} / {totalCount}
          </Text>
          <TouchableOpacity
            style={styles.skipButton}
            onPress={handleSkipCrop}
          >
            <Text style={styles.skipButtonText}>跳过裁剪</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.thumbnailContainer}
        >
          {sourceUris.map((uri, index) => {
            const isCurrent = index === currentIndex;
            const isDone = croppedResults[index] !== null;
            return (
              <TouchableOpacity
                key={`thumb-${index}`}
                style={[
                  styles.thumbnail,
                  isCurrent && styles.thumbnailActive,
                  isDone && !isCurrent && styles.thumbnailDone,
                ]}
                onPress={() => handleThumbnailPress(index)}
                activeOpacity={0.7}
              >
                <Image
                  source={{ uri: croppedResults[index] ?? uri }}
                  style={styles.thumbnailImage}
                  contentFit="cover"
                />
                {isDone && !isCurrent && (
                  <View style={styles.checkOverlay}>
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color="#4CAF50"
                    />
                  </View>
                )}
                <View style={styles.indexBadge}>
                  <Text style={styles.indexBadgeText}>{index + 1}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "black",
  },
  cropperWrapper: {
    flex: 1,
  },
  bottomBar: {
    backgroundColor: "rgba(0,0,0,0.9)",
    paddingBottom: 34,
    paddingTop: 8,
  },
  progressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  progressText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
  skipButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  skipButtonText: {
    color: "white",
    fontSize: 13,
  },
  thumbnailContainer: {
    paddingHorizontal: 12,
    gap: 8,
  },
  thumbnail: {
    width: 56,
    height: 56,
    borderRadius: 6,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
  },
  thumbnailActive: {
    borderColor: "white",
  },
  thumbnailDone: {
    borderColor: "#4CAF50",
  },
  thumbnailImage: {
    width: "100%",
    height: "100%",
  },
  checkOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  indexBadge: {
    position: "absolute",
    top: 2,
    left: 2,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 8,
    width: 16,
    height: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  indexBadgeText: {
    color: "white",
    fontSize: 10,
    fontWeight: "600",
  },
});

export default BatchImageCropper;
