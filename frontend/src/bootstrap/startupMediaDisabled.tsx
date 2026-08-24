import React from "react";

/** Splash / onboarding videos are excluded from the bundle in this mode. */
export const ENABLE_SPLASH_VIDEO = false;
export const ENABLE_ONBOARDING_GUIDE = false;

export function SplashVideoSlot(_props: { onFinish: () => void }): null {
  return null;
}

export function OnboardingGuideSlot(_props: {
  visible: boolean;
  onComplete: () => void;
}): null {
  return null;
}
