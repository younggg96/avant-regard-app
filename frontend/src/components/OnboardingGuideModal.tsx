import React, { useRef, useState, useCallback, useEffect } from "react";
import {
  View,
  Modal,
  ScrollView,
  Dimensions,
  TouchableOpacity,
  Text,
  StyleSheet,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useVideoPlayer, VideoView } from "expo-video";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "../theme";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const GUIDE_VIDEOS = [
  require("../../assets/guide-mov/1.mov"),
  require("../../assets/guide-mov/2.mov"),
  require("../../assets/guide-mov/3.mov"),
  require("../../assets/guide-mov/4.mov"),
  require("../../assets/guide-mov/5.mov"),
  require("../../assets/guide-mov/6.mov"),
  require("../../assets/guide-mov/7.mov"),
  require("../../assets/guide-mov/8.mov"),
  require("../../assets/guide-mov/9.mov"),
  require("../../assets/guide-mov/11.mov"),
];

interface VideoSlideProps {
  source: any;
  isActive: boolean;
}

const VideoSlide: React.FC<VideoSlideProps> = ({ source, isActive }) => {
  const player = useVideoPlayer(source, (p) => {
    p.loop = true;
    p.muted = true;
  });

  useEffect(() => {
    if (isActive) {
      player.play();
    } else {
      player.pause();
      player.currentTime = 0;
    }
  }, [isActive, player]);

  return (
    <View style={styles.slide}>
      <VideoView
        player={player}
        style={styles.video}
        contentFit="contain"
        nativeControls={false}
        allowsPictureInPicture={false}
      />
    </View>
  );
};

interface OnboardingGuideModalProps {
  visible: boolean;
  onComplete: () => void;
}

const OnboardingGuideModal: React.FC<OnboardingGuideModalProps> = ({
  visible,
  onComplete,
}) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const isLastSlide = currentIndex === GUIDE_VIDEOS.length - 1;

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      const index = Math.round(offsetX / SCREEN_WIDTH);
      setCurrentIndex(index);
    },
    []
  );

  const handleNext = () => {
    if (isLastSlide) {
      onComplete();
    } else {
      scrollViewRef.current?.scrollTo({
        x: (currentIndex + 1) * SCREEN_WIDTH,
        animated: true,
      });
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      statusBarTranslucent
    >
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          bounces={false}
          onMomentumScrollEnd={handleScroll}
          scrollEventThrottle={16}
          style={styles.scrollView}
        >
          {GUIDE_VIDEOS.map((source, index) => (
            <VideoSlide
              key={index}
              source={source}
              isActive={index === currentIndex}
            />
          ))}
        </ScrollView>

        <View style={styles.bottomContainer}>
          <View style={styles.dotsContainer}>
            {GUIDE_VIDEOS.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.dot,
                  index === currentIndex ? styles.dotActive : styles.dotInactive,
                ]}
              />
            ))}
          </View>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleNext}
            activeOpacity={0.8}
          >
            <Text style={styles.actionButtonText}>
              {isLastSlide ? t("onboarding.startExperience") : t("onboarding.nextStep")}
            </Text>
          </TouchableOpacity>

          {!isLastSlide && (
            <TouchableOpacity onPress={handleSkip} activeOpacity={0.7}>
              <Text style={styles.skipText}>{t("onboarding.skip")}</Text>
            </TouchableOpacity>
          )}
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
  skipText: {
    fontSize: 14,
    fontFamily: "PlayfairDisplay-Medium",
    color: theme.colors.gray300,
    textDecorationLine: "underline",
  },
  scrollView: {
    flex: 1,
  },
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  video: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.72,
  },
  bottomContainer: {
    paddingHorizontal: 24,
    paddingBottom: 20,
    alignItems: "center",
    gap: 16,
  },
  dotsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    borderRadius: 4,
  },
  dotActive: {
    width: 24,
    height: 8,
    backgroundColor: theme.colors.black,
    borderRadius: 4,
  },
  dotInactive: {
    width: 8,
    height: 8,
    backgroundColor: theme.colors.gray200,
    borderRadius: 4,
  },
  actionButton: {
    width: "100%",
    backgroundColor: theme.colors.black,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: "center",
  },
  actionButtonText: {
    fontSize: 16,
    fontFamily: "PlayfairDisplay-Bold",
    color: theme.colors.white,
  },
  stepCounter: {
    fontSize: 12,
    fontFamily: "PlayfairDisplay-Regular",
    color: theme.colors.gray200,
  },
});

export default OnboardingGuideModal;
