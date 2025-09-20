# 字体文件说明

## 📝 概述

此目录包含应用所需的字体文件。当前为占位符文件，在生产环境中需要替换为真实的字体文件。

## 🔤 所需字体

### Playfair Display (衬线字体 - 用于标题)

- `PlayfairDisplay-Regular.ttf` - 常规体
- `PlayfairDisplay-Bold.ttf` - 粗体

### Inter (无衬线字体 - 用于正文)

- `Inter-Regular.ttf` - 常规体
- `Inter-Medium.ttf` - 中等粗细
- `Inter-Bold.ttf` - 粗体

## 📥 获取字体

### 方式一：Google Fonts

1. 访问 [Google Fonts](https://fonts.google.com/)
2. 搜索并下载 "Playfair Display" 和 "Inter" 字体
3. 选择所需的字重
4. 下载 TTF 格式文件
5. 替换此目录中的占位符文件

### 方式二：直接下载

- **Playfair Display**: https://fonts.google.com/specimen/Playfair+Display
- **Inter**: https://fonts.google.com/specimen/Inter

## 🛠️ 开发模式

在开发模式下，应用会自动使用系统字体以避免字体加载错误：

- 标题使用系统衬线字体 (`serif`)
- 正文使用系统无衬线字体 (`sans-serif`)

## 🚀 生产模式

在生产构建中，应用会尝试加载自定义字体。请确保：

1. 所有字体文件都是有效的 TTF 格式
2. 文件名与代码中的引用完全匹配
3. 文件大小合理（建议每个文件 < 500KB）

## ⚠️ 注意事项

- 确保字体文件具有适当的许可证
- Google Fonts 的字体通常可以免费用于商业项目
- 替换字体文件后需要重新构建应用

## 🔧 故障排除

如果遇到字体加载问题：

1. 检查文件名是否正确
2. 确认文件格式为 TTF
3. 查看 Metro 打包器的错误信息
4. 清除缓存：`npx expo start --clear`
