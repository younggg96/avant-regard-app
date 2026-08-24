/**
 * Startup media entry — SWITCH THIS ONE LINE to include/exclude splash &
 * onboarding videos from the JS bundle / IPA.
 *
 * Metro only packs modules that are statically reachable. Importing the
 * Disabled module means SplashVideo / OnboardingGuideModal (and their
 * require()'d .mp4 / .mov assets) are NOT in the dependency graph.
 *
 * To re-enable:
 *   export { ... } from "./startupMediaEnabled";
 */
export {
  ENABLE_SPLASH_VIDEO,
  ENABLE_ONBOARDING_GUIDE,
  SplashVideoSlot,
  OnboardingGuideSlot,
} from "./startupMediaDisabled";
