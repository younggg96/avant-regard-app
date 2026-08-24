import React from "react";

import SplashVideo from "../components/SplashVideo";
import OnboardingGuideModal from "../components/OnboardingGuideModal";

/** Splash / onboarding videos are included in the bundle in this mode. */
export const ENABLE_SPLASH_VIDEO = true;
export const ENABLE_ONBOARDING_GUIDE = true;

export function SplashVideoSlot({ onFinish }: { onFinish: () => void }) {
  return <SplashVideo onFinish={onFinish} />;
}

export function OnboardingGuideSlot({
  visible,
  onComplete,
}: {
  visible: boolean;
  onComplete: () => void;
}) {
  return <OnboardingGuideModal visible={visible} onComplete={onComplete} />;
}
