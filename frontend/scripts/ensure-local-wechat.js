#!/usr/bin/env node
/**
 * Keep `expo-native-wechat` installed locally inside frontend/node_modules.
 *
 * 背景：这是一个 npm workspaces monorepo。npm 会把 expo-native-wechat
 * hoist 到根 node_modules/，但它的 app.plugin.js 里写的是
 * `require("expo/config-plugins")`，而 expo 只存在于
 * frontend/node_modules/expo，在根目录里找不到，导致 `expo prebuild`
 * 时报 "Cannot find module 'expo/config-plugins'"。
 *
 * 解决：postinstall 时若发现它被 hoist，就搬回 frontend/node_modules/。
 */
const fs = require("node:fs");
const path = require("node:path");

const PKG = "expo-native-wechat";
const frontendDir = path.resolve(__dirname, "..");
const localPath = path.join(frontendDir, "node_modules", PKG);
const rootPath = path.join(frontendDir, "..", "node_modules", PKG);

function main() {
  const hasLocal = fs.existsSync(localPath);
  const hasRoot = fs.existsSync(rootPath);

  if (hasLocal) {
    // 已经在本地，若根目录还有一份就清理掉避免混淆
    if (hasRoot) {
      fs.rmSync(rootPath, { recursive: true, force: true });
      console.log(`[ensure-local-wechat] removed duplicate at ${rootPath}`);
    }
    return;
  }

  if (!hasRoot) {
    // 两边都没有，说明还没 npm install，跳过
    return;
  }

  fs.mkdirSync(path.dirname(localPath), { recursive: true });
  fs.renameSync(rootPath, localPath);
  console.log(`[ensure-local-wechat] moved ${PKG} from root to frontend/node_modules/`);
}

try {
  main();
} catch (error) {
  console.error("[ensure-local-wechat] failed:", error);
  // 不阻塞安装流程
  process.exit(0);
}
