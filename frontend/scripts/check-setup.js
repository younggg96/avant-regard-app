#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

console.log("🔍 检查 Avant Regard Frontend 项目设置...\n");

const rootDir = path.join(__dirname, "..");

const checks = [
  {
    name: "检查 Node.js 版本",
    check: () => {
      const version = process.version;
      const major = parseInt(version.slice(1).split(".")[0], 10);
      return major >= 18;
    },
    fix: "请安装 Node.js 18 或更高版本",
  },
  {
    name: "检查 src 目录",
    check: () => fs.existsSync(path.join(rootDir, "src")),
    fix: "请确保 src 目录存在",
  },
  {
    name: "检查 node_modules",
    check: () => fs.existsSync(path.join(rootDir, "node_modules")),
    fix: "请在 frontend/ 目录下运行 npm install（或在仓库根目录运行 npm install）",
  },
  {
    name: "检查 Expo CLI",
    check: () => {
      try {
        execSync("npx expo --version", { stdio: "pipe", cwd: rootDir });
        return true;
      } catch {
        return false;
      }
    },
    fix: "请安装 Expo CLI: npm install -g @expo/cli",
  },
  {
    name: "检查 App.tsx",
    check: () => fs.existsSync(path.join(rootDir, "App.tsx")),
    fix: "请确保 App.tsx 文件存在",
  },
  {
    name: "检查 .env",
    check: () => fs.existsSync(path.join(rootDir, ".env")),
    fix: "请基于 .env.example 在 frontend/ 下创建 .env",
  },
];

let allPassed = true;

for (const check of checks) {
  process.stdout.write(`${check.name}... `);

  if (check.check()) {
    console.log("✅ 通过");
  } else {
    console.log("❌ 失败");
    console.log(`   解决方案: ${check.fix}\n`);
    allPassed = false;
  }
}

console.log("\n" + "=".repeat(50));

if (allPassed) {
  console.log("🎉 所有检查都通过了！");
  console.log("📱 你可以运行 npm run dev 或 npm start 启动应用");
} else {
  console.log("⚠️  请修复上述问题后重新运行检查");
  console.log("🔧 修复后可以再次运行: node scripts/check-setup.js");
}

console.log("=".repeat(50) + "\n");
