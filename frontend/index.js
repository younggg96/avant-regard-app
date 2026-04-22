import React from "react";
import { LogBox } from "react-native";
import { registerRootComponent } from "expo";

import { installCrashGuard } from "./src/bootstrap/installCrashGuard";
import { persistCrash, toCrashInfo } from "./src/bootstrap/crashStorage";
import { Bootstrap } from "./src/bootstrap/Bootstrap";

installCrashGuard();

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
