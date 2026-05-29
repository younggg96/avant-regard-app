#!/usr/bin/env node
/**
 * EAS Build hook (`eas-build-post-install`) — runs on EAS after dependencies
 * are installed and BEFORE `expo prebuild` / `pod install`.
 *
 * Why this exists
 * ---------------
 * `expo-native-wechat` autolinks the `WechatOpenSDK-XCFramework` CocoaPod,
 * whose binary is downloaded from Tencent's China CDN (dldir1.qq.com). EAS
 * build workers run in the US and cannot reliably reach that CDN, so the NA
 * build fails in the "Install pods" phase with:
 *   [!] Error installing WechatOpenSDK-XCFramework
 *   curl: (52) Empty reply from server
 *
 * The North America app does not use WeChat login/share (it's a China-only
 * feature), and `shareService.ts` already loads the native module lazily via
 * a try/catch and silently degrades to the system share sheet when it's
 * absent. So for the NA flavor we exclude the module from autolinking: the JS
 * package stays in node_modules (Metro can still resolve `require(...)`), but
 * the native pod is never linked and the China CDN is never contacted.
 *
 * Scope: this ONLY mutates package.json when APP_VARIANT === "na". The China
 * (CN) flavor and all local dev flows never run this hook, so they keep the
 * WeChat integration untouched. On EAS every build starts from a fresh clone,
 * so the mutation is ephemeral per build.
 */
const fs = require("node:fs");
const path = require("node:path");

const MODULE_NAME = "expo-native-wechat";

function main() {
  if (process.env.APP_VARIANT !== "na") {
    console.log(
      `[eas-exclude-wechat-na] APP_VARIANT is "${process.env.APP_VARIANT ?? ""}" (not "na") — leaving ${MODULE_NAME} autolinked.`,
    );
    return;
  }

  const pkgPath = path.resolve(__dirname, "..", "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

  pkg.expo = pkg.expo || {};
  pkg.expo.autolinking = pkg.expo.autolinking || {};
  const exclude = new Set(pkg.expo.autolinking.exclude || []);
  exclude.add(MODULE_NAME);
  pkg.expo.autolinking.exclude = [...exclude];

  fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
  console.log(
    `[eas-exclude-wechat-na] NA build — excluded ${MODULE_NAME} from autolinking (WeChat native module / China-CDN pod skipped).`,
  );
}

main();
