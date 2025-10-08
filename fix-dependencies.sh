#!/bin/bash

echo "🔧 修复 gluestack-ui 依赖问题..."

# 停止所有 expo 进程
echo "1️⃣ 停止现有进程..."
pkill -f "expo" 2>/dev/null || true
pkill -f "metro" 2>/dev/null || true

# 安装缺失的依赖
echo "2️⃣ 安装缺失的依赖..."
npm install react-dom@18.2.0 react-native-web@~0.19.6 --legacy-peer-deps

# 清除所有缓存
echo "3️⃣ 清除缓存..."
rm -rf node_modules/.cache
rm -rf .expo
watchman watch-del-all 2>/dev/null || true

echo "✅ 修复完成！"
echo ""
echo "现在运行以下命令启动应用："
echo "  npx expo start --clear"

