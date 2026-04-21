import { LogBox } from "react-native";
import { registerRootComponent } from "expo";

import App from "./App";

// iOS NSURLSession noise: `Task orphaned for request ...` fires in dev when
// the image pipeline (expo-image / RN `Image.getSize`) loses its reference to
// an in-flight NSURLSessionTask — usually because MasonryFlashList recycled a
// card mid-download. Harmless (release builds never emit it; iOS reaps the
// task on its own) but floods the dev log. Tracked upstream in expo#24614 and
// RN#31837.
if (__DEV__) {
  LogBox.ignoreLogs([/Task orphaned for request/]);
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
