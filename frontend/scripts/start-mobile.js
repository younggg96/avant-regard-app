#!/usr/bin/env node

const { execSync } = require("child_process");
const path = require("path");

console.log("🚀 Starting Avant Regard Mobile App...\n");

// Check if we're in the right directory
const rootDir = path.join(__dirname, "..");

try {
  // Change to root directory and start Expo
  process.chdir(rootDir);

  console.log("📱 Starting Expo development server...");
  console.log("📍 Location:", rootDir);
  console.log("");

  // Start Expo with clear cache option
  execSync("npx expo start --clear", { stdio: "inherit" });
} catch (error) {
  console.error("❌ Error starting the mobile app:", error.message);
  process.exit(1);
}
