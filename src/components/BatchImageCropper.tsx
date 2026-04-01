import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  ScrollView,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { ImageCropper, AspectRatio } from "./ImageCropper";
import { theme } from "../theme";

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
  const [isCropping, setIsCropping] = useState(true);

  const totalCount = sourceUris.length;
  const allCropped = croppedResults.every((uri) => uri !== null);

  const handleCropDone = useCallback(
    (resultUri: string) => {
      const newResults = [...croppedResults];
      newResults[currentIndex] = resultUri;
      setCroppedResults(newResults);

      const nextUncropped = newResults.findIndex(
        (uri, idx) => uri === null && idx > currentIndex
      );

      if (nextUncropped !== -1) {
        setCurrentIndex(nextUncropped);
      } else {
        const anyUncropped = newResults.findIndex((uri) => uri === null);
        if (anyUncropped !== -1) {
          setCurrentIndex(anyUncropped);
        } else {
          setIsCropping(false);
        }
      }
    },
    [croppedResults, currentIndex]
  );

  const handleCropCancel = useCallback(() => {
    onCancel();
  }, [onCancel]);

  const handleThumbnailPress = useCallback(
    (index: number) => {
      if (!isCropping) {
        setCurrentIndex(index);
        setIsCropping(true);
      } else if (croppedResults[currentIndex] !== null || index !== currentIndex) {
        setCurrentIndex(index);
      }
    },
    [isCropping, croppedResults, currentIndex]
  );

  const handleFinishAll = useCallback(() => {
    const finalUris = croppedResults.map(
      (uri, idx) => uri ?? sourceUris[idx]
    );
    onDone(finalUris);
  }, [croppedResults, sourceUris, onDone]);

  const handleSkipCrop = useCallback(() => {
    const newResults = [...croppedResults];
    newResults[currentIndex] = sourceUris[currentIndex];
    setCroppedResults(newResults);

    const nextUncropped = newResults.findIndex(
      (uri, idx) => uri === null && idx > currentIndex
    );

    if (nextUncropped !== -1) {
      setCurrentIndex(nextUncropped);
    } else {
      const anyUncropped = newResults.findIndex((uri) => uri === null);
      if (anyUncropped !== -1) {
        setCurrentIndex(anyUncropped);
      } else {
        setIsCropping(false);
      }
    }
  }, [croppedResults, currentIndex, sourceUris]);

  if (isCropping) {
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
  }

  return (
    <SafeAreaView style={styles.resultContainer} edges={["top", "bottom"]}>
      <View style={styles.resultHeader}>
        <TouchableOpacity onPress={onCancel} style={styles.headerButton}>
          <Text style={styles.headerButtonText}>取消</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          裁剪完成 ({croppedResults.filter((u) => u !== null).length}/
          {totalCount})
        </Text>
        <TouchableOpacity
          style={[styles.headerButton, !allCropped && styles.headerButtonDisabled]}
          onPress={handleFinishAll}
          disabled={!allCropped}
        >
          <Text
            style={[
              styles.confirmText,
              !allCropped && styles.confirmTextDisabled,
            ]}
          >
            确认添加
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.resultGrid}
        showsVerticalScrollIndicator={false}
      >
        {croppedResults.map((uri, index) => (
          <TouchableOpacity
            key={`result-${index}`}
            style={styles.resultItem}
            onPress={() => {
              setCurrentIndex(index);
              setIsCropping(true);
            }}
            activeOpacity={0.7}
          >
            <Image
              source={{ uri: uri ?? sourceUris[index] }}
              style={styles.resultImage}
              contentFit="cover"
            />
            <View style={styles.resultOverlay}>
              <Ionicons name="crop" size={20} color="white" />
              <Text style={styles.resultOverlayText}>重新裁剪</Text>
            </View>
            <View style={styles.resultIndexBadge}>
              <Text style={styles.resultIndexText}>{index + 1}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
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
  resultContainer: {
    flex: 1,
    backgroundColor: "black",
  },
  resultHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerButton: {
    minWidth: 80,
  },
  headerButtonDisabled: {
    opacity: 0.4,
  },
  headerButtonText: {
    color: "white",
    fontSize: 16,
  },
  headerTitle: {
    color: "white",
    fontSize: 17,
    fontWeight: "600",
  },
  confirmText: {
    color: theme.colors.accent,
    fontSize: 16,
    fontWeight: "600",
    textAlign: "right",
  },
  confirmTextDisabled: {
    color: "rgba(255,255,255,0.4)",
  },
  resultGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 8,
    gap: 8,
  },
  resultItem: {
    width: "31%",
    aspectRatio: 1,
    borderRadius: 8,
    overflow: "hidden",
  },
  resultImage: {
    width: "100%",
    height: "100%",
  },
  resultOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  resultOverlayText: {
    color: "white",
    fontSize: 12,
    marginTop: 4,
  },
  resultIndexBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  resultIndexText: {
    color: "white",
    fontSize: 11,
    fontWeight: "600",
  },
});

export default BatchImageCropper;
