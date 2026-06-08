import React from "react";
import { LogBox } from "react-native";
import { registerRootComponent } from "expo";
import * as SplashScreen from "expo-splash-screen";

import { installCrashGuard } from "./src/bootstrap/installCrashGuard";
import { persistCrash, toCrashInfo } from "./src/bootstrap/crashStorage";
import { Bootstrap } from "./src/bootstrap/Bootstrap";

installCrashGuard();

// Last-resort safety net against the "stuck on the splash logo" failure.
// The native splash is held by App.tsx's `preventAutoHideAsync()` and is only
// supposed to be hidden once <App> settles. If anything upstream of <App>
// stalls or diverts (Bootstrap stuck reading AsyncStorage, a persisted crash
// routing to <CrashScreen>, App never mounting, hideAsync() silently failing
// on a production device), the splash would otherwise sit on top forever and
// the user just sees the frozen logo. This timer is fully decoupled from the
// React tree, so the splash is guaranteed to come down no matter what.
setTimeout(() => {
  SplashScreen.hideAsync().catch(() => {
    // Best-effort: already hidden, or splash module unavailable.
  });
}, 8000);

if (__DEV__) {
  LogBox.ignoreLogs([/Task orphaned for request/]);
}

let appLoad;
try {
  const App = require("./App").default;
  appLoad = { ok: true, App };
} catch (error) {
  const info = toCrashInfo(error, "moduleLoad", true);
  persistCrash(info);
  // eslint-disable-next-line no-console
  console.error(
    `[CrashGuard][moduleLoad] ${info.name}: ${info.message}\n${info.stack}`,
  );
  appLoad = { ok: false, error: info };
}

function Root() {
  return React.createElement(Bootstrap, { appLoad });
}

registerRootComponent(Root);
