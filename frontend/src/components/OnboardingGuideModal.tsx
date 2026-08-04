import React, { useRef, useState, useCallback, useEffect } from "react";
import {
  View,
  Modal,
  ScrollView,
  TouchableOpacity,
  Text,
  StyleSheet,
  NativeSyntheticEvent,
  NativeScrollEvent,
  useWindowDimensions,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useVideoPlayer, VideoView } from "expo-video";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemedStyles, type AppTheme } from "../theme";

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
  width: number;
}

const VideoSlide: React.FC<VideoSlideProps> = ({ source, isActive, width }) => {
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
    <View style={[slideStyles.slide, { width }]} pointerEvents="box-none">
      {/*
        pointerEvents="none": native VideoView (esp. iOS AVPlayerLayer) often
        draws past its layout bounds and steals taps from the Next/Skip row
        below. Guide videos are display-only; swipes go to the ScrollView.
      */}
      <VideoView
        player={player}
        style={slideStyles.video}
        contentFit="contain"
        nativeControls={false}
        allowsPictureInPicture={false}
        pointerEvents="none"
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
  const { width: windowWidth } = useWindowDimensions();
  const styles = useThemedStyles(makeStyles);
  const scrollViewRef = useRef<ScrollView>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  // Prefer measured ScrollView width — module-level Dimensions can disagree
  // with the Modal's actual page width on some devices.
  const [pageWidth, setPageWidth] = useState(windowWidth);

  const isLastSlide = currentIndex === GUIDE_VIDEOS.length - 1;

  useEffect(() => {
    if (visible) {
      setCurrentIndex(0);
      requestAnimationFrame(() => {
        scrollViewRef.current?.scrollTo({ x: 0, animated: false });
      });
    }
  }, [visible]);

  useEffect(() => {
    setPageWidth(windowWidth);
  }, [windowWidth]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const width = pageWidth || windowWidth;
      if (width <= 0) return;
      const offsetX = event.nativeEvent.contentOffset.x;
      const index = Math.max(
        0,
        Math.min(Math.round(offsetX / width), GUIDE_VIDEOS.length - 1)
      );
      setCurrentIndex(index);
    },
    [pageWidth, windowWidth]
  );

  const handleNext = () => {
    if (isLastSlide) {
      onComplete();
      return;
    }
    // Android 上程序触发的 scrollTo 不会回调 onMomentumScrollEnd，
    // 必须在这里主动推进索引，否则会一直"卡"在当前页。
    const width = pageWidth || windowWidth;
    const nextIndex = currentIndex + 1;
    setCurrentIndex(nextIndex);
    scrollViewRef.current?.scrollTo({
      x: nextIndex * width,
      animated: true,
    });
  };

  const handleSkip = () => {
    onComplete();
  };

  if (!visible) return null;

  const slideWidth = pageWidth || windowWidth;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      statusBarTranslucent
    >
      <View
        style={[
          styles.container,
          { paddingTop: insets.top, paddingBottom: insets.bottom },
        ]}
      >
        <ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          bounces={false}
          onMomentumScrollEnd={handleScroll}
          scrollEventThrottle={16}
          style={styles.scrollView}
          onLayout={(e) => {
            const w = e.nativeEvent.layout.width;
            if (w > 0 && Math.abs(w - pageWidth) > 0.5) {
              setPageWidth(w);
            }
          }}
        >
          {GUIDE_VIDEOS.map((source, index) =>
            // 只挂载当前页及相邻页的播放器（最多 3 个原生实例），
            // 其余渲染等宽占位，避免 10 个播放器同时解码导致 OOM 崩溃。
            Math.abs(index - currentIndex) <= 1 ? (
              <VideoSlide
                key={index}
                source={source}
                isActive={index === currentIndex}
                width={slideWidth}
              />
            ) : (
              <View key={index} style={[slideStyles.slide, { width: slideWidth }]} />
            )
          )}
        </ScrollView>

        <View style={styles.bottomContainer} pointerEvents="box-none">
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
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.actionButtonText}>
              {isLastSlide
                ? t("onboarding.startExperience")
                : t("onboarding.nextStep")}
            </Text>
          </TouchableOpacity>

          {!isLastSlide && (
            <TouchableOpacity
              onPress={handleSkip}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 16, right: 16 }}
            >
              <Text style={styles.skipText}>{t("onboarding.skip")}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
};

const slideStyles = StyleSheet.create({
  slide: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  video: {
    width: "100%",
    height: "100%",
  },
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.colors.background,
    },
    skipText: {
      fontSize: 14,
      fontFamily: "PlayfairDisplay-Medium",
      color: t.colors.gray300,
      textDecorationLine: "underline",
    },
    scrollView: {
      flex: 1,
    },
    bottomContainer: {
      zIndex: 10,
      elevation: 10,
      paddingHorizontal: 24,
      paddingBottom: 20,
      paddingTop: 8,
      alignItems: "center",
      gap: 16,
      backgroundColor: t.colors.background,
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
      backgroundColor: t.colors.text,
      borderRadius: 4,
    },
    dotInactive: {
      width: 8,
      height: 8,
      backgroundColor: t.colors.gray200,
      borderRadius: 4,
    },
    actionButton: {
      width: "100%",
      backgroundColor: t.colors.text,
      borderRadius: 16,
      paddingVertical: 18,
      alignItems: "center",
    },
    actionButtonText: {
      fontSize: 16,
      fontFamily: "PlayfairDisplay-Bold",
      color: t.colors.textInverted,
    },
    stepCounter: {
      fontSize: 12,
      fontFamily: "PlayfairDisplay-Regular",
      color: t.colors.gray200,
    },
  });

export default OnboardingGuideModal;
