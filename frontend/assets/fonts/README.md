# 字体文件说明

## 📝 概述

此目录包含应用所需的字体文件。应用统一使用 Playfair Display 字体系列。

## 🔤 所需字体

### Playfair Display (衬线字体 - 全局使用)

- `PlayfairDisplay-Regular.ttf` - 常规体
- `PlayfairDisplay-Medium.ttf` - 中等粗细
- `PlayfairDisplay-Bold.ttf` - 粗体

## 📥 获取字体

### 方式一：Google Fonts

1. 访问 [Google Fonts](https://fonts.google.com/)
2. 搜索并下载 "Playfair Display" 字体
3. 选择 Regular (400)、Medium (500)、Bold (700) 字重
4. 下载 TTF 格式文件
5. 替换此目录中的占位符文件

### 方式二：直接下载

- **Playfair Display**: https://fonts.google.com/specimen/Playfair+Display

## 🛠️ 开发模式

在开发模式下，应用会自动使用系统衬线字体 (`Georgia`) 以避免字体加载错误。

## 🚀 生产模式

在生产构建中，应用会尝试加载自定义字体。请确保：

1. 所有字体文件都是有效的 TTF 格式
2. 文件名与代码中的引用完全匹配
3. 文件大小合理（建议每个文件 < 500KB）

## ⚠️ 注意事项

- 确保字体文件具有适当的许可证
- Google Fonts 的字体通常可以免费用于商业项目
- 替换字体文件后需要重新构建应用
- 当前 `PlayfairDisplay-Medium.ttf` 为占位符（Regular 的副本），生产环境请替换为真实的 Medium 字重文件

## 🔧 故障排除

如果遇到字体加载问题：

1. 检查文件名是否正确
2. 确认文件格式为 TTF
3. 查看 Metro 打包器的错误信息
4. 清除缓存：`npx expo start --clear`
